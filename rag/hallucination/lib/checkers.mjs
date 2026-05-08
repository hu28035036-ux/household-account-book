// Citation checking — auto-discovers kind modules from ./kinds/*.mjs.
// Each kind module exposes: { kind, check(citation, opts) → { ok, reason? } }.
// Single source of truth (design-log 06-coupling C-04).

import { readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KINDS_DIR = resolve(__dirname, 'kinds');
const ROOT = resolve(__dirname, '../../..');

let _checkersCache = null;
async function loadCheckers() {
  if (_checkersCache) return _checkersCache;
  const entries = await readdir(KINDS_DIR);
  const map = new Map();
  for (const name of entries) {
    if (!name.endsWith('.mjs')) continue;
    const mod = await import(pathToFileURL(resolve(KINDS_DIR, name)).href);
    if (typeof mod.check === 'function' && typeof mod.kind === 'string') {
      map.set(mod.kind, mod.check);
    }
  }
  _checkersCache = map;
  return map;
}

export async function checkAll(citations, opts = {}) {
  const checkers = await loadCheckers();
  const fullOpts = { root: ROOT, ...opts };
  const results = [];
  for (const c of citations) {
    const fn = checkers.get(c.kind);
    if (!fn) {
      results.push({ ok: false, citation: c, reason: `unknown citation kind: ${c.kind}` });
      continue;
    }
    const r = await fn(c, fullOpts);
    results.push({ ...r, citation: c });
  }
  return results;
}
