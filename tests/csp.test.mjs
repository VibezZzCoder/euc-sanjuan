/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// The page's Content-Security-Policy: same-origin only, in step with the inline scripts, and placed before them.
// Several cases are ported from the New York edition of EUC Thrills (MIT, VibezZzCoder).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildPolicy, inlineScripts, policiesIn } from '../tools/csp.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('index.html carries exactly one policy and it matches its inline scripts', () => {
  const found = policiesIn(html);
  assert.equal(found.length, 1);
  assert.equal(found[0], buildPolicy(html), 'run: node tools/csp.mjs');
  const scripts = inlineScripts(html);
  assert.deepEqual(scripts.map((s) => s.type), ['importmap', 'module'], 'the import map and the module script that imports js/main.js');
  assert.match(scripts[1].text, /import\('\.\/js\/main\.js'\)/);
});

test('the policy names no other host and allows no unhashed inline or evaluated script', () => {
  const [policy] = policiesIn(html);
  assert.doesNotMatch(policy, /https?:|\*|unsafe-inline|unsafe-eval|unsafe-hashes|wasm-unsafe-eval|blob:|data:/);
  const directives = Object.fromEntries(policy.split('; ').map((d) => [d.split(' ')[0], d.split(' ').slice(1)]));
  assert.deepEqual(directives['default-src'], ["'none'"]);
  assert.equal(directives['script-src'][0], "'self'");
  assert.ok(directives['script-src'].slice(1).every((s) => /^'sha256-[A-Za-z0-9+/]{43}='$/.test(s)));
  for (const name of ['worker-src', 'style-src', 'img-src', 'font-src', 'connect-src', 'media-src', 'manifest-src']) {
    assert.deepEqual(directives[name], ["'self'"], name);
  }

});

test('the policy comes before every script, right after the charset declaration', () => {
  const policyAt = html.indexOf('http-equiv="Content-Security-Policy"');
  assert.ok(policyAt > 0 && policyAt < html.indexOf('<script'));
  const charsetAt = html.indexOf('<meta charset="utf-8">');
  assert.ok(charsetAt > 0 && charsetAt < policyAt && charsetAt < 1024);
});

test('the page has nothing the policy would block: no inline handlers, style attributes or other-host loads', () => {
  const tags = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '<script></script>').match(/<[a-zA-Z][^>]*>/g);
  for (const tag of tags) {
    assert.doesNotMatch(tag, /\son[a-z]+\s*=/, tag);
    assert.doesNotMatch(tag, /\sstyle\s*=/, tag);
    if (/^<(script|link|img|iframe|source|audio|video|object|embed)\b/.test(tag)) {
      assert.doesNotMatch(tag, /(?:src|href)\s*=\s*"(?:[a-z][a-z0-9+.-]*:)?\/\//i, tag);
    }
  }
  assert.doesNotMatch(html, /<style\b|<base\b|integrity=/);
});

test('the game code creates nothing the policy would block', () => {
  // element.style and classes are fine; style attributes, style elements, evaluated strings and blob/data loads are not.
  // innerHTML and friends are banned outright: a style= or on*= inside inserted markup is refused silently.
  const blocked = /setAttribute\(\s*['"`]style|createElement\(\s*['"`](?:style|script|iframe)['"`]|\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|document\.write|\beval\(|new Function\(|createObjectURL|['"`](?:blob|data):(?:image|text|application|audio|font)/;
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(new URL(e.name + '/', dir)) : e.name.endsWith('.js') ? [new URL(e.name, dir)] : []);
  const hits = [];
  let scanned = 0;
  for (const file of walk(new URL('../js/', import.meta.url))) {
    scanned++;
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (blocked.test(line)) hits.push(`${file.pathname.split('/js/')[1]}:${i + 1}`);
    });
  }
  assert.ok(scanned > 100, `scanned ${scanned} modules`);
  assert.deepEqual(hits, []);
  // Every authored stylesheet (fonts.css is the pinned vendored file): same-origin URLs only, and each one exists.
  const sheets = fs.readdirSync(new URL('../css/', import.meta.url)).filter((n) => n.endsWith('.css') && n !== 'fonts.css');
  assert.ok(sheets.includes('game.css'));
  for (const name of sheets) {
    const css = fs.readFileSync(new URL('../css/' + name, import.meta.url), 'utf8');
    assert.doesNotMatch(css, /@import|url\(\s*['"]?(?:data:|blob:|[a-z][a-z0-9+.-]*:)?\/\//i, `css/${name} loads nothing from another host`);
    assert.doesNotMatch(css, /url\(\s*['"]?data:/i, `css/${name} has no data: URL (img-src is self only)`);
    for (const [, ref] of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
      assert.ok(fs.existsSync(new URL('../css/' + ref, import.meta.url)), `css/${name}: ${ref} exists`);
    }
  }
});

test('credits.html allows only same-origin styles, fonts and images, and no script', () => {
  const credits = fs.readFileSync(new URL('../credits.html', import.meta.url), 'utf8');
  const found = [...credits.matchAll(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/g)].map((m) => m[1]);
  assert.equal(found.length, 1);
  assert.equal(found[0], "default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'");
  assert.doesNotMatch(credits, /<script\b|<style\b|\sstyle\s*=|\son[a-z]+\s*=/);
});
