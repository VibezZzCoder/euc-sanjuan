/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// The rider picker: which of the eleven riders the game starts with, and changing rider from the title or from Pause.
// A host part (see the list in js/main.js). Browsing shows text and each rider's portrait (js/sj-riders-art.js: the
// drawings are loaded once, on the first opening); nothing of the rider's rig or sound is fetched or built for a rider
// who is only highlighted. Confirming prepares the rig and its crash voice together (js/sj-riders-selection.js)
// and swaps both in one turn. The candidate rig is compiled against the real scene, camera, lights and shadow pass while
// nothing else renders, so the first riding frames after a swap build nothing.
import { RIDERS, isPlayableRider } from './euc-roster.js';
import { RiderSelection, faultKind, abortError } from './sj-riders-selection.js';
import { waitForRenderCompletion } from './render-completion.js';
import { createRiderArt } from './sj-riders-art.js';

export const DEFAULT_RIDER = 'cool-rider';
export const RIDER_KEY = 'euc-sanjuan-rider';
const STYLE_NOTE = {
  standard: 'Your look, your wheel. The same speed, grip and brakes for every rider.',
  drunkard: 'Same speed, grip and brakes. Adds a hands-off weave, sway and the occasional stumble.',
};
const SCROLL_SPEED = 360; // px per second at full right-stick deflection

/** The rider the game boots with: a valid ?rider=, then a valid saved rider, then Cool Rider. ?rider= is not saved. */
export function startingRider(params, getStorage = () => globalThis.localStorage) {
  const asked = params?.get?.('rider');
  if (isPlayableRider(asked)) return asked;
  try {
    const saved = getStorage()?.getItem(RIDER_KEY);
    if (isPlayableRider(saved)) return saved;
  } catch { /* blocked storage: the default */ }
  return DEFAULT_RIDER;
}

export function saveRider(id, getStorage = () => globalThis.localStorage) {
  if (!isPlayableRider(id)) return false;
  try { getStorage()?.setItem(RIDER_KEY, id); return true; } catch { return false; }
}

export const styleNote = id => id === 'drunkard' ? STYLE_NOTE.drunkard : STYLE_NOTE.standard;
const nextFrame = () => new Promise(resolve => setTimeout(resolve, 16));

