# PITFALLS — 반복하지 않을 실수 모음

이 문서는 본 프로젝트를 진행하면서 **실제로 한 번 발생했던 실수**와 그 해결책을 모은 운영 가이드입니다.
새 작업을 시작하기 전, 또는 빌드/배포가 막히면 우선 이 문서를 훑어보세요.

각 항목 형식:
- **증상** — 무엇이 잘못됐나
- **원인** — 근본 원인
- **해결** — 다시 일어나지 않게 하는 방법
- **검증** — OK 상태를 어떻게 확인하나

---

## 1. Next.js App Router

### 1.1 `useSearchParams()` + 'use client' page.tsx → 정적 prerender 실패
- **증상**: Vercel build에서
  ```
  useSearchParams() should be wrapped in a suspense boundary at page "/login"
  Export encountered errors on following paths
  ```
- **원인**: page.tsx 자체가 `'use client'`이고 `useSearchParams()`를 직접 호출하면 빌드 시점에 정적 페이지로 만들 수 없는데도 force-dynamic 표시도 없어 빌드가 막힘.
- **해결**:
  1. `page.tsx`는 Server Component로 유지(`'use client'` 제거).
  2. `useSearchParams`를 쓰는 부분만 별도 `*.Client.tsx`로 분리.
  3. `page.tsx`에서 `<Suspense fallback={...}><FooClient /></Suspense>`로 감쌈.
  4. **`dynamic = "force-dynamic"`로 우회 금지**, **`next.config`로 오류 끄지 말 것.**
- **검증**:
  - `npm run build` 출력에서 해당 라우트가 `○ (Static)` 또는 `ƒ (Dynamic)` 둘 중 하나로 표시되고 에러 없음.
  - 새 라우트 추가 시 `Get-ChildItem -Recurse -Include *.tsx,*.ts | Select-String "useSearchParams"`로 위반 없는지 확인.

### 1.2 Provider를 Server Component에서 직접 쓰려는 시도
- **증상**: "You're importing a component that needs `useState`. It only works in a Client Component"
- **해결**: Provider 자체는 `'use client'`로 만들고, Server Component 안에서 `<ClientProvider>{children}</ClientProvider>` 형태로 감싸 children에는 Server Component를 그대로 넣을 수 있다.
- **검증**: `AppShell.tsx`(Server) → `ActiveHouseholdProvider`(Client) → `<Sidebar/>·<Header/>·{children}` 구조가 정상.

### 1.3 라우트 추가했는데 보호되지 않음
- **증상**: 미로그인 상태로 새 라우트가 그대로 노출.
- **원인**: `src/middleware.ts`의 `PROTECTED_PREFIXES` 갱신 누락.
- **해결**: 새 보호 라우트는 다음 4곳을 동시에 갱신:
  1. `src/middleware.ts` `PROTECTED_PREFIXES`
  2. `src/components/layout/Sidebar.tsx` NAV
  3. (모바일 메인이면) `BottomNav.tsx`
  4. `e2e/smoke.spec.ts`의 `PROTECTED_PATHS`
- **검증**: e2e smoke의 "보호 라우트는 미로그인 시 /login 으로 보냄" 테스트가 그 라우트도 포함하는지.

---

## 2. Vercel / 배포

### 2.1 함수 실행시간 / 페이로드 한계 (Hobby)
- **한계**: 함수 ~10s, 페이로드 ~4.5MB.
- **위험 작업**: OCR/AI 분석을 서버에서 직접 실행하면 타임아웃 가능.
- **해결**: OCR은 **클라이언트 측 Tesseract.js**, AI는 **외부 Ollama 서버** 호출 + `maxDuration = 60`.
  업로드도 8MB cap을 두고 거부.
- **검증**: 라우트 코드에 `export const maxDuration = 60` 표기, 업로드 라우트의 MAX_BYTES 상수.

