"""Verify dashboard downloads against a private snapshot and encrypt an archive."""
import argparse, gzip, hashlib, io, json, os, tarfile, zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from secure_backup import seal, unseal

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--snapshot',required=True);p.add_argument('--private-key',required=True)
    p.add_argument('--public-key',required=True);p.add_argument('--downloads',required=True)
    p.add_argument('--output',required=True);p.add_argument('--report',required=True)
    a=p.parse_args()
    snapshot=json.loads(gzip.decompress(unseal(Path(a.snapshot).read_bytes(),Path(a.private_key).read_bytes())))
    table=next(t for t in snapshot['tables'] if t['schema']=='storage' and t['name']=='objects')
    objects=json.loads(ET.fromstring(table['data_xml']).findtext('./row/document'))
    downloaded={}
    for entry in json.loads(Path(a.downloads).read_text()):
        if entry.get('zip'):
            with zipfile.ZipFile(entry['file']) as z:
                if z.testzip() is not None:raise RuntimeError('Download CRC failure')
                for info in z.infolist():
                    if not info.is_dir():
                        key=(entry['bucket'],info.filename)
                        if key in downloaded:raise RuntimeError('Duplicate download')
                        downloaded[key]=z.read(info)
        else:downloaded[(entry['bucket'],entry['name'])]=Path(entry['file']).read_bytes()
    expected={(o['bucket_id'],o['name']) for o in objects}
    if expected!=set(downloaded):raise RuntimeError('Storage object inventory mismatch')
    archive=io.BytesIO();manifest=[];total=0
    with tarfile.open(fileobj=archive,mode='w:gz') as tar:
        for o in objects:
            data=downloaded[(o['bucket_id'],o['name'])];metadata=o.get('metadata') or {}
            if metadata.get('size') is not None and len(data)!=int(metadata['size']):raise RuntimeError('Storage size mismatch')
            etag=str(metadata.get('eTag','')).strip('"')
            if len(etag)==32 and hashlib.md5(data).hexdigest()!=etag:raise RuntimeError('Storage ETag mismatch')
            digest=hashlib.sha256(data).hexdigest();archive_name='objects/'+digest
            ti=tarfile.TarInfo(archive_name);ti.size=len(data);ti.mode=0o600;tar.addfile(ti,io.BytesIO(data))
            manifest.append({'bucket':o['bucket_id'],'name':o['name'],'archive':archive_name,'size':len(data),'sha256':digest});total+=len(data)
        raw=json.dumps(manifest).encode();ti=tarfile.TarInfo('manifest.json');ti.size=len(raw);ti.mode=0o600;tar.addfile(ti,io.BytesIO(raw))
    sealed=seal(archive.getvalue(),Path(a.public_key).read_bytes())
    # Recover retained ciphertext and inspect every byte hash, not just encryption success.
    recovered=unseal(sealed,Path(a.private_key).read_bytes())
    with tarfile.open(fileobj=io.BytesIO(recovered),mode='r:gz') as tar:
        for item in manifest:
            if hashlib.sha256(tar.extractfile(item['archive']).read()).hexdigest()!=item['sha256']:raise RuntimeError('Storage archive verification failure')
    fd=os.open(a.output,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'wb') as f:f.write(sealed)
    report={'storage_objects_verified':len(objects),'bytes_verified':total,'encrypted_archive_recovery_verified':True,'encrypted_sha256':hashlib.sha256(sealed).hexdigest()}
    Path(a.report).write_text(json.dumps(report,indent=2)+'\n');os.chmod(a.report,0o600)
    print(json.dumps(report))
if __name__=='__main__':main()
