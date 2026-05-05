# IMPLEMENTATION_STATUS

자율 진행 결과 요약. 코드/문서가 실제로 들어간 항목과 다음 단계 메모.

## Phase 0 — 설계 문서 ✅
`docs/` 19개 작성 + 정책 변경(다중 사용자, raw_text 7일 폐기, Seoul 리전, 가입 시드 자동) 반영.

## Phase 1 — 프로젝트 세팅 ✅
- Next.js + TS + Tailwind 부트스트랩, 디자인 토큰 풀세트
- Supabase 클라이언트(client/server/admin) 분리
- `middleware.ts`로 보호 라우트
- AppShell(Sidebar/BottomNav/Header), 공통 Button/Card/Badge/Modal
- 9개 라우트 + 매직링크 로그인 + auth callback

## Phase 2 — 기본 가계부 ✅
- categories / payment_methods / transactions CRUD service + API
- 거래내역 PC 표 / 모바일 카드 자동 전환 + 검색·유형 필터 + 추가/수정/삭제
- 카테고리·결제수단 관리(색상 프리셋, 마지막 4자리만 입력)
- 대시보드 실데이터 + 월 범위 + 최근 거래 + 카테고리 상위

## Phase 3 — 파일 업로드 ✅
- `services/fileService.ts`, `/api/upload`, `/api/files(+/[id])`
- Storage 경로 `{user_id}/yyyy/mm/uuid.ext`
- Dropzone(드래그+카메라+다중) + FilesClient(상태 배지 + 미리보기 + 삭제)

## Phase 4 — OCR ✅
- Tesseract.js **클라이언트 측** 실행 (Vercel 함수 시간 제약 회피)
- `/api/ocr/[fileId]` 저장 시 서버에서 한 번 더 마스킹
- OcrPreview에서 사용자 텍스트 직접 수정 가능
- 7일 후 raw_text 자동 폐기 잡(`/api/admin/purge-raw-text`) + Vercel Cron 등록

## Phase 5 — AI 분석 ✅
- `lib/ollama/client.ts` (BASE_URL/토큰/타임아웃)
- 프롬프트 + zod 검증 + 코드블록·잡음 관대 파싱
- `extractionService`: 캐시 적중 시 호출 생략 → 1회 재시도 → 환각 검증 → 학습 후처리 → 중복 검사 → 후보 insert
- AI 서버 다운 시 503 + UI 배너로 안내(`AiServerStatus`)

## Phase 6 — 학습 데이터 ✅
- `analysis_cache` (input_hash) + `merchant_learning_rules` (사용자 가맹점 학습)
- 분석 전: 학습 힌트를 프롬프트 USER 컨텍스트로 주입
- 분석 후: 평소 패턴과 다르면 confidence 하향 + warning, 같으면 보강
- 승인 시 학습 규칙 갱신 + correction_logs 기록

## Phase 7 — 승인형 반영 ✅
- 후보 단건 승인/제외/수정 + 일괄 승인(중복·확인필요 자동 제외)
- 승인 시 `transactions` insert + 카테고리·결제수단 이름→id 매핑
- 모바일 sticky bottom 일괄 승인 바(BottomNav 위 56px)

## Phase 8 — 중복 검사 ✅
- 날짜+금액+가맹점 정규화 비교, `none/suspected/duplicate`
- 후보 생성 단계에서 최근 30일 transactions와 매칭

## Phase 9 — 통계 고도화 ✅
- `analyticsService`: 최근 6개월 시계열, 90일 반복 지출 후보(평균/안정성), 30일 AI 통계(성공/실패/승인율)
- 대시보드에 MonthlyBars + 고정지출 후보 + AI 통계 4카드

## Phase 10 — 보안/운영 ✅ (1차)
- masking 단일 모듈 + 단위 테스트 8케이스
- RLS 모든 사용자 소유 테이블 + Storage 정책
- raw_text 7일 후 자동 폐기 cron + 토큰 인증
- 설정 화면: 계정/AI 서버/보안/내보내기/계정 삭제(타이핑 확인)
- `/api/me`, `/api/export`(JSON 전체), `/api/export/transactions`(CSV), `/api/account` DELETE
- CI: typecheck + lint + vitest + next build + gitleaks

## Phase 11 — 고도화

### 완료
- ✅ CSV / XLSX 입력 어댑터 — 클라이언트 파싱(SheetJS/CSV) + 컬럼 자동 매핑(카드/계좌 헤더 감지) + 미리보기 + `/api/import/commit` + 학습/중복/마스킹 통합. `docs/IMPORT_CSV_XLSX.md` 참고.
- ✅ 예산 기능 — 카테고리별/전체 월 예산 + 진행률 + 대시보드 위젯. `docs/BUDGETS.md` 참고. 마이그레이션 `0003_budgets.sql` 추가 적용 필요.

### 다음 후보 (우선순위 순)
- E2E (Playwright) 시나리오 + 6개 뷰포트 반응형 점검
- 가족 공유(`households` + 멤버십 + RLS 변경)
- PDF 입력 (Vercel Hobby 함수 시간 한계 있어 별도 워커 검토)
- PaddleOCR / Clova OCR 어댑터
- 소비 패턴 자동 인사이트
- 시각 회귀 스냅샷
- 예산 임계치 도달 알림(메일/푸시)

## 검증 체크
- 모든 사용자 소유 테이블 RLS on (마이그레이션 do 블록으로 일괄)
- service role key는 `lib/supabase/admin.ts` 외에서는 참조 금지(grep 점검)
- 결제수단은 마지막 4자리만 받음(클라이언트 maxLength + zod 정규식)
- AI 요청 텍스트는 마스킹된 OCR + 학습 힌트 요약만
- 7일 raw_text 폐기는 cron + `RAW_TEXT_TTL_DAYS` 환경변수
