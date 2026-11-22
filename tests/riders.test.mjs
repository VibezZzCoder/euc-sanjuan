/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// The rider picker: starting rider, the swap transaction (fake tickets, no three.js) and the page contract.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startingRider, saveRider, styleNote, RIDER_KEY, DEFAULT_RIDER } from '../js/sj-riders.js';
import { RiderSelection, faultKind, abortError } from '../js/sj-riders-selection.js';
import { RIDERS, PLAYABLE_RIDERS } from '../js/euc-roster.js';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const store = (values = {}) => {
  const writes = [];
  return { writes, getItem: k => values[k] ?? null, setItem: (k, v) => { writes.push([k, v]); values[k] = v; } };
};
const params = q => new URLSearchParams(q);

test('starting rider: a valid ?rider=, then a valid saved rider, then Cool Rider; bad values ignored; nothing saved', () => {
  const saved = store({ [RIDER_KEY]: 'trollina' });
  assert.equal(startingRider(params('rider=wyldist'), () => saved), 'wyldist');
  assert.equal(startingRider(params(''), () => saved), 'trollina');
  assert.equal(startingRider(params('rider=nobody'), () => saved), 'trollina');
  assert.deepEqual(saved.writes, [], '?rider= is never saved by booting');
  for (const bad of ['cop', '__proto__', 'constructor', '', ' cool-rider', 'COOL-RIDER', 'gnarwheel ', '../wyldist', 'toString'])
    assert.equal(startingRider(params('rider=' + encodeURIComponent(bad)), () => store({ [RIDER_KEY]: bad })), DEFAULT_RIDER, bad);
  assert.equal(startingRider(params(''), () => { throw new Error('blocked'); }), DEFAULT_RIDER);
  assert.equal(startingRider(params(''), () => ({ getItem() { throw new Error('denied'); } })), DEFAULT_RIDER);
  assert.equal(startingRider(null, () => null), DEFAULT_RIDER);
  assert.equal(startingRider({ get: () => ({ toString: () => 'wyldist' }) }, () => null), DEFAULT_RIDER, 'only strings');
});

test('saving accepts only the eleven riders and survives blocked storage', () => {
  const s = store();
  assert.equal(saveRider('cop', () => s), false);
  assert.equal(saveRider('maribel-vargas', () => s), true);
  assert.deepEqual(s.writes, [[RIDER_KEY, 'maribel-vargas']]);
  assert.equal(saveRider('wyldist', () => ({ setItem() { throw new Error('quota'); } })), false);
  assert.equal(PLAYABLE_RIDERS.length, 11);
  assert.ok(!PLAYABLE_RIDERS.includes('cop'));
  assert.notEqual(styleNote('drunkard'), styleNote('cool-rider'));
  for (const id of PLAYABLE_RIDERS) if (id !== 'drunkard') assert.equal(styleNote(id), styleNote('cool-rider'));
});

