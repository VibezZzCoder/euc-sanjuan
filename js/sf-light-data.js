/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Compact mask lookup adapted from the SF terrain sampler.
export function lightMaskValue(mask, column, row) {
  let low = mask.rows[row], high = mask.rows[row + 1];
  while (low < high) { const mid = (low + high) >>> 1; if (mask.ends[mid] <= column) low = mid + 1; else high = mid; }
  return mask.values[low];
}
