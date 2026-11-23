/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// The riders' portraits in the picker: the generated drawing data (js/euc/ui/riderPortraits.js), the three marks, the
// page code that builds them (js/sj-riders-art.js, against a stand-in document) and the CSS that places the marks.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { PORTRAITS, MARKS, MARK_IMAGES, PORTRAIT_VIEWBOX } from '../js/euc/ui/riderPortraits.js';
import { PLAYABLE_RIDERS } from '../js/euc-roster.js';
import { createRiderArt, base64Bytes } from '../js/sj-riders-art.js';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const ATTRS = new Set(['d', 'fill', 'opacity', 'stroke', 'stroke-width', 'stroke-linecap', 'x', 'y', 'width', 'height', 'rx', 'ry',
  'cx', 'cy', 'r']);
const TAGS = new Set(['path', 'g', 'rect', 'circle', 'ellipse', 'mark']);
const walk = (rows, visit) => { for (const row of rows) { visit(row); if (row[2]) walk(row[2], visit); } };
// Element counts of the original drawings, each including its root svg (src/ui/menus.ts at the pinned commit).
const ELEMENTS = { 'cool-rider': 7, trollina: 18, 'red-rider': 10, adonisb2: 11, 'maribel-vargas': 15, 'wheel-in-motion': 16,
  drunkard: 21, 'flo-with-zo': 10, 'seal-on-a-wheel': 15, wyldist: 17, gnarwheel: 17 };

test('every playable rider has the original drawing, element for element, and nothing else', () => {
  assert.deepEqual(Object.keys(PORTRAITS), [...PLAYABLE_RIDERS]);
  assert.equal(PORTRAIT_VIEWBOX, '0 0 96 96');
  for (const id of PLAYABLE_RIDERS) {
    let count = 1;
    walk(PORTRAITS[id], ([tag, attrs, children]) => {
      count++;
      assert.ok(TAGS.has(tag), `${id}: ${tag}`);
      for (const [name, value] of Object.entries(attrs)) {
        assert.ok(ATTRS.has(name), `${id}: attribute ${name}`);
        assert.equal(typeof value === 'string' ? /[:()<>]|url|style/i.test(value) : false, false, `${id}: ${name}=${value}`);
      }
      if (children) assert.equal(tag, 'g');
    });
    assert.equal(count, ELEMENTS[id], id);
  }
  assert.ok(!('cop' in PORTRAITS), 'the officer is not a playable rider');
});

test('the generated module is the recorded one, derived from the pinned chooser source and logo modules', () => {
  const manifest = JSON.parse(read('js/euc/MANIFEST.json'));
  const entry = manifest.files['ui/riderPortraits.js'];
  assert.equal(entry.outputSha256, sha(fs.readFileSync(new URL('../js/euc/ui/riderPortraits.js', import.meta.url))));
  assert.equal(manifest.commit, '5f45fff19b258e140833841ba2473069af751a12');
  assert.deepEqual(entry.derivedFrom.map(o => o.source), ['src/ui/menus.ts', 'src/data/mvLogoAsset.ts', 'src/data/wimLogoAsset.ts', 'src/data/gnarwheelLogoAsset.ts']);
  assert.equal(entry.derivedFrom[0].sourceSha256, 'a5adad37dafbf8fc3b807e4778b6546b00e22e79b47ed3f0c3b1a34b963e0d8f');
  assert.ok(manifest.deferred.includes('ui/riderPortraits.js') && !manifest.eager.includes('ui/riderPortraits.js'), 'never loaded at start-up');
  assert.doesNotMatch(read('index.html'), /riderPortraits|LogoAsset/, 'not preloaded');
});

