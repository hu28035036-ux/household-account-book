# AI 가계부

영수증 사진·카드/계좌 캡처·은행 거래내역 파일을 AI 로 분석해 거래 후보를 만들고,
사용자가 승인한 항목만 가계부에 저장하는 다중 사용자 PWA. 가족·룸메이트와
가계부를 함께 쓰는 모임, 카테고리별 예산 자동 합산, 월말 AI 회고 분석까지.

배포: <https://household-account-book-seven-phi.vercel.app>

## 스택
Next.js 14 (App Router) · TypeScript · Tailwind · Supabase (Auth/PostgreSQL/Storage, RLS) ·
OpenAI Vision (영수증 1차 분석) · Tesseract.js (보조) · PDF.js · xlsx + officecrypto-tool
(비번 걸린 XLSX) · `@ducanh2912/next-pwa` (Workbox) · Vercel

## 5단계 셋업 요약

> 자세한 내용은 [`docs/SETUP_GUIDE.md`](docs/SETUP_GUIDE.md). 절대 못 빠뜨리는 것만 짧게.

1. `npm install` → `npm run typecheck && npm test`
2. Supabase 프로젝트 생성(Region: **Seoul**) → `.env.local` 채우기 (`.env.example` 참고)
3. SQL Editor에서 `supabase/migrations/0001_init.sql`, `0002_storage_policies.sql` 적용 + **private 버킷 `receipts`** 생성
4. Auth → Redirect URLs에 `http://localhost:3000/auth/callback` 등록 → `npm run dev` → 매직링크 로그인
5. `OPENAI_API_KEY` 를 `.env.local` 에 채우기 (영수증 이미지 → OpenAI Vision 직접 분석) → `/upload` 로 e2e 1회

## 핵심 원칙
- AI는 후보만 만들고, **승인된 것만** transactions에 저장.
- 사용자별 RLS 격리. 카드/계좌/주민/전화/사업자번호 자동 마스킹.
- OCR 원문은 분석 후 **7일 자동 폐기**.
- 모든 사용자 소유 테이블은 `auth.uid() = user_id` 정책.

## 주요 화면

| 화면 | 경로 | 핵심 |
|---|---|---|
| 월 캘린더 | `/dashboard` | 일별 지출/수입 + 카테고리 색깔 점 + 카테고리 합산 기반 남은 예산 |
| AI 업로드 | `/upload` | 영수증 사진 (OpenAI Vision) · CSV/XLSX(비번 자동 풀이) |
| 분석 후보 | `/candidates` | 안전한 행 일괄 승인 · 중복 의심 일괄 거부 |
| 거래내역 | `/transactions` | 검색·필터·정렬·일괄 삭제 |
| 예산 | `/budgets` | 카테고리별 한도, 80% 경고 색, 카드 클릭 시 거래 펼침 |
| 카테고리 | `/categories` | 수입/지출/공통 + 색상 프리셋 (3열 grid) |
| 결제수단 | `/payment-methods` | 카드/계좌/현금/간편결제, 끝 4자리만 보관 |
| 고정 거래 | `/recurring` | 월급·구독료 자동 입력, 사전 N일 알림 |
| 통계 | `/stats` | 6개월 흐름 + 인사이트 + AI 자동 회고 |
| 모임 | `/households` | 가족·룸메이트와 가계부 공유, 헤더 컨텍스트 전환기 |
| 가이드 | `/guide` | 작성 요령 + 사용법 두 탭 |
| 설정 | `/settings` | CSV/XLSX/JSON 백업, 알림·테마·프로필·모임 |

헤더 우상단 ✨ 또는 `Ctrl+K` — 자연어 한 줄로 거래 추가/페이지 이동.

## 프로젝트 구조
```
src/
  app/(app)/      인증 영역 18개 페이지 + (app)/layout.tsx 가 AppShell 1회 wrap
  app/api/        REST API (transactions, candidates, ocr, upload, stats/ai-analysis, …)
  components/     UI (layout, common, calendar, candidates, upload, guide, assistant, …)
  services/       도메인 로직 (calendar, transactions, candidates, OCR, 학습, 분석)
  lib/            인프라 (supabase, ocr, openai, security, duplicate, learning, validators, …)
  tests/          unit / harness
public/guide/     작성 요령 SVG 9개 (01-purpose ~ 09-review)
public/guide/usage/  사용법 SVG 9개 (01-calendar ~ 09-export)
docs/             설계 문서 19+ 와 SETUP_GUIDE
supabase/         마이그레이션 SQL
```

