// Self-test for harness/lib/anti-pattern-grep.mjs.
// Uses fixtures under harness/test/fixtures/anti-pattern/ so this never runs against real src.
//
// Cases:
//  1. silent-fallback fixture is flagged
//  2. clean fixture is not flagged
//  3. excludePaths suppresses a real-but-justified service_role match
//  4. allowList suppresses a real-but-justified dangerouslySetInnerHTML match
//  5. Windows-style backslash paths are still matched against excludePaths

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { runScan, isExcluded, normalizeSlashes, RULES } from '../../lib/anti-pattern-grep.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = resolve(__dirname, '../fixtures/anti-pattern');

// C-03: production RULES is the single source of truth. Self-test only overrides
// path-related envelope fields (excludePaths/allowList) for the fixture tree.
// If a production pattern regresses, this self-test sees the same regression.
function ruleByLabelMatch(substr, overrides) {
  const base = RULES.find((r) => r.label.includes(substr));
  if (!base) throw new Error(`anti-pattern self-test: production RULES has no rule containing "${substr}"`);
  return [{ ...base, ...overrides }];
}

const FIXTURE_RULES_FALLBACK = ruleByLabelMatch('catch → return []', { path: 'src' });
const FIXTURE_RULES_SERVICEROLE = ruleByLabelMatch('service_role', {
  path: 'src',
  excludePaths: ['src/admin-allowed'],
});
const FIXTURE_RULES_DANGEROUS = ruleByLabelMatch('dangerouslySetInnerHTML', {
  path: 'src',
  allowList: ['src/components/layout-allowlist'],
});

function hitsFor(findings, ruleLabel) {
  const f = findings.find((x) => x.rule.label === ruleLabel);
  return f ? f.hits : [];
}

export async function runAntiPatternCases() {
  const results = [];

  // 1. silent-fallback fixture is flagged
  {
    const { findings } = await runScan({ root: FIXTURE_ROOT, rules: FIXTURE_RULES_FALLBACK, forceJsScan: true });
    const hits = hitsFor(findings, 'silent fallback (catch → return [])');
    if (hits.some((h) => h.includes('silent-fallback.fixture'))) {
      results.push({ ok: true, name: 'silent-fallback fixture is flagged' });
    } else {
      results.push({
        ok: false,
        name: 'silent-fallback fixture is flagged',
        message: `expected hit on silent-fallback.fixture, got: ${JSON.stringify(hits)}`,
      });
    }
  }

  // 2. clean fixture is not flagged
  {
    const { findings } = await runScan({ root: FIXTURE_ROOT, rules: FIXTURE_RULES_FALLBACK, forceJsScan: true });
    const hits = hitsFor(findings, 'silent fallback (catch → return [])');
    if (!hits.some((h) => h.includes('clean.fixture'))) {
      results.push({ ok: true, name: 'clean fixture is not flagged' });
    } else {
      results.push({
        ok: false,
        name: 'clean fixture is not flagged',
        message: `unexpected hit on clean.fixture: ${JSON.stringify(hits)}`,
      });
    }
  }

  // 3. excludePaths suppresses service_role match in admin-allowed/
  {
    const { findings } = await runScan({ root: FIXTURE_ROOT, rules: FIXTURE_RULES_SERVICEROLE, forceJsScan: true });
    const hits = hitsFor(findings, 'service_role key referenced outside lib/supabase/admin');
    if (hits.length === 0) {
      results.push({ ok: true, name: 'excludePaths suppresses justified service_role hit' });
    } else {
      results.push({
        ok: false,
        name: 'excludePaths suppresses justified service_role hit',
        message: `expected no hits, got: ${JSON.stringify(hits)}`,
      });
    }
  }

  // 4. allowList suppresses dangerouslySetInnerHTML in layout-allowlist
  {
    const { findings } = await runScan({ root: FIXTURE_ROOT, rules: FIXTURE_RULES_DANGEROUS, forceJsScan: true });
    const hits = hitsFor(findings, 'dangerouslySetInnerHTML');
    if (hits.length === 0) {
      results.push({ ok: true, name: 'allowList suppresses justified dangerouslySetInnerHTML' });
    } else {
      results.push({
        ok: false,
        name: 'allowList suppresses justified dangerouslySetInnerHTML',
        message: `expected no hits, got: ${JSON.stringify(hits)}`,
      });
    }
  }

  // 5. Windows-style backslash paths still match excludePaths
  {
    const winLine = String.raw`C:\repo\src\admin-allowed\admin.ts:5:const k = process.env.SUPABASE_SERVICE_ROLE_KEY;`;
    const rule = FIXTURE_RULES_SERVICEROLE[0];
    if (isExcluded(winLine, rule)) {
      results.push({ ok: true, name: 'isExcluded handles backslash paths' });
    } else {
      results.push({
        ok: false,
        name: 'isExcluded handles backslash paths',
        message: `excludePaths should match after normalizeSlashes(${JSON.stringify(winLine)})`,
      });
    }
  }

  // 6. normalizeSlashes is a pure utility (sanity)
  {
    const r = normalizeSlashes(String.raw`a\b\c`);
    if (r === 'a/b/c') {
      results.push({ ok: true, name: 'normalizeSlashes converts backslashes' });
    } else {
      results.push({
        ok: false,
        name: 'normalizeSlashes converts backslashes',
        message: `got ${JSON.stringify(r)}`,
      });
    }
  }

  return results;
}
