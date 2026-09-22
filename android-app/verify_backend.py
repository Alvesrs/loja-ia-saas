"""Fail the build if the actual app entrypoints or login assets are broken."""
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urljoin

BASE = 'https://backend-prod-production-f338.up.railway.app'
ENTRIES = ['/painel/login.html', '/painel/login.html?next=cliente-estoque.html']

def fetch(url):
    result = subprocess.run(
        ['curl', '--fail', '--silent', '--show-error', '--location',
         '--max-time', '30', '--write-out', '\n%{content_type}', url],
        check=True, capture_output=True, text=True, timeout=35)
    body, content_type = result.stdout.rsplit('\n', 1)
    assert body, url
    return url, body, content_type

assets = set()
with ThreadPoolExecutor(max_workers=4) as pool:
    for url, html, content_type in pool.map(fetch, [BASE + p for p in ENTRIES]):
        assert 'text/html' in content_type, url
        assert 'id="form-login"' in html and 'id="senha"' in html, url
        assert "apiFetch('/auth/login'" in html, 'Login script missing'
        assets.update(urljoin(url, p) for p in re.findall(
            r'(?:src|href)="((?:js|css)/[^"<>]+)"', html))
        print('PASS login form:', url, flush=True)
    for url, body, content_type in pool.map(fetch, sorted(assets)):
        assert 'text/html' not in content_type, url
        print('PASS asset:', url, flush=True)
