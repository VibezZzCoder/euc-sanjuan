/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan — adapted from VibezZzCoder/euc-sanfrancisco (MIT) */
// Officer Dorkins: the chase referee (timers, warnings, capture, escape) and the words on the chase notice. From the
// San Francisco edition (js/nemesis-chase.js, © 2026 VibezZzCoder, MIT; first written for the New York edition).
// This module owns rules, not rider or city movement.
//
// San Juan's own: Old San Juan is small and made for looking around, so he turns up less often (first attempt after
// 40–75 s of riding, later ones 75–150 s after he leaves or lets the rider go); no ambush begins while the rider is in a
// skate spot (a chase already under way goes on); the patrol can be switched off (he leaves and no ambush begins) and
// on again (the first-attempt timer starts over). Strikes, warnings, capture and escape are the donor's rules.

export const CHASE_RULES = Object.freeze({
  firstMin: 40, firstMax: 75, againMin: 75, againMax: 150,
  calmSeconds: 4, retrySeconds: 1, sightRange: 110,
  loseSeconds: 12, outrunDistance: 150, outrunSeconds: 6,
  acquireSeconds: 60, leaveSeconds: 8, recoverySeconds: 3,
  warningKnockdowns: 3, leaveMinSeconds: 1.5, bannerSeconds: 2.6, hintSeconds: 3.2,
});

export function createChaseDirector({ rules = CHASE_RULES, random = Math.random } = {}) {
  const r = rules;
  const between = (lo, hi) => lo + (hi - lo) * random();
  const state = {
    phase: 'waiting', wait: between(r.firstMin, r.firstMax), calm: 0, patrol: true,
    acquired: false, sees: false, knockdowns: 0, recovery: 0, chaseTime: 0,
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
    /** He cannot reach the rider: he gives up and leaves (the rider has lost him). */
    giveUp() {
      if (state.phase !== 'chasing') return false;
      state.phase = 'leaving'; state.leaveTime = 0; fire('escaped'); return true;
    },
    // The host holds a still-visible departure; only presentation time (banner age) advances.
    hold(dt) { if (dt > 0 && state.phase === 'leaving') state.eventAge += dt; },
    update(dt, { riding = false, crashed = false, recovered = false,
      distance = Infinity, sees = false, inView = false, skating = false } = {}) {
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
        state.knockdowns = state.recovery = state.chaseTime = state.unseen = state.far = 0;
        return fire('ambush');
      }
      if (state.phase === 'chasing') {
        state.chaseTime += dt; state.sees = sees;
        if (sees) state.acquired = true;
        let escaped = !state.acquired && state.chaseTime >= r.acquireSeconds;
        if (crashed) state.recovery = r.recoverySeconds;
        else state.recovery = Math.max(0, state.recovery - dt);
        if (crashed || state.recovery > 0) state.unseen = state.far = 0;
        else if (state.acquired) {
          state.unseen = sees ? 0 : state.unseen + dt;
          state.far = !sees && distance > r.outrunDistance ? state.far + dt : 0;
          escaped = state.unseen >= r.loseSeconds && state.far >= r.outrunSeconds;
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
  paddle: 'Paddle! Hop or swerve', seen: 'Officer Dorkins', incoming: 'Dorkins is closing in',
  recovering: 'Catch your breath · still pursued', unseen: 'Searching · get more distance',
  far: 'Stay hidden · losing him', patrol: 'Dorkins goes off duty',
  hint: 'Break his line of sight',
});

export function chaseHudView(state, distance, rules = CHASE_RULES, swingPhase = 'idle') {
  let banner = ['ambush', 'escaped', 'warning', 'captured', 'released'].includes(state.lastEvent)
    && state.eventAge < rules.bannerSeconds ? state.lastEvent : null;
  // once, right after he turns up: what to do about him
  if (!banner && state.lastEvent === 'ambush' && state.phase === 'chasing' && state.eventAge < rules.bannerSeconds + rules.hintSeconds) banner = 'hint';
  if (swingPhase === 'windup' && state.phase === 'chasing') banner = 'paddle';
  const knockdowns = state.knockdowns, heat = Math.min(rules.warningKnockdowns, knockdowns);
  const hot = knockdowns >= rules.warningKnockdowns;
  const heatText = hot ? `${heat}/${rules.warningKnockdowns} · arrest risk` : `Warnings ${knockdowns}/${rules.warningKnockdowns}`;
  const bannerText = banner === 'warning' ? (hot ? 'Final warning · arrest risk!' : `Warning ${knockdowns}/${rules.warningKnockdowns} · on your feet!`)
    : banner === 'paddle' && hot ? 'Arrest risk! Hop or swerve' : CHASE_TEXT[banner] || '';
  let cue = null, losing = 0;
  if (state.phase === 'chasing') {
    cue = !state.acquired ? 'incoming' : state.recovery > 0 ? 'recovering' : state.sees ? 'seen' : state.far > 0 ? 'far' : 'unseen';
    losing = Math.min(1, state.unseen / rules.loseSeconds, state.far / rules.outrunSeconds);
  }
  return { banner, bannerText, cue, metres: Math.round(Number.isFinite(distance) ? distance : 0),
    losing, knockdowns, heat, hot, heatText };
}
