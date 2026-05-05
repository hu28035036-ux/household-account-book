# DEVELOPMENT_PHASES

## 큰 흐름
설계(Phase 0) → 골격(Phase 1) → 가계부 본체(Phase 2) → 업로드(Phase 3) → OCR(Phase 4) → AI 후보(Phase 5) → 학습(Phase 6) → 승인형(Phase 7) → 중복(Phase 8) → 통계 고도화(Phase 9) → 보안/운영(Phase 10) → 고도화(Phase 11).

## Phase 0. 설계 문서 작성 (현재 단계)
- 본 docs 19개 작성.
- DB/UX/반응형/디자인/AI/보안/배포 확정.
- 산출물: `docs/*` (이 문서들).
- 검수: 스크롤하면서 빠진 항목/충돌 항목 점검.

## Phase 1. 기본 프로젝트 세팅
- Next.js (App Router) + TypeScript + Tailwind 부트스트랩.
- Supabase 연결(클라이언트/서버/admin 분리).
- 기본 레이아웃: AppShell + Sidebar/BottomNav + Header.
- 화이트+핑크 디자인 토큰 적용(`tailwind.config.ts`).
- 로그인/로그아웃, 보호된 라우트.
- 산출물: 빈 대시보드/거래내역/업로드/후보/카테고리/결제수단/설정 라우트, 보호된 컨텍스트.

검증:
- 360/768/1024/1280에서 레이아웃 깨짐 없음.
- 로그인 → 대시보드 라우팅.
- secret 누락 없음.

## Phase 2. 기본 가계부 기능
- transactions / categories / payment_methods CRUD.
- 거래내역: PC 표 / 모바일 카드 전환.
- 대시보드 기본 집계(월별 지출/수입/잔액).

검증:
- 다른 사용자 row 접근 불가(RLS).
- 카테고리/결제수단 추가→거래에 적용→대시보드 반영.

## Phase 3. 파일 업로드
- Supabase Storage 버킷/정책 적용.
- 업로드 UI(드래그 + 카메라 입력).
- uploaded_files 연동.
- 파일 목록/삭제.

검증:
- 모바일에서 카메라 촬영 → 업로드 가능.
- 파일 삭제 시 Storage+DB 일관 처리.

## Phase 4. OCR
- Tesseract.js 통합(서버측).
- OCR 진행 상태 표시.
- 마스킹 적용 후 ocr_results 저장.
- 사용자에게 OCR 텍스트 미리보기/수정 제공.

검증:
- 한국어/영어 영수증 인식.
- 마스킹 단위 테스트 통과.

## Phase 5. AI 분석 후보
- Ollama 클라이언트(`lib/ollama`) + 프롬프트 + zod 검증.
- transaction_candidates 저장.
- 분석 실패 처리(재시도/에러 메시지).
- 후보 화면 PC 표 / 모바일 카드.

검증:
- AI 하네스 JSON 케이스 다수 통과.
- Ollama 다운 시 친절한 에러.

## Phase 6. 사용자 기록 기반 학습데이터
- user_learning_rules / merchant_* / category_* / payment_method_* / analysis_cache / user_correction_logs.
- 분석 전 사전 매칭(가맹점/키워드/캐시).
- 분석 후 후처리 보정(confidence 가감, 카테고리 보강, 패턴 어긋남 warning).
- 자동 최종 저장 금지 유지.

검증:
- 동일 OCR 재업로드 시 캐시 적중.
- 같은 가맹점 반복 → 추천 일관성 ↑.
- 다른 사용자 학습은 본인에게 영향 없음.

## Phase 7. 승인형 반영
- 후보 단건 수정/제외/승인 + 일괄 승인.
- 모바일 sticky bottom 일괄 승인 바.
- 승인 후 transactions insert + correction_logs + 학습 갱신.

검증:
- 의심/확인 필요 항목은 일괄 승인에서 제외.
- 승인 후 거래내역 즉시 반영.

## Phase 8. 중복 검사
- 날짜/금액/가맹점/결제수단/source_type 기반 점수.
- duplicate_status 갱신.
- UI에 중복 의심 명확 표시.

검증:
- 같은 영수증 재업로드 → suspected.
- 사용자 확인 후 승인 시 정상 저장.

## Phase 9. 통계 고도화
- 월별/카테고리별/결제수단별 차트.
- 고정지출 후보(반복 패턴).
- AI 분석 내역 통계(자동 처리 비율 등).

검증:
- 월 경계, 시간대 처리 정확.

## Phase 10. 보안/삭제/운영
- 마스킹 강화/검토.
- 파일 삭제 정책(자동 정리 옵션).
- RLS 종합 점검.
- 로그 최소화/감사 로그 도입.
- GitHub/Vercel 배포 문서화 최신화.

검증:
- secret 커밋 0.
- 다른 사용자 데이터 누출 0.

## Phase 11. 고도화 (선택)
- PDF/CSV/Excel 지원.
- PaddleOCR 등 로컬 OCR 대체.
- 가족 공유.
- 예산/리포트.
- 소비 패턴 분석.

## 작업 원칙(모든 Phase 공통)
- 큰 파일 하나에 몰지 않는다.
- DB 변경에는 마이그레이션/롤백 동반.
- 각 Phase 종료 시 unit + 통합 + 모바일/PC 반응형 검증.
- 디자인 토큰 일관성 확인.
- GitHub push 전 비밀키 점검.
- Vercel preview에서 e2e 1회 시연 후 main 머지.
