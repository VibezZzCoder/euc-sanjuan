/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Officer Dorkins, the rules without the world: the chase referee with San Juan's intervals, the skate-spot and patrol
// gates, the paddle swing and its swept contact (cases ported from the San Francisco edition's tests). CPU only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CHASE_RULES, CHASE_TEXT, createChaseDirector, chaseHudView } from '../js/sj-dorkins-chase.js';
import { createSwing, sweptHit, SWING } from '../js/sj-dorkins-swing.js';
import { createPaddleContact } from '../js/sj-dorkins-contact.js';
import { seededRandom } from '../js/sj-life-random.js';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const ride = (d, seconds, facts = {}) => { let event = null; for (let t = 0; t < seconds - 1e-9; t += 0.05) event = d.update(0.05, { riding: true, ...facts }) ?? event; return event; };

test('San Juan intervals: first attempt after 40–75 s of riding, later ones 75–150 s', () => {
  for (const seed of ['dorkins', 'a', 'b', 'c', 'd']) {
    const d = createChaseDirector({ random: seededRandom(seed) });
    assert.ok(d.state.wait >= 40 && d.state.wait <= 75, `first wait ${d.state.wait}`);
    assert.equal(d.update(100, { riding: false }), null, 'no clock while not riding');
    assert.ok(d.state.wait >= 40);
    assert.equal(ride(d, d.state.wait - 0.2), null);
    assert.equal(ride(d, 0.4), 'ambush');
    d.update(0.1, { riding: true, sees: true, distance: 5 });
    for (let i = 0; i < 4; i++) { assert.equal(d.knockedDown(), true); d.state.recovery = 0; }
    assert.equal(d.state.phase, 'captured');
    assert.equal(d.release(), true);
    assert.ok(d.state.wait >= 75 && d.state.wait <= 150, `again ${d.state.wait}`);
  }
  assert.deepEqual([CHASE_RULES.firstMin, CHASE_RULES.firstMax, CHASE_RULES.againMin, CHASE_RULES.againMax], [40, 75, 75, 150]);
});

test('after an escape he goes and the next attempt is 75–150 s later', () => {
  const d = createChaseDirector({ random: () => 0.5 });
  d.soon(); assert.equal(d.update(0.1, { riding: true }), 'ambush');
  d.update(0.1, { riding: true, sees: true, distance: 10 });
  assert.equal(ride(d, CHASE_RULES.loseSeconds + 1, { sees: false, distance: 200 }), 'escaped');
  assert.equal(ride(d, 2, { inView: false }), 'gone');
  assert.equal(d.state.phase, 'waiting');
  assert.ok(d.state.wait > 110 && d.state.wait <= 112.5, String(d.state.wait)); // 75 + 0.5 × 75, less the riding after he went
});

test('no ambush begins inside a skate spot; a chase under way goes on there', () => {
  const d = createChaseDirector({ random: () => 0 });
  assert.equal(ride(d, 60, { skating: true }), null);
  assert.equal(d.state.phase, 'waiting');
  assert.equal(ride(d, 0.1, { skating: false }), 'ambush');
  d.update(0.1, { riding: true, sees: true, distance: 5, skating: true });
  assert.equal(d.state.phase, 'chasing');
  ride(d, 20, { sees: true, distance: 5, skating: true });
  assert.equal(d.state.phase, 'chasing');
});

test('the skate gate is asked when the countdown actually crosses zero (not before the frame is counted)', () => {
  const d = createChaseDirector({ random: () => 0 });
  d.state.wait = 0.12; d.state.calm = 0;
  let asked = 0;
  for (let i = 0; i < 40; i++) assert.equal(d.update(0.05, { riding: true, skating: () => { asked++; return true; } }), null);
  assert.ok(asked > 30, 'asked on every due frame'); assert.equal(d.state.phase, 'waiting');
  assert.equal(d.update(0.05, { riding: true, skating: () => false }), 'ambush');
});

test('he never gives up: no rule ends a chase because he cannot reach the rider; a close, unseen rider is not lost', () => {
  const d = createChaseDirector({ random: () => 0 });
  d.soon(); d.update(0.1, { riding: true }); d.update(0.1, { riding: true, sees: true, distance: 2 });
  assert.equal(d.giveUp, undefined);
  // round a corner, behind a van, under a stair: unseen for a long while but near
  assert.equal(ride(d, 60, { sees: false, distance: 40 }), null);
  assert.equal(d.state.phase, 'chasing');
  // unseen and far, but not long enough
  assert.equal(ride(d, CHASE_RULES.outrunSeconds - 1, { sees: false, distance: CHASE_RULES.outrunDistance + 5 }), null);
});

