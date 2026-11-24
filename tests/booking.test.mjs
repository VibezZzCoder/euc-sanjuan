/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// The booking without a browser: the director's clock, the placement contract, the page's #booking / #chase / Pause row
// contract and its phone rules, and ?cop=0 building nothing. CPU only.
// The timer and transfer cases follow the booking tests of the San Francisco edition of EUC Thrills (MIT, VibezZzCoder).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { BOOKING_RULES, BOOKING_TEXT, BOOKING_SITE, createBookingDirector, createBookingPlacement, afterRelease } from '../js/sj-booking-rules.js';
import { createChaseDirector } from '../js/sj-dorkins-chase.js';

const V = new URL('../vendor/three/', import.meta.url).href;
registerHooks({ resolve(s, c, next) {
  if (s === 'three' || s === 'three/webgpu') return { url: V + 'build/three.webgpu.js', shortCircuit: true };
  if (s === 'three/tsl') return { url: V + 'build/three.tsl.js', shortCircuit: true };
  return next(s, c);
} });

test('booking: frozen while not visible, transfer asked until a checked arrival, release waits for the player', () => {
  const booking = createBookingDirector();
  assert.equal(booking.start('Trollina', 4), true);
  assert.equal(booking.start('other', 4), false);
  assert.equal(booking.update(100, false), null);
  assert.equal(booking.state.age, 0);
  assert.equal(booking.update(BOOKING_RULES.transferSeconds), 'transfer');
  assert.equal(booking.update(0.49), null);
  assert.equal(booking.update(0.02), 'transfer');
  assert.equal(booking.arrive(), true); assert.equal(booking.arrive(), false);
  assert.equal(booking.update(BOOKING_RULES.intakeSeconds), 'signature');
  assert.equal(booking.update(BOOKING_RULES.signatureSeconds), 'released');
  assert.equal(booking.update(100), null);
  assert.equal(booking.active, true, 'release waits for the player');
  assert.equal(booking.finish(), true); assert.equal(booking.active, false);
  assert.equal(booking.start('Seal on a Wheel', 4), true); assert.equal(booking.state.number, 2);
  assert.match(BOOKING_TEXT.captured.reply, /Cuartelillo del Monociclo/);
});

test('placement: Skip and release share one checked path; a refusal changes nothing', () => {
  const chase = createChaseDirector({ random: () => 0 }); chase.soon(); chase.update(0.1, { riding: true });
  chase.update(0.1, { riding: true, sees: true, distance: 3 }); for (let i = 0; i < 4; i++) { chase.knockedDown(); chase.state.recovery = 0; }
  const booking = createBookingDirector(); booking.start('Cool Rider', 4);
  const calls = [];
  let allow = false;
  const placement = createBookingPlacement({ booking, chase, place: (site, departure) => { calls.push([site.x, site.heading, departure]); return allow; } });
  assert.equal(placement.release(), null, 'blocked from the capture spot (Skip before the desk)');
  assert.deepEqual(calls.map(c => c[2]), [1.2, 1.2, 1.2]);
  assert.equal(chase.state.phase, 'captured'); assert.equal(booking.active, true);
  assert.equal(placement.transfer(), null); assert.equal(booking.state.phase, 'captured');
  allow = true;
  assert.ok(placement.transfer()); assert.equal(booking.state.phase, 'intake'); assert.equal(calls.at(-1)[2], 0);
  const site = placement.release();
  assert.deepEqual([site.x, site.heading], [BOOKING_SITE.release[0].x, BOOKING_SITE.release[0].heading]);
  assert.equal(chase.state.phase, 'waiting'); assert.equal(booking.active, false);
  assert.ok(chase.state.wait >= 75 && chase.state.wait <= 150);
});

test('page contract: #booking, #chase, the Pause row and the map legend', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const dialog = html.match(/<dialog id="booking"[\s\S]*?<\/dialog>/)?.[0] ?? '';
  for (const id of ['booking-heading', 'booking-subtitle', 'booking-line', 'booking-reply', 'booking-rider', 'booking-number', 'booking-stamp', 'booking-note'])
    assert.match(dialog, new RegExp(`id="${id}"`), id);
  assert.match(dialog, /<button id="booking-skip" class="secondary">Skip booking<\/button>/);
  assert.match(dialog, /<button id="booking-release" class="primary" disabled>Back to riding<\/button>/);
  assert.match(dialog, /aria-labelledby="booking-heading"/);
  assert.match(dialog, /id="booking-heading" tabindex="-1"/);
  assert.doesNotMatch(dialog, /style=|on[a-z]+=/);
  assert.match(html, /<p id="chase" class="chase" hidden role="status"><\/p>/);
  const fps = html.indexOf('id="show-fps"'), cop = html.indexOf('id="dorkins"'), next = html.indexOf('<h3 class="tag">Controls</h3>');
  assert.ok(fps > 0 && cop > fps && cop < next, 'the patrol row follows Show FPS counter');
  assert.match(html, /<label class="row check"><span>Officer Dorkins on patrol<\/span> <input id="dorkins" type="checkbox" checked><\/label>/);
  assert.match(html, /<li id="legend-dorkins" hidden>/);
  for (const word of ['Policía', 'Police', 'POLICE', 'Sheriff', 'Department']) assert.ok(!dialog.includes(word), `no agency word: ${word}`);
});

test('phone rules in booking.css: definite dialog height, no zero-basis flex, clear backdrop, 44 px targets', () => {
  const css = readFileSync(new URL('../css/booking.css', import.meta.url), 'utf8');
  assert.match(css, /#booking\{[^}]*height:min\(/);
  assert.doesNotMatch(css, /flex:\s*1(?![\d.]|\s+1\s+auto)/, 'no flex:1');
  assert.match(css, /#booking::backdrop\{background:transparent\}/);
  assert.doesNotMatch(css, /backdrop-filter|blur\(/);
  for (const m of css.matchAll(/min-height:(\d+)px/g)) assert.ok(Number(m[1]) >= 44, `target ${m[0]}`);
});

test('?cop=0 builds nothing: no rig, graph, desk, sound or notice', async () => {
  const { createDorkins } = await import('../js/sj-dorkins.js');
  const touched = [];
  const trap = new Proxy({}, { get(_, key) { touched.push(String(key)); throw new Error('touched ' + String(key)); } });
  const row = { hidden: false };
  const host = { params: new URLSearchParams('cop=0'), $: id => (id === 'dorkins' ? { closest: () => row } : null),
    get scene() { return trap; }, get world() { return trap; }, get life() { return trap; }, get camera() { return trap; } };
  assert.equal(await createDorkins(host), null);
  assert.deepEqual(touched, []);
  assert.equal(row.hidden, true, 'the Pause row is hidden');
});

test('after a successful release: riding stays, an interrupted start pauses on the promenade, other owners keep the game', () => {
  assert.equal(afterRelease('riding'), 'ride');
  assert.equal(afterRelease('booking'), 'pause', 'the start was dropped: the empty booking state becomes Pause');
  assert.equal(afterRelease('paused', { pauseOpen: false }), 'pause', 'paused without its dialog (a page shown again)');
  assert.equal(afterRelease('paused', { pauseOpen: true }), 'keep');
  for (const state of ['leaving', 'error', 'loading', 'title', 'map']) assert.equal(afterRelease(state), 'keep', state);
});
