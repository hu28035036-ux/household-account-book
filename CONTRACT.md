# AI 가계부 — Contract

이 문서는 AI 가계부의 코드, 콘텐츠, 운영에 손대는 모든 사람과 AI 에이전트가 반드시 지켜야 하는 **절대 규칙**이다.
다른 모든 문서(AGENTS.md, docs/*)와 충돌하면 **이 문서가 항상 우선**한다.

위반은 **사용자 금융정보 노출 / 개인정보보호법·신용정보법 위반 / 서비스 신뢰 붕괴**로 직결된다.

- 최초 작성: 2026-05-08
- 마지막 갱신: 2026-05-08
- 도메인 분류: **금융 + 개인정보** (개인 가계부, 영수증/카드/계좌 데이터)

---

## 1. 도메인 안전 (최상위 절대선)

### 1-1. 금지 동작

- 카드/계좌/주민/사업자/전화 **원문 저장 금지** — 마지막 일부만 마스킹 저장
- AI에 보낼 텍스트는 **반드시 마스킹 후** 전송. 원문 OCR 그대로 외부 모델에 넘기지 않는다.
- AI가 만든 거래 후보를 **사용자 승인 없이 transactions 에 자동 insert 금지**
- 다른 사용자(또는 다른 household)의 거래/파일/학습데이터 **노출 금지**

### 1-2. AI 분석 책임 라인

- AI 출력은 **항상 후보(candidates)** 로 라벨링. UI에서 "AI 추정"임을 명시.
- 환각 검증 실패 / confidence 낮음 시 `requires_review` 플래그 + 경고 배지
- 학습 규칙은 **사용자별 격리**. `global_learning_rules` 에 PII 절대 금지 (가맹점 정규화 키워드 + 카테고리 정도만)

### 1-3. 위험 신호 처리

- raw_text 에 카드/계좌 번호로 의심되는 패턴이 마스킹 안 된 채 발견되면 → 저장 단계에서 서버가 한 번 더 마스킹 + 경고 로그
- AI가 사용자가 입력한 적 없는 카테고리/결제수단을 추정하면 → confidence 하향 + warning

---

## 2. 사용자 안전

### 2-1. 안전 분기 의무

- 자동 승인 모드는 **존재하지 않는다**. 일괄 승인은 사용자가 명시적으로 누른 경우만.
- 일괄 승인 시에도 `duplicate` / `requires_review` 후보는 **자동 제외**.
- AI 응답 파싱 실패 시 사용자에게 빈 후보 또는 부분 후보 + 명확한 에러 표시. 추측해서 채우지 않는다.

### 2-2. 상시 표시 정보

- AI 추정값에는 항상 "AI 추정" 라벨 + confidence
- 마스킹된 카드/계좌 표시는 **마지막 4자리 + 별표** 패턴 통일 (`****-****-****-1234`)

### 2-3. 자동 차단 조건

- AI 서버 다운 / 503 응답 → UI 배너 + 분석 버튼 비활성, **사용자 데이터로 임의 추정 금지**
- 환경변수 누락 (Supabase 키 등) → 서버 부팅은 통과시키되, 호출 시점에 명확한 500 에러. 디폴트 키 fallback 금지.

---

## 3. 데이터 보안 / 개인정보

### 3-1. 최소 수집 원칙

- 수집 항목: 이메일(매직링크), 닉네임(선택), 거래 입력값
- 마스킹 후만 저장: 카드 마지막 4자리, 계좌 마지막 4자리, 사업자 마지막 그룹, 전화 마지막 4자리
- **수집 금지**: 카드 전체 번호, 계좌 전체 번호, 주민등록번호, 비밀번호 평문, OCR 원문(7일 후 자동 폐기)

### 3-2. 권한 분리 (RLS)

- 모든 사용자 소유 테이블에 RLS on
- 정책: `auth.uid() = user_id` 인 행만 select/insert/update/delete
- household 공유 테이블은 select 만 멤버 공유, write 는 본인 소유로 제한
- **RLS 약화/제거 PR 은 단독 머지 금지** — CONTRACT 갱신 + 사용자 명시 승인 필요
- `service_role` key 는 `lib/supabase/admin.ts` **외부에서 참조 금지** (grep 점검 필수)

### 3-3. 시크릿 관리

- 코드/커밋 절대 포함 금지: `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `OLLAMA_API_TOKEN`, JWT secret
- 저장 위치: 로컬 `.env.local`, Vercel Environment Variables (그 둘만)
- 프론트 노출 허용: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon 키만)
- gitleaks pre-commit + GitHub Action 운영. 유출 감지 시 즉시 키 회전.

### 3-4. 로깅 규칙

- 평문 로그 금지: OCR 원문 전체, AI 응답 원문 전체, 카드/계좌/주민번호, 비밀번호
- AI 디버그 로그는 마스킹 후 짧은 보관기간 (개발 환경만)
- 운영 로그 식별자: user_id 직접 노출 대신 `hashed_user_id` 권장
- raw_text 자동 폐기: **7일** (cron `/api/admin/purge-raw-text`, 매일 18:00 KST)

---

## 4. 아키텍처 (타협 불가)

### 4-1. 핵심 구조 원칙

- **Next.js App Router + Supabase + Vercel `icn1` 리전** (Seoul). 변경 시 전체 재설계.
- 클라이언트는 anon key 만. 모든 민감 작업은 Route Handler 경유.
- OCR 은 클라이언트(Tesseract.js) 또는 서버(OpenAI Vision). 둘 다 결과는 마스킹 후 저장.
- AI 추출은 **후보 → 승인 → transactions** 단방향. 역방향 자동 흐름 금지.

### 4-2. 영역별 불변 조건

- `lib/supabase/admin.ts` 외부에서 service_role 참조 금지
- `lib/security/masking.ts` 가 마스킹 단일 진실. 다른 곳에서 정규식 직접 작성 금지.
- 모든 사용자 입력은 **서버측에서 zod 1차 검증** 후 DB 저장
- `dangerouslySetInnerHTML` 금지 (sanitize-html 통과한 경우만 예외)

---

## 5. 워크플로우 존중

### 5-1. 사용자 워크플로우 제약

- 모바일 우선 (영수증 카메라 업로드 흐름)
- 후보 승인 페이지는 모바일에서 sticky bottom 일괄 승인 바 (BottomNav 위 56px)
- PWA 설치 시 정상 동작해야 함 (오프라인 fallback은 best-effort)

### 5-2. 최종 책임 명시

- AI 자동 제안은 모두 "참고용" 라벨
- 최종 결정 주체: **로그인한 사용자**. household 공유라도 거래 만든이만 수정/삭제.
- 자동 제안을 결정으로 위장하는 UI 금지 (자동 체크박스, 자동 카운트다운 승인 등)

---

## 6. 법적 / 윤리 가드레일

### 6-1. 적용 법규

- **개인정보보호법** (한국)
- **신용정보의 이용 및 보호에 관한 법률** (카드/계좌 데이터 취급)
- 자체 OCR + 자체 분석으로 운영 → 외부 신용평가/금융기관 연동 시 별도 가이드 필수

### 6-2. 사용자 동의

- 회원가입 시 **개인정보 처리 동의 + AI 분석 동의** 체크박스 (마이그레이션 0016 적용)
- 기존 사용자도 미동의 시 AI 게이트로 차단 → 동의 후 사용
- 미성년자 가입은 별도 절차 필요 (현재는 성인만, 가입 폼에 명시)

### 6-3. 외부 관계

- OCR/Vision API 제공자에게 보내는 데이터는 **마스킹 후**, 약관상 학습 사용 옵트아웃 확인
- 백업/내보내기 파일에는 마스킹 상태 그대로 포함 (원문 복원 불가)

---

## 7. 코드 품질

### 7-1. 타입/정적 분석

- TypeScript `strict` 활성. `any` 사용 시 주석으로 사유 명시.
- ESLint 통과 필수 (next lint).

### 7-2. 에러 처리

- 사용자 노출 메시지: 한국어, 친화적, 원시 메시지 노출 금지
- 모든 API Route 는 `try/catch` 로 감싸 production 500 표면 노출 차단 (commit `99f25a5` 기준)
- 환경변수 누락 시: 부팅은 통과, 호출 시점에 명확한 에러

### 7-3. 도메인 상수

- 임계값(7일 폐기, confidence 임계, 일괄 승인 한도 등)은 매직 넘버 금지 — 명명된 상수
- 변경 이력 주석 또는 commit 메시지에 사유 기록

---

## 8. 개발 프로세스

### 8-1. 커밋 / PR

- 메시지 형식: `<영역>(<범위>): <변경>` (예: `feat(ocr): OpenAI Vision 통합`)
- 영역 키워드: `feat`, `fix`, `ui`, `stab`, `refactor`, `docs`, `test`, `chore`
- 도메인 콘텐츠(카테고리 시드, 마스킹 규칙) 변경은 별도 PR + 사용자 승인

### 8-2. 마이그레이션

- `supabase/migrations/000X_<이름>.sql` 순차 번호. down 파일 함께 작성.
- 수동 SQL 변경 금지 — 마이그레이션 파일로만.
- RLS 정책 변경 시 `scripts/audit-rls.mjs` 통과 필수.

### 8-3. 배포 전 체크리스트

- [ ] `npm run verify` 통과 (typecheck + test + build)
- [ ] `npm run smoke:all` 통과
- [ ] 새 환경변수 Vercel 등록
- [ ] 새 마이그레이션 Supabase 프로젝트에 적용
- [ ] gitleaks 스캔 통과
- [ ] 콘솔 에러 0

### 8-4. 롤백

- 목표 시간: 5분 이내
- Vercel: 이전 배포 promote
- DB: down 마이그레이션 또는 backward-compat 스키마 (가능한 한 backward-compat 우선 설계)

---

## 9-B. 메타 작업 격리 원칙 (현재 기능 무수정)

**최상위 운영 원칙 — 사용자 명시 명령 (2026-05-08)**:
> 절대 현재 기능에서 기능 이상이 발생하면 안 된다.

본 시스템의 *메타 작업* (harness, rag, docs/design-log, docs/AGENT_BEHAVIOR, docs/execute-plans, .claude/agents, AGENTS, CONTRACT 보강) 은 가계부 *본 기능 영역* 에 영향을 주면 안 된다.

### 9-B-1. 본 기능 영역 (메타 작업이 절대 건드리지 않는 곳)

코드 단일 진실: [`harness/lib/protected-paths.mjs`](./harness/lib/protected-paths.mjs).
사람용 요약 (이 목록은 위 파일과 동기화 — 코드가 진실, 본 표는 참고):

```
src/
supabase/
public/
e2e/
samples/
scripts/                 (이 영역은 ai-extraction / collab-security / qa-harness 영역 작업에서만 변경)
package.json
package-lock.json
next.config.mjs
vercel.json
tsconfig.json
tailwind.config.ts
postcss.config.js
playwright.config.ts
vitest.config.ts
next-env.d.ts
```

자동 재생성 파일 (`tsconfig.tsbuildinfo`) 은 tsc 가 매번 갱신하므로 게이트에서 의도적 제외.
이 목록 안 파일을 메타 작업 도중 변경한 게 발견되면 **즉시 incident 기록 + 롤백**.

### 9-B-2. 메타 작업이 손대도 되는 영역

```
.claude/agents/**
AGENTS.md
CONTRACT.md
docs/AGENT_BEHAVIOR.md
docs/design-log/**
docs/execute-plans/**
harness/**
rag/**
```

이 외 docs/ 하위 (기존 30개 설계 문서) 는 *읽기만* — 변경은 영역 에이전트 작업 영역.

### 9-B-3. 본 기능 회귀 검증 의무

메타 작업 종료 시:
- `git diff --stat HEAD -- <본 기능 영역>` 결과가 **비어있어야** 한다
- 영역 외 변경 발견 시 본 작업을 종료하지 않는다 — incident 기록 후 롤백 또는 사용자 결정 요청
- self-test 가 본 회귀 검사 자동화 (`harness/test/cases/meta-isolation.mjs`)

### 9-B-4. 본 기능 영역 변경이 *필요해지면*

영역 에이전트 (ai-extraction / finance-core / collab-security / ux-design / qa-harness) 의 명시 작업 + Sentinel 사전 게이트 + Verifier 사후 게이트 + loop-validator 5회 안정성 통과 후만.
메타 에이전트 (conductor / orchestrator / sentinel / verifier / loop-validator / curator) 는 본 기능 영역 직접 수정 절대 금지.

**브랜치 컨벤션 (자동 모드 전환)**:
- `meta/...` (또는 prefix 없음) → 메타 작업. meta-isolation 게이트 strict (변경 시 fail).
- `ai-extraction/...` / `finance-core/...` / `collab-security/...` / `ux-design/...` / `qa-harness/...` → 영역 작업. 게이트는 *informational* — diff 를 보고만 하고 차단 안 함.

게이트의 상세 동작은 [`harness/test/cases/meta-isolation.mjs`](./harness/test/cases/meta-isolation.mjs) 의 `AREA_PREFIXES` 와 `isAreaBranch()`.

### 9-B-5. 본 원칙 위반 시

CONTRACT §9-A-3 *"검증 없는 종료"* 와 동격으로 처리. 즉시:
1. 변경된 본 기능 파일 git checkout 으로 롤백
2. `harness/runbook.md` 에 incident 기록 (사용자 영향 / 발견자 / 어떻게 새는지)
3. Sentinel 의 점검 카탈로그에 같은 경로 진입 차단 룰 추가

---

## 9-A. 에이전트 사용 시 반드시 피해야 할 4가지 패턴

출처: [`harness/references/하네스엔지니어링-요약.md`](./harness/references/하네스엔지니어링-요약.md) §8 (이정민, GDG Build with AI).
가계부의 모든 에이전트는 이 4가지를 위반하지 않는다.

### 9-A-1. 추상적 코드 작성 줄이기
- 과한 추상화 금지 — `useEffect` 안에 또 다른 `useEffect`, 5단 이상의 HOC 합성, 제너릭 안의 제너릭
- "혹시 모를 경우"용 옵션·플래그를 미리 추가하지 않는다 — 실제 케이스가 등장한 시점에 추가
- 한 함수가 3가지 이상의 책임을 갖지 않는다 (단순 얕은 추상이 깊은 추상보다 낫다)

### 9-A-2. 불확실한 fallback 금지
- 실패는 **이유를 설명**한다. 어물쩍 빈 결과 / 디폴트 값으로 넘기지 않는다.
- 환경변수 누락, AI 서버 다운, 인증 실패는 **명확한 에러 + 사용자 친화 메시지**. 임의 추정으로 후보 생성 금지(§1-3과 일치).
- `try { ... } catch { return [] }` 같은 침묵 fallback 금지. 최소한 hashed 식별자로 로그 + 사용자 메시지 노출.

### 9-A-3. 검증 없는 종료 막기
- 모든 AI 추출 결과는 **사용자 승인 게이트** 통과 (§2-1)
- 본인 영역 변경 후에는 영역별 verify(typecheck + 본인 테스트 + 관련 smoke) 통과해야 종료
- 하네스 케이스를 **줄이지 않는다** (회귀 그물망은 단방향 누적)

### 9-A-4. 기능 경계 명확히
- 각 에이전트의 [`.claude/agents/<name>.md`](./.claude/agents/) `Scope` / `Forbidden` 이 진실이다 — 무단 확장 금지
- 다른 영역 파일을 건드려야 하면 **그 영역 에이전트에게 위임**. 본인이 빠르게 수정하는 일관성 위반보다, 위임이 항상 안전.
- 사용자 승인 지점(§5-2): AI 후보 → 거래 transactions, RLS 정책 변경, 시크릿/마이그레이션, 모델 교체

---

## 9. 재점검 주기

- 매 분기 첫 월요일 — CONTRACT 전체 재점검
- 사용자 100명 / 1000명 도달 시 — 리전/스케일/감사 라인 재검토
- 사고/이벤트 발생 시 — 즉시 재점검 + 재발 방지 조항 추가
- 모델 업그레이드 시 — 프롬프트/파싱 호환 확인

---

## 위반 시

- 본 계약을 위반한 상태의 코드는 **프로덕션 배포 불가 / 즉시 롤백**
- 재발 방지 조치를 본 문서에 영구화
- 사용자 데이터에 도달한 사고는 **개인정보 유출 통보 절차** (개인정보보호법 §34) 에 따라 처리