// ---- The transaction, with fake tickets ----
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function rig(active = 'cool-rider') {
  const r = { active, live: 0, maxLive: 0, prepared: [], cancels: 0, log: [], pending: [], commitResult: true };
  r.api = {
    active: () => r.active,
    prepare(id, { signal }) {
      const d = deferred(), entry = { id, signal, d, disposed: false, committed: false };
      r.live++; r.maxLive = Math.max(r.maxLive, r.live); r.prepared.push(entry); r.pending.push(entry);
      signal.addEventListener('abort', () => d.reject(abortError()), { once: true });
      d.promise.catch(() => { r.live--; });
      return d.promise;
    },
    cancel() { r.cancels++; return Promise.resolve(); },
  };
  r.ticket = (entry, valid = true) => ({
    id: entry.id, get valid() { return valid && !entry.committed && !entry.disposed; },
    commit() { if (r.commitResult === false) return false; entry.committed = true; r.active = entry.id; r.log.push('rig.commit'); r.live--; return true; },
    dispose() { if (!entry.committed && !entry.disposed) { entry.disposed = true; r.live--; r.log.push('rig.dispose'); } },
  });
  r.resolve = (i = r.pending.length - 1, valid) => { const e = r.pending[i]; e.d.resolve(r.ticket(e, valid)); };
  return r;
}
function audio(log) {
  const a = { live: 0, maxLive: 0, prepared: [], pending: [], none: false };
  a.api = {
    prepare(id, { signal }) {
      if (a.none) return null;
      const d = deferred(), entry = { id, signal, d, committed: false, disposed: false };
      a.live++; a.maxLive = Math.max(a.maxLive, a.live); a.prepared.push(entry); a.pending.push(entry);
      signal.addEventListener('abort', () => d.reject(abortError()), { once: true });
      d.promise.catch(() => { a.live--; });
      return d.promise;
    },
  };
  a.resolve = (i = a.pending.length - 1, valid = true) => {
    const e = a.pending[i];
    e.d.resolve({ id: e.id, get valid() { return valid && !e.disposed && !e.committed; },
      commit() { e.committed = true; a.live--; log.push('bank.commit'); return true; },
      dispose() { if (!e.committed && !e.disposed) { e.disposed = true; a.live--; log.push('bank.dispose'); } } });
  };
  return a;
}
const flush = () => new Promise(r => setTimeout(r, 0));
function setup(opts = {}) {
  const r = rig(), log = r.log, a = audio(log), commits = [], states = [];
  const sel = new RiderSelection({ rig: r.api, audio: a.api, visible: opts.visible ?? (() => true), allowed: opts.allowed ?? (() => true),
    onCommit: id => { log.push('onCommit:' + id); commits.push(id); }, onState: (s, id) => states.push([s, id]) });
  return { r, a, sel, commits, states, log };
}

test('both tickets commit in one synchronous turn, then the host is told; nothing else runs between them', async () => {
  const { r, a, sel, commits, log } = setup();
  const run = sel.prepare('wyldist'); await flush();
  assert.equal(r.prepared.length, 1); assert.equal(a.prepared.length, 1);
  r.resolve(); await flush(); assert.deepEqual(commits, [], 'waits for the voice too');
  a.resolve(); assert.equal(await run, true);
  assert.deepEqual(log, ['rig.commit', 'bank.commit', 'onCommit:wyldist']);
  assert.deepEqual(commits, ['wyldist']); assert.equal(r.live, 0); assert.equal(a.live, 0); assert.equal(sel.preparing, false);
});

test('a failure on either side disposes both, aborts the sibling, commits nothing and is classified', async () => {
  for (const side of ['rig', 'audio']) {
    const { r, a, sel, commits } = setup();
    const run = sel.prepare('gnarwheel'); await flush();
    const err = new Error('worker fault');
    if (side === 'rig') { r.pending[0].d.reject(err); } else { a.pending[0].d.reject(err); }
    await assert.rejects(run, /worker fault/);
    assert.deepEqual(commits, []); assert.equal(r.active, 'cool-rider');
    assert.ok(r.prepared[0].signal.aborted && a.prepared[0].signal.aborted, side + ': sibling aborted');
    assert.equal(r.live, 0, side + ': rig candidate freed'); assert.equal(a.live, 0, side + ': bank candidate freed');
  }
  const moduleError = Object.assign(new Error('import failed'), { reloadRequired: true });
  assert.equal(faultKind(moduleError), 'reload');
  assert.equal(faultKind(new Error('decode')), 'retry');
  assert.equal(faultKind(abortError()), 'cancelled');
  assert.equal(faultKind(Object.assign(new Error('x'), { reloadRequired: 'yes' })), 'retry');
});

