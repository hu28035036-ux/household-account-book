// Self-test for rag/hallucination/ — extractors + checkers + cases.
// Reads cases from rag/hallucination/cases/*.json and asserts the verify-citations
// pipeline produces the expected total/ok counts.
//
// Catches: extractor regex regressions, checker false negatives/positives,
// cases drift from real repo state.

import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { extractCitations } from '../../../rag/hallucination/lib/extractors.mjs';
import { checkAll } from '../../../rag/hallucination/lib/checkers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CASES_DIR = resolve(__dirname, '../../../rag/hallucination/cases');

async function loadCases() {
  let entries;
  try {
    entries = await readdir(CASES_DIR);
  } catch {
    return [];
  }
  const cases = [];
  for (const name of entries) {
    if (!name.endsWith('.json')) continue;
    const text = await readFile(resolve(CASES_DIR, name), 'utf8');
    cases.push({ file: name, ...JSON.parse(text) });
  }
  return cases;
}

function failedKinds(results) {
  return results.filter((r) => !r.ok).map((r) => r.citation.kind);
}

function setEqual(a, b) {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

// Smoke check that markdown-aware extractor strips backtick-wrapped examples.
// Without it, incidents.md (which quotes fake citations as examples) would always fail.
async function backtickSmokeCase() {
  const exampleText =
    'real: AGENTS.md §9-A-2. example: `incident-9999` `src/lib/imaginary.ts` `§9-A-77`.';
  const citations = await extractCitations(exampleText);
  // We expect only the real ones outside backticks: AGENTS.md (file) + 9-A-2 (section).
  const kinds = citations.map((c) => `${c.kind}:${c.value}`).sort();
  const want = ['file:AGENTS.md', 'section:9-A-2'];
  if (kinds.length === want.length && want.every((w, i) => w === kinds[i])) {
    return { ok: true, name: 'backtick examples are ignored' };
  }
  return {
    ok: false,
    name: 'backtick examples are ignored',
    message: `expected [${want.join(', ')}], got [${kinds.join(', ')}]`,
  };
}

// Smoke check that the .json/.js alternation order in FILE_PATH_RE works.
// Without ordering longest-first, "agent-fake-citations-001.json" would be
// extracted as ".js" and fail. (incident-0008 regression.)
async function jsonExtensionCase() {
  const text = 'see rag/hallucination/cases/agent-fake-citations-001.json for fixture';
  const citations = await extractCitations(text);
  const file = citations.find((c) => c.kind === 'file');
  if (file && file.value.endsWith('.json')) return { ok: true, name: 'json extension not truncated to js' };
  return {
    ok: false,
    name: 'json extension not truncated to js',
    message: `got ${file ? file.value : '(no file)'}`,
  };
}

export async function runHallucinationCases() {
  const cases = await loadCases();
  if (cases.length === 0) {
    return [{ ok: false, name: 'cases dir non-empty', message: `no cases under ${CASES_DIR}` }];
  }
  const results = [
    await backtickSmokeCase(),
    await jsonExtensionCase(),
  ];
  for (const c of cases) {
    const text = c.input?.text ?? '';
    const citations = await extractCitations(text);
    const checks = await checkAll(citations);
    const total = checks.length;
    const ok = checks.filter((r) => r.ok).length;
    const got = failedKinds(checks).sort();
    const want = [...(c.expected?.failed_kinds ?? [])].sort();

    if (total !== c.expected.total) {
      results.push({
        ok: false,
        name: `${c.id}: total citations`,
        message: `expected total=${c.expected.total}, got ${total} (citations: ${citations.map((x) => `${x.kind}:${x.value}`).join(', ')})`,
      });
      continue;
    }
    if (ok !== c.expected.ok) {
      results.push({
        ok: false,
        name: `${c.id}: ok count`,
        message: `expected ok=${c.expected.ok}, got ${ok}`,
      });
      continue;
    }
    if (!setEqual(got, want)) {
      results.push({
        ok: false,
        name: `${c.id}: failed kinds`,
        message: `expected [${want.join(', ')}], got [${got.join(', ')}]`,
      });
      continue;
    }
    results.push({ ok: true, name: c.id });
  }
  return results;
}
