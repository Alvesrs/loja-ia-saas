import importlib.util, pathlib, unittest
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
p=pathlib.Path(__file__).parents[1]/'scripts/stability/secure_backup.py'
s=importlib.util.spec_from_file_location('secure_backup',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class Backup(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  k=rsa.generate_private_key(public_exponent=65537,key_size=3072)
  cls.public=k.public_key().public_bytes(serialization.Encoding.PEM,serialization.PublicFormat.SubjectPublicKeyInfo)
  cls.private=k.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption())
 def test_round_trip(self):
  data=b'isolated fixture only';encrypted=m.seal(data,self.public)
  self.assertNotIn(data,encrypted);self.assertEqual(m.unseal(encrypted,self.private),data)
 def test_tampering_rejected(self):
  encrypted=bytearray(m.seal(b'fixture',self.public));encrypted[-1]^=1
  with self.assertRaises(Exception):m.unseal(bytes(encrypted),self.private)
 def test_wrong_key_rejected(self):
  k=rsa.generate_private_key(public_exponent=65537,key_size=3072)
  other=k.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption())
  with self.assertRaises(Exception):m.unseal(m.seal(b'fixture',self.public),other)
if __name__=='__main__':unittest.main()
