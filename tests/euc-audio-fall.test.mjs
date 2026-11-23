/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// The crash recording lasts as long as the fall: getting up or being moved fades it out quickly (a stand-in context).
import test from 'node:test';
import assert from 'node:assert/strict';
import { EucAudio, CUES, crashScale } from '../js/euc-audio.js';

globalThis.fetch = () => new Promise(() => {}); // shared loops never arrive: not part of these cases

function fakeContext(state = 'running') {
  const param = (value = 0) => {
    const p = { value, events: [],
      setTargetAtTime(v, t, tc) { p.events.push(['target', v, t, tc]); },
      setValueAtTime(v, t) { p.events.push(['set', v, t]); },
      linearRampToValueAtTime(v, t) { p.events.push(['linear', v, t]); },
      exponentialRampToValueAtTime(v, t) { p.events.push(['exp', v, t]); },
      cancelScheduledValues(t) { p.events.push(['cancel', t]); },
      cancelAndHoldAtTime(t) { p.events.push(['hold', t]); } };
    return p;
  };
  const node = (extra = {}) => ({ connect(n) { return n; }, disconnect() {}, ...extra });
  const source = (extra) => {
    const s = node({ startedAt: NaN, stoppedAt: Infinity, onended: null, ...extra,
      start(t = 0) { s.startedAt = t; }, stop(t = ctx.currentTime) { s.stoppedAt = Math.min(s.stoppedAt, t); } });
    ctx.made.push(s);
    return s;
  };
  const ctx = {
    state, currentTime: 0, sampleRate: 48000, made: [],
    createGain: () => node({ gain: param(1) }),
    createBiquadFilter: () => node({ frequency: param(), detune: param(), Q: param(), gain: param(), type: '' }),
    createOscillator: () => source({ frequency: param(), detune: param(), type: '' }),
    createConstantSource: () => source({ offset: param() }),
    createBufferSource: () => source({ playbackRate: param(1), detune: param(), buffer: null, loop: false }),
    createBuffer: (channels, length, rate) => ({ length, duration: length / rate, getChannelData: () => new Float32Array(length) }),
  };
  return ctx;
}

const recording = seconds => ({ duration: seconds, length: Math.round(seconds * 48000), numberOfChannels: 1, sampleRate: 48000 });
const banks = (seconds = 2.4) => ({ active: { id: 'cool-rider' }, stats: {}, dispose() {},
  buffer: (id, key) => recording(key === 'stumbleDrunkard' ? 0.4 : seconds) });

function rig(state) {
  const ctx = fakeContext(state);
  const audio = new EucAudio(ctx, ctx.createGain(), { riderBanks: banks() });
  const controller = { crashed: false, isGrounded: true, currentSurface: 'pavement', overspeed: 0, powerLoad: 0 };
  const entity = { type: 'euc', speed: 0, controller };
  const frame = (events = [], dt = 1 / 60) => { ctx.currentTime += dt; audio.update(entity, events); };
  const crash = (rider = 'cool-rider') => { controller.crashed = true; frame([{ type: 'crash', rider, speed: 6 }]); return audio.crashVoice; };
  return { ctx, audio, controller, entity, frame, crash };
}
const levelOf = voice => voice.nodes.find(n => n.isLevel).gain;
const stopsBy = (voice, t) => voice.sources.every(s => s.stoppedAt <= t);
const fadesToZero = (voice, by) => levelOf(voice).events.some(([kind, v, t]) => kind === 'linear' && v === 0 && t <= by + 1e-9);

test('getting up fades the crash recording in about a tenth of a second, from its current level (no click)', () => {
  const { ctx, audio, controller, frame, crash } = rig('running');
  const voice = crash();
  assert.ok(voice, 'a crash recording is playing');
  for (let i = 0; i < 30; i++) frame(); // half a second down
  assert.ok(stopsBy(voice, Infinity) && voice.sources[0].stoppedAt === Infinity, 'still playing while down');
  controller.crashed = false;
  frame([{ type: 'recover' }]);
  const at = ctx.currentTime;
  const ev = levelOf(voice).events;
  // the first value scheduled after recovery is the recording's current gain, at `now`: no step down
  const current = CUES.crash.level * crashScale(6);
  assert.deepEqual(ev.slice(-3), [['cancel', at], ['set', current, at], ['linear', 0, at + CUES.fallFade]]);
  assert.ok(!ev.some(([kind]) => kind === 'hold'), 'no cancelAndHoldAtTime (it holds a wrong value on some browsers)');
  assert.ok(stopsBy(voice, at + CUES.fallFade + 0.01), 'the source stops right after the fade');
  assert.equal(audio.crashVoice, null);
});