test('three marks, placed as the original places them, each the reviewed PNG with its own aspect', async () => {
  assert.deepEqual(Object.keys(MARKS), ['maribel-vargas', 'wheel-in-motion', 'gnarwheel']);
  assert.deepEqual(MARKS['maribel-vargas'], { x: 39.5, y: 75, width: 17, height: 14.2, preserveAspectRatio: 'xMidYMid meet' });
  assert.deepEqual(MARKS['wheel-in-motion'], { x: 35, y: 79, width: 26, height: 11.46, preserveAspectRatio: 'xMidYMid meet' });
  assert.deepEqual(MARKS.gnarwheel, { x: 33, y: 67, width: 30, height: 30 / (1499 / 375), preserveAspectRatio: 'xMidYMid meet' });
  const css = read('css/riders.css');
  for (const [id, box] of Object.entries(MARKS)) {
    let marks = 0;
    walk(PORTRAITS[id], ([tag, attrs]) => { if (tag === 'mark') { marks++; assert.deepEqual(attrs, { x: box.x, y: box.y, width: box.width, height: box.height }); } });
    assert.equal(marks, 1, id);
    const image = await MARK_IMAGES[id]();
    const bytes = base64Bytes(image.base64);
    assert.equal(sha(bytes), image.sha256, `${id}: the PNG is the reviewed one`);
    const view = new DataView(bytes.buffer, bytes.byteOffset);
    assert.deepEqual([view.getUint32(16), view.getUint32(20)], [image.width, image.height], `${id}: PNG size`);
    // the canvas over the mark: the same rectangle, in percent of the 96-unit drawing
    const rule = css.match(new RegExp(`\\.portrait-mark\\[data-mark=${id}\\]\\{left:([\\d.]+)%;top:([\\d.]+)%;width:([\\d.]+)%;height:([\\d.]+)%\\}`));
    assert.ok(rule, `${id}: CSS rule`);
    [box.x, box.y, box.width, box.height].forEach((v, i) => assert.ok(Math.abs(Number(rule[i + 1]) - v / 96 * 100) < 1e-3, `${id}: ${rule[0]}`));
  }
  // nothing the original drew after a mark covers it (paint order is kept by the overlay)
  for (const id of ['maribel-vargas', 'wheel-in-motion']) assert.equal(PORTRAITS[id].at(-1)[0], 'mark', id);
  const after = PORTRAITS.gnarwheel.slice(PORTRAITS.gnarwheel.findIndex(r => r[0] === 'mark') + 1);
  for (const [, a] of after) {
    // paths: the y of each absolute move (these shapes then step down or sideways); circles and rects: their top
    const top = a.d ? Math.min(...[...a.d.matchAll(/M[\d.]+[ ,]([\d.]+)/g)].map(m => Number(m[1])))
      : a.r ? Number(a.cy) - Number(a.r) : Number(a.y);
    assert.ok(top >= MARKS.gnarwheel.y + MARKS.gnarwheel.height, `gnarwheel: a later shape starts at ${top}`);
  }
});

// ---- the page code against a stand-in document
function fakeDocument() {
  const made = [];
  const element = (ns, tag) => {
    const el = { ns, tag, attrs: {}, children: [], dataset: {}, className: '', isConnected: false, width: 300, height: 150,
      setAttribute(name, value) { this.attrs[name] = String(value); }, append(...c) { this.children.push(...c); },
      getBoundingClientRect: () => ({ width: 0, height: 0 }), getContext: () => null };
    made.push(el);
    return el;
  };
  return { made, createElement: tag => element('html', tag), createElementNS: (ns, tag) => element(ns, tag) };
}

test('building a portrait: SVG elements from the data, decorative, no style, no URL, no ids; built once per call', async () => {
  const doc = fakeDocument();
  globalThis.document = doc;
  try {
    const art = createRiderArt({ decodeBytes: async () => ({ source: {}, width: 10, height: 10 }) });
    assert.equal(art.loaded, false);
    assert.equal(art.build('gnarwheel'), null, 'nothing before the data has arrived');
    await art.ready();
    for (const id of PLAYABLE_RIDERS) {
      const box = art.build(id);
      assert.equal(box.attrs['aria-hidden'], 'true');
      const svg = box.children[0];
      assert.equal(svg.ns, 'http://www.w3.org/2000/svg');
      assert.equal(svg.attrs.viewBox, '0 0 96 96');
      assert.equal(box.children.length, MARKS[id] ? 2 : 1, id);
      if (MARKS[id]) assert.equal(box.children[1].tag, 'canvas');
    }
    for (const el of doc.made) {
      for (const [name, value] of Object.entries(el.attrs)) {
        assert.notEqual(name, 'style'); assert.notEqual(name, 'id'); assert.notEqual(name, 'href');
        assert.doesNotMatch(value, /data:|blob:|javascript:/);
      }
    }
    assert.equal(art.stats.builds, 11);
  } finally { delete globalThis.document; }
});

test('a failed load leaves the picker as it was (no portrait, a warning, no throw)', async () => {
  const warn = console.warn; let warned = 0; console.warn = () => { warned++; };
  try {
    const art = createRiderArt({ load: () => Promise.reject(new Error('offline')) });
    assert.equal(await art.ready(), null);
    assert.equal(art.failed, true); assert.equal(art.build('cool-rider'), null); assert.equal(warned, 1);
  } finally { console.warn = warn; }
});

test('the page code: one fixed import of the drawings, no markup or style insertion, nothing at start-up', () => {
  const src = read('js/sj-riders-art.js');
  assert.deepEqual([...src.matchAll(/import\(\s*'([^']+)'\s*\)/g)].map(m => m[1]), ['./euc/ui/riderPortraits.js', './euc/render/pngDecode.js']);
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|\.style\b|setProperty|createObjectURL|toDataURL|['"`](?:data|blob):/.test(src));
  assert.match(src, /createElementNS\(SVG, tag\)/);
  // the picker asks for the art only when it opens
  const riders = read('js/sj-riders.js');
  assert.match(riders, /stamp\.scrollIntoView\?\.\(\{ block: 'nearest' \}\);\n {4}showArt\(\);\n {4}return true;/);
  assert.doesNotMatch(riders, /import\(/);
});