### 2.2 Vercel Cron 인증 헤더 불일치
- **증상**: Vercel Cron으로 호출하는데 `x-cron-token` 검증에서 401.
- **원인**: Vercel Cron은 `x-vercel-cron` 헤더만 자동으로 붙임. 우리 코드는 `x-cron-token` 사용.
- **해결**: 라우트에서 둘 중 하나만 통과해도 OK가 되도록 OR 검증.
  ```ts
  if (req.headers.get('x-vercel-cron')) return true;
  if (token === process.env.CRON_TOKEN) return true;
  ```
- **검증**: `/api/admin/purge-raw-text`의 `isAuthorized` 함수 형태.

### 2.3 환경변수 누락으로 build 실패
- **증상**: `NEXT_PUBLIC_SUPABASE_URL` 등이 없으면 dev/build에서 죽음.
- **해결**:
  - 로컬 `.env.local` 사용. `.env.example`로 항상 필요한 키 목록을 동기화.
  - 빌드 검증 시 dummy 값 주입:
    ```bash
    NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy \
    SUPABASE_SERVICE_ROLE_KEY=dummy \
    OLLAMA_API_BASE_URL=http://localhost:11434 \
    OLLAMA_MODEL=gemma4:e4b \
    npm run build
    ```
  - CI 워크플로의 build job env에도 같은 dummy.

---

## 3. Supabase / RLS / 마이그레이션

### 3.1 service role key 노출
- **위험**: 클라이언트 번들에 들어가면 RLS가 무력화됨.
- **해결**:
  - `lib/supabase/admin.ts`에서만 `SUPABASE_SERVICE_ROLE_KEY` 참조.
  - 변수명에 `NEXT_PUBLIC_` 절대 붙이지 말 것.
  - 빌드 산출물에 키 노출 안 됐는지 grep:
    ```bash
    grep -r "SUPABASE_SERVICE_ROLE_KEY" .next/static || echo "ok"
    ```

### 3.2 RLS 정책 변경 시 기존 정책 drop 잊음
- **증상**: 마이그레이션 재적용 시 정책 충돌 / 정책이 두 번 걸려 OR 의미 변형.
- **해결**: 항상 `drop policy if exists ... on TABLE;`을 `create policy` 앞에 두기.
- **검증**: 마이그레이션 SQL 파일에 `drop policy if exists`가 모든 정책마다 짝으로 있는지.

### 3.3 멱등성 없는 마이그레이션
- **위험**: 두 번 적용하면 실패.
- **해결**: `create table if not exists`, `create index if not exists`, `add column if not exists`, `drop policy if exists` 사용. DO 블록에서도 마찬가지.

### 3.4 NULL 컬럼에 대한 unique
- **증상**: `unique(user_id, category_id, month_start)` 인덱스에서 category_id가 NULL인 행은 unique가 안 걸림(Postgres 기본).
- **해결**: **partial unique index**로 분리:
  ```sql
  create unique index ... on T(user_id, category_id, month_start) where category_id is not null;
  create unique index ... on T(user_id, month_start)              where category_id is null;
  ```

### 3.5 가족 공유 RLS 변경 시 read만 풀고 write는 그대로
- **원칙**: write 정책을 멤버에 풀지 말 것. 본인 row만 수정/삭제.
- **이유**: 가족이 임의로 다른 멤버 거래를 손대면 데이터 무결성 깨짐.

---

## 4. Build / Deploy 사전 검증

### 4.1 의존성 추가만 하고 install 안 함
- **증상**: `package.json`에 라이브러리 추가했지만 빌드에서 `Module not found`.
- **해결**: 새 의존성 추가 시 즉시 `npm install` 실행. 자동화하려면 PR 시 CI가 `npm ci`로 잡아냄.

### 4.2 `npm run build` 검증 없이 push
- **증상**: GitHub Actions / Vercel에서 빨간 빌드.
- **해결**: 새 라우트/큰 변경 후에는 로컬에서 빌드 1회. 시간 들지만 안전.
- **CI**: `.github/workflows/ci.yml`의 `build` job이 dummy env로 자동 검증.

