#!/usr/bin/env node
/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// tools/csp.mjs — keep index.html's Content-Security-Policy in step with its inline scripts.
// Ported from the same tool in the New York edition of EUC Thrills (MIT, VibezZzCoder).
//
// usage: node tools/csp.mjs            rewrite the policy in index.html
//        node tools/csp.mjs --check    offline: the policy in index.html is exactly the one built here
//
// The game loads everything from its own host (three.js is vendored). The policy makes the browser enforce that:
// scripts, workers, styles, fonts, images, sounds and data may only come from this origin, so a script tag or import
// pointing at another host does not run. The two inline scripts (the import map and the module script that imports
// js/main.js and reports a failed start) are allowed by their SHA-256 hashes, which is why this tool must be re-run
// whenever either one changes, down to a single space; tests/csp.test.mjs and tools/smoke.py fail if it was not. A stale
// hash blocks the import map and the game does not boot.
//
// The policy is a <meta> tag, like NYC's and SF's (static hosting cannot send response headers). It must come before
// the first script. A <meta> policy cannot carry frame-ancestors, report-uri or sandbox. Nothing here needs data:
// images, so img-src is 'self' only.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = path.join(ROOT, 'index.html');
const META = /<meta http-equiv="Content-Security-Policy" content="([^"]*)" \/>/g;
// Script types the browser executes or applies; anything else (text/plain, application/json) is a data block.
const ACTIVE_TYPES = new Set(['', 'module', 'importmap', 'text/javascript', 'application/javascript']);

// Inline scripts of an HTML document, in order: { type, text }
export function inlineScripts(html) {
  const out = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc\s*=/.test(m[1])) continue;
    const type = (m[1].match(/\btype\s*=\s*"([^"]*)"/) || [, ''])[1].trim().toLowerCase();
    if (ACTIVE_TYPES.has(type)) out.push({ type, text: m[2] });
  }
  return out;
}

export const scriptHash = (text) => `'sha256-${crypto.createHash('sha256').update(text, 'utf8').digest('base64')}'`;

export function buildPolicy(html) {
  const hashes = inlineScripts(html).map((s) => scriptHash(s.text));
  return [
    "default-src 'none'",
    `script-src 'self' ${hashes.join(' ')}`.trim(),
    "worker-src 'self'",
    "style-src 'self'",
    "img-src 'self'",
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'self'",
    "manifest-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
}

// The policies written in the document (there must be exactly one)
export const policiesIn = (html) => [...html.matchAll(META)].map((m) => m[1]);

function main() {
  const check = process.argv.includes('--check');
  const html = fs.readFileSync(INDEX, 'utf8');
  const found = policiesIn(html);
  const want = buildPolicy(html);
  if (found.length !== 1) {
    console.error(`csp: index.html must contain exactly one Content-Security-Policy meta tag (found ${found.length})`);
    process.exit(1);
  }
  if (found[0] === want) {
    console.log(`csp: OK (${inlineScripts(html).length} inline scripts hashed)`);
    return;
  }
  if (check) {
    console.error('csp: the policy in index.html is out of date; run: node tools/csp.mjs');
    console.error(`  have: ${found[0]}\n  want: ${want}`);
    process.exit(1);
  }
  fs.writeFileSync(INDEX, html.replace(META, () => `<meta http-equiv="Content-Security-Policy" content="${want}" />`));
  console.log('csp: index.html updated');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
