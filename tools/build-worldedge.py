# El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan
"""World edge heights (outside the playable polygon) — © 2026 VibezZzCoder, MIT. Heights: USGS 1 m DEM (public domain).

Offline, bounded: reads the already-downloaded USGS_1M_19_x80y205 tile from the directory named by SJ_DATA_DIR (no network) and
writes js/sj-worldedge-data.js with two int16 height grids in the game's local frame (azimuthal equidistant,
lat 18.4655 lon -66.1167, x = east, z = -north):
  near — 8 m grid from x = 1344 (stitched to the terrain's east edge x = 1340 in JS) to x = 1536 over Puerta de Tierra (drawn at the land cut);
  far  — 32 m grid over the rest of the tile (Isla de Cabras, Cataño, Isla Grande / Miramar, Puerta de Tierra east,
         Condado) for the backdrop.
Water (DEM nodata) is stored as -32768; far vertices excluded (near the playable land or inside the near grid) as -32767. Heights are centimetres (near) / decimetres (far).

Python deps: numpy and Pillow only. The tile is LZW + floating-point predictor; Pillow decodes it.
Projection: UTM 19N (NAD83, GRS80) -> geographic by the Krüger n-series, then geographic -> local by the geodesic
(Vincenty inverse) distance/azimuth from the origin, which is the definition of the ellipsoidal azimuthal equidistant
projection that tools/build-city.py uses through pyproj. Checked against data/terrain.i16 during regeneration.
"""
import os
from pathlib import Path
import argparse
import base64, hashlib, json, math, sys

# Validate options before importing GIS dependencies or opening any input/output.
if __name__ == "__main__":
    argparse.ArgumentParser(description=__doc__).parse_args()
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
TIF = Path(os.environ.get('SJ_DATA_DIR', ROOT / 'inputs')) / 'USGS_1M_19_x80y205_PR_PuertoRicoUSVI_D24.tif'
OUT = ROOT / 'js/sj-worldedge-data.js'
LON0, LAT0 = -66.1167, 18.4655
NEAR = dict(x0=1344.0, step=8.0, nx=25, z0=-432.0, nz=101)         # x 1344..1536, z -432..368 (perf round: 8 m; far rows aligned)
FAR = dict(step=32.0, x0=-4800.0, z0=-3600.0, nx=316, nz=190)       # x -4800..5280, z -3600..2448 (tile bounds)
BUFFER = 64.0  # far vertices this close to the playable land (land.u8) are excluded: the islet is drawn by the game

def utm_inverse(E, N):
    a, f, k0 = 6378137.0, 1 / 298.257222101, 0.9996
    n = f / (2 - f); A = a / (1 + n) * (1 + n**2 / 4 + n**4 / 64)
    beta = [n / 2 - 2 * n**2 / 3 + 37 * n**3 / 96, n**2 / 48 + n**3 / 15, 17 * n**3 / 480]
    delta = [2 * n - 2 * n**2 / 3 - 2 * n**3, 7 * n**2 / 3 - 8 * n**3 / 5, 56 * n**3 / 15]
    xi, eta = N / (k0 * A), (E - 500000.0) / (k0 * A)
    xp, ep = xi.copy(), eta.copy()
    for j, b in enumerate(beta, 1):
        xp -= b * np.sin(2 * j * xi) * np.cosh(2 * j * eta); ep -= b * np.cos(2 * j * xi) * np.sinh(2 * j * eta)
    chi = np.arcsin(np.sin(xp) / np.cosh(ep))
    phi = chi + sum(d * np.sin(2 * j * chi) for j, d in enumerate(delta, 1))
    lam = math.radians(-69.0) + np.arctan2(np.sinh(ep), np.cos(xp))
    return phi, lam

def utm_forward(phi, lam):
    a, f, k0 = 6378137.0, 1 / 298.257222101, 0.9996
    n = f / (2 - f); A = a / (1 + n) * (1 + n**2 / 4 + n**4 / 64)
    alpha = [n / 2 - 2 * n**2 / 3 + 5 * n**3 / 16, 13 * n**2 / 48 - 3 * n**3 / 5, 61 * n**3 / 240]
    e = math.sqrt(f * (2 - f))
    t = np.sinh(np.arctanh(np.sin(phi)) - e * np.arctanh(e * np.sin(phi)))
    dl = lam - math.radians(-69.0)
    xp = np.arctan2(t, np.cos(dl)); ep = np.arctanh(np.sin(dl) / np.sqrt(1 + t * t))
    xi, eta = xp.copy(), ep.copy()
    for j, al in enumerate(alpha, 1):
        xi += al * np.sin(2 * j * xp) * np.cosh(2 * j * ep); eta += al * np.cos(2 * j * xp) * np.sinh(2 * j * ep)
    return 500000.0 + k0 * A * eta, k0 * A * xi