test('outlast: two minutes of pursuit without a capture wear his battery down; time down after a knock-down does not count', () => {
  const d = createChaseDirector({ random: () => 0.5 });
  d.soon(); d.update(0.1, { riding: true }); d.update(0.1, { riding: true, sees: true, distance: 5 });
  assert.equal(CHASE_RULES.outlastSeconds, 120);
  assert.equal(ride(d, 50, { sees: true, distance: 8 }), null);
  assert.equal(d.knockedDown(), true);
  // the recovery seconds after the knock-down are not pursuit
  ride(d, CHASE_RULES.recoverySeconds, { sees: true, distance: 3 });
  assert.ok(Math.abs(d.state.pursuit - 50.1) < 0.2, String(d.state.pursuit));
  assert.equal(ride(d, CHASE_RULES.outlastSeconds - CHASE_RULES.tiredSeconds - 50.5, { sees: true, distance: 8 }), null);
  assert.notEqual(chaseHudView(d.state, 8).cue, 'tired');
  ride(d, 1, { sees: true, distance: 8 });
  assert.equal(chaseHudView(d.state, 8).cue, 'tired'); assert.equal(CHASE_TEXT.tired, 'His battery is fading · keep going');
  assert.equal(ride(d, CHASE_RULES.tiredSeconds, { sees: true, distance: 8 }), 'outlasted');
  assert.equal(d.state.phase, 'leaving');
  const v = chaseHudView(d.state, 8);
  assert.equal(v.banner, 'outlasted'); assert.equal(v.bannerText, 'You wore him out · ¡Wepa!');
  assert.equal(ride(d, 2, { inView: false }), 'gone');
  assert.ok(d.state.wait >= 75 && d.state.wait <= 150, String(d.state.wait));
});

test('the patrol switch: off sends him away and stops ambushes; on restarts the first-attempt timer', () => {
  const d = createChaseDirector({ random: () => 1 });
  d.soon(); assert.equal(d.update(0.1, { riding: true }), 'ambush');
  assert.equal(d.setPatrol(false), true);
  assert.equal(d.state.phase, 'leaving');
  assert.equal(ride(d, 10), 'gone');
  assert.equal(ride(d, 400), null, 'no ambush while off duty');
  assert.equal(d.state.phase, 'waiting');
  assert.equal(d.setPatrol(true), true);
  assert.equal(d.state.wait, 75);
  assert.equal(d.setPatrol(true), false);
});

test('three accepted hits warn, the fourth captures until an explicit release (donor rules)', () => {
  const d = createChaseDirector({ random: () => 0 });
  d.soon(); d.update(0.1, { riding: true }); d.update(0.1, { riding: true, sees: true, distance: 5 });
  for (let i = 1; i <= 4; i++) {
    assert.equal(d.knockedDown(), true);
    assert.equal(d.state.phase, i === 4 ? 'captured' : 'chasing');
    if (i < 4) { assert.equal(d.knockedDown(), false, 'recovery grace'); d.update(CHASE_RULES.recoverySeconds, { riding: true, sees: true, distance: 5 }); }
  }
  assert.equal(d.update(100, { riding: true }), null);
  assert.equal(d.state.phase, 'captured');
  const v = chaseHudView(d.state, 3);
  assert.equal(v.banner, 'captured'); assert.match(v.bannerText, /Cuartelillo/);
});

test('escape needs loss of sight and distance; crashes reset progress (donor rules)', () => {
  const d = createChaseDirector({ random: () => 0 });
  d.soon(); d.update(0.1, { riding: true }); d.update(0.1, { riding: true, sees: true, distance: 10 });
  d.update(12, { riding: true, sees: false, distance: 20 });
  assert.equal(d.state.phase, 'chasing');
  d.update(5, { riding: true, sees: false, distance: 200 });
  d.observePlayer({ crashed: true });
  assert.equal(d.state.far, 0);
  d.update(3, { riding: true, sees: false, distance: 200 });
  assert.equal(d.update(9, { riding: true, sees: false, distance: 200 }), null, 'not yet: loseSeconds of no sight');
  assert.equal(d.update(4, { riding: true, sees: false, distance: 200 }), 'escaped');
  assert.equal(CHASE_TEXT.escaped.startsWith('You lost him'), true);
});

