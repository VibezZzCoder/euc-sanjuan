#!/usr/bin/env python3
# El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan
"""Extract only first-area OSM anchors; no network, terrain rebuild or donor mutation.

Run with Python with pyproj. Dimensions of authored dressing
are specified separately in sj-plaza-layout.js; photographs are never shipped as textures.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
from pyproj import Transformer, CRS

ROOT = Path(__file__).resolve().parent.parent
SOURCE = Path(os.environ.get('SJ_DATA_DIR', ROOT / 'inputs')) / 'osm-old-san-juan.json'
TARGET = ROOT/'data/plaza-detail.json'


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    raw=SOURCE.read_bytes()
    elements=json.loads(raw)['elements']
    by_id={(e['type'],e['id']):e for e in elements}
    transform=Transformer.from_crs(4326,CRS.from_proj4('+proj=aeqd +lat_0=18.4655 +lon_0=-66.1167 +datum=WGS84 +units=m'),always_xy=True)
    def point(p):
        x,y=transform.transform(p['lon'],p['lat'])
        return [round(x,3),round(-y,3)]
    def way(oid):
        return {'source':f'way/{oid}','ring':[point(p) for p in by_id['way',oid]['geometry'][:-1]]}
    benches=[]
    for e in elements:
        if e['type']!='node' or e.get('tags',{}).get('amenity')!='bench':continue
        p=point(e)
        if -30<p[0]<40 and 4<p[1]<42:
            benches.append({'source':f'node/{e["id"]}','point':p})
    output={'cityEdition': 'El Viejo San Juan: EUC Thrills by VibezZzCoder — https://github.com/VibezZzCoder/euc-sanjuan', 'credit': '© OpenStreetMap contributors — ODbL 1.0','version':1,'source':'© OpenStreetMap contributors — ODbL',
            'inputSha256':hashlib.sha256(raw).hexdigest(),
            'plaza':way(487051052),'fountain':way(487051054),'gazebo':way(269915829),
            'benches':sorted(benches,key=lambda b:b['source'])}
    encoded=json.dumps(output,ensure_ascii=False,indent=2)+'\n'
    if args.check:
        assert TARGET.read_text()==encoded,'Stale plaza anchors'
        print('Plaza source anchors match cached OSM')
    else:
        TARGET.write_text(encoded)
        print(f'Wrote {TARGET.relative_to(ROOT)} ({len(encoded.encode())} bytes)')


if __name__=='__main__':main()