### 4.3 PowerShell의 npm.ps1 실행 차단
- **증상**: `npm : File ... npm.ps1 cannot be loaded because running scripts is disabled`
- **해결**: PowerShell 스크립트 정책 영향. Bash 도구로 `npm.cmd run build`를 호출하거나 `Set-ExecutionPolicy`(사용자 권한). Claude는 Bash로 우회.

---

## 5. Git / 보안

### 5.1 `.env*` 커밋 위험
- **검증 절차** (push 전):
  ```bash
  git diff --cached --name-only | grep -E "(^|/)\.env(\.|$)|service.role|service_role|\.pem$" || echo "ok"
  ```
- **사고 시**: 키를 즉시 회전(Supabase Reset) → BFG로 히스토리 정리 → force-push.

### 5.2 런타임 로그 노이즈
- **증상**: `.bkit/audit/*.jsonl`, `.bkit/runtime/*.ndjson`이 매 세션 변경되어 `git status`가 시끄러움.
- **해결**: `.gitignore`에 `.bkit/audit/`, `.bkit/runtime/` 추가. 이미 추적된 파일은 `git rm --cached`.

### 5.3 CRLF 경고
- Windows에서 LF→CRLF 자동 변환 경고는 **무시 가능**(autocrlf 기본 동작). 일관성을 강제하려면 `.gitattributes`로 `* text=auto eol=lf` 또는 `eol=crlf` 통일.

### 5.4 force-push to main
- **금지**. 항상 PR 또는 별도 브랜치에서 정리.

---

## 6. Tool / 작업 진행 메모 (LLM 자체)

### 6.1 Edit 전에 Read 선행
- **증상**: `tool_use_error: File has not been read yet. Read it first before writing to it.`
- **원인**: Edit/Write로 기존 파일을 덮으려면 같은 세션에서 Read 한 적이 있어야 함. 응답이 길어지면 컨텍스트가 갱신돼 다시 Read 필요해질 수 있음.
- **해결**:
  - 큰 통째 변경은 Write 한 번이 안전(단, 같은 응답에서 직전 Read 필요).
  - 작은 변경은 Read → Edit 페어로 처리.
  - 같은 응답에서 같은 파일을 여러 번 Edit할 때 첫 Edit이 성공하면 후속 Edit도 가능.

### 6.2 Edit `replace_all` 미사용
- **증상**: 동일 문자열이 여러 곳에 있는데 unique 매치 실패.
- **해결**: 명시적으로 `replace_all: true` 또는 더 큰 컨텍스트(주변 5~10줄 포함)로 unique 만들기.

### 6.3 응답 폭주
- **증상**: 한 응답에서 30+ 도구 호출 + 긴 텍스트 → 응답이 끊기거나 context 폭증.
- **해결**: Phase를 단계로 쪼개기. 한 응답에 새 파일 ~20개 / 변경 ~30 라인 구간으로 자르기.

### 6.4 destructive 작업은 사용자 확인
- 자동 모드여도 git force-push, DB 데이터 삭제, 외부 계정 생성은 멈추고 사용자 확인.
- 코드 수정·새 파일·로컬 빌드는 자율 허용.

---

## 7. UI / UX

### 7.1 모바일 터치 영역 < 44px
- **해결**: 버튼/입력 height ≥ 44px (`h-11` 이상).
- **검증**: e2e responsive 테스트가 자동 검증.

### 7.2 가로 스크롤 발생
- **검증**: e2e가 `documentElement.scrollWidth ≤ clientWidth + 1` 확인.
- **자주 원인**: 긴 텍스트 truncate 누락, 표 컬럼 wide.
- **해결**: 모바일은 표 대신 카드 리스트로 전환.

