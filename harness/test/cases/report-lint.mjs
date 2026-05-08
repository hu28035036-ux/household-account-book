// Self-test for harness/lib/report-lint.mjs.
// Catches regressions in 5-section detection: missing section, wrong order,
// keyword variants, header-depth flexibility.

import { lintReport, SECTIONS } from '../../lib/report-lint.mjs';

function ok(name, cond, message) {
  return cond ? { ok: true, name } : { ok: false, name, message: message ?? 'condition false' };
}

const GOOD_REPORT = `
보고

## 1. 목적
간단한 작업이었음.

## 2. 어떤 에이전트 사용했는지
ai-extraction 만 호출.

## 3. 코드작성 단위화로 잘 진행됐는지
단위화 영향 없음.

## 4. 검증 / 테스트 제대로 진행했는지
self-test 74/74.

## 5. 하네스로 막힌 할루시네이션 제대로 막혔는지
verify-citations 통과.
`;

const MISSING_SEC = `
## 1. 목적
...
## 2. 어떤 에이전트 사용했는지
...
## 3. 단위화 진행
...
## 5. 할루시네이션 점검
...
`;

const OUT_OF_ORDER = `
## 1. 목적
...
## 3. 코드작성 단위화로 잘 진행됐는지
...
## 2. 어떤 에이전트 사용했는지
...
## 4. 검증 진행
...
## 5. 할루시네이션
...
`;

const VARIED_DEPTH = `
# 보고

#### 목적
...

###### 사용한 에이전트
ai-extraction.

## 단위화 결과
정합.

#### 검증 결과
self-test pass.

## 할루시네이션 점검
verify-citations clean.
`;

export async function runReportLintCases() {
  const results = [];

  // 1. Good report passes.
  {
    const r = lintReport(GOOD_REPORT);
    results.push(ok('good report passes', r.ok, `errors: ${r.errors.join('; ')}`));
  }

  // 2. Missing section fails.
  {
    const r = lintReport(MISSING_SEC);
    const missingFour = r.errors.some((e) => /§4/.test(e));
    results.push(ok('missing section detected (§4)', !r.ok && missingFour, `r=${JSON.stringify(r)}`));
  }

  // 3. Out-of-order sections fail (because cursor advances past §3 before §2).
  {
    const r = lintReport(OUT_OF_ORDER);
    results.push(ok('out-of-order sections detected', !r.ok));
  }

  // 4. Heading depth doesn't matter — a report using mixed depths still passes
  //    as long as keywords appear in order.
  {
    const r = lintReport(VARIED_DEPTH);
    results.push(ok('mixed heading depth accepted', r.ok, `errors: ${r.errors.join('; ')}`));
  }

  // 5. Empty input fails cleanly.
  {
    const r = lintReport('');
    results.push(ok('empty input fails', !r.ok));
  }

  // 6. Sections list has exactly 5 items in canonical order (1..5).
  {
    const ids = SECTIONS.map((s) => s.id);
    const correct = ids.length === 5 && ids.every((id, i) => id === i + 1);
    results.push(ok('SECTIONS contract: ids 1..5 in order', correct, `got: ${ids.join(',')}`));
  }

  return results;
}
