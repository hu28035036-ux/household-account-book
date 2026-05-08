// Group discovery for self-test — convention-based (design-log 06-coupling C-13).
//
// CONVENTION (single source of truth: this regex):
//   - Case file lives at  harness/test/cases/<name>.mjs
//   - File exports a function whose name matches  /^run[A-Z].*Cases$/
//     Examples: runCompareCases, runMaskingMirrorCases, runExtractionHallucinationCases
//   - The group label shown in self-test output = the file name (sans .mjs),
//     NOT the export name. The function can be renamed without breaking discovery.
//
// To add a new group: drop a new file matching the convention. self-test picks it up.
// To rename a group: rename the file (function rename alone won't change the label).
//
// Pulled out of self-test.mjs so it can itself be regression-tested without
// re-running the harness.

import { readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CASES_DIR = resolve(__dirname, '../cases');

// Public so tests / docs can pull the canonical convention.
export const CASE_EXPORT_PATTERN = /^run[A-Z].*Cases$/;

export async function discoverGroups(opts = {}) {
  const dir = opts.casesDir ?? DEFAULT_CASES_DIR;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    return { groups: [], error: `cannot read cases dir: ${err.message}` };
  }
  const groups = [];
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith('.mjs')) continue;
    const url = pathToFileURL(resolve(dir, e.name)).href;
    let mod;
    try {
      mod = await import(url);
    } catch (err) {
      groups.push({
        name: e.name.replace(/\.mjs$/, ''),
        source: e.name,
        run: () => Promise.resolve([{ ok: false, name: '(import failed)', message: err.message }]),
      });
      continue;
    }
    for (const [exportName, fn] of Object.entries(mod)) {
      if (typeof fn === 'function' && CASE_EXPORT_PATTERN.test(exportName)) {
        groups.push({
          name: e.name.replace(/\.mjs$/, ''),
          source: e.name,
          exportName,
          run: fn,
        });
      }
    }
  }
  groups.sort((a, b) => a.name.localeCompare(b.name));
  return { groups };
}
