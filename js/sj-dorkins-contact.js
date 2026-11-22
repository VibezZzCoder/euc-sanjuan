/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan — adapted from VibezZzCoder/euc-sanfrancisco (MIT) */
// Officer Dorkins: admits a drawn paddle contact into the rider's own controller (hardKnock); never moves the rider.
// From the San Francisco edition (js/sf-nemesis-contact.js, © 2026 VibezZzCoder, MIT; the swept test first written for
// the New York edition).
import { sweptContactFraction, sweptContactWindow, SWING } from './sj-dorkins-swing.js';

const validFace = p => p && [p.x, p.y, p.z].every(Number.isFinite);
const validRider = p => p && [p.x, p.z, p.bottom].every(Number.isFinite);

/**
 * Record one drawn frame at a time. Caller resets at a new swing and on hidden/frozen/placement
 * boundaries. Sight at the computed contact time is an additional layer check, not a substitute
 * for the controller's own collision policy.
 */
export function createPaddleContact(queries, director) {
  if (!queries || typeof queries.clearLine !== 'function' || !director || typeof director.knockedDown !== 'function') {
    throw new TypeError('Paddle contact requires line queries and a chase director');
  }
  let previousFace = null, previousRider = null, struck = false, serial;
  function reset() { previousFace = previousRider = null; struck = false; serial = undefined; }
  function clearBetween(face, rider) {
    const y = rider.bottom + Math.max(0.05, Math.min(SWING.riderHeight, face.y - rider.bottom));
    return queries.clearLine(face, { x: rider.x, y, z: rider.z });
  }
  // Sight between the interpolated face and rider poses at fraction t of this frame.
  function clearAt(t, face, rider) {
    return clearBetween({ x: previousFace.x + (face.x - previousFace.x) * t,
      y: previousFace.y + (face.y - previousFace.y) * t, z: previousFace.z + (face.z - previousFace.z) * t },
    { x: previousRider.x + (rider.x - previousRider.x) * t,
      bottom: previousRider.bottom + (rider.bottom - previousRider.bottom) * t,
      z: previousRider.z + (rider.z - previousRider.z) * t });
  }
  // The closest pose was occluded: try at most four other exactly re-admitted in-range poses
  // (window ends and midpoints), so a wall at one instant cannot veto a clear earlier/later hit.
  function clearElsewhere(sweep, interval, t, face, rider) {
    const win = sweptContactWindow(...sweep, interval);
    if (!win) return false;
    for (const s of [(win.from + t) / 2, (t + win.to) / 2, win.from, win.to]) {
      if (Math.abs(s - t) < 1e-6 || sweptContactFraction(...sweep, { from: s, to: s }) === null) continue;
      if (clearAt(s, face, rider)) return true;
    }
    return false;
  }
  function frame({ face, rider, interval, controller, placementSerial, enabled = true }) {
    if (!validFace(face) || !validRider(rider)) { previousFace = previousRider = null; return false; }
    const moved = previousRider && Math.hypot(rider.x - previousRider.x, rider.bottom - previousRider.bottom,
      rider.z - previousRider.z) > 5;
    if (!enabled || (serial !== undefined && placementSerial !== serial) || moved) previousFace = previousRider = null;
    serial = placementSerial;
    let accepted = false;
    if (enabled && previousFace && previousRider && !struck && interval
      && director.state?.phase === 'chasing' && director.state.recovery <= 0 && !controller?.crashed
      && typeof controller?.hardKnock === 'function') {
      const sweep = [previousFace.x, previousFace.y, previousFace.z, face.x, face.y, face.z, rider, SWING, previousRider];
      const t = sweptContactFraction(...sweep, interval);
      if (t !== null && (clearAt(t, face, rider) || clearElsewhere(sweep, interval, t, face, rider))) {
        if (controller.hardKnock(face.x - previousFace.x, face.z - previousFace.z)) {
          struck = true;
          accepted = director.knockedDown();
        }
      }
    }
    // Never bridge a disabled frame; this also prevents a freeze from creating a long sweep.
    if (enabled) {
      previousFace = { x: face.x, y: face.y, z: face.z };
      previousRider = { x: rider.x, bottom: rider.bottom, z: rider.z };
    }
    return accepted;
  }
  return { frame, reset, get struck() { return struck; } };
}
