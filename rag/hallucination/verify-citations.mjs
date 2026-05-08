#!/usr/bin/env node
// CLI entry — extract citations from text and verify each against the repo state.
// Exit 0 if all citations are real (or no citations found).
// Exit 1 if any citation is hallucinated.
// Exit 2 if the tool itself can't run (bad input, etc).
//
// Inputs (any one):
//   --text "<answer text>"     single text blob
//   --file path/to/draft.md    single file
//   --files <a> <b> ...        multiple files (space-separated, terminate with another flag or end)
//   --dir <directory>          all .md files under directory (recursive)
//   stdin (when isTTY=false)   pipe input
//
// Multiple --file/--files/--dir can be combined; results are merged.

import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { extractCitations } from './lib/extractors.mjs';
import { checkAll } from './lib/checkers.mjs';

// The set of files/dirs that the verify gate scans by default.
// Picked because they are the most citation-heavy and are written by agents,
// not by hand-edited docs/* (which would bloat the run without much benefit).
const REPO_DEFAULTS = {
  files: [
    'AGENTS.md',
    'CONTRACT.md',
    'docs/AGENT_BEHAVIOR.md',
    'harness/runbook.md',
    'rag/hallucination/incidents.md',
  ],
  dirs: ['docs/execute-plans', '.claude/agents'],
};

const args = process.argv.slice(2);
let inputText = null;
let asJson = false;
const inputFiles = [];
const inputDirs = [];

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--text') {
    inputText = args[++i];
  } else if (a === '--file') {
    inputFiles.push(args[++i]);
  } else if (a === '--files') {
    while (i + 1 < args.length && !args[i + 1].startsWith('--')) inputFiles.push(args[++i]);
  } else if (a === '--dir') {
    inputDirs.push(args[++i]);
  } else if (a === '--repo-defaults') {
    inputFiles.push(...REPO_DEFAULTS.files);
    inputDirs.push(...REPO_DEFAULTS.dirs);
  } else if (a === '--json') {
    asJson = true;
  } else if (a === '--help' || a === '-h') {
    console.log(`Usage:
  verify-citations.mjs --text "<answer text>"
  verify-citations.mjs --file path/to/draft.md
  verify-citations.mjs --files a.md b.md c.md
  verify-citations.mjs --dir docs/execute-plans
  verify-citations.mjs --repo-defaults     scan repo's citation-heavy files in one shot
  verify-citations.mjs --dir docs/execute-plans --file harness/runbook.md
  cat draft.md | verify-citations.mjs
  verify-citations.mjs --text "..." --json

Exit codes:
  0  all citations real (or no citations)
  1  one or more hallucinated citations
  2  tool itself failed (bad input)
`);
    process.exit(0);
  }
}

async function readStdin() {
  if (process.stdin.isTTY) return null;
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function walkMd(dir) {
  const out = [];
  async function walk(d) {
    let entries;
    try {
      entries = await readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = resolve(d, e.name);
      if (e.isDirectory()) {
        if (e.name.startsWith('.') || e.name === 'node_modules') continue;
        await walk(p);
      } else if (extname(e.name) === '.md') {
        out.push(p);
      }
    }
  }
  await walk(resolve(dir));
  return out;
}

// Build the list of (label, text) pairs to scan.
const sources = [];

for (const dir of inputDirs) {
  const files = await walkMd(dir);
  for (const f of files) {
    try {
      const text = await readFile(f, 'utf8');
      sources.push({ label: f, text });
    } catch (err) {
      console.error(`error: cannot read ${f}: ${err.message}`);
      process.exit(2);
    }
  }
}
for (const f of inputFiles) {
  try {
    const text = await readFile(f, 'utf8');
    sources.push({ label: f, text });
  } catch (err) {
    console.error(`error: cannot read ${f}: ${err.message}`);
    process.exit(2);
  }
}
if (inputText) sources.push({ label: '<--text>', text: inputText });
if (sources.length === 0) {
  const stdinText = await readStdin();
  if (stdinText) sources.push({ label: '<stdin>', text: stdinText });
}

if (sources.length === 0) {
  console.error('error: no input. Use --text, --file, --files, --dir, or pipe to stdin.');
  process.exit(2);
}

// Run extraction + verification per source, then aggregate.
const perSource = [];
let totalCount = 0;
let totalFailed = 0;
for (const s of sources) {
  const citations = await extractCitations(s.text);
  const results = await checkAll(citations);
  totalCount += results.length;
  totalFailed += results.filter((r) => !r.ok).length;
  perSource.push({ label: s.label, results });
}

if (asJson) {
  const failed = [];
  for (const ps of perSource) {
    for (const r of ps.results) {
      if (!r.ok) failed.push({ source: ps.label, kind: r.citation.kind, value: r.citation.value, reason: r.reason });
    }
  }
  console.log(
    JSON.stringify(
      {
        sources: sources.length,
        total: totalCount,
        ok: totalCount - totalFailed,
        failed,
      },
      null,
      2
    )
  );
  process.exit(totalFailed > 0 ? 1 : 0);
}

console.log(`\n=== Citation verification (${sources.length} source${sources.length === 1 ? '' : 's'}) ===`);
console.log(`Found ${totalCount} citation${totalCount === 1 ? '' : 's'} (${totalCount - totalFailed} ok, ${totalFailed} hallucinated)\n`);
for (const ps of perSource) {
  if (ps.results.length === 0) continue;
  if (sources.length > 1) console.log(`— ${ps.label}`);
  for (const r of ps.results) {
    const tag = r.ok ? '✓' : '✗';
    console.log(`  ${tag} [${r.citation.kind}] ${r.citation.value}${r.ok ? '' : ` — ${r.reason}`}`);
  }
}
if (totalFailed > 0) {
  console.log('\nHallucinated citations detected. Per AGENT_BEHAVIOR §1-A, do not send the answer until these are corrected or removed.');
  process.exit(1);
}
console.log('\nAll citations verified.');
process.exit(0);
