// Citation extraction — auto-discovers kind modules from ./kinds/*.mjs.
// Each kind module exposes: { kind, extract(text) → citations[] }.
// Single source of truth for each kind (design-log 06-coupling C-04).

import { readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KINDS_DIR = resolve(__dirname, 'kinds');

let _kindsCache = null;
async function loadKinds() {
  if (_kindsCache) return _kindsCache;
  const entries = await readdir(KINDS_DIR);
  const kinds = [];
  for (const name of entries) {
    if (!name.endsWith('.mjs')) continue;
    const mod = await import(pathToFileURL(resolve(KINDS_DIR, name)).href);
    if (typeof mod.extract === 'function' && typeof mod.kind === 'string') {
      kinds.push(mod);
    }
  }
  _kindsCache = kinds;
  return kinds;
}

// Markdown-aware: strip out fenced code blocks and inline backticks before scanning.
// Citations inside ``` ... ``` or `...` are treated as literal examples.
function stripMarkdownExamples(text) {
  let out = text.replace(/```[\s\S]*?```/g, ' ');
  out = out.replace(/~~~[\s\S]*?~~~/g, ' ');
  out = out.replace(/`[^`\n]*`/g, ' ');
  return out;
}

function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const key = `${it.kind}:${it.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

export async function extractCitations(text) {
  if (!text || typeof text !== 'string') return [];
  const scanText = stripMarkdownExamples(text);
  const kinds = await loadKinds();
  const out = [];
  for (const k of kinds) {
    out.push(...k.extract(scanText));
  }
  return dedupe(out);
}
