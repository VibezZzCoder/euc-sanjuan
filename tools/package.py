#!/usr/bin/env python3
# El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan
"""Build and hash the local portable runtime. This is not a GitHub release exporter."""
from pathlib import Path
import hashlib
import json
import shutil
from serve import ROOT, PUBLIC, DIRS, RUNTIME_DATA


def main():
    destination=ROOT/'dist'
    if destination.is_symlink():raise ValueError('dist must be a directory inside the checkout')
    if destination.exists():shutil.rmtree(destination)
    destination.mkdir()
    records=[]
    for name in sorted(PUBLIC|DIRS):
        item=ROOT/name
        if item.is_symlink():raise ValueError(f'Symlink forbidden: {item}')
        files=sorted(item.rglob('*')) if item.is_dir() else [item]
        for source in files:
            if source.relative_to(ROOT).as_posix()=='data/boundary-review.svg':continue  # optional authoring diagram
            if source.is_symlink():raise ValueError(f'Symlink forbidden: {source}')
            if not source.is_file():continue
            relative=source.relative_to(ROOT)
            if relative.parts[0]=='data' and relative.as_posix() not in {'data/'+n for n in RUNTIME_DATA}:raise ValueError(f'Unknown geographic output: {relative}')
            if any(part.startswith('.') for part in relative.parts):raise ValueError(f'Hidden runtime path: {relative}')
            target=destination/relative;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
            raw=target.read_bytes();records.append({'path':str(relative),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
    (destination/'PACKAGE.json').write_text(json.dumps(records,indent=2)+'\n')
    print(f'Portable runtime: {len(records)} files, {sum(r["bytes"] for r in records):,} bytes')
    assert not any((destination/p).exists() for p in ['.git','AGENTS.md','docs','tools','tests','CHANGELOG.md'])


if __name__=='__main__':main()