## 문서
- [PROJECT_OVERVIEW](docs/PROJECT_OVERVIEW.md) · [ARCHITECTURE](docs/ARCHITECTURE.md) · [DATABASE_SCHEMA](docs/DATABASE_SCHEMA.md)
- [AI_EXTRACTION_FLOW](docs/AI_EXTRACTION_FLOW.md) · [OCR_FLOW](docs/OCR_FLOW.md) · [OLLAMA_GEMMA_FLOW](docs/OLLAMA_GEMMA_FLOW.md) · [LEARNING_DATA_FLOW](docs/LEARNING_DATA_FLOW.md)
- [SECURITY_PRIVACY_RULES](docs/SECURITY_PRIVACY_RULES.md) · [API_DESIGN](docs/API_DESIGN.md)
- [UI_UX_STRUCTURE](docs/UI_UX_STRUCTURE.md) · [DESIGN_SYSTEM](docs/DESIGN_SYSTEM.md) · [RESPONSIVE_DESIGN_PLAN](docs/RESPONSIVE_DESIGN_PLAN.md)
- [SUPABASE_SETUP](docs/SUPABASE_SETUP.md) · [GITHUB_VERSIONING_PLAN](docs/GITHUB_VERSIONING_PLAN.md) · [VERCEL_DEPLOYMENT_PLAN](docs/VERCEL_DEPLOYMENT_PLAN.md) · [LOCAL_AI_SERVER_PLAN](docs/LOCAL_AI_SERVER_PLAN.md)
- [TEST_HARNESS_PLAN](docs/TEST_HARNESS_PLAN.md) · [DEVELOPMENT_PHASES](docs/DEVELOPMENT_PHASES.md) · [KNOWN_RISKS](docs/KNOWN_RISKS.md)
- [IMPLEMENTATION_STATUS](docs/IMPLEMENTATION_STATUS.md) — Phase별 구현 상태
- [SETUP_GUIDE](docs/SETUP_GUIDE.md) — 사용자가 직접 해야 하는 14단계

## 최근 업데이트

| PR | 제목 | 핵심 |
|---|---|---|
| [#8](https://github.com/hu28035036-ux/household-account-book/pull/8) | UI 정돈 | 카테고리·결제수단 카드를 모바일/태블릿/PC 모두 3열 grid 로 통일. 분석 후보 "일괄 승인 (선택 필요)" 텍스트 단축 — 한 줄 유지. |
| [#7](https://github.com/hu28035036-ux/household-account-book/pull/7) | 사용법 SVG + PWA 캐시 안정화 | `/guide/usage/` 9개 SVG 추가 (월캘린더·OCR·import·후보·예산·고정·통계·모임·백업). PWA SW 가 4xx 응답을 30일 stale 로 캐시하던 사고 차단 (`cacheableResponse: { statuses: [0, 200] }`). 첫 실패 시 cache-busting query 로 1회 자동 retry. |
| [#6](https://github.com/hu28035036-ux/household-account-book/pull/6) | 가이드 탭 분리 | `/guide` 를 "작성 요령" + "사용법" 두 탭으로. 월캘린더 상단 전체 예산을 카테고리 합산 자동 계산. |
| [#5](https://github.com/hu28035036-ux/household-account-book/pull/5) | 캘린더 전체 예산 자동화 | 카테고리별 예산 합산 → 월 캘린더 "남은 예산" 자동 반영. 별도 전체 예산 입력 불필요. |
| #4 | 1차 배포 (incident-0014) | 첫 prod 배포 + 메타 영역 격리 룰 (C-14) 도입. |

OCR: 초기엔 Ollama gemma 로컬 LLM 이었으나, 안정성을 위해 OpenAI Vision 단독으로 전환됨
(commit `b974ee6`, `654889c`). Tesseract 는 텍스트 캡처(스크린샷)에만 보조 사용.

## 라이선스
TBD
