/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Compact San Juan host boundary — © 2026 VibezZzCoder, MIT.
// window.NYC is retained only as the pinned engine's internal compatibility namespace.
export function getCity() {
  if(!globalThis.window?.NYC) throw new Error('Initialize the San Juan host first');
  return window.NYC;
}
export function isTypingInField(event) {
  const t=event?.target;
  return !!t && (['INPUT','TEXTAREA','SELECT'].includes(t.tagName)||t.isContentEditable);
}
