/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan — adapted from VibezZzCoder/euc-sanfrancisco (MIT) */
// Officer Dorkins: the chase referee (timers, warnings, capture, escape) and the words on the chase notice. From the
// San Francisco edition (js/nemesis-chase.js, © 2026 VibezZzCoder, MIT; first written for the New York edition).
// This module owns rules, not rider or city movement.
//
// San Juan's own: Old San Juan is small and made for looking around, so he turns up less often (first attempt after
// 40–75 s of riding, later ones 75–150 s after he leaves or lets the rider go); no ambush begins while the rider is in a
// skate spot (a chase already under way goes on); the patrol can be switched off (he leaves and no ambush begins) and
// on again (the first-attempt timer starts over). Strikes, warnings and capture are the donor's rules.
//
// He does not give up because something is in his way. The rider gets away in one of two ways:
//   lose him     out of his sight for loseSeconds, and beyond outrunDistance for the last outrunSeconds of it (he hears
//                a wheel within hearRange, so this takes getting well away, not one corner);
//   outlast him  outlastSeconds of pursuit wear his battery down: his wheel beeps from tiredSeconds before the end, he
//                breaks off and leaves. Only pressed riding counts (`pressing`, the host's judgement: the rider is up and
//                moving and he is close or has just swung); standing still, or time he cannot attack, counts nothing.

export const CHASE_RULES = Object.freeze({
  firstMin: 40, firstMax: 75, againMin: 75, againMax: 150,
  calmSeconds: 4, retrySeconds: 1, sightRange: 110,
  loseSeconds: 15, outrunDistance: 110, outrunSeconds: 8, hearRange: 85, hearAfter: 1.5, hearEvery: 2,
  outlastSeconds: 120, tiredSeconds: 20,
  acquireSeconds: 60, leaveSeconds: 8, recoverySeconds: 3,
  warningKnockdowns: 3, leaveMinSeconds: 1.5, bannerSeconds: 2.6, hintSeconds: 3.2,
});

export function createChaseDirector({ rules = CHASE_RULES, random = Math.random } = {}) {
  const r = rules;
  const between = (lo, hi) => lo + (hi - lo) * random();
  const state = {
    phase: 'waiting', wait: between(r.firstMin, r.firstMax), calm: 0, patrol: true,
    acquired: false, sees: false, knockdowns: 0, recovery: 0, chaseTime: 0, pursuit: 0,
    unseen: 0, far: 0, leaveTime: 0, lastEvent: null, eventAge: Infinity,
  };
  function fire(event) { state.lastEvent = event; state.eventAge = 0; return event; }
  function observePlayer({ crashed = false, recovered = false, displaced = false } = {}) {
    if (state.phase === 'captured') return;
    if (displaced) state.sees = false;
    if (!crashed && !recovered) return;
    if (state.phase === 'waiting') state.calm = r.calmSeconds;
    else if (state.phase === 'chasing') {
      state.recovery = r.recoverySeconds;
      state.unseen = state.far = 0;
    }
  }
  return {
    state,
    observePlayer,
    postpone(seconds = r.retrySeconds) {
      state.phase = 'waiting'; state.wait = seconds; state.lastEvent = null; state.eventAge = Infinity;
    },
    // Called only after the drawn paddle connects and controller.hardKnock accepts it.
    knockedDown() {
      if (state.phase !== 'chasing' || state.recovery > 0) return false;
      state.knockdowns++;
      state.recovery = r.recoverySeconds;
      state.unseen = state.far = 0;
      if (state.knockdowns > r.warningKnockdowns) { state.phase = 'captured'; fire('captured'); }
      else fire('warning');
      return true;
    },
    // Call only after the controller actually accepts a clear release placement.
    release() {
      if (state.phase !== 'captured') return false;
      state.phase = 'waiting'; state.wait = between(r.againMin, r.againMax);
      state.knockdowns = state.recovery = state.unseen = state.far = state.calm = 0;
      state.acquired = state.sees = false; fire('released');
      return true;
    },
    /** The Pause switch. Off: a chase turns into his departure and no ambush begins. On: the first-attempt timer restarts. */
    setPatrol(on) {
      on = !!on;
      if (state.patrol === on) return false;
      state.patrol = on;
      if (!on && state.phase === 'chasing') { state.phase = 'leaving'; state.leaveTime = 0; state.lastEvent = null; state.eventAge = Infinity; }
      if (on && state.phase === 'waiting') { state.wait = between(r.firstMin, r.firstMax); state.calm = 0; }
      return true;
    },
    soon() { if (state.phase === 'waiting') { state.wait = 0; state.calm = 0; } },
    // The host holds a still-visible departure; only presentation time (banner age) advances.
    hold(dt) { if (dt > 0 && state.phase === 'leaving') state.eventAge += dt; },
    update(dt, { riding = false, crashed = false, recovered = false,
      distance = Infinity, sees = false, inView = false, skating = false, pressing = true } = {}) {
      observePlayer({ crashed, recovered });
      if (!(dt > 0) || !riding || state.phase === 'captured') return null;
      state.eventAge += dt;
      if (state.phase === 'waiting') {
        if (!state.patrol) return null;
        state.calm = crashed ? r.calmSeconds : Math.max(0, state.calm - dt);
        state.wait -= dt;
        // A skate spot is for skating: the timer runs on, but the ambush waits until the rider has left it. `skating` may
        // be a function: it is asked at the moment the ambush would begin, never before the frame's time is counted.
        if (state.wait > 0 || state.calm > 0 || crashed) return null;
        if (typeof skating === 'function' ? skating() : skating) return null;
        state.phase = 'chasing'; state.acquired = state.sees = false;
        state.knockdowns = state.recovery = state.chaseTime = state.pursuit = state.unseen = state.far = 0;
        return fire('ambush');
      }
      if (state.phase === 'chasing') {
        state.chaseTime += dt; state.sees = sees;
        if (sees) state.acquired = true;
        let escaped = !state.acquired && state.chaseTime >= r.acquireSeconds;
        if (crashed) state.recovery = r.recoverySeconds;
        else state.recovery = Math.max(0, state.recovery - dt);
        if (crashed || state.recovery > 0) state.unseen = state.far = 0;
        else {
          if (pressing) state.pursuit += dt; // the outlast clock: pressed riding time
          if (state.acquired) {
            state.unseen = sees ? 0 : state.unseen + dt;
            state.far = !sees && distance > r.outrunDistance ? state.far + dt : 0;
            escaped = state.unseen >= r.loseSeconds && state.far >= r.outrunSeconds;
          }
          if (!escaped && state.pursuit >= r.outlastSeconds) { state.phase = 'leaving'; state.leaveTime = 0; return fire('outlasted'); }
        }
        if (!escaped) return null;
        state.phase = 'leaving'; state.leaveTime = 0;
        return fire(state.acquired ? 'escaped' : 'missed');
      }
      state.leaveTime += dt;
      if (state.leaveTime < 0 || (state.leaveTime < r.leaveSeconds
        && (state.leaveTime < r.leaveMinSeconds || inView))) return null;
      state.phase = 'waiting'; state.wait = between(r.againMin, r.againMax); state.calm = 0;
      return 'gone';
    },
  };
}

