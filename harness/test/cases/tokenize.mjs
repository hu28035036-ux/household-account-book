// Self-test for rag/lib/tokenize.mjs.
// Catches: tokenizer drops too aggressively / fails on Korean syllables / breaks on mixed input.

import { tokenize } from '../../../rag/lib/tokenize.mjs';

function expectIncludes(name, input, mustInclude) {
  const tokens = tokenize(input);
  const missing = mustInclude.filter((t) => !tokens.includes(t));
  if (missing.length === 0) return { ok: true, name };
  return {
    ok: false,
    name,
    message: `expected tokens to include [${missing.join(', ')}], got [${tokens.join(', ')}]`,
  };
}

function expectExcludes(name, input, mustExclude) {
  const tokens = tokenize(input);
  const present = mustExclude.filter((t) => tokens.includes(t));
  if (present.length === 0) return { ok: true, name };
  return {
    ok: false,
    name,
    message: `expected tokens to exclude [${present.join(', ')}], got [${tokens.join(', ')}]`,
  };
}

export async function runTokenizeCases() {
  return [
    expectIncludes(
      'mixed Korean + English keeps both',
      'RLS 정책 household 공유',
      ['rls', '정책', 'household', '공유']
    ),
    expectIncludes(
      'lowercase normalization for English',
      'BM25 vs Embedding',
      ['bm25', 'embedding']
    ),
    expectExcludes(
      'common stopwords dropped',
      'this is the and 그리고 등',
      ['the', 'and', '그리고', '등']
    ),
    expectExcludes(
      'single-character tokens dropped',
      'a b c 가 나 다',
      ['a', 'b', 'c', '가', '나', '다']
    ),
    expectIncludes(
      'punctuation does not corrupt adjacent tokens',
      'masking, 카드(번호) — 마지막 4자리',
      ['masking', '카드', '번호', '마지막', '4자리']
    ),
  ];
}
