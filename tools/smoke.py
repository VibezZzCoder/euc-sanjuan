#!/usr/bin/env python3
# El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan
"""Lightweight source/package closure, provenance, link and payload checks; no browser."""
from pathlib import Path
import hashlib
import os
import shutil
import subprocess
import json
import re
from serve import ROOT


def main():
    checks=0
    def check(condition,message):
        nonlocal checks
        if not condition:raise AssertionError(message)
        checks+=1
    for source in (ROOT/'js').rglob('*.js'):
        for path in re.findall(r'''(?:from\s*|import\s*\()\s*['"](\.[^'"]+)['"]''',source.read_text()):
            check((source.parent/path).is_file(),f'Missing JS import {source.relative_to(ROOT)} -> {path}')
    for name in ['README.md','NOTICE.md','NOTICE-EUC-THRILLS.md','FORK_GUIDE.md','provenance/README.md']:
        source=ROOT/name
        for target in re.findall(r'\]\(([^)]+)\)',source.read_text()):
            if '://' in target or target.startswith('#'):continue
            check((source.parent/target.split('#')[0]).is_file(),f'Broken document link: {name} -> {target}')
    # Home Screen install: the web manifest parses, its icons exist at the sizes it states, and every local file the
    # page head links to is shipped (served and packaged).
    app=json.loads((ROOT/'manifest.webmanifest').read_text())
    check(app.get('start_url')=='./' and app.get('scope')=='./' and app.get('id')=='./' and app.get('display')=='standalone','Web manifest id/start/scope/display')
    purposes=set()
    for icon in app['icons']:
        raw=(ROOT/icon['src'].removeprefix('./')).read_bytes()
        check(raw[:8]==b'\x89PNG\r\n\x1a\n' and icon['type']=='image/png','Manifest icon is a PNG: '+icon['src'])
        w,h,depth,colour=int.from_bytes(raw[16:20],'big'),int.from_bytes(raw[20:24],'big'),raw[24],raw[25]
        check(icon['sizes']==f'{w}x{h}' and w==h and depth==8 and colour==2,f'Manifest icon {icon["src"]} is opaque RGB {icon["sizes"]}')
        purposes.add(icon.get('purpose','any'))
    check({'any','maskable'}<=purposes,'Manifest has any and maskable icons')
    from serve import PUBLIC, DIRS
    head=(ROOT/'index.html').read_text().split('</head>')[0]
    for ref in re.findall(r'<(?:link|script)\b[^>]*\b(?:href|src)="([^"]+)"',head):
        check('://' not in ref and (ROOT/ref).is_file() and (ref in PUBLIC or ref.split('/')[0] in DIRS),'Head link not shipped: '+ref)
    apple=re.search(r'<link rel="apple-touch-icon" href="([^"]+)" sizes="180x180">',head)
    check(apple is not None and (ROOT/apple[1]).read_bytes()[16:24]==(180).to_bytes(4,'big')*2,'Apple touch icon 180x180')
    manifest=json.loads((ROOT/'js/euc/MANIFEST.json').read_text())
    check(bool(manifest),'Generated EUC manifest exists')
    imported=json.loads((ROOT/'provenance/sf-import.json').read_text())
    unchanged=0
    for record in imported['files']:
        expected=record.get('editionSha256',record['sha256'])
        check(hashlib.sha256((ROOT/record['path']).read_bytes()).hexdigest()==expected,'Imported bytes changed: '+record['path'])
        unchanged+=expected==record['sha256']
    for path in (ROOT/'js').glob('*.js'):
        text=path.read_text()
        check(not re.search(r"(?:KEY\s*=\s*|(?:getItem|setItem)\()['\"]euc-sanfrancisco",text),'SF storage namespace: '+path.name)
    for name in ['terrain.i16','land.u8','surface.u8','city.json','ground.bin','streets-cache.bin']:
        check((ROOT/'data'/name).is_file(),'Missing runtime data '+name)
    # The streets layout cache goes stale whenever any input of the streets layout changes (every merge): a stale cache
    # still boots through the runtime path, about a second slower, so staleness must fail here, not ship unnoticed.
    node=shutil.which(os.environ.get('NODE','node'))
    check(node is not None,'Node.js is required (set NODE or PATH).')
    for tool,marker in [('build-streets-cache','is current'),('csp',None),('vendor-three',None),('headers','source notices checked'),('actors-provenance','actor imports checked')]:
        result=subprocess.run([node,f'tools/{tool}.mjs','--check'],cwd=ROOT,capture_output=True,text=True,timeout=600)
        check(result.returncode==0 and (not marker or marker in result.stdout),f'{tool} failed: '+(result.stdout+result.stderr)[-500:])
        print('PASS node:',tool)
    package=ROOT/'dist'
    if package.exists():
        for r in json.loads((package/'PACKAGE.json').read_text()):
            check(hashlib.sha256((package/r['path']).read_bytes()).hexdigest()==r['sha256'],'Package hash '+r['path'])
            check((package/r['path']).read_bytes()==(ROOT/r['path']).read_bytes(),'Stale package '+r['path'])
        check(not any((package/p).exists() for p in ['.git','AGENTS.md','docs','tools','tests','CHANGELOG.md']),'Private paths in package')
    print(f'{checks} smoke checks passed; {unchanged} unchanged donor files; source/package closure valid')


if __name__=='__main__':main()