test('a newer request supersedes the older one: one candidate at a time, only the newest commits', async () => {
  const { r, a, sel, commits } = setup();
  const first = sel.prepare('trollina'); await flush();
  const second = sel.prepare('red-rider');
  await assert.rejects(first, e => e.name === 'AbortError');
  await flush();
  assert.equal(r.prepared.length, 2); assert.equal(r.prepared[1].id, 'red-rider');
  r.resolve(1); a.resolve(1); assert.equal(await second, true);
  assert.deepEqual(commits, ['red-rider']);
  assert.equal(r.maxLive, 1, 'never more than one rig candidate'); assert.equal(a.maxLive, 1, 'never more than one bank candidate');
  // A late ticket of the superseded request is not committable.
  assert.equal(r.prepared[0].committed, false);
});

test('cancel while preparing: rejects as cancelled, nothing committed or saved, the rig preparation is cancelled', async () => {
  const { r, a, sel, commits } = setup();
  const run = sel.prepare('wyldist'); await flush();
  const drained = sel.cancel();
  await assert.rejects(run, e => faultKind(e) === 'cancelled');
  await drained;
  assert.equal(r.cancels, 1); assert.deepEqual(commits, []); assert.equal(sel.preparing, false);
  r.resolve(0); a.resolve(0); await flush(); // native work finishing late changes nothing
  assert.deepEqual(commits, []); assert.equal(r.active, 'cool-rider');
});

test('refused at the last moment: hidden page, a menu that moved on, an invalid ticket or an install that says no', async () => {
  for (const [name, opts, valid, installs] of [['hidden', { visible: () => false }, true, true], ['not allowed', { allowed: () => false }, true, true],
    ['invalid rig ticket', {}, false, true], ['install refused', {}, true, false]]) {
    const { r, a, sel, commits, log } = setup(opts);
    r.commitResult = installs;
    const run = sel.prepare('adonisb2'); await flush();
    r.resolve(0, valid); a.resolve(0); await assert.rejects(run);
    assert.deepEqual(commits, [], name); assert.ok(!log.includes('bank.commit'), name + ': voice not committed');
    assert.equal(a.live, 0, name + ': bank freed');
  }
});

test('no audio context yet: the swap is rig-only; the same rider prepares no rig', async () => {
  const s = setup(); s.a.none = true;
  const run = s.sel.prepare('seal-on-a-wheel'); await flush(); s.r.resolve(); assert.equal(await run, true);
  assert.deepEqual(s.commits, ['seal-on-a-wheel']); assert.deepEqual(s.log, ['rig.commit', 'onCommit:seal-on-a-wheel']);
  const t = setup();
  const same = t.sel.prepare('cool-rider'); await flush();
  assert.equal(t.r.prepared.length, 0, 'no rig rebuilt for the committed rider'); t.a.resolve(); assert.equal(await same, true);
});

test('the page: the picker dialog, its controls and the two buttons that open it', () => {
  const html = read('index.html');
  const dialog = html.match(/<dialog id="riders"[\s\S]*?<\/dialog>/)?.[0];
  assert.ok(dialog);
  const order = [...dialog.matchAll(/<button type="button" class="stamp" data-rider="([a-z0-9-]+)"[^>]*>[\s\S]*?<span class="stamp-name">([^<]+)<\/span><\/button>/g)];
  assert.deepEqual(order.map(m => m[1]), [...PLAYABLE_RIDERS], 'eleven stamps in roster order');
  assert.deepEqual(order.map(m => m[2]), PLAYABLE_RIDERS.map(id => RIDERS[id].name), 'names from the rider data');
  for (const id of ['riders-heading', 'riders-card', 'riders-state', 'riders-name', 'riders-profile', 'riders-style', 'riders-wheel',
    'riders-wheel-blurb', 'riders-status', 'riders-confirm', 'riders-retry', 'riders-cancel']) assert.ok(dialog.includes(`id="${id}"`), id);
  assert.ok(!dialog.includes('id="rider-status"'), 'the HUD warning line keeps its own id');
  assert.match(dialog, /<article id="riders-card" class="postcard" tabindex="0"/, 'the card is a keyboard stop');
  assert.match(dialog, /id="riders-status" role="status"/);
  // Every control is a real button; nothing the security policy refuses; no images for riders.
  assert.doesNotMatch(dialog, /<(input|select|a|img|picture|svg|canvas|video)\b/);
  assert.doesNotMatch(html, /\sstyle\s*=/);
  assert.equal((dialog.match(/<button\b/g) ?? []).length, 14);
  // The openers: right after Ride on the title plaque, right after Return to Plaza de Armas in Pause.
  assert.match(html, /<button id="ride" class="primary">[^<]*<\/button>\s*<button id="choose-rider" type="button" class="secondary rider-pick">/);
  assert.match(html, /<button id="restart" class="secondary">[^<]*<\/button>\s*<button id="change-rider" type="button" class="secondary rider-pick">/);
  const pause = html.match(/<dialog id="pause"[\s\S]*?<\/dialog>/)[0];
  assert.ok(pause.indexOf('id="sound"') < pause.indexOf('id="show-fps"'));
});

