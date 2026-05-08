// Self-test for harness/lib/adapters/masking.mjs.
// Specifically guards incident-0001 (regex ordering): a phone number must NOT be
// swallowed by a generic account regex, an RRN must NOT collide with phone/biz, etc.

import { run as maskingRun } from '../../lib/adapters/masking.mjs';

async function check(name, input, expected) {
  const out = await maskingRun({ input: { text: input } });
  if (out.masked === expected) return { ok: true, name };
  return {
    ok: false,
    name,
    message: `\n      expected: ${JSON.stringify(expected)}\n      got:      ${JSON.stringify(out.masked)}`,
  };
}

export async function runMaskingCases() {
  return [
    await check(
      'incident-0001: phone number not swallowed by generic account',
      '문의 010-1234-5678',
      '문의 ***-****-5678'
    ),
    await check(
      'incident-0001: card number 4-4-4-4 → last 4 only',
      '카드 1234-5678-9012-3456 결제',
      '카드 ****-****-****-3456 결제'
    ),
    await check(
      'incident-0001: RRN not collided with phone/biz',
      '주민 900101-1234567',
      '주민 ******-*******'
    ),
    await check(
      'incident-0001: business reg → last group only',
      '사업자 123-45-67890',
      '사업자 ***-**-67890'
    ),
    await check(
      'no false positives on plain numbers',
      '연도 2026 / 페이지 12',
      '연도 2026 / 페이지 12'
    ),
  ];
}
