// Self-test for rag/search.mjs CLI flags.
// Verifies --min-score actually drops weak results, --warn-below tags but keeps,
// --json shape includes weak flag, and unknown query → exit 2.
//
// We spawn the CLI as a child process so we exercise the real argv parsing.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');

function runSearch(args) {
  return new Promise((resolveStep) => {
    const child = spawn('node', ['rag/search.mjs', ...args], {
      cwd: ROOT,
      shell: process.platform === 'win32',
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr.on('data', (d) => (err += d.toString()));
    child.on('exit', (code) => resolveStep({ code, out, err }));
    child.on('error', () => resolveStep({ code: -1, out: '', err: 'spawn failed' }));
  });
}

export async function runSearchCases() {
  const results = [];

  // 1. unfiltered query returns at least one match for an indexed term
  {
    const r = await runSearch(['RLS', '--limit', '3', '--json']);
    if (r.code !== 0) {
      results.push({ ok: false, name: 'unfiltered query exits 0', message: `exit ${r.code}: ${r.err.slice(0, 200)}` });
    } else {
      try {
        const j = JSON.parse(r.out);
        results.push({ ok: Array.isArray(j) && j.length > 0, name: 'unfiltered query returns matches', message: `len=${j.length}` });
      } catch (e) {
        results.push({ ok: false, name: 'unfiltered query returns matches', message: `bad json: ${r.out.slice(0, 200)}` });
      }
    }
  }

  // 2. min-score above all matches → empty result, exit 0
  {
    const r = await runSearch(['RLS', '--min-score', '999', '--json']);
    if (r.code !== 0) {
      results.push({ ok: false, name: '--min-score above all → exits 0', message: `exit ${r.code}` });
    } else {
      try {
        const j = JSON.parse(r.out);
        results.push({ ok: Array.isArray(j) && j.length === 0, name: '--min-score above all → empty array', message: `len=${j.length}` });
      } catch (e) {
        results.push({ ok: false, name: '--min-score above all → empty array', message: `bad json: ${r.out.slice(0, 200)}` });
      }
    }
  }

  // 3. warn-below adds weak: true on low-score results in JSON output
  {
    const r = await runSearch(['RLS', '--limit', '3', '--warn-below', '999', '--json']);
    try {
      const j = JSON.parse(r.out);
      const allWeak = j.length > 0 && j.every((x) => x.weak === true);
      results.push({ ok: allWeak, name: '--warn-below tags weak in JSON', message: `j[0]=${JSON.stringify(j[0])?.slice(0, 200)}` });
    } catch (e) {
      results.push({ ok: false, name: '--warn-below tags weak in JSON', message: `bad json: ${r.out.slice(0, 200)}` });
    }
  }

  // 4. missing query → exit 2 with error message
  {
    const r = await runSearch([]);
    results.push({
      ok: r.code === 2 && /query is required/.test(r.err),
      name: 'missing query exits 2',
      message: `code=${r.code}, err=${r.err.slice(0, 100)}`,
    });
  }

  return results;
}
