#!/usr/bin/env python3
# El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan
"""No-store game preview with private paths excluded. Default: loopback 8004."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = {'index.html','credits.html','manifest.webmanifest','LICENSE','NOTICE.md','NOTICE-EUC-THRILLS.md','FORK_GUIDE.md','README.md','LICENSING.md','PACKAGE.json'}
DIRS = {'js','css','data','vendor','assets','audio','fonts','provenance'}


RUNTIME_DATA = {'boundary.geojson','city.json','ground.bin','land.u8','plaza-detail.json','stairs.json','streets-cache.bin','surface.u8','terrain.i16'}


class Handler(SimpleHTTPRequestHandler):
    extensions_map={**SimpleHTTPRequestHandler.extensions_map,'.webmanifest':'application/manifest+json'}

    def end_headers(self):
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        super().end_headers()

    def send_head(self):
        try:
            path=unquote(urlsplit(self.path).path, errors='strict').lstrip('/') or 'index.html'
            parts=Path(path).parts
            root=Path(self.directory).resolve()
            target=(root/path).resolve()
            allowed=(path in PUBLIC or parts[0] in DIRS) and not any(p.startswith('.') or p in ('..','') for p in parts)
            if target.is_relative_to(root):
                actual=target.relative_to(root)
                allowed=allowed and (str(actual) in PUBLIC or actual.parts[0] in DIRS)
            if parts and parts[0]=='data':allowed=allowed and path in {'data/'+n for n in RUNTIME_DATA}
            if not allowed or not target.is_relative_to(root) or not target.is_file():
                self.send_error(404);return None
            self.path='/'+path
            for name in ('If-Modified-Since','If-None-Match'):
                if name in self.headers:del self.headers[name]
            return super().send_head()
        except (ValueError,UnicodeError,OSError):
            self.send_error(400);return None


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port',type=int,default=8004)
    parser.add_argument('--host',default='127.0.0.1')
    parser.add_argument('--dist',action='store_true')
    args=parser.parse_args()
    root=ROOT/'dist' if args.dist else ROOT
    if not (root/'index.html').exists():parser.error('Missing runtime index')
    with ThreadingHTTPServer((args.host,args.port),partial(Handler,directory=str(root))) as server:
        print(f'San Juan preview: http://{args.host}:{args.port}',flush=True)
        try:server.serve_forever()
        except KeyboardInterrupt:pass


if __name__=='__main__':main()