test('chase notice text: warnings n/3, the telegraph and the escape progress', () => {
  const d = createChaseDirector({ random: () => 0 });
  d.soon(); d.update(0.1, { riding: true }); d.update(0.1, { riding: true, sees: true, distance: 6 });
  assert.equal(chaseHudView(d.state, 6).bannerText, CHASE_TEXT.ambush);
  d.state.eventAge = CHASE_RULES.bannerSeconds + 1;
  assert.equal(chaseHudView(d.state, 6).bannerText, CHASE_TEXT.hint, 'once, what to do');
  d.state.eventAge = CHASE_RULES.bannerSeconds + CHASE_RULES.hintSeconds + 0.1;
  assert.equal(chaseHudView(d.state, 6).cue, 'seen'); assert.equal(chaseHudView(d.state, 6).banner, null);
  assert.equal(chaseHudView(d.state, 6, CHASE_RULES, 'windup').bannerText, 'Paddle! Hop or swerve');
  d.knockedDown();
  assert.equal(chaseHudView(d.state, 6).bannerText, 'Warning 1/3 · on your feet!');
  d.state.recovery = 0; d.update(7, { riding: true, sees: false, distance: 200 });
  const v = chaseHudView(d.state, 200);
  assert.equal(v.cue, 'far'); assert.ok(v.losing > 0.4 && v.losing <= 1);
  assert.equal(v.heatText, 'Warnings 1/3');
});

test('wind-up is harmless and only the actual active interval admits contact', () => {
  const swing = createSwing(); swing.start();
  assert.equal(swing.update(0.5), null);
  assert.ok(swing.contact.from > swing.contact.to);
  assert.equal(swing.update(0.3), 'strike');
  assert.ok(swing.contact.from > 0 && swing.contact.from < swing.contact.to);
  assert.equal(swing.update(0.1), null);
  assert.equal(swing.phase, 'recover');
  assert.ok(swing.contact.from <= swing.contact.to);
});

test('swept contact respects moving and airborne riders and the active slice', () => {
  const rider = { x: 0, z: 0, bottom: 0 };
  assert.equal(sweptHit(-2, 0.5, 0, 2, 0.5, 0, rider), true);
  assert.equal(sweptHit(-2, 0.5, 0, 2, 0.5, 0, { ...rider, bottom: 2 }), false);
  assert.equal(sweptHit(-2, 0.5, 0, 2, 0.5, 0, rider, SWING, rider, { from: 0, to: 0.2 }), false);
  assert.equal(sweptHit(-2, 0.5, 0, 2, 0.5, 0, { x: 3, z: 0, bottom: 0 }, SWING, { x: -3, z: 0, bottom: 0 }), true);
});

function contactSetup(clearLine = () => true) {
  const director = createChaseDirector({ random: () => 0 });
  director.soon(); director.update(0.1, { riding: true });
  return { director, contact: createPaddleContact({ clearLine }, director) };
}
const rider = { x: 0, bottom: 0, z: 0 }, face = x => ({ x, y: 1, z: 0 }), interval = { from: 0, to: 1 };

test('only an accepted controller contact counts, once per swing; a wall vetoes it', () => {
  const { director, contact } = contactSetup();
  let calls = 0, allow = false;
  const controller = { crashed: false, hardKnock() { calls++; return allow; } };
  const frame = x => contact.frame({ face: face(x), rider, interval, controller, placementSerial: 1 });
  frame(-1); assert.equal(frame(1), false); assert.equal(director.state.knockdowns, 0);
  allow = true; assert.equal(frame(-1), true); assert.equal(director.state.knockdowns, 1);
  director.state.recovery = 0; assert.equal(frame(1), false); assert.equal(calls, 2);
  const walled = contactSetup(() => false);
  let blockedCalls = 0; const c2 = { hardKnock() { blockedCalls++; return true; } };
  walled.contact.frame({ face: face(-1), rider, interval, controller: c2 });
  assert.equal(walled.contact.frame({ face: face(1), rider, interval, controller: c2 }), false);
  assert.equal(blockedCalls, 0);
});

test('a placement, a freeze or a jump of the rider breaks the contact history', () => {
  const { contact } = contactSetup();
  let calls = 0;
  const controller = { hardKnock() { calls++; return true; } };
  const frame = (x, serial, enabled = true, target = rider) => contact.frame({ face: face(x), rider: target, interval, controller, placementSerial: serial, enabled });
  frame(-1, 1); assert.equal(frame(1, 2), false);
  frame(-1, 2, false); assert.equal(frame(1, 2), false);
  assert.equal(frame(-1, 2, true, { x: 20, bottom: 0, z: 0 }), false); assert.equal(frame(1, 2), false);
  assert.equal(calls, 0);
});