def aeqd_forward(phi, lam):
    """Vincenty inverse from the origin (WGS84): returns local x (east), z (-north)."""
    a, f = 6378137.0, 1 / 298.257223563; b = a * (1 - f)
    p1 = math.radians(LAT0); U1 = math.atan((1 - f) * math.tan(p1))
    U2 = np.arctan((1 - f) * np.tan(phi)); L = lam - math.radians(LON0)
    lamb = L.copy()
    for _ in range(60):
        sl, cl = np.sin(lamb), np.cos(lamb)
        ss = np.sqrt((np.cos(U2) * sl)**2 + (math.cos(U1) * np.sin(U2) - math.sin(U1) * np.cos(U2) * cl)**2)
        cs = math.sin(U1) * np.sin(U2) + math.cos(U1) * np.cos(U2) * cl
        sig = np.arctan2(ss, cs)
        sa = np.where(ss == 0, 0.0, math.cos(U1) * np.cos(U2) * sl / np.where(ss == 0, 1, ss))
        c2a = 1 - sa * sa
        c2sm = np.where(c2a == 0, 0.0, cs - 2 * math.sin(U1) * np.sin(U2) / np.where(c2a == 0, 1, c2a))
        C = f / 16 * c2a * (4 + f * (4 - 3 * c2a))
        prev = lamb
        lamb = L + (1 - C) * f * sa * (sig + C * ss * (c2sm + C * cs * (-1 + 2 * c2sm**2)))
        if np.nanmax(np.abs(lamb - prev)) < 1e-13: break
    u2 = c2a * (a * a - b * b) / (b * b)
    A = 1 + u2 / 16384 * (4096 + u2 * (-768 + u2 * (320 - 175 * u2)))
    B = u2 / 1024 * (256 + u2 * (-128 + u2 * (74 - 47 * u2)))
    ds = B * ss * (c2sm + B / 4 * (cs * (-1 + 2 * c2sm**2) - B / 6 * c2sm * (-3 + 4 * ss**2) * (-3 + 4 * c2sm**2)))
    s = b * A * (sig - ds)
    az = np.arctan2(np.cos(U2) * np.sin(lamb), math.cos(U1) * np.sin(U2) - math.sin(U1) * np.cos(U2) * np.cos(lamb))
    return s * np.sin(az), -s * np.cos(az)

def aeqd_inverse(x, z):
    """Local -> geographic by Newton iteration on aeqd_forward (start: spherical estimate)."""
    R = 6378137.0
    phi = math.radians(LAT0) + (-z) / R; lam = math.radians(LON0) + x / (R * math.cos(math.radians(LAT0)))
    for _ in range(6):
        fx, fz = aeqd_forward(phi, lam)
        d = 1e-7
        ax, az_ = aeqd_forward(phi + d, lam); bx, bz = aeqd_forward(phi, lam + d)
        j11, j12, j21, j22 = (ax - fx) / d, (bx - fx) / d, (az_ - fz) / d, (bz - fz) / d
        rx, rz = x - fx, z - fz; det = j11 * j22 - j12 * j21
        phi = phi + (j22 * rx - j12 * rz) / det; lam = lam + (-j21 * rx + j11 * rz) / det
    return phi, lam

def load_dem():
    Image.MAX_IMAGE_PIXELS = None
    im = Image.open(TIF)
    tags = im.tag_v2
    tx, ty = tags[33922][3], tags[33922][4]
    return np.asarray(im, dtype=np.float32), tx, ty

def sample(dem, tx, ty, x, z):
    """Bilinear DEM height at local points (PixelIsArea centres, as build-city.py); NaN where any tap is nodata."""
    phi, lam = aeqd_inverse(x, z)
    E, N = utm_forward(phi, lam)
    fx, fy = E - tx - 0.5, ty - N - 0.5
    ix, iy = np.floor(fx).astype(int), np.floor(fy).astype(int)
    u, v = fx - ix, fy - iy
    ok = (ix >= 0) & (iy >= 0) & (ix < dem.shape[1] - 1) & (iy < dem.shape[0] - 1)
    ix, iy = np.clip(ix, 0, dem.shape[1] - 2), np.clip(iy, 0, dem.shape[0] - 2)
    a, b, c, d = dem[iy, ix], dem[iy, ix + 1], dem[iy + 1, ix], dem[iy + 1, ix + 1]
    valid = ok & (a > -1000) & (b > -1000) & (c > -1000) & (d > -1000)
    h = a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v
    return np.where(valid, h, np.nan)

