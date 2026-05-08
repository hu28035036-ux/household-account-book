import { readFile, readdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { compareCase } from './compare.mjs';
import { validate } from './schema.mjs';

const CASES_DIR = new URL('../cases/', import.meta.url);

async function listCaseFiles(domain) {
  const root = new URL(domain ? `../cases/${domain}/` : '../cases/', import.meta.url);
  const out = [];
  // Track each case's containing domain folder so adapters can be folder-keyed,
  // not just id-prefix-keyed (id "extraction-hallucination-001" must NOT dispatch
  // to the "extraction" adapter).
  async function walk(dir, currentDomain) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const url = new URL(`${e.name}${e.isDirectory() ? '/' : ''}`, dir);
      if (e.isDirectory()) await walk(url, e.name);
      else if (e.name.endsWith('.json') && !e.name.includes('.skip.')) {
        out.push({ url, domain: currentDomain });
      }
    }
  }
  await walk(root, domain ?? null);
  return out;
}

async function loadCase(entry) {
  const raw = await readFile(entry.url, 'utf8');
  const data = JSON.parse(raw);
  data._file = basename(entry.url.pathname);
  data._domain = entry.domain; // folder-derived; fallback to id prefix in runCase
  return data;
}

function selectByTag(cases, tag) {
  return cases.filter((c) => Array.isArray(c.tags) && c.tags.includes(tag));
}

function selectById(cases, id) {
  return cases.filter((c) => c.id === id);
}

// Dispatch policy (design-log 06-coupling C-12):
//
//   1. PRIMARY  — case folder name. cases/<domain>/<id>.json → adapter `<domain>`.
//                 This is the source of truth.
//   2. FALLBACK — case id prefix (split on '-', take [0]). Used only when the
//                 case is loaded outside the cases/<domain>/ tree (rare: tag-only
//                 selection or external loaders).
//
// Why folder beats id-prefix: compound domains (e.g. "extraction-hallucination")
// would be wrongly truncated by id-prefix to "extraction". Folder is unambiguous.
// New compound domain = new folder. No id naming gymnastics required.
async function runCase(c, opts) {
  const domain = c._domain || (c.id || '').split('-')[0];
  let adapter;
  try {
    adapter = await import(`./adapters/${domain}.mjs`);
  } catch {
    return {
      id: c.id,
      file: c._file,
      status: 'error',
      message: `no adapter for domain "${domain}" (expected harness/lib/adapters/${domain}.mjs)`,
    };
  }
  // Validate case shape against the adapter's declared schemas (design-log C-06/C-07).
  // A schema mismatch is a case-authoring error — surface it as 'error', not 'fail'.
  if (adapter.inputSchema) {
    const v = validate(c, adapter.inputSchema);
    if (!v.ok) {
      return {
        id: c.id,
        file: c._file,
        status: 'error',
        message: `case input shape mismatch: ${v.errors.join('; ')}`,
      };
    }
  }
  try {
    const actual = await adapter.run(c, opts);
    if (adapter.expectedSchema) {
      const v = validate(actual, adapter.expectedSchema);
      if (!v.ok) {
        return {
          id: c.id,
          file: c._file,
          status: 'error',
          message: `adapter output shape mismatch: ${v.errors.join('; ')}`,
        };
      }
    }
    const cmp = compareCase(c.expected, actual, c.tolerances || {});
    return {
      id: c.id,
      file: c._file,
      status: cmp.ok ? 'pass' : 'fail',
      diffs: cmp.diffs,
      actual,
    };
  } catch (err) {
    return { id: c.id, file: c._file, status: 'error', message: err.message };
  }
}

export async function runAll(opts) {
  const files = await listCaseFiles(opts.domain);
  let cases = await Promise.all(files.map(loadCase));
  if (opts.tag) cases = selectByTag(cases, opts.tag);
  if (opts.case) cases = selectById(cases, opts.case);
  if (cases.length === 0) {
    console.warn('[harness] no cases matched.');
    return [];
  }
  const results = [];
  for (const c of cases) {
    results.push(await runCase(c, opts));
  }
  return results;
}
