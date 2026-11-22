/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan — adapted from VibezZzCoder/euc-sanfrancisco (MIT) */
// The booking, run by the officer part: a host state 'booking' entered on capture, the paperwork scene at the
// Cuartelillo del Monociclo, the <dialog id="booking"> with its receipt, and the checked release. Adapted from the San
// Francisco edition (js/booking.js BookingScreen and the booking host code in js/main.js, © 2026 VibezZzCoder, MIT).
//
// One owner for the clock, the input, the camera and the release: the clock stops while the window is blurred or
// hidden; keys held when the capture happened cannot press a dialog button until they have been let go; the gamepad
// drives the dialog through the host's menu scheme (MENUS.booking) with its neutral-stick gate; Skip and "Back to
// riding" are the same checked release; a refused release changes nothing and the dialog says so.
import { createBookingScene } from './sj-booking-scene.js';
import { BOOKING_SITE, BOOKING_TEXT, BOOKING_NOTES, BOOKING_RULES, createBookingDirector, createBookingPlacement, afterRelease } from './sj-booking-rules.js';
export { BOOKING_SITE };

async function plaqueCanvas() {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 324;
  try { await Promise.race([Promise.all(['800 92px Fraunces', '700 40px Overpass'].map(f => document.fonts?.load(f))), new Promise(r => setTimeout(r, 1500))]); } catch { /* system fonts */ }
  const c = canvas.getContext('2d');
  c.fillStyle = '#f8f1e3'; c.fillRect(0, 0, 1024, 324);
  c.strokeStyle = '#254873'; c.lineWidth = 14; c.strokeRect(7, 7, 1010, 310);
  c.lineWidth = 3; c.strokeRect(26, 26, 972, 272);
  c.fillStyle = '#a62d23'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = '700 34px Overpass, Inter, sans-serif'; c.fillText('C U A R T E L I L L O   D E L', 512, 84);
  c.fillStyle = '#182c40'; c.font = '800 104px Fraunces, Georgia, serif'; c.fillText('Monociclo', 512, 172);
  c.fillStyle = '#254873'; c.font = 'italic 600 38px Inter, sans-serif'; c.fillText('Una rueda. Un formulario.', 512, 252);
  return canvas;
}

