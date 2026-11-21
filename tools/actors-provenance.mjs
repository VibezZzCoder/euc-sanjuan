/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Keeps provenance/actors-import.json honest: every listed San Juan file exists and its recorded hash is current.
//   node tools/actors-provenance.mjs --check    fail when a listed file changed without its record
//   node tools/actors-provenance.mjs            record the current hashes (after editing a listed file)
// A new file taken from a donor needs a new entry: path, donor, sourcePath, sourceBytes, sourceSha256 (the donor
// file's bytes before adaptation) and a one-line `derived` note.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'provenance/actors-import.json');
const manifest = JSON.parse(readFileSync(file, 'utf8'));
const check = process.argv.includes('--check');
const stale = [];
for (const entry of manifest.files) {
  for (const key of ['path', 'donor', 'sourcePath', 'sourceBytes', 'sourceSha256', 'derived']) {
    if (entry[key] === undefined || entry[key] === '') throw new Error(`${entry.path ?? '?'}: missing ${key}`);
  }
  if (!manifest.donors[entry.donor]) throw new Error(`${entry.path}: unknown donor ${entry.donor}`);
  const hash = createHash('sha256').update(readFileSync(join(root, entry.path))).digest('hex');
  if (hash !== entry.editionSha256) { stale.push(entry.path); entry.editionSha256 = hash; }
}
if (check) {
  if (stale.length) { console.error('actors-import.json is stale for: ' + stale.join(', ')); process.exit(1); }
  console.log(`${manifest.files.length} actor imports checked`);
} else {
  writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`${manifest.files.length} actor imports recorded` + (stale.length ? ` (updated: ${stale.join(', ')})` : ''));
}
