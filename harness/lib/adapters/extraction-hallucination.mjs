// extraction-hallucination domain adapter.
// Given { ocr_text, candidate, user_hints? }, returns the four hallucination
// signals defined in rag/hallucination/patterns.json (extraction category):
//
//   merchant_in_ocr      — candidate.merchant 가 OCR 텍스트에 부분문자열로 존재하는가
//   amount_in_ocr        — candidate.amount 의 숫자가 OCR 텍스트 어딘가에 존재하는가 (콤마 허용)
//   category_consistent  — user_hints.categories 가 있으면 candidate.category 와 일치하는가
//   pii_clean            — candidate 의 모든 string 필드가 PII 패턴 없는가 (카드/주민/전화)
//
// Each signal returns true (clean) or false (hallucinated). Cases assert the
// expected boolean shape, so a regression in any check fails immediately.
//
// Pure / deterministic — no LLM calls. Fits run.mjs --mock by default.

const PII_PATTERNS = [
  /(?:\d{4}[-\s]?){3}\d{4}/,             // 카드번호
  /\b\d{6}-?[1-4]\d{6}\b/,                // 주민등록번호
  /\b01[016789][-\s]?\d{3,4}[-\s]?\d{4}\b/, // 전화번호
];

function normalizeAmount(n) {
  if (typeof n === 'number') return String(Math.round(n));
  if (typeof n === 'string') return n.replace(/[,\s]/g, '');
  return '';
}

function merchantInOcr(merchant, ocrText) {
  if (!merchant || !ocrText) return false;
  // Exact substring or strong prefix match. Korean does not split well on whitespace,
  // so substring is the safest baseline.
  return ocrText.includes(merchant);
}

function amountInOcr(amount, ocrText) {
  if (amount === undefined || amount === null) return false;
  if (!ocrText) return false;
  const num = normalizeAmount(amount);
  if (!num) return false;
  // Allow OCR text to have thousands separators or surrounding currency markers.
  const numNoCommas = ocrText.replace(/[,\s]/g, '');
  return numNoCommas.includes(num);
}

function categoryConsistent(category, hintCategories) {
  if (!hintCategories || hintCategories.length === 0) return true; // no hint → can't say
  if (!category) return false;
  return hintCategories.includes(category);
}

function piiClean(candidate) {
  const fields = [];
  for (const v of Object.values(candidate ?? {})) {
    if (typeof v === 'string') fields.push(v);
  }
  for (const f of fields) {
    for (const re of PII_PATTERNS) {
      if (re.test(f)) return false;
    }
  }
  return true;
}

export const inputSchema = {
  input: {
    ocr_text: 'string',
    candidate: 'object',
    user_hints: 'object?',
  },
};
export const expectedSchema = {
  merchant_in_ocr: 'boolean',
  amount_in_ocr: 'boolean',
  category_consistent: 'boolean',
  pii_clean: 'boolean',
};

export async function run(testCase) {
  const ocr = testCase.input?.ocr_text ?? '';
  const candidate = testCase.input?.candidate ?? {};
  const hints = testCase.input?.user_hints ?? {};
  return {
    merchant_in_ocr: merchantInOcr(candidate.merchant, ocr),
    amount_in_ocr: amountInOcr(candidate.amount, ocr),
    category_consistent: categoryConsistent(candidate.category, hints.categories),
    pii_clean: piiClean(candidate),
  };
}

// Exposed for self-test reuse.
export const _internal = {
  merchantInOcr,
  amountInOcr,
  categoryConsistent,
  piiClean,
};
