# IMPORT_CSV_XLSX — 시트 가져오기

## 흐름
```
파일 선택 → 클라이언트 파싱(SheetJS/CSV) → 컬럼 자동 감지 + 사용자 확정
        → 정규화(date/amount/type) → 미리보기
        → /api/import/commit → 학습 후처리 + 중복 검사 → transaction_candidates
        → /candidates에서 일괄 승인
```

## 자동 감지되는 헤더 패턴
| 필드 | 매칭 정규식(요약) |
|---|---|
| transaction_date | 이용일/거래일/승인일/일자/날짜/date |
| amount | 이용금액/거래금액/승인금액/금액/amount/total/합계 |
| amount_in | 입금/수입/credit/deposit |
| amount_out | 출금/지출/debit/withdraw |
| merchant_name | 가맹점/상호/이용처/적요/내용/merchant/payee |
| description | 메모/비고/설명/description/memo |
| payment_method | 결제수단/카드/계좌/payment |
| category | 분류/카테고리/category |

자동 감지에 실패해도 사용자가 드롭다운에서 직접 선택할 수 있습니다.

## 인코딩
- CSV는 UTF-8 우선 → replacement char가 많으면 EUC-KR로 재시도.

## 보안
- 파일은 **브라우저에서만 파싱**됩니다(Storage 미경유). 서버에는 가공된 후보 row만 전송.
- 서버 측 commit 시 `raw_text_basis`에 마스킹 한 번 더 적용.
- 입력 검증은 zod 스키마.

## 한도
- 한 번에 최대 2,000행. 더 큰 파일은 나눠서 올리세요.
- 기본 신뢰도 0.7 (OCR보다 안정적).

## 권장 컬럼 매핑
- 카드 명세서: `이용일자 / 가맹점 / 이용금액`
- 은행 입출금: `거래일 / 적요 / 입금 / 출금`
- 단순 가계부 시트: `날짜 / 가맹점 / 금액 / 카테고리`

## 타입 결정 규칙
- `입금/출금` 두 컬럼이면 입금>0 → income, 출금>0 → expense.
- 단일 amount 컬럼이면 음수 → expense, 양수 + 가맹점 있음 → expense, 양수 + 가맹점 없음 → income (보수적).
- 사용자가 후보 화면에서 수정 가능.

## 테스트
- `tests/unit/importNormalize.test.ts` — 날짜/금액 파싱, 자동 매핑, 입출금 분기.
