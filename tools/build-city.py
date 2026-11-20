#!/usr/bin/env python3
# El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan
"""Deterministic offline base geography from cached OSM + USGS inputs. No network.

Run using python3 tools/build-city.py.
Python deps: numpy, tifffile, imagecodecs, pyproj, shapely.
"""
import os
from pathlib import Path
import hashlib
import json
import math
import xml.etree.ElementTree as ET
import numpy as np
import tifffile
from pyproj import Transformer, CRS
from shapely.geometry import Polygon, LineString, Point, mapping
from shapely.ops import polygonize, unary_union
from shapely import contains_xy, make_valid, transform

ROOT = Path(__file__).resolve().parent.parent
INPUT = Path(os.environ.get('SJ_DATA_DIR', ROOT / 'inputs'))
OUT = ROOT / 'data'
LON0, LAT0 = -66.1167, 18.4655
FRAME = (-66.1300, 18.4595, -66.1040, 18.4740)
STEP = 2
LOCAL = CRS.from_proj4(f'+proj=aeqd +lat_0={LAT0} +lon_0={LON0} +datum=WGS84 +units=m')
FORWARD = Transformer.from_crs(4326, LOCAL, always_xy=True)
INVERSE = Transformer.from_crs(LOCAL, 4326, always_xy=True)
RASTER = Transformer.from_crs(LOCAL, 26919, always_xy=True)


def project(lon, lat):
    x, north = FORWARD.transform(lon, lat)
    return x, -north


def polygons(geometry):
    if geometry.is_empty: return []
    if geometry.geom_type == 'Polygon': return [geometry]
    return [p for child in getattr(geometry, 'geoms', []) for p in polygons(child)]


def lines(geometry):
    if geometry.is_empty: return []
    if geometry.geom_type == 'LineString': return [geometry]
    return [p for child in getattr(geometry, 'geoms', []) for p in lines(child)]


def ring(points):
    return [[round(x, 3), round(z, 3)] for x, z in list(points)[:-1]]


def save(name, value):
    (OUT / name).write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n')