export async function createRiders(host) {
  const { $, QUIET, MENUS } = host;
  const dialog = $('riders');
  if (!dialog) return null;
  const stamps = [...dialog.querySelectorAll('.stamp[data-rider]')].filter(b => isPlayableRider(b.dataset.rider));
  const ui = {
    list: dialog.querySelector('.stamps'), card: $('riders-card'), state: $('riders-state'), name: $('riders-name'),
    profile: $('riders-profile'), note: $('riders-style'), wheel: $('riders-wheel'), wheelBlurb: $('riders-wheel-blurb'),
    status: $('riders-status'), confirm: $('riders-confirm'), retry: $('riders-retry'), back: $('riders-cancel'),
  };
  let origin = null, opener = null, highlighted = host.riderId, mode = 'browse', fault = null, armed = false;
  let previewShown = false, started = 0, serial = 0, opening = false, closedAt = -1e9, closedOpener = null; // serial: the request the picker's state belongs to
  const part = { lastTiming: null, timings: [], selection: null, art: createRiderArt() };
  const cardStamp = ui.card.querySelector('.postcard-stamp'), cardArt = new Map(); // rider id -> the card's portrait
  const committed = () => host.riderId;
  const nameOf = id => RIDERS[id].name;

  function labels() {
    const name = nameOf(committed());
    $('ride').textContent = `Ride with ${name}`;
    const build = $('build');
    if (build.textContent) { const parts = build.textContent.split(' · '); parts[parts.length - 1] = name; build.textContent = parts.join(' · '); }
    for (const id of ['choose-rider', 'change-rider']) { const dot = $(id)?.querySelector('.rider-dot'); if (dot) dot.dataset.rider = committed(); }
  }

  function render(message) {
    const id = highlighted, spec = RIDERS[id], active = committed();
    for (const stamp of stamps) {
      const rider = stamp.dataset.rider;
      stamp.setAttribute('aria-pressed', String(rider === id));
      if (rider === active) stamp.setAttribute('aria-current', 'true'); else stamp.removeAttribute('aria-current');
      if (mode === 'preparing') stamp.setAttribute('aria-disabled', 'true'); else stamp.removeAttribute('aria-disabled');
    }
    if (ui.card.dataset.rider !== id) {
      ui.card.dataset.rider = id;
      ui.name.textContent = spec.name;
      ui.profile.textContent = spec.blurb ?? '';
      ui.wheel.textContent = spec.wheelName ?? '';
      ui.wheelBlurb.textContent = spec.wheelBlurb ?? '';
      ui.note.textContent = styleNote(id);
      ui.card.scrollTop = 0; // a new rider's card starts at the top; the same rider keeps its place
      showCardArt(id);
    }
    ui.state.textContent = id === active ? 'Riding now' : 'In the crew';
    const keep = id === active;
    // Full label as the accessible name; the name part is a span that small windows hide (the status line names it).
    const [verb, tail] = mode === 'preparing' ? ['Getting', ' ready…'] : [keep ? 'Keep' : 'Choose', ''], label = `${verb} ${spec.name}${tail}`;
    if (ui.confirm.getAttribute('aria-label') !== label) {
      const text = document.createElement('span'), name = document.createElement('span'); // one text item: spaces stay spaces
      name.className = 'confirm-name'; name.textContent = ` ${spec.name}`; text.append(verb, name, tail);
      ui.confirm.replaceChildren(text); ui.confirm.setAttribute('aria-label', label);
    }
    // Stays enabled and focused while preparing, so a repeated Enter, tap or A lands here and does nothing.
    if (mode === 'preparing') ui.confirm.setAttribute('aria-disabled', 'true'); else ui.confirm.removeAttribute('aria-disabled');
    if (mode === 'preparing') ui.confirm.setAttribute('aria-busy', 'true'); else ui.confirm.removeAttribute('aria-busy');
    ui.confirm.hidden = mode === 'error';
    ui.retry.hidden = mode !== 'error';
    ui.retry.textContent = fault === 'reload' ? 'Reload the game' : 'Try again';
    ui.back.textContent = mode === 'preparing' ? 'Cancel' : 'Back';
    dialog.toggleAttribute('aria-busy', mode === 'preparing');
    const text = message ?? (mode === 'preparing' ? `Getting ${spec.name} ready… You can cancel.`
      : keep ? `You are riding as ${spec.name}.` : `Tap ${spec.name}’s stamp again, or use Choose, to pick this rider.`);
    if (ui.status.textContent !== text) ui.status.textContent = text;
  }

  // Portraits: the stamps get theirs once, the card shows the highlighted rider's (each built once, then reused).
  function showCardArt(id) {
    if (!part.art.loaded || !cardStamp) return;
    if (!cardArt.has(id)) cardArt.set(id, part.art.build(id));
    const art = cardArt.get(id);
    if (art && cardStamp.firstChild !== art) cardStamp.replaceChildren(art);
    if (dialog.open) part.art.repaint();
  }
  let stampsDrawn = false;
  function showArt() {
    part.art.ready().then(() => {
      if (!part.art.loaded) return;
      if (!stampsDrawn) {
        stampsDrawn = true;
        for (const stamp of stamps) { const art = part.art.build(stamp.dataset.rider); if (art) stamp.querySelector('.stamp-ink')?.prepend(art); }
      }
      showCardArt(ui.card.dataset.rider);
    });
  }

  function highlight(id) {
    if (!isPlayableRider(id) || mode === 'preparing' || (id === highlighted && mode !== 'error')) return;
    if (mode === 'error') { mode = 'browse'; fault = null; }
    highlighted = id;
    render();
  }

  function open(from) {
    // A stray second press from the choice that just closed the picker (it lands on the opener) must not reopen it.
    if (dialog.open || host.busy || !['title', 'paused'].includes(host.state) || (from === closedOpener && performance.now() - closedAt < 350)) return false;
    origin = host.state; opener = from; mode = 'browse'; fault = null;
    const target = committed(), stamp = stamps.find(s => s.dataset.rider === target) ?? stamps[0];
    highlighted = target; render();
    // showModal() focuses the first stamp by itself: that must not count as browsing to it.
    opening = true;
    try { dialog.showModal(); } finally { opening = false; }
    ui.list.scrollTop = 0; ui.card.scrollTop = 0;
    highlighted = target; render();
    stamp.focus(QUIET); stamp.scrollIntoView?.({ block: 'nearest' });
    showArt();
    return true;
  }

  function settleCancel(message) {
    const drain = part.selection.cancel();
    serial++; mode = 'browse'; fault = null;
    if (dialog.open) render(message);
    drain.then(() => {
      if (previewShown && !host.busy && ['title', 'paused'].includes(host.state)) redraw().catch(error => host.failure(error));
    });
    return drain;
  }

  // Close without restoring focus: the host is moving on (a ride, an error, a page leaving).
  function closeQuietly() {
    if (part.selection.preparing) settleCancel();
    if (dialog.open) { dialog.close(); closedAt = performance.now(); closedOpener = opener; }
    mode = 'browse'; origin = null;
  }

  function close() {
    if (!dialog.open) return;
    const back = opener;
    closeQuietly();
    (back?.isConnected ? back : $('ride')).focus(QUIET);
  }

  async function redraw() {
    host.draw(performance.now(), 0, true);
    previewShown = false;
    await waitForRenderCompletion(host.renderer);
  }

  function confirm() {
    if (mode === 'preparing' || !dialog.open) return;
    const id = highlighted;
    if (id === committed()) { close(); return; }
    mode = 'preparing'; fault = null; started = performance.now(); const token = ++serial;
    render();
    const timing = { id, backend: host.renderer?.backend?.isWebGPUBackend ? 'WebGPU' : 'WebGL2', audio: !!(host.audio && host.context) };
    part.selection.prepare(id).then(async () => {
      timing.committedMs = performance.now() - started;
      await redraw();
      timing.frameMs = performance.now() - started;
      part.lastTiming = timing; if (part.timings.length < 64) part.timings.push(timing);
      if (token !== serial) return;
      mode = 'browse';
      if (dialog.open && origin === host.state) close();
    }).catch(error => {
      const kind = faultKind(error);
      if (token !== serial) return; // whoever cancelled has already set the picker's state
      if (kind === 'cancelled') { // refused at the last moment: the page was hidden or the menu changed
        mode = 'browse'; if (dialog.open) render(`Stopped. You are still riding as ${nameOf(committed())}.`);
        if (previewShown && !host.busy) redraw().catch(e => host.failure(e));
        return;
      }
      console.warn('Rider preparation failed', error);
      mode = 'error'; fault = kind;
      if (!dialog.open) return;
      render(kind === 'reload'
        ? `Part of the game did not load. Reload the game to keep riding as ${nameOf(committed())}.`
        : `${nameOf(id)} could not be prepared. Try again, or choose another rider.`);
      ui.retry.focus(QUIET);
      if (previewShown && !host.busy) redraw().catch(e => host.failure(e));
    });
  }

  function reloadCommitted() {
    part.selection.cancel();
    const url = new URL(location.href);
    url.searchParams.set('rider', committed());
    try { history.replaceState(history.state, '', url); } catch { /* the reload below still works */ }
    location.reload();
  }

  // Compile the candidate where it will be drawn: the real scene, camera and lights, then one real frame with the sun's
  // shadow pass so its shadow-caster variants exist too. Nothing else renders or resizes meanwhile (host.busy).
  async function compile(resource, { signal }) {
    for (let i = 0; host.busy && i < 600; i++) { if (signal.aborted) throw abortError(); await nextFrame(); }
    if (signal.aborted || host.busy) throw abortError();
    const { renderer, scene, camera, sun, entity } = host, old = entity.mesh, shown = old.visible, culled = [];
    host.busy = true;
    try {
      scene.add(resource.group);
      resource.group.traverse(o => { if (o.frustumCulled) { culled.push(o); o.frustumCulled = false; } });
      await renderer.compileAsync(resource.group, camera, scene);
      if (signal.aborted) throw abortError();
      old.visible = false;
      sun.shadow.needsUpdate = true;
      renderer.render(scene, camera);
      previewShown = true;
      await waitForRenderCompletion(renderer);
    } finally {
      resource.group.removeFromParent();
      for (const o of culled) o.frustumCulled = true;
      old.visible = shown;
      host.busy = false;
    }
  }

  part.selection = new RiderSelection({
    rig: {
      active: () => host.entity.riderId,
      prepare: (id, { signal }) => host.entity.prepareRider(id, { signal, compile }),
      cancel: () => host.entity.cancelRiderPreparation(),
    },
    // Before the first Ride there is no audio context: the swap is rig-only and Ride prepares the committed voice.
    // Muted or not, an existing context prepares the voice with the rig (decoding works on a suspended context).
    audio: { prepare: (id, { signal }) => host.audio && host.context && host.context.state !== 'closed'
      ? host.audio.riderBanks.prepareRider(id, host.context, { signal }) : null },
    allowed: () => dialog.open && host.state === origin,
    onCommit: id => {
      host.riderId = id;
      saveRider(id);
      try { // a ?rider= from the address would override the saved choice on the next load
        const url = new URL(location.href);
        if (url.searchParams.has('rider')) { url.searchParams.delete('rider'); history.replaceState(history.state, '', url); }
      } catch { /* not fatal */ }
      labels();
      host.notify('rider', id);
    },
  });

  // ---- Wiring ----
  for (const stamp of stamps) {
    const id = stamp.dataset.rider;
    stamp.addEventListener('pointerdown', () => { armed = highlighted === id && mode !== 'preparing'; });
    stamp.addEventListener('focus', () => { if (!opening) highlight(id); });
    stamp.addEventListener('click', event => {
      // Choosing the highlighted stamp again rides with it: a second tap, Enter/Space or the pad's A on a focused stamp.
      const again = event.detail === 0 ? highlighted === id : armed;
      armed = false;
      if (mode === 'preparing') return; // a repeated press while preparing is harmless
      if (again && mode !== 'error') confirm(); else highlight(id);
    });
  }
  ui.confirm.addEventListener('click', confirm);
  ui.retry.addEventListener('click', () => { if (fault === 'reload') reloadCommitted(); else { mode = 'browse'; confirm(); ui.confirm.focus(QUIET); } });
  ui.back.addEventListener('click', () => {
    if (mode === 'preparing') { settleCancel(`Stopped. You are still riding as ${nameOf(committed())}.`); stamps.find(s => s.dataset.rider === highlighted)?.focus(QUIET); }
    else close();
  });
  dialog.addEventListener('cancel', event => event.preventDefault()); // Esc goes through the host (cancel() below)
  // The card is a keyboard stop of its own: arrows, Page Up/Down, Home/End and Space scroll it (the host's riding keys
  // would otherwise swallow them).
  ui.card.addEventListener('keydown', event => {
    if (event.target !== ui.card || event.altKey || event.ctrlKey || event.metaKey) return;
    const page = ui.card.clientHeight * .85, step = { ArrowDown: 40, ArrowUp: -40, PageDown: page, PageUp: -page,
      Space: event.shiftKey ? -page : page, Home: -1e6, End: 1e6 }[event.code];
    if (step === undefined) return;
    event.preventDefault(); event.stopPropagation();
    ui.card.scrollTop = Math.max(0, Math.min(ui.card.scrollHeight - ui.card.clientHeight, ui.card.scrollTop + step));
  });
  // Arrow keys move between stamps: left/right in order, up/down to the nearest stamp in the next visual row.
  dialog.addEventListener('keydown', event => {
    const at = stamps.indexOf(event.target);
    if (at < 0 || event.altKey || event.ctrlKey || event.metaKey) return;
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.code], vertical = { ArrowUp: -1, ArrowDown: 1 }[event.code];
    if (!step && !vertical) return;
    event.preventDefault(); event.stopPropagation();
    let next = step ? stamps[(at + step + stamps.length) % stamps.length] : null;
    if (vertical) {
      const r = stamps[at].getBoundingClientRect(), cx = (r.left + r.right) / 2;
      let best = null, bestGap = Infinity, bestDx = Infinity;
      for (const s of stamps) {
        if (s === stamps[at]) continue;
        const q = s.getBoundingClientRect(), gap = vertical > 0 ? q.top - r.bottom : r.top - q.bottom, dx = Math.abs((q.left + q.right) / 2 - cx);
        if (gap < -4) continue;
        if (gap < bestGap - 12 || (Math.abs(gap - bestGap) <= 12 && dx < bestDx)) { best = s; bestGap = Math.min(gap, bestGap); bestDx = dx; }
      }
      next = best ?? (vertical > 0 ? ui.confirm.hidden ? ui.retry : ui.confirm : null);
    }
    if (next && !next.disabled) { next.focus(QUIET); next.scrollIntoView?.({ block: 'nearest' }); }
  });
  for (const id of ['choose-rider', 'change-rider']) {
    $(id)?.addEventListener('click', event => open(event.currentTarget));
    // A held Enter/Space that just chose a rider auto-repeats onto the opener: only a fresh press opens the picker.
    $(id)?.addEventListener('keydown', event => { if (event.repeat && ['Enter', 'NumpadEnter', 'Space'].includes(event.code)) event.preventDefault(); });
  }

  // The gamepad drives the picker's own controls while it is open, over the title or Pause.
  for (const state of ['title', 'paused']) { const base = MENUS[state]; MENUS[state] = () => dialog.open ? dialog : base(); }

  labels();
  Object.assign(part, {
    open, close,
    cancel() {
      if (!dialog.open) return false;
      if (mode === 'preparing') ui.back.click(); else close();
      return true;
    },
    // Right stick scrolls the rider's card; nothing else in the menus uses it.
    menu(input, dt) {
      const y = input?.look?.y;
      if (dialog.open && y && Number.isFinite(dt)) ui.card.scrollTop += y * SCROLL_SPEED * Math.min(.05, Math.max(0, dt));
      return false;
    },
    gate(next) { if (dialog.open && next !== origin) closeQuietly(); },
    away() { if (part.selection.preparing) settleCancel(`Stopped while the page was away. You are still riding as ${nameOf(committed())}.`); },
    // The player looked away (window blur, page hidden): a preparation still running is dropped; choose again to retry.
    interrupted() { if (part.selection.preparing) settleCancel(`Stopped while you were away. You are still riding as ${nameOf(committed())}.`); },
    failed() { closeQuietly(); },
    resize() { if (dialog.open && part.art.loaded) part.art.repaint(); },
    // The rider's crash voice belongs to the place of the fall: a map arrival, Restart, a rescue or the booking ends it.
    placed() { host.audio?.placed?.(); },
  });
  return part;
}

