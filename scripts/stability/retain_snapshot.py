"""Validate an encrypted connector snapshot and seal it for private retention."""
import argparse, base64, gzip, hashlib, json, os, subprocess
import xml.etree.ElementTree as ET
from pathlib import Path
from secure_backup import seal
def main():
    p=argparse.ArgumentParser();p.add_argument('--transport-dir',required=True);p.add_argument('--public-key',required=True);p.add_argument('--output',required=True);p.add_argument('--manifest',required=True);a=p.parse_args()
    root=Path(a.transport_dir);meta=json.loads((root/'snapshot.transport.json').read_text())
    ciphertext=root/'snapshot.pgp';ciphertext.write_bytes(base64.b64decode((root/'snapshot.pgp.b64').read_text()));os.chmod(ciphertext,0o600)
    home=root/'gpg';home.mkdir(mode=0o700,exist_ok=True)
    result=subprocess.run(['gpg','--no-options','--homedir',str(home),'--batch','--pinentry-mode','loopback','--passphrase-fd','0','--decrypt',str(ciphertext)],input=(meta['transport_key']+'\n').encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if result.returncode:raise RuntimeError('Encrypted snapshot validation failed')
    raw=result.stdout
    if hashlib.sha256(raw).hexdigest()!=meta['plaintext_sha256']:raise RuntimeError('Snapshot checksum mismatch')
    snapshot=json.loads(raw)
    if snapshot.get('format')!='saintsai-logical-snapshot-v1':raise RuntimeError('Snapshot format mismatch')
    counts={};rows=0;storage_objects=0
    for t in snapshot['tables']:
        document=ET.fromstring(t['data_xml']).findtext('./row/document')
        values=json.loads(document)
        if not isinstance(values,list) or not all(isinstance(v,dict) for v in values):raise RuntimeError('Snapshot table data invalid')
        counts[t['schema']]=counts.get(t['schema'],0)+1;rows+=len(values)
        if t['schema']=='storage' and t['name']=='objects':storage_objects=len(values)
    encrypted=seal(gzip.compress(raw),Path(a.public_key).read_bytes())
    fd=os.open(a.output,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'wb') as f:f.write(encrypted)
    manifest={'format':'saintsai-logical-snapshot-v1','created_at':snapshot['created_at'],'server_version':snapshot['server_version'],'table_counts':counts,'row_count':rows,'storage_object_records':storage_objects,'storage_object_bytes_included':False,'restore_verified':False,'plaintext_sha256':meta['plaintext_sha256'],'encrypted_sha256':hashlib.sha256(encrypted).hexdigest()}
    Path(a.manifest).write_text(json.dumps(manifest,indent=2)+'\n');os.chmod(a.manifest,0o600)
    for path in [ciphertext,root/'snapshot.pgp.b64',root/'snapshot.transport.json']:path.unlink()
    print(json.dumps({'snapshot_retained':True,'table_counts':counts,'row_count':rows,'storage_object_records':storage_objects,'restore_verified':False}))
if __name__=='__main__':main()
