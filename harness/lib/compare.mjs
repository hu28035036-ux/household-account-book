// Compare expected vs actual for harness cases.
// Generic — domain adapters return shapes that match expected schema.
//
// design-log 06-coupling C-08: leaf-comparison rules are now registered as
// { match, apply, priority } records sorted high-priority first. Adding a new
// path-keyed semantics (like another `_min` suffix) is a list append, not a
// branch-order edit deep inside walk(). Higher priority wins.

const PRIMITIVE_RULES = [
  // confidence_min — actual must be >= expected. Higher priority than the
  // generic number rule so confidence_min isn't swallowed by amount_pct.
  // (Caught by harness self-test, runbook incident-0004.)
  {
    name: 'confidence_min',
    priority: 100,
    match: (path) => path.endsWith('confidence_min'),
    apply: (path, exp, act, _tol, diffs) => {
      if (typeof act !== 'number' || act < exp) {
        diffs.push({ path, msg: `expected confidence >= ${exp}, got ${act}` });
      }
    },
  },
  // merchant — exact / exact-or-alias / contains modes selected by tolerances.merchant_match
  {
    name: 'merchant',
    priority: 80,
    match: (path) => path.endsWith('merchant'),
    apply: (path, exp, act, tol, diffs) => {
      const mode = tol.merchant_match || 'exact';
      if (mode === 'exact' && exp !== act) {
        diffs.push({ path, msg: `expected "${exp}", got "${act}"` });
      } else if (mode === 'exact-or-alias') {
        if (exp !== act && !(typeof act === 'string' && act.includes(exp))) {
          diffs.push({ path, msg: `expected "${exp}" (or alias), got "${act}"` });
        }
      } else if (mode === 'contains') {
        if (typeof act !== 'string' || !act.toLowerCase().includes(String(exp).toLowerCase())) {
          diffs.push({ path, msg: `expected contains "${exp}", got "${act}"` });
        }
      }
    },
  },
  // generic number — amount_pct tolerance
  {
    name: 'number',
    priority: 50,
    match: (_path, exp, act) => typeof exp === 'number' && typeof act === 'number',
    apply: (path, exp, act, tol, diffs) => {
      const pct = tol.amount_pct ?? 0;
      const allowed = Math.abs(exp) * (pct / 100);
      if (Math.abs(exp - act) > allowed) {
        diffs.push({ path, msg: `expected ${exp}, got ${act} (tol ${pct}%)` });
      }
    },
  },
  // fallback — strict equality. Lowest priority so specific rules above fire first.
  {
    name: 'strict-eq',
    priority: 0,
    match: () => true,
    apply: (path, exp, act, _tol, diffs) => {
      if (exp !== act) diffs.push({ path, msg: `expected ${JSON.stringify(exp)}, got ${JSON.stringify(act)}` });
    },
  },
];

// Sort once at module load, descending priority.
PRIMITIVE_RULES.sort((a, b) => b.priority - a.priority);

export function compareCase(expected, actual, tolerances = {}) {
  const diffs = [];
  walk('', expected, actual, tolerances, diffs);
  return { ok: diffs.length === 0, diffs };
}

function walk(path, exp, act, tol, diffs) {
  if (exp === undefined) return;
  if (Array.isArray(exp)) {
    if (!Array.isArray(act)) {
      diffs.push({ path, msg: `expected array, got ${typeof act}` });
      return;
    }
    if (exp.length !== act.length) {
      diffs.push({ path, msg: `array length mismatch: expected ${exp.length}, got ${act.length}` });
    }
    const len = Math.min(exp.length, act.length);
    for (let i = 0; i < len; i++) walk(`${path}[${i}]`, exp[i], act[i], tol, diffs);
    return;
  }
  if (exp && typeof exp === 'object') {
    if (!act || typeof act !== 'object') {
      diffs.push({ path, msg: `expected object, got ${typeof act}` });
      return;
    }
    for (const k of Object.keys(exp)) walk(path ? `${path}.${k}` : k, exp[k], act[k], tol, diffs);
    return;
  }
  // primitive — first matching rule by priority wins
  for (const rule of PRIMITIVE_RULES) {
    if (rule.match(path, exp, act)) {
      rule.apply(path, exp, act, tol, diffs);
      return;
    }
  }
}

// Exposed for self-test.
export const _internal = { PRIMITIVE_RULES };