test('a placement while down (map, Restart, rescue, booking, release) ends the recording and the impact one-shots', () => {
  for (const reason of ['map', 'restart', 'rescue', 'booking', 'release']) {
    // map, Restart and the booking happen while the context is suspended; a rescue and a release while it runs
    const suspended = ['map', 'restart', 'booking'].includes(reason);
    const { ctx, audio, controller, frame, crash } = rig('running');
    const voice = crash();
    audio.thump(ctx.currentTime, 130, 40, 0.4, 0.3); // an impact still ringing
    const others = [...audio.voices].filter(v => v !== voice);
    assert.ok(others.length >= 1);
    ctx.currentTime += 0.3; // well into the recording
    if (suspended) ctx.state = 'suspended';
    audio.placed(reason);
    const fade = suspended ? CUES.fallFadeSuspended : CUES.fallFade, at = ctx.currentTime;
    for (const v of [voice, ...others]) assert.ok(fadesToZero(v, at + fade) && stopsBy(v, at + fade + 0.01), reason);
    assert.deepEqual(levelOf(voice).events.slice(-2, -1), [['set', CUES.crash.level * crashScale(6), at]], `${reason}: anchored`);
    assert.equal(audio.crashVoice, null, reason);
    ctx.state = 'running';
    controller.crashed = false; // the placement got the rider up
    frame([{ type: 'recover' }]);
    const chirp = [...audio.voices].filter(v => !v.fadingUntil);
    assert.ok(chirp.length >= 1, `${reason}: the recovery chirp after the placement still plays`);
  }
});

test('a new crash replaces the old recording; the new one plays on', () => {
  const { audio, controller, frame, crash } = rig('running');
  const first = crash();
  controller.crashed = false; frame(); // a brief recovery, then down again
  const second = crash();
  assert.notEqual(first, second);
  assert.ok(stopsBy(first, Infinity) && first.sources[0].stoppedAt < Infinity, 'the first one was ended');
  for (let i = 0; i < 10; i++) frame();
  assert.equal(audio.crashVoice, second);
  assert.equal(second.sources[0].stoppedAt, Infinity, 'the new one is still playing');
});

test('getting up with nothing playing, and placements with nothing playing, are harmless', () => {
  const { ctx, audio, controller, frame } = rig('running');
  controller.crashed = true; frame(); // down without a recording (still loading, say)
  controller.crashed = false; frame([{ type: 'recover' }]);
  audio.placed('map');
  assert.equal(audio.crashVoice, null);
  ctx.state = 'suspended'; audio.placed('restart');
  audio.dispose(); audio.placed('map'); // after disposal: nothing
});

test('the Drunkard stumble clip follows the same rule; riding on without a fall leaves one-shots alone', () => {
  const { ctx, audio, controller, frame } = rig('running');
  frame([{ type: 'stumble', rider: 'drunkard' }]);
  const stumble = audio.stumbleVoice;
  assert.ok(stumble);
  frame([{ type: 'hop', charge: 1 }]);
  const hop = [...audio.voices].find(v => v !== stumble);
  controller.crashed = true; frame([{ type: 'crash', rider: 'drunkard', speed: 4 }]);
  const crashVoice = audio.crashVoice;
  controller.crashed = false; frame([{ type: 'recover' }]);
  const at = ctx.currentTime;
  for (const v of [stumble, crashVoice]) assert.ok(fadesToZero(v, at + CUES.fallFade));
  assert.ok(!hop.fadingUntil, 'getting up in place lets the short synthesized sounds finish');
});

test('a fade during the recording\'s attack leaves from the partial level', () => {
  const { ctx, audio, controller, frame } = rig('running');
  controller.crashed = true; frame([{ type: 'crash', rider: 'cool-rider', speed: 6 }], 0);
  const voice = audio.crashVoice, start = ctx.currentTime;
  ctx.currentTime += 0.004; audio.placed('rescue'); // half way through the 8 ms attack
  const set = levelOf(voice).events.find(([kind, , t]) => kind === 'set' && t === ctx.currentTime);
  assert.ok(Math.abs(set[1] - CUES.crash.level * crashScale(6) * 0.5) < 1e-9, `${set[1]} at ${ctx.currentTime - start}`);
});

test('a placement during the get-up fade continues it from where it is, never louder', () => {
  const { ctx, audio, controller, frame, crash } = rig('running');
  const voice = crash();
  for (let i = 0; i < 30; i++) frame();
  controller.crashed = false; frame([{ type: 'recover' }]);
  const t0 = ctx.currentTime, full = CUES.crash.level * crashScale(6);
  ctx.currentTime += 0.032; ctx.state = 'suspended'; // the map opens 32 ms later
  audio.placed('map');
  const reached = full * (1 - 0.032 / CUES.fallFade), ev = levelOf(voice).events;
  const after = ev.slice(ev.findIndex(([k, , t]) => k === 'linear' && t === t0 + CUES.fallFade) + 1);
  assert.deepEqual(after[1], ['set', after[1][1], ctx.currentTime]);
  assert.ok(Math.abs(after[1][1] - reached) < 1e-9, `${after[1][1]} vs ${reached}`);
  for (const [kind, v] of after) if (kind !== 'cancel') assert.ok(v <= reached + 1e-12, `${kind} ${v} above ${reached}`);
  assert.deepEqual(after.at(-1), ['linear', 0, ctx.currentTime + CUES.fallFadeSuspended]);
});

test('a fall that is not over keeps its recording through ordinary frames', () => {
  const { audio, frame, crash } = rig('running');
  const voice = crash();
  for (let i = 0; i < 90; i++) frame();
  assert.equal(audio.crashVoice, voice);
  assert.ok(!voice.fadingUntil);
});
