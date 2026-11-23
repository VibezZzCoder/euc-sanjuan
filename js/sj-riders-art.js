/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// The riders' portraits on the picker's stamps and postcard: the original EUC Thrills chooser drawings, from the
// generated element data in js/euc/ui/riderPortraits.js. That module is imported once, the first time the picker opens
// (never at start-up). Each drawing is built with createElementNS from the data, unchanged; the three riders' own marks
// are PNG pixels in the existing logo modules, decoded off the opening path (createImageBitmap from the bytes, or the
// bundled PNG decoder where a browser refuses) and painted on a small canvas laid exactly over the mark's rectangle
// in the drawing, at device-pixel size and with the artwork's own aspect. The page loads no data: or blob: URL.
// Portraits are decorative (aria-hidden): the rider's name is the label. If anything fails to load, the stamps and
// the card keep their ink and text and choosing works as before.
const SVG = 'http://www.w3.org/2000/svg';
const SOURCE_WIDTH = 256; // the decoded marks are kept at most this wide; the full-size pixels are released

export function createRiderArt({ load = () => import('./euc/ui/riderPortraits.js'), decodeBytes = decodeMarkBytes,
  pixelRatio = () => globalThis.devicePixelRatio || 1 } = {}) {
  let data = null, loading = null, failed = false;
  const marks = new Map(); // rider id -> { source (canvas or bitmap), width, height } once decoded; null if it failed
  const pending = new Map(); // rider id -> promise of the decode
  const canvases = new Set(); // every mark canvas built, for painting once decoded and on resize
  const stats = { builds: 0, paints: 0, markFailures: 0 };

  function ready() {
    if (data) return Promise.resolve(data);
    if (!loading) loading = load().then(module => { data = module; return module; }, error => {
      failed = true; console.warn('Rider portraits unavailable', error); return null; });
    return loading;
  }

  // One drawing, a span.portrait holding the svg (and a canvas for a mark). Built from the data: nothing is parsed.
  function build(id) {
    const rows = data?.PORTRAITS?.[id];
    if (!rows) return null;
    const box = document.createElement('span');
    box.className = 'portrait';
    box.setAttribute('aria-hidden', 'true');
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', data.PORTRAIT_VIEWBOX);
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('aria-hidden', 'true');
    const add = (parent, list) => {
      for (const [tag, attrs, children] of list) {
        if (tag === 'mark') continue; // painted on the canvas below, in the same place
        const el = document.createElementNS(SVG, tag);
        for (const name of Object.keys(attrs)) el.setAttribute(name, attrs[name]);
        parent.append(el);
        if (children) add(el, children);
      }
    };
    add(svg, rows);
    box.append(svg);
    if (data.MARKS?.[id]) {
      const canvas = document.createElement('canvas');
      canvas.className = 'portrait-mark';
      canvas.dataset.mark = id;
      canvas.width = canvas.height = 0;
      box.append(canvas);
      canvases.add(canvas);
      decodeMark(id).then(() => paint(canvas));
    }
    stats.builds++;
    return box;
  }

  function decodeMark(id) {
    if (pending.has(id)) return pending.get(id);
    const job = (async () => {
      try {
        const image = await data.MARK_IMAGES[id]();
        const decoded = await decodeBytes(base64Bytes(image.base64));
        marks.set(id, shrink(decoded));
      } catch (error) {
        marks.set(id, null); stats.markFailures++;
        console.warn(`Rider mark unavailable: ${id}`, error);
      }
    })();
    pending.set(id, job);
    return job;
  }

  // Paint one mark canvas at its laid-out size (read only here: on opening and on resize while the picker is open).
  function paint(canvas) {
    const mark = marks.get(canvas.dataset.mark), box = data?.MARKS?.[canvas.dataset.mark];
    if (!mark || !box || !canvas.isConnected) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const ratio = pixelRatio(), w = Math.max(1, Math.round(rect.width * ratio)), h = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width === w && canvas.height === h && canvas.dataset.painted === '1') return;
    canvas.width = w; canvas.height = h;
    const g = canvas.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, w, h);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    // preserveAspectRatio xMidYMid meet: the whole mark, its own aspect, centred in the rectangle
    const scale = Math.min(w / mark.width, h / mark.height), dw = mark.width * scale, dh = mark.height * scale;
    g.drawImage(mark.source, (w - dw) / 2, (h - dh) / 2, dw, dh);
    canvas.dataset.painted = '1';
    stats.paints++;
  }

  function repaint() { for (const canvas of canvases) if (canvas.isConnected) paint(canvas); }

  return { ready, build, repaint, get loaded() { return !!data; }, get failed() { return failed; },
    get stats() { return { ...stats, marks: [...marks.values()].filter(Boolean).length }; } };
}

export function base64Bytes(text) {
  const raw = atob(text), bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

// The PNG bytes to something drawImage takes: the browser's decoder from the bytes (no URL is involved), or the
// bundled decoder when createImageBitmap is missing or refuses.
export async function decodeMarkBytes(bytes) {
  if (typeof createImageBitmap === 'function' && typeof Blob === 'function') {
    try {
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close?.() };
    } catch { /* the bundled decoder below */ }
  }
  const { decodePng } = await import('./euc/render/pngDecode.js');
  const { width, height, rgba } = decodePng(bytes);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.byteLength), width, height), 0, 0);
  return { source: canvas, width, height, release: () => { canvas.width = canvas.height = 0; } };
}

// Keep a copy at most SOURCE_WIDTH wide (halving steps keep the downscale smooth), then release the full size.
function shrink(decoded) {
  let { source, width, height } = decoded;
  if (width <= SOURCE_WIDTH) return { source, width, height };
  while (width > SOURCE_WIDTH) {
    const w = Math.max(SOURCE_WIDTH, Math.round(width / 2)), h = Math.max(1, Math.round(height * w / width));
    const step = document.createElement('canvas');
    step.width = w; step.height = h;
    const g = step.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(source, 0, 0, w, h);
    if (source !== decoded.source) source.width = source.height = 0;
    source = step; width = w; height = h;
  }
  decoded.release?.();
  return { source, width, height };
}
