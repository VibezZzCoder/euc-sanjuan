/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan — adapted from VibezZzCoder/euc-sanfrancisco (MIT) */
// Changing rider: one transaction that owns the rig candidate and the crash-voice candidate until both are ready,
// then commits both in one synchronous turn, or neither. Adapted from RiderSelection in the San Francisco edition
// (js/game-menu.js). No three.js and no DOM here, so it runs headless.
//
//   rig:   { active() → committed id, prepare(id, { signal }) → Promise<ticket>, cancel() → Promise }
//   audio: { prepare(id, { signal }) → Promise<ticket> | null }   null = no audio context yet: the swap is rig-only
//   ticket: { id, valid, commit() → true | false (rig) / true | throws (audio), dispose() }
// A ticket disposed after commit is harmless; a ticket that was never committed frees its resources on dispose.

export const abortError = () => new DOMException('Rider preparation cancelled', 'AbortError');

/** 'cancelled' | 'reload' (a module failed to load: only a page reload helps) | 'retry' (anything else). */
export function faultKind(error) {
  if (error?.name === 'AbortError') return 'cancelled';
  return error?.reloadRequired === true ? 'reload' : 'retry';
}

export class RiderSelection {
  constructor({ rig, audio, visible = () => !globalThis.document?.hidden, allowed = () => true,
    onState = () => {}, onCommit = () => {} }) {
    Object.assign(this, { rig, audio, visible, allowed, onState, onCommit });
    this.tail = Promise.resolve();
    this.request = null;
    this.closed = false;
  }

  get preparing() { return !!this.request; }

  /** Stop the current request. Resolves once everything it started has settled (native work is drained, not cut). */
  cancel() {
    const request = this.request;
    this.request = null;
    request?.abort();
    // Aborting the request's signal retires its own audio candidate; the rig side is cancelled explicitly.
    const drain = request ? this.rig.cancel() : undefined;
    return Promise.allSettled([this.tail, drain]);
  }

  prepare(id) {
    if (this.closed) return Promise.reject(abortError());
    this.cancel();
    const request = new AbortController();
    this.request = request;
    const check = () => {
      if (this.closed || request.signal.aborted || this.request !== request) throw abortError();
    };
    this.onState('preparing', id);
    const run = this.tail.then(async () => {
      let rig, bank;
      try {
        check();
        const audioWork = this.audio.prepare(id, { signal: request.signal });
        const before = this.rig.active();
        const current = () => !request.signal.aborted && this.rig.active() === id;
        const rigWork = before === id
          ? Promise.resolve({ id, get valid() { return current(); }, commit: current, dispose() {} })
          : this.rig.prepare(id, { signal: request.signal });
        // Wait for BOTH even after one fails: a decode or a compile cannot always be interrupted.
        const results = await Promise.allSettled([rigWork, audioWork ?? Promise.resolve(null)].map(work =>
          Promise.resolve(work).catch(error => { request.abort(); throw error; })));
        if (results[0].status === 'fulfilled') rig = results[0].value;
        if (results[1].status === 'fulfilled') bank = results[1].value;
        const failure = results.find(r => r.status === 'rejected' && r.reason?.name !== 'AbortError')
          ?? results.find(r => r.status === 'rejected');
        if (failure) throw failure.reason;
        check();
        if (rig?.valid !== true || rig.id !== id || (bank && (bank.valid !== true || bank.id !== id))
          || !this.visible() || !this.allowed()) throw abortError();
        // Nothing between the two transfers: no await, no event, no save.
        if (!rig.commit()) throw new Error('The rider could not be swapped in. Try again.');
        bank?.commit();
        this.request = null;
        this.onCommit(id);
        this.onState('ready', id);
        return true;
      } catch (error) {
        request.abort();
        if (this.request === request) {
          this.request = null;
          this.onState(faultKind(error) === 'cancelled' ? 'cancelled' : 'error', id, error);
        }
        throw error;
      } finally {
        rig?.dispose();
        bank?.dispose();
        if (this.request === request) this.request = null;
      }
    });
    this.tail = run.catch(() => {});
    return run;
  }

  dispose() { this.closed = true; return this.cancel(); }
}
