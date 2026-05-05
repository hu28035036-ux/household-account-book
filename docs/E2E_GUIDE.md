# E2E_GUIDE

Playwright 기반 e2e 테스트 가이드.

## 시나리오 분류

### 1. Smoke (인증 없음, CI 기본)
- 루트 → `/login` 자동 리다이렉트
- 보호 라우트 9개 모두 미로그인 시 `/login?redirect=...`로 이동
- 로그인 화면이 정상 렌더링되고 핵심 컨트롤(이메일/버튼) 노출
- 잘못된 경로가 5xx 안 나옴

### 2. Responsive (인증 없음, CI 기본)
6개 뷰포트(`mobile-360`, `mobile-390`, `tablet-768`, `desktop-1024`, `desktop-1280`, `desktop-1440`)에서:
- 가로 스크롤 발생 안 함
- 모바일에서 핵심 버튼/입력 높이 ≥ 44px
- 폼이 화면 안쪽에 정렬

### 3. 인증 흐름 (선택, env 있을 때만)
- admin client로 테스트 사용자 생성 → `generateLink` 으로 매직링크 직링크 → 콜백 호출 → 세션 쿠키 확보
- `/dashboard` 진입 + 4개 카드 노출 확인

## 실행

### 로컬 (smoke + responsive 전체 6 뷰포트)
```powershell
npm run e2e:install   # 첫 1회만, Chromium 다운로드
npm run e2e
```
`playwright.config.ts`의 `webServer`가 `npm run dev`를 자동 기동.

### 특정 프로젝트만
```powershell
npx playwright test --project=mobile-390
npx playwright test --project=desktop-1280
```

### UI 모드 (디버그)
```powershell
npm run e2e:ui
```

### 인증 시나리오 포함
```powershell
$env:E2E_TEST_EMAIL = "you+e2e@example.com"
$env:NEXT_PUBLIC_SUPABASE_URL = "https://xxxx.supabase.co"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = "eyJ..."
$env:SUPABASE_SERVICE_ROLE_KEY = "eyJ..."
npm run e2e
```

> 주의: 테스트 사용자가 실제 Supabase 프로젝트에 생성됩니다. 프로덕션 DB로는 절대 돌리지 말고, dev/staging 프로젝트를 따로 두세요.

### 외부 서버 대상으로 실행
```powershell
$env:E2E_BASE_URL = "https://your-preview.vercel.app"
npm run e2e
```
이 경우 `webServer`는 자동 비활성화되고, `BASE_URL`만 사용합니다.

## CI
- `.github/workflows/ci.yml` `e2e-smoke` 잡: `mobile-390` + `desktop-1280` 두 뷰포트로 smoke + responsive만 실행.
- 인증 시나리오는 비밀이 필요해 별도 워크플로(또는 secrets 설정 후 활성화)에서 돌리는 것을 권장.

## 결과
- HTML 리포트: `playwright-report/`
- 추적·스크린샷: 실패 시에만 캡처 (`trace: retain-on-failure`)

## 안티패턴
- 매직링크 메일 받기를 e2e에서 직접 시도하지 말 것 — 시간/네트워크 의존성 큼. `generateLink` admin API로 우회.
- 프로덕션 DB로 e2e 돌리지 말 것.
- `viewport.width`로 분기되는 셀렉터(BottomNav vs Sidebar)는 `playwright.config.ts` projects별 viewport에 맞춰 골라야 함.
