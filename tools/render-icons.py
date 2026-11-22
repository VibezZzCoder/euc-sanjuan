#!/usr/bin/env python3
# El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan
"""Render the Home Screen icons from their SVG sources (assets/icons/*.svg) with ffmpeg's librsvg decoder, then store
them as opaque 8-bit RGB PNGs (Pillow). `--check` re-renders in memory and compares sizes and pixels with the files."""
import argparse
import io
import subprocess
from pathlib import Path
from PIL import Image, ImageChops

ICONS = Path(__file__).resolve().parent.parent / 'assets' / 'icons'
OUTPUTS = [('icon.svg', 'icon-180.png', 180), ('icon.svg', 'icon-192.png', 192), ('icon.svg', 'icon-512.png', 512),
           ('icon-maskable.svg', 'icon-maskable-512.png', 512)]


def render(svg, size):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-width', str(size), '-height', str(size), '-i', str(ICONS / svg),
                          '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'], check=True, capture_output=True).stdout
    image = Image.open(io.BytesIO(raw)).convert('RGBA')
    if image.size != (size, size): raise ValueError(f'{svg}: rendered {image.size}, wanted {size}')
    if image.getextrema()[3][0] < 255: raise ValueError(f'{svg}: the art must be opaque edge to edge')
    return image.convert('RGB')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    for svg, png, size in OUTPUTS:
        image = render(svg, size)
        if args.check:
            stored = Image.open(ICONS / png)
            if stored.mode != 'RGB' or stored.size != (size, size): raise SystemExit(f'{png}: {stored.mode} {stored.size}')
            diff = ImageChops.difference(stored, image).getextrema()
            if max(high for _, high in diff) > 2: raise SystemExit(f'{png} differs from its source; run tools/render-icons.py')
        else:
            image.save(ICONS / png, optimize=True)
        print(('checked' if args.check else 'wrote'), png, size)


if __name__ == '__main__':
    main()
