#!/usr/bin/env python3
# El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan
"""Ground polygons for the city-wide streets pass — © 2026 VibezZzCoder, MIT. Input: OSM / ODbL (cached extract).

Offline, read-only: reads the directory named by SJ_DATA_DIR/osm-old-san-juan.json (the same extract tools/build-city.py uses) and
writes js/sj-streets-data.js. No network. Run with the GIS environment (pyproj):
  python3 tools/build-streets.py
Squares and car parks also carry precomputed convex pieces. Kinds: lawn (landuse=grass/meadow, leisure=park/garden/playground), scrub (natural=scrub/wood), parking
(amenity=parking), square (highway=pedestrian|footway + area=yes, place=square), pitch (leisure=pitch).
"""
import json
import os
from pathlib import Path
from pyproj import CRS, Transformer

ROOT = Path(__file__).resolve().parents[1]
INPUT = Path(os.environ.get('SJ_DATA_DIR', ROOT / 'inputs')) / 'osm-old-san-juan.json'
LON0, LAT0 = -66.1167, 18.4655
LOCAL = CRS.from_proj4(f'+proj=aeqd +lat_0={LAT0} +lon_0={LON0} +datum=WGS84 +units=m')
FORWARD = Transformer.from_crs(4326, LOCAL, always_xy=True)


def project(lon, lat):
    x, north = FORWARD.transform(lon, lat)
    return [round(x, 2), round(-north, 2)]


def signed_area(r):
    return sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(r, r[1:] + r[:1])) / 2


def cross(a, b, c):
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def convex_pieces(ring):
    """Ear clipping then Hertel-Mehlhorn merges (port of convexPieces in js/sj-gate-layout.js); CCW pieces in x,z."""
    pts = [p for i, p in enumerate(ring) if (p[0] - ring[(i + 1) % len(ring)][0]) ** 2 + (p[1] - ring[(i + 1) % len(ring)][1]) ** 2 > 1e-12]
    if signed_area(pts) < 0: pts = pts[::-1]
    out, guard = [], len(pts) ** 2
    def inside(p, a, b, c): return cross(a, b, p) > 1e-12 and cross(b, c, p) > 1e-12 and cross(c, a, p) > 1e-12
    while len(pts) > 3 and guard > 0:
        guard -= 1
        n = len(pts)
        flat = next((i for i in range(n) if abs(cross(pts[i - 1], pts[i], pts[(i + 1) % n])) < 1e-6), -1)
        if flat >= 0: pts.pop(flat); continue
        for i in range(n):
            a, b, c = pts[i - 1], pts[i], pts[(i + 1) % n]
            if cross(a, b, c) <= 1e-12: continue
            if any(p is not a and p is not b and p is not c and inside(p, a, b, c) for p in pts): continue
            out.append([a, b, c]); pts.pop(i); break
        else:
            raise ValueError('ring is not simple')
    if len(pts) == 3 and abs(signed_area(pts)) > 1e-9: out.append(pts)
    key = lambda p: (round(p[0], 6), round(p[1], 6))
    def is_convex(r): return all(cross(r[k - 1], r[k], r[(k + 1) % len(r)]) >= -1e-9 for k in range(len(r)))
    merged = True
    while merged:
        merged = False
        for i in range(len(out)):
            for j in range(i + 1, len(out)):
                A, B = out[i], out[j]
                for a in range(len(A)):
                    a0, a1 = key(A[a]), key(A[(a + 1) % len(A)])
                    for b in range(len(B)):
                        if key(B[b]) == a1 and key(B[(b + 1) % len(B)]) == a0:
                            r = A[a + 1:] + A[:a + 1] + B[b + 2:] + B[:b]
                            r = [p for k, p in enumerate(r) if key(p) != key(r[(k + 1) % len(r)])]
                            clean = [p for k, p in enumerate(r) if abs(cross(r[k - 1], p, r[(k + 1) % len(r)])) > 1e-9]
                            if len(clean) >= 3 and is_convex(clean):
                                out[i] = clean; out.pop(j); merged = True; break
                    if merged: break
                if merged: break
            if merged: break
    return [[[round(x, 3), round(z, 3)] for x, z in p] for p in out if abs(signed_area(p)) > 1e-4]


def kind(t):
    if t.get('amenity') == 'parking': return 'parking'
    if t.get('leisure') == 'pitch': return 'pitch'
    if t.get('landuse') in ('grass', 'meadow') or t.get('leisure') in ('park', 'garden', 'playground'): return 'lawn'
    if t.get('natural') in ('scrub', 'wood'): return 'scrub'
    if t.get('place') == 'square': return 'square'
    if t.get('highway') in ('pedestrian', 'footway') and t.get('area') == 'yes': return 'square'
    return None


def main():
    data = json.loads(INPUT.read_text())
    nodes = {e['id']: e for e in data['elements'] if e['type'] == 'node'}
    out = []
    for e in data['elements']:
        if e['type'] != 'way': continue
        k = kind(e.get('tags', {}))
        ids = e.get('nodes', [])
        if not k or len(ids) < 4 or ids[0] != ids[-1] or any(n not in nodes for n in ids): continue
        ring = [project(nodes[n]['lon'], nodes[n]['lat']) for n in ids[:-1]]
        area = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(ring, ring[1:] + ring[:1])) / 2
        if abs(area) < 4: continue
        rec = {'id': e['id'], 'kind': k, 'name': e.get('tags', {}).get('name', ''), 'surface': e.get('tags', {}).get('surface', ''), 'ring': ring}
        if k in ('square', 'parking'):
            try: rec['pieces'] = convex_pieces(ring)
            except ValueError: print('not simple', e['id'])
        out.append(rec)
    out.sort(key=lambda p: p['id'])
    # Building footprints (data/city.json) as convex pieces: sidewalk margins are fitted to the frontages by subtracting
    # them (precomputed: ear clipping + merges at load time cost ~0.3 s).
    city = json.loads((ROOT / 'data/city.json').read_text())
    bpieces = []
    for b in city['buildings']:
        try: bpieces.append([b['id'], convex_pieces([list(p) for p in b['outer']])])
        except ValueError: print('building not simple', b['id'])
    body = ',\n'.join(json.dumps(p, separators=(',', ':'), ensure_ascii=False) for p in out)
    (ROOT / 'js/sj-streets-data.js').write_text(
        '/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT code — https://github.com/VibezZzCoder/euc-sanjuan — Data: © OpenStreetMap contributors, ODbL 1.0 */\n' '// Generated by tools/build-streets.py from the cached OSM extract (ODbL). Do not edit by hand.\n'
        '// {id, kind: lawn|scrub|parking|square|pitch, name, surface, ring: [[x,z]…], pieces?} in the city projection (z = −north);\n'
        '// squares and car parks carry their convex pieces (counter-clockwise in x,z), precomputed to keep layout time down.\n'
        'export const GROUND_AREAS=[\n' + body + '];\n'
        '// [building id, convex pieces of its outer ring] for every building in data/city.json.\n'
        'export const BUILDING_PIECES=' + json.dumps(bpieces, separators=(',', ':')) + ';\n')
    print(len(out), {k: sum(1 for p in out if p['kind'] == k) for k in ('lawn', 'scrub', 'parking', 'square', 'pitch')})


if __name__ == '__main__':
    main()
