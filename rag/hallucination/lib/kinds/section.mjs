// 'section' citation kind — §N(-X)* refs to CONTRACT/AGENTS/AGENT_BEHAVIOR sections.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const SECTION_RE = /§(\d+(?:-[A-Z0-9]+)*)/g;
// design-log files are scanned because runbook entries cite their §1-6 / §3-N
// directly. New design-log/*.md files are picked up automatically by checker
// when DEFAULT_DOCS is regenerated — but for now we list explicitly to avoid
// scanning hundreds of unrelated docs/.
const DEFAULT_DOCS = [
  'CONTRACT.md',
  'AGENTS.md',
  'docs/AGENT_BEHAVIOR.md',
  'docs/design-log/00-overview.md',
  'docs/design-log/01-meta-agents.md',
  'docs/design-log/02-area-agents.md',
  'docs/design-log/03-harness.md',
  'docs/design-log/04-rag.md',
  'docs/design-log/05-flow.md',
  'docs/design-log/06-coupling.md',
];

export const kind = 'section';

export function extract(text) {
  const out = [];
  let m;
  while ((m = SECTION_RE.exec(text)) !== null) {
    out.push({ kind, value: m[1], raw: m[0] });
  }
  return out;
}

export async function check(citation, opts) {
  const root = opts?.root;
  if (!root) return { ok: false, reason: 'no root configured' };
  const docs = opts?.sectionDocs ?? DEFAULT_DOCS;
  for (const rel of docs) {
    let text;
    try {
      text = await readFile(resolve(root, rel), 'utf8');
    } catch {
      continue;
    }
    const reHeading = new RegExp(`^#{1,6}\\s+${citation.value}[\\s.]`, 'm');
    const reInline = new RegExp(`§${citation.value}\\b`);
    if (reHeading.test(text) || reInline.test(text)) return { ok: true };
  }
  return { ok: false, reason: `§${citation.value} not found in ${docs.join(' or ')}` };
}
