"""Authenticated backup encryption. Payloads and private keys are never logged."""
import argparse, base64, json, os, struct
from pathlib import Path
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
MAGIC=b'SAINTSAI_BACKUP_1\n'
AAD=b'SaintsAI database backup v1'
OAEP=padding.OAEP(mgf=padding.MGF1(hashes.SHA256()),algorithm=hashes.SHA256(),label=AAD)
def seal(data, public_pem):
    public=serialization.load_pem_public_key(public_pem)
    if public.key_size < 3072: raise ValueError('Backup RSA key is too small')
    key=os.urandom(32); nonce=os.urandom(12)
    header=json.dumps({'key':base64.b64encode(public.encrypt(key,OAEP)).decode(),'nonce':base64.b64encode(nonce).decode()},sort_keys=True,separators=(',',':')).encode()
    return MAGIC+struct.pack('>I',len(header))+header+AESGCM(key).encrypt(nonce,data,AAD+header)
def unseal(data, private_pem):
    if not data.startswith(MAGIC): raise ValueError('Unsupported backup format')
    offset=len(MAGIC); size=struct.unpack('>I',data[offset:offset+4])[0]
    if size>4096: raise ValueError('Invalid backup header')
    header=data[offset+4:offset+4+size]; values=json.loads(header)
    private=serialization.load_pem_private_key(private_pem,password=None)
    key=private.decrypt(base64.b64decode(values['key'],validate=True),OAEP)
    return AESGCM(key).decrypt(base64.b64decode(values['nonce'],validate=True),data[offset+4+size:],AAD+header)
def main():
    p=argparse.ArgumentParser();p.add_argument('mode',choices=['encrypt','decrypt']);p.add_argument('--key',required=True);p.add_argument('--input',required=True);p.add_argument('--output',required=True);a=p.parse_args()
    result=(seal if a.mode=='encrypt' else unseal)(Path(a.input).read_bytes(),Path(a.key).read_bytes())
    fd=os.open(a.output,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'wb') as f:f.write(result)
if __name__=='__main__':main()
