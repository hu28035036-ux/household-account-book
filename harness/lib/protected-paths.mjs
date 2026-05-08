// Single source for the production-feature protected paths
// (CONTRACT §9-B-1 — "절대 현재 기능에서 기능 이상이 발생하면 안 된다").
//
// Both the human-readable §9-B-1 in CONTRACT.md and the meta-isolation gate
// (harness/test/cases/meta-isolation.mjs) consume this list. When a new
// protected path is needed, edit here only — both places pick it up.
// (design-log 06-coupling C-11.)

export const PROTECTED_PATHS = [
  'src',
  'supabase',
  'public',
  'e2e',
  'samples',
  'scripts',
  'package.json',
  'package-lock.json',
  'next.config.mjs',
  'vercel.json',
  'tsconfig.json',
  'tailwind.config.ts',
  'postcss.config.js',
  'playwright.config.ts',
  'vitest.config.ts',
  'next-env.d.ts',
];

// Auto-regenerated artifacts that live inside / next to protected files.
// They are owned by tooling (tsc, etc.), not by meta agents — exempt from the gate.
export const AUTO_GENERATED = [
  'tsconfig.tsbuildinfo',
];
