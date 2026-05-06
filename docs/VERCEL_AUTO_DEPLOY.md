# VERCEL_AUTO_DEPLOY — 자동 배포 셋업

main push 시 production이, dev/feature 브랜치 push 시 preview가 자동 배포되도록 만드는 두 가지 길.

## 옵션 A — Vercel Dashboard 연결 (권장, 5분)

가장 안정적이고 표준적인 길. 한 번만 누르면 그 후 모든 push가 자동.

1. https://vercel.com/new 로 이동 → GitHub 로그인
2. `household-account-book` 리포지토리 **Import**
3. Framework Preset: **Next.js**(자동 감지)
4. **Environment Variables** 등록 (`.env.example` 참고). 비밀 값은 Sensitive 체크:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` ★ Sensitive
   - `SUPABASE_STORAGE_BUCKET=receipts`
   - `OLLAMA_API_BASE_URL` (외부에서 접근 가능한 주소)
   - `OLLAMA_MODEL=gemma4:e4b`
   - `OLLAMA_API_TOKEN` ★ Sensitive (외부 노출 시 필수)
   - `OCR_LANGUAGE=kor+eng`
   - `NEXT_PUBLIC_OCR_LANGUAGE=kor+eng`
   - `APP_ENV=production`
   - `RAW_TEXT_TTL_DAYS=7`
   - `NEXT_PUBLIC_RAW_TEXT_TTL_DAYS=7`
   - `CRON_TOKEN` (cron 보호용 랜덤 문자열)
   - `ADMIN_EMAILS=your-email@example.com`
5. **Deploy** 클릭 → 첫 production 배포 자동
6. 도메인이 발급되면 Supabase → Auth → URL Configuration의 **Redirect URLs**에
   `https://<vercel-도메인>/auth/callback` 추가
7. 이후
   - `git push origin main` → **Production 자동 배포**
   - `git push origin dev` 또는 `feature/*` → **Preview URL 자동 발급** (PR에 코멘트로 붙음)

> `vercel.json`에 등록된 cron(매일 03:00 KST `/api/admin/purge-raw-text`)도 이 시점부터 자동 활성화.

## 옵션 B — GitHub Actions로 Vercel CLI 배포

Dashboard 연동을 굳이 안 쓰고 싶거나, 빌드 환경을 GitHub Actions에 통일하고 싶을 때.

1. https://vercel.com/account/tokens 에서 **Personal Token 발급**.
2. 로컬에서 1회 link (대화식, 5분):
   ```bash
   npm i -g vercel
   vercel login         # 브라우저 인증
   vercel link          # household-account-book 프로젝트와 연결
   cat .vercel/project.json
   # → { "orgId": "...", "projectId": "..." }
   ```
3. GitHub repo Settings → Secrets and variables → **Actions**에 3개 등록:
   - `VERCEL_TOKEN` = 1번에서 발급한 토큰
   - `VERCEL_ORG_ID` = 2번 출력의 `orgId`
   - `VERCEL_PROJECT_ID` = 같은 출력의 `projectId`
4. `.github/workflows/vercel-deploy.yml`이 트리거됨:
   - main push → production 배포
   - 그 외 브랜치 push → preview 배포
5. 환경변수는 여전히 Vercel 측에 있어야 함 (옵션 A의 4단계 그대로). 또는 `vercel env add`로 등록.

## 비교

| 항목 | A. Dashboard | B. Actions |
|---|---|---|
| 첫 셋업 시간 | 5분 | 10분 |
| 환경변수 관리 | Vercel Dashboard | Vercel Dashboard 또는 `vercel env add` |
| 빌드 위치 | Vercel Build Container | GitHub Actions (vercel CLI) |
| Preview URL PR 코멘트 | ✅ 자동 | ⚠️ 별도 코멘트 작업 필요 |
| 권장 대상 | 일반 사용자 (지금) | 빌드를 CI에 합치고 싶은 경우 |

**둘 중 하나만 쓰면 됩니다.** 동시에 쓰면 같은 commit을 두 번 배포해 충돌·요금 낭비가 생기니 한쪽만 활성화하세요.

## 검증 (배포 후)
- Vercel 도메인의 `/login` 접근 → 디자인 정상
- 이메일 OTP로 1회 로그인 → 영구 세션
- `/admin` 메뉴 노출 (관리자 이메일이 `ADMIN_EMAILS`에 있고 화이트리스트에도 등록된 경우)
- Vercel → Project → Functions 로그에서 cron 호출 확인 (매일 03:00 KST)

## 안티패턴
- 같은 리포에 옵션 A + B 둘 다 활성화하면 **이중 배포** 발생.
- `VERCEL_TOKEN`을 코드/PR/이슈에 절대 노출 금지. GitHub Secret 외부로 공유 X.
- production 환경에서 e2e 돌리지 말 것. dev/staging 분리.
