#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { tokenize } from './lib/tokenize.mjs';
import { score } from './lib/score.mjs';

const args = process.argv.slice(2);
let limit = 5;
let asJson = false;
let minScore = 0;     // off by default. Set to e.g. 1.0 to drop weak matches.
let warnBelow = null; // optional soft threshold — print a [WARN] tag, do not drop.
const queryParts = [];

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--limit') limit = Number(args[++i]) || 5;
  else if (a === '--json') asJson = true;
  else if (a === '--min-score') minScore = Number(args[++i]) || 0;
  else if (a === '--warn-below') warnBelow = Number(args[++i]);
  else if (a === '--help' || a === '-h') {
    console.log(`Usage: node rag/search.mjs <query> [--limit N] [--json] [--min-score X] [--warn-below X]

  --min-score X   drop results with score < X (default 0 = off). Helps prevent
                  hallucinated citations of weakly-related docs.
  --warn-below X  keep result but tag it [WARN] when score < X. Useful to surface
                  borderline matches without dropping them.

  Build the index first: node rag/build.mjs
`);
    process.exit(0);
  } else queryParts.push(a);
}

if (queryParts.length === 0) {
  console.error('error: query is required. Try: node rag/search.mjs "RLS household"');
  process.exit(2);
}

const indexUrl = new URL('./index.json', import.meta.url);
let index;
try {
  index = JSON.parse(await readFile(indexUrl, 'utf8'));
} catch {
  console.error('error: rag/index.json missing. Run: node rag/build.mjs');
  process.exit(2);
}

const q = queryParts.join(' ');
const qTokens = tokenize(q);
if (qTokens.length === 0) {
  console.error('error: query produced no usable tokens.');
  process.exit(2);
}

const ranked = index.docs
  .map((d) => ({ doc: d, s: score(qTokens, d, index) }))
  .filter((r) => r.s > 0 && r.s >= minScore)
  .sort((a, b) => b.s - a.s)
  .slice(0, limit);

if (asJson) {
  console.log(
    JSON.stringify(
      ranked.map((r) => ({
        path: r.doc.path,
        title: r.doc.title,
        score: r.s,
        weak: warnBelow !== null && r.s < warnBelow,
        summary: r.doc.summary,
      })),
      null,
      2
    )
  );
  process.exit(0);
}

if (ranked.length === 0) {
  console.log(minScore > 0
    ? `(no matches at score >= ${minScore})`
    : '(no matches)');
  process.exit(0);
}

console.log(`\n=== RAG search: "${q}" ===`);
for (const r of ranked) {
  const weak = warnBelow !== null && r.s < warnBelow ? ' [WARN: low score]' : '';
  console.log(`\n[${r.s.toFixed(2)}]${weak} ${r.doc.path}`);
  console.log(`  ${r.doc.title}`);
  if (r.doc.summary) console.log(`  ${r.doc.summary}`);
}
console.log('');
