// 'incident' citation kind — incident-NNNN refs to runbook entries.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const INCIDENT_RE = /\bincident-(\d{4})(-[a-zA-Z]+)?\b/g;

export const kind = 'incident';

export function extract(text) {
  const out = [];
  let m;
  while ((m = INCIDENT_RE.exec(text)) !== null) {
    out.push({ kind, value: `incident-${m[1]}${m[2] ?? ''}`, raw: m[0] });
  }
  return out;
}

export async function check(citation, opts) {
  const root = opts?.root;
  if (!root) return { ok: false, reason: 'no root configured' };
  const runbook = opts?.runbook ?? 'harness/runbook.md';
  let text;
  try {
    text = await readFile(resolve(root, runbook), 'utf8');
  } catch {
    return { ok: false, reason: `cannot read ${runbook}` };
  }
  const re = new RegExp(`^#{1,6}\\s+${citation.value}\\b`, 'm');
  if (re.test(text)) return { ok: true };
  return { ok: false, reason: `${citation.value} not found in ${runbook}` };
}
