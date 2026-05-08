// Single source for verify gate / loop-validator stages.
// design-log 06-coupling C-09: previously verify.mjs and loop.mjs each defined
// stages independently — adding a stage required editing both. Centralizing here.
//
// Each stage: { label, cmd, args, optional? }.
//   optional=true means the stage is skipped (counts as pass) when the underlying
//   tool isn't available (e.g. dev server for smoke, Supabase env for RLS).

export const STAGES = {
  selfTest: {
    label: 'self-test',
    cmd: 'node',
    args: ['harness/test/self-test.mjs'],
  },
  typecheck: {
    label: 'typecheck',
    cmd: 'npm',
    args: ['run', 'typecheck'],
  },
  vitest: {
    label: 'vitest',
    cmd: 'npm',
    args: ['test', '--', '--run'],
  },
  harnessMock: {
    label: 'harness',
    cmd: 'node',
    args: ['harness/run.mjs', '--mock'],
  },
  eslint: {
    label: 'eslint',
    cmd: 'npm',
    args: ['run', 'lint'],
  },
  antiPatternGrep: {
    label: 'grep:silent-fallback',
    cmd: 'node',
    args: ['harness/lib/anti-pattern-grep.mjs'],
  },
  smokeAll: {
    label: 'smoke:all',
    cmd: 'npm',
    args: ['run', 'smoke:all'],
    optional: true,
  },
  auditRls: {
    label: 'audit-rls',
    cmd: 'node',
    args: ['scripts/audit-rls.mjs'],
    optional: true,
  },
  responsive: {
    label: 'responsive',
    cmd: 'npx',
    args: ['playwright', 'test', 'e2e/responsive.spec.ts'],
    optional: true,
  },
  verifyCitations: {
    label: 'verify-citations',
    cmd: 'node',
    args: ['rag/hallucination/verify-citations.mjs', '--repo-defaults'],
  },
};
