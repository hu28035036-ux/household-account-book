// Self-test for harness/lib/adapters/extraction-hallucination.mjs.
// Targets the four signal helpers directly (merchantInOcr / amountInOcr /
// categoryConsistent / piiClean). End-to-end coverage lives under
// harness/cases/extraction-hallucination/ via run.mjs — this group catches the
// inner helpers that the cases all rely on.

import { _internal } from '../../lib/adapters/extraction-hallucination.mjs';

const { merchantInOcr, amountInOcr, categoryConsistent, piiClean } = _internal;

function ok(name, cond, message) {
  return cond ? { ok: true, name } : { ok: false, name, message: message ?? 'condition false' };
}

export async function runExtractionHallucinationCases() {
  return [
    // merchantInOcr
    ok('merchantInOcr: substring match', merchantInOcr('스타벅스', '스타벅스 강남점\n아메리카노')),
    ok('merchantInOcr: not in OCR fails', !merchantInOcr('이마트24', 'GS25 강남점')),
    ok('merchantInOcr: empty inputs fail', !merchantInOcr('', 'anything') && !merchantInOcr('스타벅스', '')),

    // amountInOcr
    ok('amountInOcr: integer in plain text', amountInOcr(4500, '아메리카노 4500')),
    ok('amountInOcr: with commas', amountInOcr(45000, '합계 45,000')),
    ok('amountInOcr: not present fails', !amountInOcr(9999, '아메리카노 4500')),
    ok('amountInOcr: string amount accepted', amountInOcr('4500', '합계 4500')),

    // categoryConsistent
    ok('categoryConsistent: hint match', categoryConsistent('카페', ['카페', '식비'])),
    ok('categoryConsistent: hint mismatch', !categoryConsistent('교통', ['카페', '식비'])),
    ok('categoryConsistent: no hints → true', categoryConsistent('카페', [])),
    ok('categoryConsistent: no category fails when hints present', !categoryConsistent(null, ['카페'])),

    // piiClean
    ok(
      'piiClean: clean candidate',
      piiClean({ merchant: '스타벅스', amount: 4500, note: '아메리카노' })
    ),
    ok(
      'piiClean: card number leak',
      !piiClean({ merchant: '스타벅스', note: '카드 1234-5678-9012-3456 결제' })
    ),
    ok(
      'piiClean: RRN leak',
      !piiClean({ note: '주민 900101-1234567' })
    ),
    ok(
      'piiClean: phone number leak',
      !piiClean({ note: '연락처 010-1234-5678' })
    ),
    ok(
      'piiClean: ignores non-strings',
      piiClean({ merchant: '스타벅스', amount: 4500, raw: { nested: 'object' } })
    ),
  ];
}