### 7.3 색상만으로 상태 구분
- **금지**: 색상만으로는 색약 사용자가 구분 못 함.
- **해결**: 배지 텍스트 + 색상 동반 (`Badge tone="..."` 컴포넌트).

### 7.4 Sidebar(md+) ↔ BottomNav(sm) 둘 다 노출
- **해결**: Sidebar는 `hidden md:flex`, BottomNav는 `md:hidden`. 어긋나면 둘 다 보임 또는 둘 다 안 보임.

---

## 8. 보안 / 마스킹

### 8.1 raw_text 그대로 로깅
- **금지**: OCR 원문을 디버그 로그에 평문으로 남기지 말 것.
- **해결**: `lib/security/masking.ts`의 `maskAll`을 모든 외부 출력 경로에서 통과시킨다.

### 8.2 카드/계좌번호 전체 입력 받음
- **금지**: 결제수단 등록에서 전체 번호 입력란 제공.
- **해결**: 마지막 4자리만 받도록 `maxLength=4` + zod 정규식 강제. 서버 service에서 `****-****-****-XXXX` 형태로 마스킹 저장.

### 8.3 AI 요청에 학습 힌트로 PII 흘림
- **금지**: 가맹점 원문, 메모 원문을 전부 프롬프트에 주입.
- **해결**: 정규화된 키워드 상위 N개만 마스킹된 형태로 제공.

---

## 9. Korean 처리

### 9.1 CSV EUC-KR 인코딩 깨짐
- **해결**: UTF-8로 읽고 replacement char가 많으면 EUC-KR로 재시도(`parsers.ts`의 `readAsText`).

### 9.2 한국어 날짜 포맷
- **해결**: `lib/import/normalize.ts`의 `parseDate`가 `2026.05.05`, `2026/5/5`, `2026년 5월 5일`, ISO 모두 지원.

### 9.3 시간대 (KST/UTC 혼재)
- **원칙**: DB는 UTC(`timestamptz`), 표시는 KST(`Intl.DateTimeFormat({ timeZone: 'Asia/Seoul' })`). 월 경계 집계도 KST로.
- **검증**: `monthRangeKST(ym)` 헬퍼만 사용.

### 9.4 CSV 한글 export
- **해결**: UTF-8 BOM 추가(`﻿`) → 엑셀에서 깨지지 않음.

---

## 10. 테스트

### 10.1 인증 e2e의 메일 의존성
- **금지**: 실제 메일을 받아 매직링크 클릭하는 e2e.
- **해결**: admin client `generateLink({ type: 'magiclink' })`로 직링크 생성 → 콜백 호출.

### 10.2 e2e가 production DB로 도는 사고
- **금지**: prod env로 e2e 실행.
- **해결**: dev/staging 프로젝트 분리. `E2E_BASE_URL`로 명시적 분리.

---

## 11. 운영 체크리스트 (배포 / 데이터 변경 시)

- [ ] 새 라우트 → middleware/Sidebar/BottomNav/e2e 4곳 갱신
- [ ] `useSearchParams` 새로 사용 → Suspense + Client 분리
- [ ] 새 의존성 → `npm install` 실행 + CI 통과
- [ ] DB 변경 → 멱등 마이그레이션 + RLS 정책 + down 스크립트
- [ ] 마이그레이션 적용 필요 → `IMPLEMENTATION_STATUS.md`와 응답에 명시
- [ ] `npm run build` 로컬 검증
- [ ] `git status`로 `.env*` 안 들어갔는지
- [ ] 비밀 grep 검사
- [ ] e2e smoke + responsive 통과
- [ ] 모바일 360 / 데스크톱 1280 직접 확인

---

## 추가 발견 시 갱신 규칙

새로운 실수가 발생하면:
1. 위 섹션 중 적합한 곳에 **증상/원인/해결/검증** 4구조로 추가.
2. 실수가 일어난 커밋 SHA를 본문에 짧게 인용.
3. 가능하면 `tests/` 또는 `e2e/`에 회귀 테스트 추가.
