"""Backup already-public storage objects without copying any service credentials."""
import argparse,gzip,hashlib,io,json,os,tarfile,urllib.parse,urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from secure_backup import seal,unseal
ORIGIN='https://ldpiryzsunxwuhyvvogg.supabase.co'
def main():
    p=argparse.ArgumentParser();p.add_argument('--snapshot',required=True);p.add_argument('--private-key',required=True);p.add_argument('--public-key',required=True);p.add_argument('--output',required=True);p.add_argument('--manifest',required=True);a=p.parse_args()
    snapshot=json.loads(gzip.decompress(unseal(Path(a.snapshot).read_bytes(),Path(a.private_key).read_bytes())))
    def table(name):
        t=next(t for t in snapshot['tables'] if t['schema']=='storage' and t['name']==name)
        return json.loads(ET.fromstring(t['data_xml']).findtext('./row/document'))
    buckets={b['id']:b for b in table('buckets')};objects=table('objects');manifest=[];buffer=io.BytesIO()
    with tarfile.open(fileobj=buffer,mode='w:gz') as archive:
        for obj in objects:
            if buckets[obj['bucket_id']].get('public') is not True:raise RuntimeError('Private bucket needs a separate authenticated export')
            url=ORIGIN+'/storage/v1/object/public/'+urllib.parse.quote(obj['bucket_id'],safe='')+'/'+urllib.parse.quote(obj['name'],safe='/')
            request=urllib.request.Request(url,headers={'Accept-Encoding':'identity'})
            with urllib.request.urlopen(request,timeout=30) as response:
                if urllib.parse.urlsplit(response.geturl()).netloc!=urllib.parse.urlsplit(ORIGIN).netloc:raise RuntimeError('Unexpected storage download origin')
                data=response.read(100*1024*1024+1)
                if len(data)>100*1024*1024:raise RuntimeError('Storage object exceeds backup bound')
                expected=obj.get('metadata',{}).get('size')
                if expected is not None and len(data)!=int(expected):raise RuntimeError('Storage object changed since database snapshot')
                old_etag=str(obj.get('metadata',{}).get('eTag') or '').strip('"');new_etag=str(response.headers.get('ETag') or '').strip('"')
                if old_etag and new_etag and old_etag!=new_etag:raise RuntimeError('Storage object version changed')
            hashed=hashlib.sha256((obj['bucket_id']+'/'+obj['name']).encode()).hexdigest()+'.bin'
            entry=tarfile.TarInfo('objects/'+hashed);entry.size=len(data);entry.mode=0o600;archive.addfile(entry,io.BytesIO(data))
            manifest.append({'bucket':obj['bucket_id'],'name':obj['name'],'file':'objects/'+hashed,'size':len(data),'sha256':hashlib.sha256(data).hexdigest(),'metadata':obj.get('metadata')})
        body=json.dumps(manifest,separators=(',',':')).encode();entry=tarfile.TarInfo('storage-manifest.json');entry.size=len(body);entry.mode=0o600;archive.addfile(entry,io.BytesIO(body))
    encrypted=seal(buffer.getvalue(),Path(a.public_key).read_bytes())
    fd=os.open(a.output,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'wb') as f:f.write(encrypted)
    summary={'object_count':len(objects),'downloaded_count':len(manifest),'total_bytes':sum(o['size'] for o in manifest),'encrypted_sha256':hashlib.sha256(encrypted).hexdigest(),'storage_download_verified':True,'storage_upload_restore_verified':False}
    Path(a.manifest).write_text(json.dumps(summary,indent=2)+'\n');os.chmod(a.manifest,0o600);print(json.dumps(summary))
if __name__=='__main__':main()
