# AI 가계부

영수증·카드/계좌 캡처를 OCR + 로컬 LLM(Ollama gemma4:e4b)으로 분석해 거래 후보를 만들고, 사용자가 승인한 항목만 가계부에 저장하는 다중 사용자 웹앱.

## 스택
Next.js (App Router) · TypeScript · Tailwind · Supabase (Auth/PostgreSQL/Storage, RLS) · Tesseract.js · Ollama gemma4:e4b · Vercel

## 5단계 셋업 요약

> 자세한 내용은 [`docs/SETUP_GUIDE.md`](docs/SETUP_GUIDE.md). 절대 못 빠뜨리는 것만 짧게.

1. `npm install` → `npm run typecheck && npm test`
2. Supabase 프로젝트 생성(Region: **Seoul**) → `.env.local` 채우기 (`.env.example` 참고)
3. SQL Editor에서 `supabase/migrations/0001_init.sql`, `0002_storage_policies.sql` 적용 + **private 버킷 `receipts`** 생성
4. Auth → Redirect URLs에 `http://localhost:3000/auth/callback` 등록 → `npm run dev` → 매직링크 로그인
5. Ollama 설치 + `ollama pull gemma4:e4b` → `/settings`에서 "AI 서버 연결됨" 확인 → `/upload`로 e2e 1회

## 핵심 원칙
- AI는 후보만 만들고, **승인된 것만** transactions에 저장.
- 사용자별 RLS 격리. 카드/계좌/주민/전화/사업자번호 자동 마스킹.
- OCR 원문은 분석 후 **7일 자동 폐기**.
- 모든 사용자 소유 테이블은 `auth.uid() = user_id` 정책.

## 프로젝트 구조
```
src/
  app/            App Router 라우트 + API (route.ts)
  components/     UI (layout, common, transactions, candidates, upload, files, settings, charts)
  services/       도메인 로직(거래/후보/OCR/추출/학습/분석)
  lib/            인프라(supabase, ocr, ollama, ai, security, duplicate, learning, formatting, validators, http, utils)
  tests/          unit / harness
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

## 라이선스
TBD