export async function createBooking(host, { officer, director: chase, life, stats = {} }) {
  const { world, $, QUIET } = host;
  const sampler = world.sampler, probe = { normal: {} };
  const step = () => host.entity?.controller?.tuning?.maxStepUp ?? 0.216;
  const onFloor = p => { const g = sampler.sampleGround(p.x, p.z, probe, p.y + 0.5); return Number.isFinite(g.height) && Math.abs(g.height - p.y) < 0.3 ? { ...p, y: g.height } : { ...p }; };
  const desk = onFloor(BOOKING_SITE.desk), intake = BOOKING_SITE.intake.map(onFloor), release = BOOKING_SITE.release.map(onFloor);
  const scene = createBookingScene(host.scene, desk, officer, { plaque: await plaqueCanvas() });
  const booking = createBookingDirector();
  const placement = createBookingPlacement({ booking, chase, intake, release, place(site, departure) {
    const target = sampler.findPlacementTarget({ x: site.x, z: site.z, headingY: site.heading, referenceY: site.y, maxStepUp: step() });
    if (!target || Math.abs(target.y - site.y) > 0.5) return false;
    life?.clearAround(site.x, site.z, 6);
    return host.entity.placeAt(site.x, site.z, site.heading, site.y, { requireClear: true, departure }) === true;
  } });

  const dialog = $('booking');
  const q = id => $(id);
  const nodes = { heading: q('booking-heading'), subtitle: q('booking-subtitle'), line: q('booking-line'), reply: q('booking-reply'),
    rider: q('booking-rider'), number: q('booking-number'), stamp: q('booking-stamp'), note: q('booking-note'), skip: q('booking-skip'), release: q('booking-release') };
  const shown = {};
  const put = (key, value, write) => { if (shown[key] !== value) { shown[key] = value; write(value); } };
  host.MENUS.booking = () => dialog;
  host.RESUMABLE.add('booking');
  host.AUDIBLE.add('booking'); // quietly: only the paper tear plays (the officer part's sound)

  // keys down when the capture happened: they must be let go before they can press anything in the dialog
  const down = new Set(), blocked = new Set();
  const onKey = event => {
    const pressing = event.type === 'keydown';
    if (pressing && !event.repeat) down.add(event.code); else if (!pressing) down.delete(event.code);
    if (!dialog.open) { blocked.clear(); return; }
    if (blocked.has(event.code) || (pressing && event.repeat && ['Enter', 'NumpadEnter', 'Space'].includes(event.code))) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (!pressing) blocked.delete(event.code);
    }
  };
  addEventListener('keydown', onKey, true); addEventListener('keyup', onKey, true);
  let windowFocused = true;
  addEventListener('blur', () => { down.clear(); windowFocused = false; });
  addEventListener('focus', () => { windowFocused = true; });
  for (const type of ['pointerdown', 'keydown']) addEventListener(type, () => { windowFocused = true; }, true); // input means the page has focus
  dialog.addEventListener('cancel', event => event.preventDefault()); // Esc never skips the booking
  let suspended = false, starting = false;

  function write() {
    const s = booking.state, copy = BOOKING_TEXT[s.phase] ?? BOOKING_TEXT.captured;
    put('phase', s.phase, phase => {
      dialog.dataset.phase = phase;
      nodes.heading.textContent = copy.heading; nodes.line.textContent = copy.line; nodes.reply.textContent = copy.reply;
      nodes.reply.hidden = !copy.reply;
      nodes.subtitle.textContent = phase === 'captured' ? BOOKING_NOTES.transfer : BOOKING_NOTES.processing;
      nodes.stamp.textContent = phase === 'released' ? 'RELEASED' : 'VOID';
      nodes.note.textContent = phase === 'released' ? BOOKING_NOTES.done : BOOKING_NOTES.wait;
      nodes.release.disabled = phase !== 'released';
      if (phase === 'released' && dialog.open) nodes.release.focus(QUIET);
    });
    put('rider', s.rider, name => { nodes.rider.textContent = name; });
    put('number', s.number, n => { nodes.number.textContent = `EUC-${String(n).padStart(3, '0')}`; });
    put('torn', s.phase === 'released' || (s.phase === 'signature' && s.age >= BOOKING_RULES.tearSeconds), v => { dialog.toggleAttribute('data-torn', v); });
    put('signing', s.phase === 'signature' && s.age >= BOOKING_RULES.writeDelay, v => { dialog.toggleAttribute('data-signing', v); });
  }
  function setSuspended(value) {
    if (suspended === value) return;
    suspended = value; dialog.toggleAttribute('data-suspended', value);
  }
  function close() {
    if (dialog.open) dialog.close();
    document.body.classList.remove('booking-open');
    for (const key of Object.keys(shown)) delete shown[key];
  }
  // Skip and "Back to riding": the same checked release. Refused: nothing changes, the dialog stays and says so.
  async function finish() {
    if (!booking.active || suspended || host.busy) return;
    const site = placement.release();
    if (!site) { nodes.note.textContent = BOOKING_NOTES.blocked; shown.note = null; return; }
    stats.releases = (stats.releases ?? 0) + 1;
    scene.end(); officer.end(); close();
    host.notify('placed', 'release');
    await host.resume();
    // the booking is over: if the ride did not start (the player looked away meanwhile), pause on the promenade
    if (afterRelease(host.state, { pauseOpen: $('pause').open }) === 'pause') host.enterPause?.();
  }
  nodes.skip.onclick = finish; nodes.release.onclick = finish;

  // the larger open area beside or above the dialog (CSS pixels), measured on open and after a resize only
  let free = null, viewing = null;
  function measureFree() {
    const W = Math.max(1, innerWidth), H = Math.max(1, innerHeight), r = dialog.open ? dialog.getBoundingClientRect() : null;
    if (!r) { free = { x: 0, y: 0, w: W, h: H }; return; }
    const right = { x: r.right, y: 0, w: W - r.right, h: H }, above = { x: 0, y: 0, w: W, h: r.top };
    free = right.w * right.h >= above.w * above.h ? right : above;
    if (free.w < 40 || free.h < 40) free = { x: 0, y: 0, w: W, h: H };
  }
  function releaseView() { if (viewing) { viewing.clearViewOffset(); viewing = null; } }
  // sound: the booking is quietly audible (the paper tear, at its moment); the rider's and the city's voices are cut
  function hushVoices() {
    try {
      const a = host.audio; a?.reset(); host.lifeAudio?.hush?.();
      // and the rider's whole output, until the ride goes on (reset() leaves some motor layers where they were)
      if (a?.out?.gain) { const g = a.out.gain, at = a.context.currentTime; g.cancelScheduledValues(at); g.setValueAtTime(g.value, at); g.linearRampToValueAtTime(0, at + 0.05); }
    } catch { /* sound never stops the game */ }
  }
  function unhushVoices() {
    try { const a = host.audio; if (a?.out?.gain) { const g = a.out.gain, at = a.context.currentTime; g.cancelScheduledValues(at); g.setValueAtTime(1, at); } } catch { /* as above */ }
  }
  return {
    get active() { return booking.active; },
    get state() { return booking.state; },
    get suspended() { return suspended; },
    scene, placement, director: booking,
    /** Called by the officer part on capture, from the riding frame. */
    start(rider, knockdowns) {
      if (!booking.start(rider, knockdowns)) return false;
      blocked.clear(); for (const code of down) blocked.add(code);
      starting = true; host.gate('booking'); starting = false;
      document.body.classList.add('booking-open');
      dialog.showModal(); dialog.querySelector('.booking-body').scrollTop = 0; nodes.heading.focus(QUIET); free = null;
      write();
      return true;
    },
    idle(dt, now) {
      if (!booking.active) return;
      const visible = !document.hidden && windowFocused && document.hasFocus();
      setSuspended(!visible);
      const bdt = visible ? dt : 0;
      if (bdt > 0) { host.atmosphere?.advance(bdt); life?.update(bdt, host.entity, host.camera); }
      if (booking.update(bdt, visible) === 'transfer') {
        if (placement.transfer()) host.notify('placed', 'booking');
        else nodes.subtitle.textContent = BOOKING_NOTES.retry;
      }
      scene.update(bdt, booking.state, host.camera.aspect);
      write();
      if (visible) host.draw(now, bdt);
    },
    /** The cinematic camera while the desk is on show: the subject fitted into the screen area the dialog leaves free. */
    view(camera) {
      if (!booking.active || booking.state.phase === 'captured') { releaseView(); return; }
      const v = scene.cameraView;
      if (!Number.isFinite(v.center.x)) return;
      const W = Math.max(1, innerWidth), H = Math.max(1, innerHeight);
      if (!free) measureFree();
      const tanV = Math.tan(v.fov * Math.PI / 360), tanH = tanV * W / H;
      const fit = Math.min(tanV * free.h / H, tanH * free.w / W) * 0.9;
      const d = v.radius / Math.sin(Math.atan(fit));
      camera.position.set(v.center.x + v.dir.x * d, v.center.y + v.dir.y * d, v.center.z + v.dir.z * d);
      camera.lookAt(v.center.x, v.center.y, v.center.z);
      camera.fov = v.fov; camera.aspect = W / H;
      camera.setViewOffset(W, H, W / 2 - (free.x + free.w / 2), H / 2 - (free.y + free.h / 2), W, H);
      viewing = camera; camera.updateMatrixWorld();
    },
    resize() { free = null; },
    cancel() { return booking.active; },
    gate(next, prev) {
      if (next === 'booking') hushVoices();
      if (prev === 'booking' && next !== 'booking') { releaseView(); free = null; unhushVoices(); }
      if (prev === 'booking' && next !== 'booking' && !starting) { scene.end(); close(); }
      if (next === 'booking' && booking.active && !dialog.open && !starting) { dialog.showModal(); nodes.heading.focus(QUIET); write(); }
    },
    warm(on) { scene.warm(on); },
    away() { setSuspended(true); },
    returned() { if (booking.active && !dialog.open) { dialog.showModal(); nodes.heading.focus(QUIET); write(); } },
    failed() { close(); },
    finish,
  };
}
