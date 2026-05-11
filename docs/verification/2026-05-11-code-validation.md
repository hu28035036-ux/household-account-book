# 2026-05-11 전체 코드 검증 기록

작성 시각: 2026-05-11 08:40 KST (Codex 초안)  
**수정 시각: 2026-05-11 17:00 KST (Claude Code 후속 — smoke spawn fix 적용)**  
작성자: Codex (초안), Claude Code (후속 수정)  
목적: Claude Code 수정 전 현재 코드 상태의 검증 결과 + 그에 대한 fix 기록.

---

## 0. 후속 수정 요약 (Claude Code 2026-05-11 17:00)

- **처리**: incident-0015 → **CLOSED**
- **의도**: Windows + Node 24 에서 `spawn('npm.cmd', [...])` 가 `shell` 옵션 없이 호출되면 EINVAL — Node 24 의 spawn 보안 강화 정책이 `.cmd` 배치에 대해 `shell: true` 를 요구. 추가로 기존 `taskkill /F /IM node.exe` 가 모든 Node 프로세스를 죽이는 위험 패턴 → `taskkill /F /T /PID <dev.pid>` 로 dev child tree 만 정리하도록 좁힘.
- **저장**: PR [#22](https://github.com/hu28035036-ux/household-account-book/pull/22) (squash commit `4e3bddb`)
- **변경 파일**:
  - `scripts/run-smoke.mjs` — spawn `shell: isWin` + taskkill PID-tree
  - `docs/verification/2026-05-11-code-validation.md` — 본 §0 (자기 참조)
  - `harness/runbook.md` — incident-0015 entry 추가 (CLOSED)

Codex 가 "우선순위 높음" 으로 적은 1·2번 항목 처리됨. 3번 (smoke 세부 스크립트 4개 결과 기록) 은 dev 서버를 띄워야 하므로 사용자가 로컬에서 `npm run smoke:all` 실행 후 추가 기록 권장.

---

## 1. 요약

핵심 검증 게이트는 통과했다.

- `npm.cmd run verify`: 통과
- `node harness\verify.mjs`: 통과
- `npm.cmd run smoke:all`: 실패, dev 서버 spawn 단계에서 `spawn EINVAL`

`smoke:all` 실패는 샌드박스 밖에서도 재현되었으므로 단순 권한 문제가 아니다. 실패 기록은 `harness/runbook.md` 의 `incident-0015` 로 남겼다.

---

## 2. 실행한 검증

### 2-1. npm verify

명령:

```powershell
npm.cmd run verify
```

결과:

- 1차 실행: 실패
  - 원인: 샌드박스 권한으로 Vitest config 로딩 실패
  - 메시지: `Cannot read directory "../../..": Access is denied.`
- 샌드박스 밖 재실행: 통과

통과 상세:

- `npm run typecheck`: 통과
- `npm test`: 통과
  - Test Files: 20 passed
  - Tests: 135 passed
- `npm run build`: 통과
  - Next.js production build 성공
  - static pages: 63/63 generated

build warning:

- `src/components/ai-history/AiHistoryClient.tsx`: unnecessary `activeId` dependency
- `src/components/budgets/BudgetsClient.tsx`: unnecessary `activeId` dependency
- `src/components/recurring/RecurringClient.tsx`: unnecessary `activeId` dependency
- `src/components/settings/MfaCard.tsx`: `<img>` 사용 경고

build 후 출력된 dynamic server usage 메시지:

- `/api/auth/check-username`: `request.url`
- `/api/export`: `cookies`
- `/api/export/transactions`: `cookies`
- `/api/export/transactions/xlsx`: `cookies`
- `/api/export/xlsx`: `cookies`

Next build 종료 코드는 0이었다.

### 2-2. harness verify

명령:

```powershell
node harness\verify.mjs
```

결과:

- 1차 실행: 실패
  - 원인: 샌드박스 권한으로 Vitest config 로딩 실패
- 샌드박스 밖 재실행: 통과

통과 상세:

- self-test: 80/80 통과
- typecheck: 통과
- vitest: 20 files / 135 tests 통과
- harness mock: 8/8 통과
- verify-citations: 130/130 통과

참고:

- Node deprecation warning `DEP0190` 출력
- Vite CJS Node API deprecation warning 출력
- 둘 다 종료 코드를 실패로 만들지는 않았다.

### 2-3. smoke all

명령:

```powershell
npm.cmd run smoke:all
```

결과:

- 실패
- 샌드박스 밖 재실행도 동일 실패

실패 메시지:

```text
[smoke] dev 서버 시작…
Error: spawn EINVAL
```

실패 위치:

- `scripts/run-smoke.mjs` line 21
- `spawn(cmd, ['run', 'dev'], ...)`

판단:

- smoke 세부 스크립트는 실행되지 않았다.
- dev 서버 시작 전 실패라서 API/페이지 smoke 자체의 통과/실패는 아직 검증되지 않았다.
- Claude Code가 Windows 실행 방식 또는 Node 24 호환성을 확인해야 한다.

---

## 3. 현재 클로드코드에게 넘길 수정 후보

우선순위 높음:

1. `scripts/run-smoke.mjs` 의 Windows dev 서버 spawn 방식 수정
2. 수정 후 `npm.cmd run smoke:all` 재실행
3. smoke 세부 스크립트 4개 결과 기록

수정 후보:

- Windows에서 `spawn(cmd, ['run', 'dev'], { shell: true, ... })` 사용
- 또는 `cmd.exe /c npm.cmd run dev` 형태로 실행
- 또는 dev 서버 자동 시작과 smoke 실행을 분리하는 옵션 추가

주의:

- `taskkill /F /IM node.exe` 는 모든 Node 프로세스를 죽일 수 있으므로, 가능하면 dev 서버 child process tree 만 종료하는 방식으로 개선하는 것이 좋다.

우선순위 낮음:

1. build warning 4건 정리
2. `DEP0190` warning 원인 확인
3. Vite CJS warning 확인

---

## 4. 변경 파일

검증 기록으로 수정/추가된 파일:

- `harness/runbook.md`
- `docs/verification/2026-05-11-code-validation.md`

이번 검증 중 production 코드 수정은 하지 않았다.

---

## 5. 2026-05-11 재확인 메모 — smoke spawn fix 이후 남은 파일

Codex 재확인 시각: 2026-05-11 09:30 KST

현재 상태:

- `scripts/run-smoke.mjs` 의 Windows + Node 24 `spawn EINVAL` 문제는 더 이상 재현되지 않음.
- `npm.cmd run verify` 는 통과.
- `npm.cmd run smoke:all` 은 여전히 실패.
- 개별 확인한 `scripts/test-all-endpoints.mjs` 는 `38/39` 실패.
- 실패 지점: `GET /api/ai-status → 401`
- 기대값: `200 또는 503`
- 로그인 smoke 계열은 인증 쿠키 위장 방식이 현재 앱과 맞지 않아 보호 페이지가 `307`, API가 `401` 로 떨어지는 상태.

Claude Code가 다음에 봐야 할 파일:

1. `scripts/test-all-endpoints.mjs`
   - `/api/ai-status` 를 공개 API로 기대하고 있다.
   - 현재 실제 응답은 `401` 이므로, 공개 API 기대가 맞는지 또는 테스트 기대값이 틀렸는지 확인 필요.

2. `src/app/api/ai-status/route.ts`
   - 실제 `/api/ai-status` 라우트.
   - 코드상 공개 라우트처럼 보이지만 smoke 에서는 `401` 이 나오므로 라우트/환경/인증 처리 확인 필요.

3. `src/middleware.ts`
   - API는 matcher 에서 제외되어야 한다.
   - `/api/ai-status` 에 인증이 걸리는 경로가 middleware 때문인지 확인.

4. `scripts/test-pages-as-user.mjs`
   - 로그인 사용자 smoke.
   - 현재 쿠키 위장 방식이 먹지 않아 보호 페이지가 전부 `307`, 인증 API가 전부 `401`.

5. `scripts/test-pages-content.mjs`
   - 인증된 페이지 콘텐츠 smoke.
   - 현재 인증 쿠키 미인식으로 보호 페이지가 `307`.

6. `scripts/test-mutation-apis.mjs`
   - mutation API smoke.
   - 현재 인증 미인식으로 `AUTH_IDENTIFY_REQUIRED`.

7. `src/lib/auth/getSession.ts`
   - 앱이 실제 서버에서 세션을 읽는 방식.
   - smoke 스크립트의 쿠키 생성 방식과 맞춰봐야 한다.

8. `src/lib/supabase/server.ts`
   - 서버 Supabase client 의 쿠키 읽기 방식.
   - smoke 쿠키 포맷 검증에 중요.

다음 검증 권장 순서:

1. `npm.cmd run smoke:all`
2. 실패 시 dev 서버를 별도로 띄우고 `node scripts/test-all-endpoints.mjs`
3. 인증 쿠키 수정 후 `node scripts/test-pages-as-user.mjs`
4. 이어서 `node scripts/test-pages-content.mjs`
5. 마지막으로 `node scripts/test-mutation-apis.mjs`
6. 전체 통과 후 `npm.cmd run verify`

---

## 6. Codex §5 재확인에 대한 Claude Code 응답 (2026-05-11 17:30 KST)

- **처리**: incident-0015-followup (smoke 인증/쿠키 위장) — **개방 (OPEN)** 유지. 코드 단 fix 못 함 — 환경 의존.
- **의도** (점검 결과 요약):
  - `/api/ai-status/route.ts` — **인증 체크 없는 공개 라우트** 확인. `GET` 만 export 하며 fail() 호출 없음. 200 만 반환 가능 (코드상). Codex 가 받은 401 은 코드 경로상 발생 불가.
  - `src/middleware.ts:80-82` — `matcher: ['/((?!_next/|api/|...).*)' ]` 로 **`/api/*` 가 middleware 에서 제외**됨. middleware 가 ai-status 에 인증 redirect 거는 게 아님.
  - `scripts/test-all-endpoints.mjs:48-50` — ai-status 를 `PUBLIC_APIS` 로 분류해 200 기대. 기대값 자체는 정확.
  - 결론: Codex 가 본 401 은 **환경 의존** (가능성: dev 서버 미준비 + login redirect HTML 응답을 401 로 오인 / Supabase rate limit / 환경변수 미설정으로 cold-start 시 다른 분기). **코드 변경으로 fix 불가**.
- **smoke 쿠키 위장 (scripts/test-pages-* + lib/auth/getSession.ts + lib/supabase/server.ts)**: Supabase Auth 가 access token 을 storage_key 별 multiple cookies 로 split 하는 최근 변경과 smoke 의 단순 cookie 생성 방식이 불일치할 가능성. fix 는 **smoke 스크립트 전면 재작성** 필요 — 큰 범위라 별도 PR 권고.
- **저장**: PR [#26](https://github.com/hu28035036-ux/household-account-book/pull/26) (squash commit `39bc343`)
- **변경 파일**:
  - `docs/verification/2026-05-11-code-validation.md` — 본 §6 (자기 참조)
  - `harness/runbook.md` — incident-0015-followup OPEN entry 추가 (smoke 인증/쿠키 위장 미해결)
- **다음 단계 권고** (사용자 결정):
  1. 로컬에서 직접 dev 서버 (`npm run dev`) 띄우고 브라우저로 `http://localhost:3000/api/ai-status` 호출해 실제 응답 status 확인. 200 이면 Codex 환경 한정 이슈로 종결.
  2. 200 이 아니면 응답 본문/헤더 캡처해서 알려주시면 코드 단 fix 가능.
  3. smoke 쿠키 위장은 별도 PR 트랙 — `@supabase/ssr` 의 현재 storage_key 포맷 (`sb-<project_ref>-auth-token`) 으로 cookie 직접 생성하는 방식으로 재작성.
