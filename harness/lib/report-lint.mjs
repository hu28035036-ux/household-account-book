#!/usr/bin/env node
// Report format linter — enforces AGENT_BEHAVIOR §4-A 5-section structure.
// User mandate (2026-05-08): "앞으로 이렇게 보고해".
//
// Sections must appear in order:
//   1. 목적
//   2. 어떤 에이전트 사용했는지
//   3. 코드작성 단위화로 잘 진행됐는지
//   4. 검증 / 테스트 제대로 진행했는지
//   5. 하네스로 막힌 할루시네이션 제대로 막혔는지
//
// Recognition: each section is a header line (#, ##, ### …) whose text contains the
// section's distinguishing keyword. We don't enforce a specific heading depth so the
// report can fit nested structures. We DO enforce order and presence.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Each section: { id, label, mustContain }. mustContain is a RegExp the heading must match.
export const SECTIONS = [
  { id: 1, label: '목적', mustContain: /목적/ },
  { id: 2, label: '어떤 에이전트 사용했는지', mustContain: /(에이전트|agent)/i },
  { id: 3, label: '코드작성 단위화로 잘 진행됐는지', mustContain: /(단위화|모듈화)/ },
  { id: 4, label: '검증 / 테스트 제대로 진행했는지', mustContain: /(검증|테스트|verify|test)/i },
  { id: 5, label: '하네스로 막힌 할루시네이션 제대로 막혔는지', mustContain: /(할루시네이션|hallucination)/i },
];

export function lintReport(text) {
  if (!text || typeof text !== 'string') {
    return { ok: false, errors: ['empty input'], hits: [] };
  }
  const lines = text.split(/\r?\n/);
  const headers = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+(.+?)\s*$/);
    if (m) headers.push({ lineNo: i + 1, depth: m[1].length, text: m[2] });
  }

  const hits = [];
  let cursor = 0; // pointer into headers — sections must come in order
  const errors = [];

  for (const sec of SECTIONS) {
    let found = -1;
    for (let i = cursor; i < headers.length; i++) {
      if (sec.mustContain.test(headers[i].text)) {
        found = i;
        break;
      }
    }
    if (found === -1) {
      errors.push(`§${sec.id} (${sec.label}): not found in any heading after cursor ${cursor}`);
      hits.push({ id: sec.id, found: false });
    } else {
      hits.push({ id: sec.id, found: true, lineNo: headers[found].lineNo, text: headers[found].text });
      cursor = found + 1;
    }
  }

  return { ok: errors.length === 0, errors, hits };
}

// CLI entry — runs when this file is executed directly.
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  let inputFile = null;
  let inputText = null;
  let asJson = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--file') inputFile = args[++i];
    else if (a === '--text') inputText = args[++i];
    else if (a === '--json') asJson = true;
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: report-lint.mjs [--file path | --text "..." | <stdin>] [--json]

Enforces AGENT_BEHAVIOR §4-A 5-section structure on a report draft.

Exit codes:
  0  all 5 sections present and in order
  1  missing or out-of-order section(s)
  2  bad input
`);
      process.exit(0);
    }
  }
  let text = inputText;
  if (!text && inputFile) {
    try {
      text = await readFile(inputFile, 'utf8');
    } catch (err) {
      console.error(`error: cannot read ${inputFile}: ${err.message}`);
      process.exit(2);
    }
  }
  if (!text && !process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    text = Buffer.concat(chunks).toString('utf8');
  }
  if (!text) {
    console.error('error: no input.');
    process.exit(2);
  }

  const { ok, errors, hits } = lintReport(text);

  if (asJson) {
    console.log(JSON.stringify({ ok, errors, hits }, null, 2));
    process.exit(ok ? 0 : 1);
  }
  console.log('=== report-lint ===');
  for (const h of hits) {
    const tag = h.found ? '✓' : '✗';
    const detail = h.found ? `line ${h.lineNo}: ${h.text}` : 'NOT FOUND';
    console.log(`  ${tag} §${h.id}  ${detail}`);
  }
  if (!ok) {
    console.log('\n' + errors.map((e) => `  - ${e}`).join('\n'));
    console.log('\nReport violates AGENT_BEHAVIOR §4-A. Add the missing sections in order before sending.');
    process.exit(1);
  }
  console.log('\nReport passes AGENT_BEHAVIOR §4-A 5-section check.');
  process.exit(0);
}
