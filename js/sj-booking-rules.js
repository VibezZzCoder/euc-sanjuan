/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan — adapted from VibezZzCoder/euc-sanfrancisco (MIT) */
// The booking that follows a capture: its clock, its words and its place. Pure (no DOM, no renderer). The director and
// the paperwork joke come from the San Francisco edition (js/booking.js, © 2026 VibezZzCoder, MIT; first written for
// the New York edition); the site and the San Juan voice are this game's own.

export const BOOKING_RULES = Object.freeze({ transferSeconds: 1.1, intakeSeconds: 3.6, signatureSeconds: 4.4, writeDelay: 1, tearSeconds: 2.4 });

// The desk stands on the public forecourt of La Princesa, about four metres out from the old jail's south face, end-on
// to the promenade; nothing is fixed to the building. Heights are rechecked on the built world at boot.
export const BOOKING_SITE = Object.freeze({
  name: 'Cuartelillo del Monociclo',
  desk: Object.freeze({ x: -143.5, y: 2.313, z: 222.3, heading: 0.05191 }),
  // the rider stands facing the desk (stationary placement)
  intake: Object.freeze([Object.freeze({ x: -143.33, y: 2.272, z: 225.6, heading: -3.08968 })]),
  // released on the promenade: east first (away from the fountain), the same spot facing west, then a backup west
  release: Object.freeze([
    Object.freeze({ x: -137, y: 2.297, z: 227.65, heading: 1.671 }),
    Object.freeze({ x: -137, y: 2.297, z: 227.65, heading: -1.47059 }),
    Object.freeze({ x: -146, y: 2.241, z: 226.9, heading: -1.47059 }),
  ]),
});

export const BOOKING_TEXT = Object.freeze({
  captured: { heading: 'Busted.', line: 'Three warnings. One form.', reply: 'Dorkins is taking you to the Cuartelillo del Monociclo.' },
  intake: { heading: 'Intake.', line: 'Front wheel?', reply: '“That is the wheel.”' },
  signature: { heading: 'Official business.', line: 'Firme aquí… no, wait. This one’s mine.', reply: 'Dorkins signs.' },
  released: { heading: 'Released.', line: 'Paperwork’s gone. Caso cerrado.', reply: 'Wheel count on release: 1. Still 1.' },
});
export const BOOKING_NOTES = Object.freeze({
  transfer: 'Transfer to intake', processing: 'Vehicle processing', retry: 'Intake occupied. Retrying…',
  wait: 'Please remain at the desk.', done: 'Heat cleared. No fine. Keep rolling.',
  blocked: 'The way out is blocked right now. Try again in a moment.',
});

/** idle → captured → intake → signature → released → idle. Transfer is asked for until arrive() confirms it. */
export function createBookingDirector(rules = BOOKING_RULES) {
  const state = { phase: 'idle', age: 0, number: 0, rider: '', knockdowns: 0, retry: 0 };
  return {
    state,
    get active() { return state.phase !== 'idle'; },
    start(rider, knockdowns) {
      if (state.phase !== 'idle') return false;
      Object.assign(state, { phase: 'captured', age: 0, number: state.number + 1, rider: String(rider ?? ''), knockdowns, retry: 0 });
      return true;
    },
    arrive() { if (state.phase !== 'captured') return false; state.phase = 'intake'; state.age = 0; return true; },
    /** `visible` false (window blurred or hidden) freezes the clock. Returns 'transfer' | 'signature' | 'released' | null. */
    update(dt, visible = true) {
      if (!visible || !(dt > 0) || state.phase === 'idle' || state.phase === 'released') return null;
      state.age += dt;
      if (state.phase === 'captured') {
        state.retry -= dt;
        if (state.age < rules.transferSeconds || state.retry > 0) return null;
        state.retry = 0.5; // a walker briefly on the intake spot: ask again shortly
        return 'transfer';
      }
      const span = state.phase === 'intake' ? rules.intakeSeconds : rules.signatureSeconds;
      if (state.age < span) return null;
      state.age -= span;
      state.phase = state.phase === 'intake' ? 'signature' : 'released';
      return state.phase;
    },
    finish() { if (state.phase === 'idle') return false; state.phase = 'idle'; state.age = 0; return true; },
  };
}

/**
 * Checked placement for the booking: the intake (stationary) and the release (with a short clear ride-away), each from
 * a fixed list tried in order. `place(site, departure)` puts the rider there only when it is clear and returns true;
 * a refused attempt changes nothing. Skip and "Back to riding" both use release().
 */
export function createBookingPlacement({ place, booking, chase, intake = BOOKING_SITE.intake, release = BOOKING_SITE.release, departure = 1.2 }) {
  const valid = p => p && [p.x, p.y, p.z, p.heading].every(Number.isFinite);
  if (typeof place !== 'function' || typeof booking?.arrive !== 'function' || typeof chase?.release !== 'function'
    || !intake.length || !intake.every(valid) || !release.length || !release.every(valid)) throw new TypeError('invalid booking placement');
  const intakeSites = intake.map(p => ({ ...p })), releaseSites = release.map(p => ({ ...p }));
  const tryAll = (sites, d) => { for (const site of sites) if (place(site, d) === true) return site; return null; };
  return {
    transfer() {
      if (booking.state.phase !== 'captured' || chase.state.phase !== 'captured') return null;
      const site = tryAll(intakeSites, 0);
      if (site) booking.arrive();
      return site;
    },
    release() {
      if (!booking.active || chase.state.phase !== 'captured') return null;
      const site = tryAll(releaseSites, departure);
      if (!site) return null;
      chase.release(); booking.finish();
      return site;
    },
  };
}

/**
 * After a release placement has succeeded the booking is over. The host was asked to start riding; when that start did
 * not happen (the player looked away while it was being prepared, or anything else), the game must not stay in an empty
 * booking state. Returns 'ride' (riding: nothing to do), 'pause' (open Pause on the promenade) or 'keep' (another owner
 * already holds the game: Pause is open, the page is being left, an error).
 */
export function afterRelease(state, { pauseOpen = false } = {}) {
  if (state === 'riding') return 'ride';
  if (state === 'booking' || (state === 'paused' && !pauseOpen)) return 'pause';
  return 'keep';
}
