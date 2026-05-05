# TEST_HARNESS_PLAN

## 테스트 도구
- 단위/통합: **Vitest** (또는 Jest). 타입스크립트 친화적이고 Next.js와 잘 어울림.
- React 컴포넌트: **@testing-library/react**.
- E2E: **Playwright** (모바일/PC 뷰포트 시뮬레이션).
- AI 하네스: **자체 JSON 케이스 + Vitest 통합**.

## 폴더
```
src/tests/
  unit/
    masking.test.ts
    extractionValidator.test.ts
    duplicateChecker.test.ts
  integration/
    api.transactions.test.ts
    api.candidates.test.ts
    rls.test.ts
  harness/
    ai-extraction-cases.json
    runHarness.test.ts
e2e/
  flow.upload-approve.spec.ts
  responsive.spec.ts
```

## 테스트 범위 (필수 항목)
1. 수동 거래 등록 (CRUD)
2. 거래 수정/삭제
3. 카테고리 생성/수정
4. 결제수단 생성/수정
5. 파일 업로드(메타+Storage 모킹)
6. OCR 결과 저장
7. AI JSON 파싱(정상/비정상)
8. 잘못된 JSON 처리(재시도 1회)
9. 후보 생성
10. 후보 수정/승인 → transactions 반영
11. 중복 검사(같은 날·같은 금액·같은 가맹점)
12. 사용자별 데이터 분리(다른 사용자 row 접근 거부)
13. 민감정보 마스킹(카드/계좌/주민/전화/사업자번호)
14. RLS 확인(서로 다른 두 사용자로 접근 시도)
15. 대시보드 집계(월/카테고리/결제수단)
16. 모바일/PC 반응형 표시(Playwright)
17. 화이트+핑크 색상 적용 일관성(시각 회귀 검토)
18. 위험/경고 상태 색상 구분
19. 사용자 학습데이터 반영(승인 후 다음 분석에 영향)
20. GitHub 비밀키 커밋 방지(gitleaks CI)
21. Vercel build 통과(CI에서 `next build`)

## AI 하네스 케이스 (`tests/harness/ai-extraction-cases.json`)
각 케이스는 다음을 포함:
```json
{
  "id": "single-receipt-01",
  "description": "단일 영수증, 가맹점/금액/날짜 모두 명확",
  "inputMaskedOcr": "...",
  "expected": {
    "documentType": "receipt",
    "transactionsCount": 1,
    "fields": { "amountIsNotNull": true, "merchantIsNotNull": true }
  }
}
```

### 포함 케이스
- 단일 영수증
- 여러 품목 영수증
- 카드 결제내역 캡처(여러 거래)
- 계좌 이체 내역 캡처(여러 거래)
- 날짜 불명확
- 금액 여러 개
- 가맹점명 불명확
- 중복 가능 거래
- OCR 오인식 텍스트
- 민감정보 포함(마스킹 통과 검증)
- 반복 가맹점 학습(같은 가맹점이 등장 → 학습 규칙으로 카테고리 자동 추천)
- 사용자별 학습 분리(다른 사용자에게는 영향 없음)

## 하네스 실행 방식
- Vitest 통합 테스트로 위 JSON을 순회.
- Ollama는 실제 호출 또는 **stub**(테스트용 fake Ollama 서버) 사용.
- 검증: zod 스키마 통과 / 필드 존재 / warning 포함 여부.

## 반응형 테스트 (Playwright)
- viewports: 360, 390, 768, 1024, 1280, 1440.
- 시나리오:
  1. 로그인
  2. 대시보드 진입
  3. 거래 1건 수동 등록
  4. 영수증 업로드 → OCR → 분석 → 후보 1건 승인
  5. 거래내역에 반영 확인
  6. 카테고리/결제수단/설정 화면 도달
  7. 화면 깨짐/오버플로/터치 영역 검사

## 시각 회귀(선택)
- Playwright `toHaveScreenshot`으로 핵심 화면 스냅샷.
- 색상/레이아웃 변경 감시.

## 보안 테스트
- masking 함수에 카드/계좌/주민/전화/사업자번호 입력 → 마스킹 결과 검증.
- RLS: 다른 사용자 row select 시 0건 반환 검증.
- secret 스캐너 CI.

## 통과 기준
- 단위/통합/하네스 모두 그린.
- E2E 핵심 플로우 그린.
- gitleaks 0건.
- `next build` 성공.

## 실패 시 보고
- 테스트 결과 숨기지 않고 콘솔과 PR에 명시.
- 회피용 skip은 사유와 이슈 링크 의무화.
