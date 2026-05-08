// 'file' citation kind. Two extractors: rooted paths (src/...) and well-known
// root .md files (AGENTS.md / CONTRACT.md / README.md / MEMORY.md).

import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

const FILE_EXT = '(?:tsx|ts|mts|mjs|json|cjs|js|md|sql|css|sh)';
const FILE_PATH_RE = new RegExp(
  `(?<![\\w\\-/])` +
    `((?:src|harness|rag|docs|scripts|supabase|public|e2e|samples)(?:/[a-zA-Z0-9_\\-\\.]+)+\\.${FILE_EXT})\\b`,
  'g'
);
const ROOT_FILE_RE = /\b(AGENTS|CONTRACT|README|MEMORY)\.md\b/g;

export const kind = 'file';

export function extract(text) {
  const out = [];
  let m;
  while ((m = FILE_PATH_RE.exec(text)) !== null) {
    out.push({ kind, value: m[1], raw: m[0] });
  }
  while ((m = ROOT_FILE_RE.exec(text)) !== null) {
    out.push({ kind, value: `${m[1]}.md`, raw: m[0] });
  }
  return out;
}

export async function check(citation, opts) {
  const root = opts?.root;
  if (!root) return { ok: false, reason: 'no root configured' };
  const target = resolve(root, citation.value);
  try {
    await access(target);
    return { ok: true };
  } catch {
    return { ok: false, reason: `file not found: ${citation.value}` };
  }
}