def grid(dem, tx, ty, g, scale):
    xs = g['x0'] + np.arange(g['nx']) * g['step']; zs = g['z0'] + np.arange(g['nz']) * g['step']
    xx, zz = np.meshgrid(xs, zs)
    h = sample(dem, tx, ty, xx.ravel(), zz.ravel()).reshape(xx.shape)
    q = np.where(np.isnan(h), -32768, np.clip(np.rint(h * scale), -32767, 32767)).astype('<i2')
    return q

def main():
    dem, tx, ty = load_dem()
    # Check: the projection chain reproduces the game's terrain heights (built with pyproj) on the shared 2 m grid.
    city = json.loads((ROOT / 'data/city.json').read_text()); t = city['terrain']
    hq = np.fromfile(ROOT / 'data/terrain.i16', dtype='<i2').reshape(t['nz'], t['nx']).astype(np.float64) / 100
    land = np.fromfile(ROOT / 'data/land.u8', dtype='u1').reshape(t['nz'], t['nx'])
    rng = np.random.default_rng(7); js, is_ = np.nonzero(land); pick = rng.choice(len(js), 4000, replace=False)
    px, pz = t['x0'] + is_[pick] * t['step'], t['z0'] + js[pick] * t['step']
    mine = sample(dem, tx, ty, px.astype(float), pz.astype(float)); ref = hq[js[pick], is_[pick]]
    ok = ~np.isnan(mine); err = np.abs(mine[ok] - ref[ok])
    check = {'samples': int(ok.sum()), 'medianAbsErr': round(float(np.median(err)), 4), 'p99AbsErr': round(float(np.percentile(err, 99)), 4),
             'maxAbsErr': round(float(err.max()), 4)}
    print('terrain check', check)
    if check['p99AbsErr'] > 0.05: sys.exit('projection check failed')
    near = grid(dem, tx, ty, NEAR, 100); far = grid(dem, tx, ty, FAR, 10)
    # Near: the first column (x = 1344) keeps the DEM only beside the cut's dry rows, so the drawn shoreline leaves the
    # game's own coast corner instead of jogging along the DEM fringe outside it.
    zs = NEAR['z0'] + np.arange(NEAR['nz']) * NEAR['step']
    near[(zs < -250) | (zs > 138), 0] = -32768
    # Far: exclude vertices within BUFFER of playable land and inside the near grid (x < 1728, z -432..368 exclusive).
    k = int(BUFFER // 8); blocks = land[: t['nz'] // 4 * 4, : t['nx'] // 4 * 4].reshape(t['nz'] // 4, 4, t['nx'] // 4, 4).max(axis=(1, 3))
    c = np.pad(blocks, k).astype(np.int32).cumsum(0).cumsum(1); c = np.pad(c, ((1, 0), (1, 0)))
    win = c[2 * k + 1:, 2 * k + 1:] - c[:-2 * k - 1, 2 * k + 1:] - c[2 * k + 1:, :-2 * k - 1] + c[:-2 * k - 1, :-2 * k - 1]
    xs = FAR['x0'] + np.arange(FAR['nx']) * FAR['step']; zf = FAR['z0'] + np.arange(FAR['nz']) * FAR['step']
    xx, zz = np.meshgrid(xs, zf)
    bi = np.floor((xx - t['x0']) / 8).astype(int); bj = np.floor((zz - t['z0']) / 8).astype(int)
    inside = (bi >= 0) & (bj >= 0) & (bi < win.shape[1]) & (bj < win.shape[0])
    nearLand = np.zeros(xx.shape, bool); nearLand[inside] = win[bj[inside], bi[inside]] > 0
    inNear = (xx < NEAR['x0'] + (NEAR['nx'] - 1) * NEAR['step']) & (xx > NEAR['x0'] - 64) & (zz > NEAR['z0']) & (zz < NEAR['z0'] + (NEAR['nz'] - 1) * NEAR['step'])
    far[nearLand | inNear] = -32767
    src = hashlib.sha256(TIF.read_bytes()).hexdigest()
    b64 = lambda q: base64.b64encode(q.tobytes()).decode()
    body = (
        '/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT code — https://github.com/VibezZzCoder/euc-sanjuan — Data: USGS 3DEP, public domain */\n' '// Generated by tools/build-worldedge.py — do not edit. USGS 1 m DEM (public domain), tile '
        f'{TIF.name} sha256 {src}.\n'
        f'// Projection check against data/terrain.i16: {json.dumps(check)}\n'
        f'export const NEAR={json.dumps({**NEAR, "scale": 0.01})};\n'
        f'export const FAR={json.dumps({**FAR, "scale": 0.1})};\n'
        f'export const NEAR_B64="{b64(near)}";\n'
        f'export const FAR_B64="{b64(far)}";\n')
    OUT.write_text(body)
    print('wrote', OUT, len(body), 'bytes; near land', int((near > -32768).sum()), 'far land', int((far > -32768).sum()))

if __name__ == '__main__':
    main()
