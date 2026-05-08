// Self-test for harness/lib/compare.mjs.
// Catches regressions in: equality, amount tolerance, confidence_min,
// merchant_match modes, array length checks, nested objects.

import { compareCase } from '../../lib/compare.mjs';

function expectOk(name, expected, actual, tolerances) {
  const r = compareCase(expected, actual, tolerances);
  if (r.ok) return { ok: true, name };
  return { ok: false, name, message: `expected ok=true, got diffs: ${JSON.stringify(r.diffs)}` };
}

function expectFail(name, expected, actual, tolerances, mustMention) {
  const r = compareCase(expected, actual, tolerances);
  if (r.ok) return { ok: false, name, message: 'expected ok=false, got ok=true' };
  if (mustMention) {
    const joined = JSON.stringify(r.diffs);
    if (!joined.includes(mustMention)) {
      return { ok: false, name, message: `diffs missing "${mustMention}": ${joined}` };
    }
  }
  return { ok: true, name };
}

export async function runCompareCases() {
  return [
    expectOk('simple equality', { a: 1, b: 'x' }, { a: 1, b: 'x' }, {}),

    expectFail('primitive mismatch', { a: 1 }, { a: 2 }, {}, 'expected 1'),

    expectOk(
      'amount within 5% tolerance',
      { amount: 1000 },
      { amount: 1040 },
      { amount_pct: 5 }
    ),

    expectFail(
      'amount outside 5% tolerance',
      { amount: 1000 },
      { amount: 1100 },
      { amount_pct: 5 },
      'tol 5%'
    ),

    expectOk(
      'confidence_min satisfied (actual >= expected)',
      { confidence_min: 0.7 },
      { confidence_min: 0.85 },
      {}
    ),

    expectFail(
      'confidence_min unsatisfied',
      { confidence_min: 0.7 },
      { confidence_min: 0.5 },
      {},
      'confidence >= 0.7'
    ),

    expectOk(
      'merchant exact-or-alias allows alias containment',
      { merchant: '스타벅스' },
      { merchant: '스타벅스 강남점' },
      { merchant_match: 'exact-or-alias' }
    ),

    expectFail(
      'array length mismatch flagged',
      { items: [1, 2, 3] },
      { items: [1, 2] },
      {},
      'array length mismatch'
    ),
  ];
}