// San Juan's voice: English with a little Spanish, the donor's meanings.
export const CHASE_TEXT = Object.freeze({
  ambush: '¡Ay! Officer Dorkins is after you', escaped: 'You lost him · ¡Wepa!',
  captured: 'Busted · off to the Cuartelillo', released: 'Released · back to riding',
  paddle: 'Paddle! Hop or swerve', paddleLow: 'Paddle low · hop!', paddleHigh: 'Paddle high · swerve or brake!',
  paddleHeld: 'He holds the paddle · wait for it', seen: 'Officer Dorkins', incoming: 'Dorkins is closing in',
  recovering: 'Catch your breath · still pursued', unseen: 'Out of his sight · he can still hear you',
  far: 'Stay hidden · losing him', patrol: 'Dorkins goes off duty',
  hint: 'Dodge the paddle · outlast him',
  outlasted: 'You wore him out · ¡Wepa!', tired: 'His battery is fading · keep going',
});

// The wind-up's words name the counter: a low sweep is hopped, a high one swerved or braked; a held one waits.
function paddleText(kind, hot) {
  const text = kind === 'low' ? CHASE_TEXT.paddleLow : kind === 'high' ? CHASE_TEXT.paddleHigh : kind === 'held' ? CHASE_TEXT.paddleHeld : CHASE_TEXT.paddle;
  return hot ? `Arrest risk! ${text}` : text;
}
export function chaseHudView(state, distance, rules = CHASE_RULES, swingPhase = 'idle', swingKind = null) {
  let banner = ['ambush', 'escaped', 'outlasted', 'warning', 'captured', 'released'].includes(state.lastEvent)
    && state.eventAge < rules.bannerSeconds ? state.lastEvent : null;
  // once, right after he turns up: what to do about him
  if (!banner && state.lastEvent === 'ambush' && state.phase === 'chasing' && state.eventAge < rules.bannerSeconds + rules.hintSeconds) banner = 'hint';
  if (swingPhase === 'windup' && state.phase === 'chasing') banner = 'paddle';
  const knockdowns = state.knockdowns, heat = Math.min(rules.warningKnockdowns, knockdowns);
  const hot = knockdowns >= rules.warningKnockdowns;
  const heatText = hot ? `${heat}/${rules.warningKnockdowns} · arrest risk` : `Warnings ${knockdowns}/${rules.warningKnockdowns}`;
  const bannerText = banner === 'warning' ? (hot ? 'Final warning · arrest risk!' : `Warning ${knockdowns}/${rules.warningKnockdowns} · on your feet!`)
    : banner === 'paddle' ? paddleText(swingKind, hot) : CHASE_TEXT[banner] || '';
  let cue = null, losing = 0;
  if (state.phase === 'chasing') {
    const tired = state.pursuit >= rules.outlastSeconds - rules.tiredSeconds;
    cue = !state.acquired ? 'incoming' : state.recovery > 0 ? 'recovering' : state.far > 0 ? 'far' : tired ? 'tired' : state.sees ? 'seen' : 'unseen';
    losing = Math.min(1, state.unseen / rules.loseSeconds, state.far / rules.outrunSeconds);
  }
  return { banner, bannerText, cue, battery: Math.max(0, 1 - state.pursuit / rules.outlastSeconds), metres: Math.round(Number.isFinite(distance) ? distance : 0),
    losing, knockdowns, heat, hot, heatText };
}
