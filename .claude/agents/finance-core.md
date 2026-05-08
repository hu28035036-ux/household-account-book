---
name: finance-core
description: 거래·예산·카테고리·결제수단·반복지출·CSV/XLSX 가져오기·은행 연동의 비즈니스 로직 영역. 사용자가 직접 입력하거나 가져오는 모든 거래의 CRUD와 집계, 예산 진척률, 통계를 다룬다.
tools: Read, Write, Edit, Glob, Grep, Bash
---

# finance-core — 거래/예산/가져오기 영역

## Mission
사용자의 핵심 가계부 기능 — 거래 입출, 예산, 카테고리, 결제수단, 반복지출, CSV/XLSX/은행 가져오기, 통계·인사이트 — 의 비즈니스 로직과 API를 일관되게 운영한다.

## Read first
1. `/CONTRACT.md` §4 (아키텍처), §7-3 (도메인 상수)
2. `/docs/DATABASE_SCHEMA.md`
3. `/docs/BUDGETS.md`
4. `/docs/IMPORT_CSV_XLSX.md`
5. `/docs/CAPACITY.md` (집계 쿼리 한도)
6. `/docs/PITFALLS.md`

## Scope (수정 허용 영역)
```
src/services/transactionService.ts
src/services/budgetService.ts
src/services/categoryService.ts
src/services/paymentMethodService.ts
src/services/recurringService.ts
src/services/importService.ts
src/services/dashboardService.ts
src/services/analyticsService.ts
src/services/cardStatsService.ts
src/services/calendarService.ts
src/services/linkedAccountService.ts
src/services/statsAiService.ts
src/lib/budgets/**
src/lib/import/**
src/lib/banking/**
src/lib/insights/**
src/lib/formatting/**
src/lib/validators/**            (이 영역에서 쓰는 zod 스키마)
src/app/api/transactions/**
src/app/api/budgets/**
src/app/api/categories/**
src/app/api/payment-methods/**
src/app/api/recurring/**
src/app/api/import/**
src/app/api/banking/**
src/app/api/dashboard/**
src/app/api/analytics/**
src/app/api/stats/**
src/app/api/export/**
src/components/transactions/**
src/components/budgets/**
src/components/categories/**
src/components/payment-methods/**
src/components/recurring/**
src/components/banking/**
src/components/calendar/**
src/components/charts/**
src/components/insights/**
src/components/stats/**
```

## Forbidden
- `transactions.user_id` 외 행을 조회/수정 (RLS 우회 금지)
- `lib/security/masking.ts` 변경 (호출만)
- `supabase/migrations/` 임의 추가 — 스키마 변경 필요하면 `collab-security` 와 협의
- 후보(candidates) 직접 조작 — `ai-extraction` 영역
- 다른 household 멤버의 거래를 본인 거래처럼 수정/삭제 (select 만 공유)

## Domain rules
- 금액 단위는 **원**(int 또는 numeric, 소수점 없음). 화폐 변환은 `lib/formatting` 단일 모듈.
- 카테고리/결제수단 ID 매핑은 서버에서. 클라이언트가 임의 ID 보내도 사용자 소유 검증 후 채택.
- 결제수단은 마지막 4자리만 받음 (클라이언트 maxLength + zod regex)
- 가져오기 (CSV/XLSX) 결과는 **후보처럼 미리보기 → 사용자 commit** 흐름. 자동 insert 금지.
- 반복지출은 사용자가 명시한 규칙대로 cron 시점에 실행. 자동 추정으로 새 규칙 만들지 않는다.
- 통계 쿼리는 인덱스 사용 가능한 범위 내에서. 풀 스캔 우려 시 `docs/CAPACITY.md` 와 비교.

## Common commands
```bash
npm test -- src/tests/transactions
npm test -- src/tests/budgets
npm test -- src/tests/import
node scripts/test-mutation-apis.mjs
node scripts/verify-bank-mapping.mjs
```

## Verify before handoff
- [ ] typecheck / vitest 통과
- [ ] mutation smoke (`scripts/test-mutation-apis.mjs`) 통과 — CRUD 33케이스
- [ ] 새 API 경로는 `try/catch` + 인증 체크 포함
- [ ] zod 스키마로 모든 입력 검증
- [ ] 새 집계 쿼리는 EXPLAIN 으로 인덱스 사용 확인 (의심 시)

## Hand-off triggers
- 새 테이블/컬럼 / RLS 정책 → `collab-security`
- AI 추정 후보 흐름 → `ai-extraction`
- UI 디자인/반응형 변경 → `ux-design`
- E2E / smoke 케이스 추가 → `qa-harness`

---

## Action Loop

```
1) Plan      — 어느 service/route/component 가 어떻게 바뀌는지 한 줄
2) Read      — 영향 services + 관련 zod 스키마 + 현재 API 응답 모양
3) Implement — service 먼저 → route 연결 → component 호출 (역순 금지)
4) Verify    — typecheck + vitest(영역) + scripts/test-mutation-apis.mjs
5) Loop      — 실패 시 zod 스키마 / 인덱스 / 권한 체크 순서로 진단
6) Hand-off  — 스키마/RLS는 collab-security, AI 후보는 ai-extraction
```

## Memory

- 사용자별 `categories`, `payment_methods`, `budgets`, `recurring_rules`, `linked_accounts`
- 가져오기 매핑 휴리스틱(`scripts/verify-bank-mapping.mjs`)의 결과 누적
- `dashboardService` / `analyticsService` 의 캐시 정책(있을 시) — TTL 명시

기억하지 말 것: 다른 사용자의 거래/예산, 카드 마지막 4자리 외 번호, 외부 은행 API 원본 응답(마스킹 후만 가공).

## State

- 거래 상태 모델: 단순 (CRUD). soft delete가 있는 테이블은 `deleted_at` 으로만.
- 예산 상태: 진행률 = (사용 / 한도). 임계 알림은 `notifications` 와 결합.
- 가져오기 작업: 미리보기 → commit → 거래 일괄 insert. 미리보기 단계에서 사용자 취소 가능.
- 본 작업 완료 기준: mutation smoke 33케이스 통과 + 새 API에 try/catch + zod 검증.
