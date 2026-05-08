#!/usr/bin/env node
// Static checks for CONTRACT §9-A patterns the loop-validator wants caught at round 3.
// Read-only — never modifies code. Exits non-zero when any flagged pattern is hit so the
// loop-validator can reset the counter.
//
// Module API (for harness/test/self-test):
//   RULES                — default rule set (CONTRACT §9-A)
//   normalizeSlashes(s)
//   isExcluded(line, rule)
//   rg(rule, opts)       — ripgrep wrapper, exit code -1 if rg unavailable
//   jsScan(rule, opts)   — Node fallback walk
//   runScan(opts)        — full pipeline; returns { findings }
// CLI: runs runScan with defaults, exits 0 on clean, 1 on findings.

import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(__dirname, '../..');

// excludePaths is matched after normalizing slashes (Windows ripgrep-less fallback prints "\").
// allowList is used for justified usages — e.g. theme init script using dangerouslySetInnerHTML
// where the content is fully controlled and the React safe path doesn't apply.
//
// Each rule: a label, a ripgrep-friendly regex, optional path filter, and a CONTRACT pointer.
// Patterns are intentionally narrow — they should flag the obvious offender, not every catch block.
export const RULES = [
  {
    label: 'silent fallback (catch → return [])',
    pattern: String.raw`catch\s*\([^)]*\)\s*\{\s*return\s*\[\s*\]`,
    path: 'src',
    contract: '§9-A-2',
  },
  {
    label: 'silent fallback (catch → return null)',
    pattern: String.raw`catch\s*\([^)]*\)\s*\{\s*return\s*null\s*[;}]`,
    path: 'src',
    contract: '§9-A-2',
  },
  {
    label: 'service_role key referenced outside lib/supabase/admin.ts',
    pattern: 'SUPABASE_SERVICE_ROLE_KEY',
    path: 'src',
    contract: '§3-3',
    excludePaths: ['src/lib/supabase/admin'],
  },
  {
    label: 'dangerouslySetInnerHTML',
    pattern: 'dangerouslySetInnerHTML',
    path: 'src',
    contract: '§4-2',
    // Justified usages (controlled inline scripts only). Add new entries here when reviewed.
    allowList: [
      // theme init script — content fully controlled, no user input
      'src/app/layout.tsx',
    ],
  },
  {
    // The real threat is: AI extraction code path inserting into transactions without
    // going through candidate approval. Direct user input / recurring rules / candidate
    // approve flow legitimately insert. We narrow the rule by excluding the legitimate
    // services and api routes; if a new ai-extraction file ever inserts directly,
    // it lands outside these exclusions and gets flagged.
    label: 'direct transactions insert outside candidates approve flow',
    pattern: String.raw`from\(['"]transactions['"]\)\s*\.insert`,
    path: 'src',
    contract: '§1 (AI 후보 단방향)',
    excludePaths: [
      'src/app/api/candidates',
      'src/services/candidateService',     // candidate approve actually performs the insert
      'src/services/recurringService',     // user-defined recurring rules
      'src/services/transactionService',   // direct user input CRUD
      'src/services/importService',        // CSV/XLSX commit (user explicit)
    ],
  },
];

export function normalizeSlashes(s) {
  return s.replace(/\\/g, '/');
}

export function isExcluded(line, rule) {
  const norm = normalizeSlashes(line);
  if (rule.excludePaths && rule.excludePaths.some((p) => norm.includes(p))) return true;
  if (rule.allowList && rule.allowList.some((p) => norm.includes(p))) return true;
  return false;
}

export function rg(rule, opts = {}) {
  const cwd = opts.root ?? DEFAULT_ROOT;
  return new Promise((resolveStep) => {
    const args = ['--no-heading', '--line-number', '--color=never', '-e', rule.pattern, rule.path];
    const child = spawn('rg', args, { cwd });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr.on('data', (d) => (err += d.toString()));
    child.on('exit', (code) => resolveStep({ code, out, err }));
    child.on('error', () => resolveStep({ code: -1, out: '', err: 'rg unavailable' }));
  });
}

// Fallback JS-side scan when ripgrep isn't on PATH (Windows often won't have it).
// Multiline regex search across the whole file — line-by-line missed `catch (e) {\n  return []\n}`
// patterns where the offender spans lines. (Caught by harness self-test, runbook incident-0006.)
export async function jsScan(rule, opts = {}) {
  const { readdir } = await import('node:fs/promises');
  const root = resolve(opts.root ?? DEFAULT_ROOT, rule.path);
  const hits = [];
  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
        await walk(p);
      } else if (/\.(ts|tsx|js|mjs|fixture)$/.test(e.name)) {
        try {
          const text = await readFile(p, 'utf8');
          const re = new RegExp(rule.pattern, 'gm');
          let m;
          while ((m = re.exec(text)) !== null) {
            const lineNo = text.slice(0, m.index).split(/\r?\n/).length;
            const firstLine = (text.slice(m.index).split(/\r?\n/)[0] || '').trim();
            hits.push(`${p}:${lineNo}:${firstLine}`);
            if (m.index === re.lastIndex) re.lastIndex += 1; // guard zero-width
          }
        } catch {
          // unreadable file — skip
        }
      }
    }
  }
  await walk(root);
  return hits;
}

export async function runScan(opts = {}) {
  const rules = opts.rules ?? RULES;
  const findings = [];
  for (const rule of rules) {
    let lines;
    if (opts.forceJsScan) {
      // Self-test scenarios where ripgrep's .gitignore handling would skip fixtures.
      // (Caught by harness self-test, runbook incident-0005.)
      lines = await jsScan(rule, opts);
    } else {
      const r = await rg(rule, opts);
      if (r.code === -1) {
        lines = await jsScan(rule, opts);
      } else {
        lines = r.out.split(/\r?\n/).filter((l) => l.length > 0);
      }
    }
    lines = lines.filter((l) => !isExcluded(l, rule));
    if (lines.length) {
      findings.push({ rule, hits: lines });
    }
  }
  return { findings };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { findings } = await runScan();
  if (findings.length === 0) {
    console.log('§9-A grep: clean');
    process.exit(0);
  }
  console.log('§9-A grep findings:');
  for (const f of findings) {
    console.log(`\n[${f.rule.contract}] ${f.rule.label}`);
    for (const h of f.hits.slice(0, 20)) console.log(`  ${h}`);
    if (f.hits.length > 20) console.log(`  …(${f.hits.length - 20} more)`);
  }
  console.log('\nFix the offending lines or, if the match is a false positive, narrow the rule in harness/lib/anti-pattern-grep.mjs.');
  process.exit(1);
}