test('styles: stamp inks equal the rider data, the dialog has a definite height, no zero-basis flex, no blur', () => {
  const css = read('css/riders.css');
  for (const id of PLAYABLE_RIDERS) assert.match(css, new RegExp(`\\[data-rider=${id}\\]\\{--stamp:${RIDERS[id].swatch}\\}`), id);
  assert.match(css, /#riders\{height:calc\(100dvh[^}]*\)/);
  assert.match(css, /\.stamps\{[^}]*grid-auto-rows:max-content/, 'rows fit their stamps even when the sheet scrolls');
  assert.ok(!/flex:1(;|\})/.test(css), 'no flex:1 shorthand'); assert.doesNotMatch(css, /flex:\s*1\s+1\s+0/);
  assert.doesNotMatch(css, /backdrop-filter|blur\(|linear-gradient\(to|@keyframes/);
  for (const m of css.matchAll(/\{[^}]*\}/g)) assert.doesNotMatch(m[0], /font-size:(1[0-5]|\d)px[^}]*\b(select|input)\b/);
});

test('the picker module: quiet focus, no prefetch on highlight, no markup insertion', () => {
  const src = read('js/sj-riders.js');
  assert.doesNotMatch(src, /\.focus\(\)/, 'menu focus uses focus(QUIET)');
  assert.doesNotMatch(src, /prefetch|prepareAppearance|import\(/, 'browsing loads nothing');
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|\.style\.|\.style\s*=|setProperty/.test(src), 'no markup insertion or inline styles');
  assert.match(src, /host\.notify\('rider', id\)/);
  // Choosing returns to the title or Pause; riding is a separate step, so the picker never says "Ride as".
  assert.match(src, /\[keep \? 'Keep' : 'Choose', ''\]/); assert.match(src, /label = `\$\{verb\} \$\{spec\.name\}\$\{tail\}`/);
  assert.match(src, /stamp again, or use Choose, to pick this rider/);
  assert.doesNotMatch(src, /Ride as/);
  // While preparing, nothing the player is on becomes disabled (focus would jump to Cancel): presses are ignored instead.
  assert.doesNotMatch(src, /\.disabled = mode/);
  assert.doesNotMatch(read('js/sj-riders-selection.js'), /from\s.three|document\./, 'the transaction is headless');
});

test('provenance: the borrowed rider-swap code is recorded and its San Juan hashes are current', async () => {
  const { createHash } = await import('node:crypto');
  const doc = JSON.parse(read('provenance/riders-import.json'));
  assert.ok(doc.files.length >= 1);
  for (const f of doc.files) {
    for (const k of ['path', 'donor', 'sourcePath', 'sourceBytes', 'sourceSha256', 'editionSha256', 'derived']) assert.ok(f[k], f.path + ' ' + k);
    assert.ok(doc.donors[f.donor], f.donor);
    const hash = createHash('sha256').update(fs.readFileSync(new URL('../' + f.path, import.meta.url))).digest('hex');
    assert.equal(hash, f.editionSha256, f.path + ' changed: refresh provenance/riders-import.json');
  }
  assert.match(read('credits.html'), /provenance\/riders-import\.json/);
});