test('borrowed code is recorded: every listed San Juan file matches its recorded hash', () => {
  const record = JSON.parse(readFileSync(new URL('../provenance/dorkins-import.json', import.meta.url), 'utf8'));
  assert.ok(record.files.length >= 12);
  for (const f of record.files) {
    const hash = createHash('sha256').update(readFileSync(new URL('../' + f.path, import.meta.url))).digest('hex');
    assert.equal(hash, f.editionSha256, `${f.path} changed: refresh provenance/dorkins-import.json`);
    assert.ok(f.sources.length && f.sources.every(s => /^[0-9a-f]{64}$/.test(s.sourceSha256)), f.path);
  }
  const credits = readFileSync(new URL('../credits.html', import.meta.url), 'utf8');
  assert.match(credits, /provenance\/dorkins-import\.json/);
});

test('dodges: a low sweep passes under a hopping wheel and lands on a grounded one; a high sweep meets both', () => {
  // face at 0.25 m above the floor, as the low swing draws it; a rider whose wheel is 0.4 m up, or on the floor
  for (const [low, bottom, expected, dodged] of [[true, 0.4, 0, 1], [true, 0, 1, 0], [false, 0.4, 1, 0]]) {
    const { director, contact } = contactSetup();
    const controller = { crashed: false, hardKnock: () => true };
    const target = { x: 0, bottom, z: 0 }, y = low ? 0.25 : 1.0;
    contact.frame({ face: { x: -1, y, z: 0 }, rider: target, interval, controller, placementSerial: 1, low });
    contact.frame({ face: { x: 1, y, z: 0 }, rider: target, interval, controller, placementSerial: 1, low });
    assert.equal(director.state.knockdowns, expected, `low ${low} bottom ${bottom}`);
    assert.equal(contact.dodged, dodged);
  }
  assert.ok(SWING.lockSeconds > 0 && SWING.lockSeconds < SWING.windupSeconds && SWING.lowAt < 0.35 && SWING.highAt > 0.9);
});

test('outlast is earned: standing still, or time he cannot attack, does not count', () => {
  const d = createChaseDirector({ random: () => 0.5 });
  d.soon(); d.update(0.1, { riding: true }); d.update(0.1, { riding: true, sees: true, distance: 5 });
  assert.equal(ride(d, CHASE_RULES.outlastSeconds + 30, { sees: true, distance: 5, pressing: false }), null);
  assert.equal(d.state.phase, 'chasing'); assert.ok(d.state.pursuit < 0.5, String(d.state.pursuit));
  assert.equal(ride(d, CHASE_RULES.outlastSeconds + 1, { sees: true, distance: 5, pressing: true }), 'outlasted');
});

test('a low sweep never lands with the paddle face above the wheel; the wind-up names its counter', () => {
  for (const faceY of [0.9, 1.2, 1.9]) {
    const { director, contact } = contactSetup();
    const controller = { crashed: false, hardKnock: () => true }, target = { x: 0, bottom: 0, z: 0 };
    contact.frame({ face: { x: -1, y: faceY, z: 0 }, rider: target, interval, controller, placementSerial: 1, low: true });
    contact.frame({ face: { x: 1, y: faceY, z: 0 }, rider: target, interval, controller, placementSerial: 1, low: true });
    assert.equal(director.state.knockdowns, 0, `low face at ${faceY} m`);
  }
  assert.ok(SWING.lowTop < 0.9 && SWING.lowTop > SWING.lowAt);
  const d = createChaseDirector({ random: () => 0 });
  d.soon(); d.update(0.1, { riding: true }); d.update(0.1, { riding: true, sees: true, distance: 5 });
  assert.equal(chaseHudView(d.state, 5, CHASE_RULES, 'windup', 'low').bannerText, 'Paddle low · hop!');
  assert.equal(chaseHudView(d.state, 5, CHASE_RULES, 'windup', 'high').bannerText, 'Paddle high · swerve or brake!');
  assert.notEqual(chaseHudView(d.state, 5, CHASE_RULES, 'windup', 'held').bannerText, chaseHudView(d.state, 5, CHASE_RULES, 'windup', 'low').bannerText);
});

test('a held wind-up pauses where it is (never rewinds) and goes on from there', () => {
  const swing = createSwing(); swing.start();
  swing.update(0.5); const before = swing.state.elapsed, angle = swing.angle;
  swing.paused = true; for (let i = 0; i < 30; i++) assert.equal(swing.update(0.02), null);
  assert.equal(swing.state.elapsed, before); assert.equal(swing.angle, angle);
  swing.paused = false; assert.equal(swing.update(0.25), 'strike');
});
