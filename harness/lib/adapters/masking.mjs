// Masking domain adapter — runs masking lib against input text and returns masked output.
// Lightweight: uses a parallel masking implementation here so harness has no TS build dependency.
// When src/lib/security/masking.ts changes, mirror those rules here and bump MIRROR_DATE.
// design-log 06-coupling C-05: this is an INTENTIONAL mirror. Self-test enforces the
// MIRROR_DATE marker so the adapter cannot silently drift from src.
//
// MIRROR_DATE: 2026-05-08
// MIRROR_SOURCE: src/lib/security/masking.ts

// Order matters: more specific patterns must run before generic ones.
// A generic 8–14-digit account pattern would swallow phone/RRN/biz numbers, so
// we omit it here — accounts should be masked by the calling site with its
// surrounding context (label "계좌", bank prefix, etc.). When the harness
// needs account masking, add a context-aware case rather than widening this list.
const PATTERNS = [
  // 카드번호 4-4-4-4 또는 16자리 → 마지막 4자리만 유지
  { re: /(?:\d{4}[-\s]?){3}(\d{4})/g, fmt: (_m, last) => `****-****-****-${last}` },
  // 주민등록번호 6-7
  { re: /\b\d{6}-?[1-4]\d{6}\b/g, fmt: () => '******-*******' },
  // 사업자등록번호 3-2-5
  { re: /\b\d{3}-\d{2}-(\d{5})\b/g, fmt: (_m, last) => `***-**-${last}` },
  // 전화번호 010-XXXX-XXXX
  { re: /\b01[016789][-\s]?\d{3,4}[-\s]?(\d{4})\b/g, fmt: (_m, last) => `***-****-${last}` },
];

export const inputSchema = {
  input: { text: 'string' },
};
export const expectedSchema = {
  masked: 'string',
};

export async function run(testCase) {
  const input = testCase.input?.text ?? '';
  let out = input;
  for (const { re, fmt } of PATTERNS) out = out.replace(re, fmt);
  return { masked: out };
}