def main():
    OUT.mkdir(exist_ok=True)
    elements = {}
    for name in ['osm-old-san-juan.json', 'osm-relations.json']:
        for item in json.loads((INPUT / name).read_text())['elements']:
            key = (item['type'], item['id'])
            elements[key] = {**elements.get(key, {}), **item}
    ways = [e for e in elements.values() if e['type'] == 'way']
    def coords(e):
        if 'geometry' in e: return [project(p['lon'], p['lat']) for p in e['geometry']]
        return [project(elements['node', n]['lon'], elements['node', n]['lat']) for n in e.get('nodes', [])]
    west, south, east, north = FRAME
    frame = Polygon([project(west, south), project(west, north), project(east, north), project(east, south)])
    coasts = [LineString(coords(w)).intersection(frame) for w in ways if w.get('tags', {}).get('natural') == 'coastline']
    candidates = list(polygonize(unary_union([frame.boundary, *coasts])))
    land = next((p for p in candidates if p.contains(Point(0, 0))), None)
    if land is None: raise ValueError('Could not close the coast against the bounded frame')
    # OSM coastline is the horizontal authority; piers are explicit land additions.
    piers = [Polygon(coords(w)) for w in ways if w.get('tags', {}).get('man_made') == 'pier'
             and len(coords(w)) >= 4 and coords(w)[0] == coords(w)[-1]]
    land = make_valid(unary_union([land, *piers]).intersection(frame))
    minx, minz, maxx, maxz = frame.bounds
    x0, z0 = math.floor(minx / STEP) * STEP, math.floor(minz / STEP) * STEP
    nx, nz = math.ceil((maxx - x0) / STEP) + 1, math.ceil((maxz - z0) / STEP) + 1
    xx, zz = np.meshgrid(x0 + np.arange(nx) * STEP, z0 + np.arange(nz) * STEP)
    rx, ry = RASTER.transform(xx, -zz)
    tif = INPUT / 'USGS_1M_19_x80y205_PR_PuertoRicoUSVI_D24.tif'
    with tifffile.TiffFile(tif) as file:
        meta = file.geotiff_metadata
        dem = file.pages[0].asarray()
    tx, ty = meta['ModelTiepoint'][3:5]
    # PixelIsArea raster values belong at pixel centres. Bilinear resampling only on valid cells.
    fx, fy = rx - tx - 0.5, ty - ry - 0.5
    ix, iy = np.floor(fx).astype(int), np.floor(fy).astype(int)
    u, v = fx - ix, fy - iy
    a, b, c, d = dem[iy, ix], dem[iy, ix + 1], dem[iy + 1, ix], dem[iy + 1, ix + 1]
    valid = (a > -1000) & (b > -1000) & (c > -1000) & (d > -1000) & contains_xy(land, xx, zz)
    h = np.where(valid, a*(1-u)*(1-v) + b*u*(1-v) + c*(1-u)*v + d*u*v, -4)
    del dem, a, b, c, d, rx, ry, fx, fy
    q = np.rint(h * 100).astype('<i2')
    q.tofile(OUT / 'terrain.i16')
    valid.astype('u1').tofile(OUT / 'land.u8')
    def height(x, z):
        i = min(nx-1, max(0, round((x-x0)/STEP)))
        j = min(nz-1, max(0, round((z-z0)/STEP)))
        return float(q[j, i]) / 100
    surface = np.zeros(xx.shape, dtype='u1')
    grass = []
    for w in ways:
        t = w.get('tags', {})
        if t.get('landuse') in ('grass', 'meadow', 'cemetery') or t.get('leisure') in ('park', 'garden'):
            p = coords(w)
            if len(p) > 3 and p[0] == p[-1]: grass.extend(polygons(make_valid(Polygon(p)).intersection(land)))
    if grass: surface[contains_xy(unary_union(grass), xx, zz)] = 2
    roads, steps, strips = [], [], []
    widths = {'primary': 10, 'secondary': 9, 'tertiary': 8, 'residential': 6, 'service': 4,
              'pedestrian': 5, 'footway': 2.2, 'path': 2, 'cycleway': 2.5, 'steps': 2}
    for w in ways:
        t = w.get('tags', {})
        kind = t.get('highway')
        if not kind or len(coords(w)) < 2: continue
        try: width = float(t.get('width', widths.get(kind, 6)))
        except ValueError: width = widths.get(kind, 6)
        width = min(14, max(1.5, width))
        for line in lines(LineString(coords(w)).intersection(land)):
            if line.length < 1: continue
            points = [[round(x,3), round(z,3)] for x,z in line.coords]
            row = {'id': w['id'], 'name': t.get('name',''), 'kind': kind, 'surface': t.get('surface',''),
                   'width': width, 'oneway': t.get('oneway','no'), 'points': points, 'length': round(line.length,2)}
            roads.append(row)
            if kind == 'steps': steps.append(row)
            strips.append(line.buffer(width/2, cap_style=2, join_style=2))
    if strips: surface[contains_xy(unary_union(strips), xx, zz)] = 1
    surface[~valid] = 3
    surface.tofile(OUT / 'surface.u8')
    buildings, member_ids = [], set()
    building_shapes = []
    for rel in elements.values():
        t = rel.get('tags', {})
        if rel['type'] != 'relation' or not t.get('building') or not rel.get('members'): continue
        outer, inner = [], []
        for m in rel['members']:
            if m['type'] != 'way': continue
            way = elements.get(('way', m['ref']))
            points = coords(way) if way else [project(p['lon'],p['lat']) for p in m.get('geometry', [])]
            if len(points) < 2: raise ValueError(f'Missing relation member {m["ref"]}')
            (inner if m.get('role') == 'inner' else outer).append(LineString(points))
            member_ids.add(m['ref'])
        shell = unary_union(list(polygonize(outer)))
        holes = unary_union(list(polygonize(inner)))
        building_shapes.append((rel['id'], t, shell.difference(holes)))
    for w in ways:
        t = w.get('tags', {})
        if not t.get('building') or w['id'] in member_ids: continue
        p = coords(w)
        if len(p)>3 and p[0]==p[-1]: building_shapes.append((w['id'],t,make_valid(Polygon(p))))
    for oid,t,shape in building_shapes:
        # Fort scarps already live in the DEM; don't erect a second solid over their courtyards.
        if t.get('building') == 'castle' or t.get('historic') in ('castle','fort'): continue
        explicit = 'height' in t
        try: rise = float(t['height'].replace(' m','')) if explicit else float(t.get('building:levels',2))*3.5
        except ValueError: rise, explicit = 7, False
        rise = min(45,max(2.5,rise))
        for p in polygons(shape.intersection(land)):
            if p.area < 5: continue
            outer = ring(p.exterior.coords)
            values = [height(x,z) for x,z in outer]
            base, roof = min(values)-0.3, max(values)+rise
            buildings.append({'id':oid,'outer':outer,'holes':[ring(r.coords) for r in p.interiors],
                              'base':round(base,2),'roof':round(roof,2),'name':t.get('name',''),
                              'heightSource':'height' if explicit else 'levels' if 'building:levels' in t else 'default-2-levels'})
    trees = []
    for e in elements.values():
        if e['type']=='node' and e.get('tags',{}).get('natural')=='tree':
            x,z=project(e['lon'],e['lat'])
            if land.contains(Point(x,z)): trees.append([round(x,2),round(z,2)])
    # Keep destination candidates on the main non-stair outdoor network, not disconnected fort interiors.
    network = {}
    def key(point): return tuple(round(value, 2) for value in point)
    eligible = [r for r in roads if r['kind'] not in ('steps', 'service', 'cycleway')]
    for road in eligible:
        for a, b in zip(road['points'], road['points'][1:]):
            a, b = key(a), key(b)
            network.setdefault(a, set()).add(b)
            network.setdefault(b, set()).add(a)
    remaining = set(network)
    components = []
    while remaining:
        pending = [min(remaining)]; visited = set()
        while pending:
            point = pending.pop()
            if point in visited: continue
            visited.add(point); remaining.discard(point)
            pending.extend(network[point] - visited)
        components.append(visited)
    main_network = max(components, key=len)
    connected_paths = [LineString(r['points']) for r in eligible if key(r['points'][0]) in main_network]
    # Named anchors are candidates. Runtime placement must independently check full rider clearance.
    anchors = []
    wanted = ['Plaza de Armas','Plaza Colón','Castillo San Felipe del Morro','Castillo San Cristóbal',
              'Paseo de la Princesa','La Perla']
    for label in wanted:
        matching = [e for e in elements.values() if e.get('tags',{}).get('name')==label and e['type'] in ('node','way')]
        if not matching: continue
        e = matching[0]
        p = Point(project(e['lon'],e['lat'])) if e['type']=='node' else LineString(coords(e)).centroid
        if label == 'Castillo San Felipe del Morro':
            road = next(r for r in roads if r['id'] == 59745018)
            p = LineString(road['points']).interpolate(0.6, normalized=True)
            label = 'El Morro — esplanade'
        elif label == 'Castillo San Cristóbal':
            # Exterior Norzagaray approach; no implied admission through an unmodelled fort gate.
            road = next(r for r in roads if r['id'] == 295380549)
            p = LineString(road['points']).interpolate(0.78, normalized=True)
            label = 'San Cristóbal — exterior'
        # For forts, use nearest mapped non-step path, not a centroid inside the fortress.
        nearest = min(connected_paths,key=lambda line: line.distance(p))
        p = nearest.interpolate(nearest.project(p))
        anchors.append({'name':label,'x':round(p.x,3),'z':round(p.y,3),'source':e['id']})
    save('city.json', {'cityEdition': 'El Viejo San Juan: EUC Thrills by VibezZzCoder — https://github.com/VibezZzCoder/euc-sanjuan', 'credit': '© OpenStreetMap contributors — ODbL 1.0; USGS 3DEP PR_PuertoRicoUSVI_D24 elevation — public domain','version':1,'origin':{'lon':LON0,'lat':LAT0,'projection':f'+proj=aeqd +lat_0={LAT0} +lon_0={LON0} +datum=WGS84 +units=m'},
        'terrain':{'x0':x0,'z0':z0,'nx':nx,'nz':nz,'step':STEP,'scale':0.01,'verticalDatum':'PRVD02 / GEOID18'},
        'boundary':[{'outer':ring(p.exterior.coords),'holes':[ring(r.coords) for r in p.interiors]} for p in polygons(land)],
        'buildings':buildings,'roads':roads,'trees':trees,'places':anchors})
    save('boundary.geojson', {'type':'Feature','properties':{'cityEdition': 'El Viejo San Juan: EUC Thrills by VibezZzCoder — https://github.com/VibezZzCoder/euc-sanjuan', 'credit': '© OpenStreetMap contributors — ODbL 1.0','name':'Old San Juan','areaM2':land.area,
         'note':'OSM coast/piers clipped to the research frame; eastern cut is an authored boundary'},
         'geometry':mapping(transform(land,lambda x,z:INVERSE.transform(x,-np.asarray(z)),interleaved=False))})
    save('stairs.json', steps)
    # Bounded map review artifact (local coordinates, paths preserved).
    def svgpath(p): return 'M'+'L'.join(f'{x:.1f},{z:.1f}' for x,z in p)+'Z'
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0} {z0} {(nx-1)*STEP} {(nz-1)*STEP}">',
           f'<rect x="{x0}" y="{z0}" width="{nx*STEP}" height="{nz*STEP}" fill="#163c50"/>']
    for p in polygons(land): svg.append(f'<path d="{svgpath(p.exterior.coords)}" fill="#c5c8aa"/>')
    for b in buildings: svg.append(f'<path d="{svgpath(b["outer"])}" fill="#8b7568"/>')
    for r in roads:
        pts=' '.join(f'{x},{z}' for x,z in r['points'])
        svg.append(f'<polyline points="{pts}" stroke="#ededcc" stroke-width="{r["width"]}" fill="none"/>')
    svg.append('</svg>')
    (OUT / 'boundary-review.svg').write_text('\n'.join(svg))
    source_names = ['osm-old-san-juan.json','osm-relations.json',tif.name,'vendor-dem-metadata-6.xml','product-metadata.xml']
    urls = {'osm-old-san-juan.json':'https://overpass-api.de/api/interpreter',
            'osm-relations.json':'https://overpass-api.de/api/interpreter',
            tif.name:'https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/1m/Projects/PR_PuertoRicoUSVI_D24/TIFF/'+tif.name,
            'vendor-dem-metadata-6.xml':'https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/metadata/PR_PuertoRicoUSVI_D24/PR_PuertoRicoUSVI_6_D24/reports/vendorr_provided_xml/PR_PuertoRicoUSVI_6_D24_DEM_XML_Metadata.xml',
            'product-metadata.xml':'https://thor-f5.er.usgs.gov/ngtoc/metadata/waf/elevation/1_meter/geotiff/PR_PuertoRicoUSVI_D24/USGS_1M_19_x80y205_PR_PuertoRicoUSVI_D24.xml'}
    records = [{'file':name,'url':urls[name],'bytes':(INPUT/name).stat().st_size,'sha256':hashlib.sha256((INPUT/name).read_bytes()).hexdigest()} for name in source_names]
    vendor = ET.parse(INPUT/'vendor-dem-metadata-6.xml').getroot()
    assert vendor.findtext('.//altdatum')=='Puerto Rico Vertical Datum of 2002'
    for record in records:
        name = record['file']
        record['credit'] = '© OpenStreetMap contributors — ODbL 1.0' if name.startswith('osm') else 'USGS 3DEP PR_PuertoRicoUSVI_D24 elevation — public domain' if name.endswith('.tif') else 'USGS 3DEP product and vendor metadata'
    report = {'cityEdition': 'El Viejo San Juan: EUC Thrills by VibezZzCoder — https://github.com/VibezZzCoder/euc-sanjuan', 'stairs.json': '© OpenStreetMap contributors — ODbL 1.0; data/stairs.json is an array of mapped ways.','sources':records,'queries':{name:(INPUT/name).read_text() for name in ['osj.overpassql','relations.overpassql']},
        'osmTimestamp':json.loads((INPUT/'osm-old-san-juan.json').read_text())['osm3s']['timestamp_osm_base'],
        'datumEvidence':'USGS PR_PuertoRicoUSVI_6_D24 DEM vendor metadata; contains San Juan',
        'accuracy':'10 cm RMSEV class per source report, not a local game accuracy measurement',
        'landAreaKm2':round(land.area/1e6,4),'frameAreaKm2':round(frame.area/1e6,4),
        'buildings':len(buildings),'roadWaysAfterClip':len(roads),'streetLengthM':round(sum(r['length'] for r in roads)),
        'stairs':len(steps),'mainWalkNetworkNodes':len(main_network),'walkComponents':len(components),
        'grid':[nx,nz],'validVertices':int(valid.sum()),'stepM':STEP,
        'quantizationErrorMaxM':float(np.max(np.abs(q.astype(float)/100-h))),
        'limits':['2 m terrain grid resampled from 1 m DEM; not a survey replica',
                  'Base geography excludes authored structures; see the area modules for rideable surfaces',
                  'Widths/heights inferred when absent; shared draw/collision geometry',
                  'Eastern cut follows the bounded city extent']}
    (ROOT/'provenance/geodata.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k not in ('sources','limits')},indent=2))
    print('Anchors:',anchors)


if __name__ == '__main__': main()
