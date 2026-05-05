# SETUP_GUIDE — 사용자가 직접 해야 하는 셋업 단계

이 문서는 코드가 모두 준비된 상태에서, **사용자 계정/인증이 필요해 Claude가 대신 못 하는 작업**만 모았습니다. 위에서 아래로 순서대로.

---

## 0. 사전 준비 — 5분
- 이메일 1개(매직링크 로그인용)
- GitHub 계정
- Vercel 계정 (GitHub로 로그인 가능)
- Supabase 계정
- 본인 PC에 Node.js 20 LTS 설치 (`node -v`로 20.x 확인)

---

## 1. 로컬 의존성 설치 — 3분

프로젝트 루트(`C:\Users\user\Desktop\개발\가계부`)에서:

```powershell
npm install
```

검증
```powershell
npm run typecheck
npm test
```
- typecheck 0 에러, vitest 그린이면 OK.

---

## 2. Supabase 프로젝트 만들기 — 5분

1. https://supabase.com → New Project
2. 옵션
   - **Region: Northeast Asia (Seoul)** ← 꼭
   - DB Password 안전하게 보관(외부 노출 금지)
3. 프로젝트가 켜지면 좌측 메뉴 **Project Settings → API**에서 다음 3개 복사
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (절대 클라이언트/Git에 노출 금지)

---

## 3. `.env.local` 채우기 — 1분

`.env.example`을 복사해서 `.env.local` 만든 뒤 값 채우기:

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

채울 값:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_STORAGE_BUCKET=receipts

OLLAMA_API_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma4:e4b
OLLAMA_API_TOKEN=                         # 외부 노출 시 필수, 로컬만 쓰면 비워둠

OCR_LANGUAGE=kor+eng
NEXT_PUBLIC_OCR_LANGUAGE=kor+eng

APP_ENV=development
RAW_TEXT_TTL_DAYS=7
NEXT_PUBLIC_RAW_TEXT_TTL_DAYS=7

CRON_TOKEN=원하는랜덤문자열                # 7일 폐기 cron 인증용
```

---

## 4. DB 마이그레이션 적용 — 3분

Supabase Dashboard 좌측 메뉴 **SQL Editor**에서:

1. `supabase/migrations/0001_init.sql` 내용을 통째로 붙여넣고 **Run**
2. `supabase/migrations/0002_storage_policies.sql` 내용을 통째로 붙여넣고 **Run**

검증
- 좌측 메뉴 **Table Editor**에 15개 테이블이 보이면 OK
- `auth.users` 트리거가 잘 붙었는지는 새 사용자 가입 후 자동으로 categories 17개가 생기는지로 확인 (다음 단계)

---

## 5. Storage 버킷 만들기 — 2분

Supabase Dashboard **Storage → New bucket**
- Name: `receipts`
- **Public: OFF (Private)**
- 생성 후, 4번에서 `0002_storage_policies.sql`을 이미 적용했다면 정책은 자동 반영. 확인은 Storage → 버킷 → Policies 탭에서 4개 정책(`user_can_*`) 보이면 OK.

---

## 6. Auth 설정 — 2분

Supabase **Authentication → URL Configuration**
- **Site URL**: 로컬 개발 단계에선 `http://localhost:3000`
- **Redirect URLs**에 추가
  - `http://localhost:3000/auth/callback`
  - 나중에 Vercel 도메인 추가 (예: `https://your-app.vercel.app/auth/callback`)

(선택) Authentication → Providers → Email 템플릿을 한국어로 바꿔도 좋음.

---

## 7. 로컬 가동 확인 — 5분

```powershell
npm run dev
```
- 브라우저 http://localhost:3000 → `/login`으로 자동 이동
- 이메일 입력 → 메일함에서 매직링크 클릭 → `/dashboard` 진입
- 가입 트리거 작동 검증: `/categories`에 17개, `/payment-methods`에 9개 보이면 통과

문제 시
- 로그인이 안 되면 6번 Redirect URL 다시 확인
- 가입은 됐는데 카테고리가 비면 4번 마이그레이션의 `handle_new_user` 트리거가 적용됐는지 SQL Editor에서 확인:
  ```sql
  select tgname from pg_trigger where tgname = 'on_auth_user_created';
  ```

---

## 8. Ollama 설치 + 모델 pull — 10분

1. https://ollama.com/download 에서 Windows용 설치
2. 설치 후 자동 실행. `http://localhost:11434/api/tags` 가 200을 반환하면 OK
3. PowerShell에서:
   ```powershell
   ollama pull gemma4:e4b
   ```
   - 모델 이름이 다르면 (`gemma3` 계열 등) 실제로 받은 이름으로 `.env.local`의 `OLLAMA_MODEL` 값을 바꾸세요.
4. 설정 화면(`/settings`)에서 "AI 서버 — 연결됨" 배지 뜨면 통과

---

## 9. 첫 e2e 시연 — 5분

1. `/upload` → 영수증 사진 업로드
2. OCR 진행률 → 미리보기에서 텍스트 확인 (필요하면 수정)
3. "AI 분석 시작" → `/candidates`로 자동 이동
4. 후보 1건 승인 → `/transactions`에 반영 확인
5. `/dashboard`에서 이번 달 지출/잔액 갱신 확인

---

## 10. GitHub 리포지토리 만들기 — 5분

```powershell
git init
git add .
git status                                    # .env.local 있으면 안 됨 (.gitignore에 들어가 있음)
git commit -m "feat: AI ledger MVP (Phase 0~10)"
```

GitHub에서 빈 리포지토리 생성 후:
```powershell
git branch -M main
git remote add origin https://github.com/<사용자명>/<리포명>.git
git push -u origin main
```

`dev` 브랜치도 만들어 두면 나중에 편함:
```powershell
git checkout -b dev
git push -u origin dev
git checkout main
```

---

## 11. Vercel 배포 — 5분

1. https://vercel.com → New Project → GitHub 리포지토리 import
2. Framework: **Next.js** 자동 감지
3. **Environment Variables** 추가 — `.env.local`과 같은 값 (단, 다음만 다르게)
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: 동일
   - `SUPABASE_SERVICE_ROLE_KEY`: 동일 (Sensitive 체크)
   - `OLLAMA_API_BASE_URL`: **외부에서 접근 가능한 주소**여야 함 → 12번 참고
   - `OLLAMA_API_TOKEN`: 12번에서 정한 값
   - `CRON_TOKEN`: `.env.local`과 동일
4. Deploy
5. 배포 후 도메인이 발급되면 6번 Supabase Auth Redirect URL에 `https://<도메인>/auth/callback` 추가

---

## 12. Ollama 외부 노출 — 10분 (선택, 다중 사용자/배포에 필수)

로컬에서만 쓸 거면 생략. Vercel에서도 호출하려면 인터넷에서 닿게 만들어야 함.

### 옵션 A. Cloudflare Tunnel (권장)
1. https://dash.cloudflare.com → Zero Trust → Networks → Tunnels → Create a tunnel
2. 본인 PC에 `cloudflared` 설치 후 안내된 명령어 실행
3. Public hostname을 `http://localhost:11434`에 매핑
4. 발급된 URL을 Vercel `OLLAMA_API_BASE_URL`에 입력
5. 보안: Cloudflare Access 정책 추가 또는 헤더 토큰 필수
   - 본 코드는 `OLLAMA_API_TOKEN`을 `x-ai-token` 헤더로 보냄. Cloudflare Worker나 nginx 프록시에서 이 헤더 검증 후 통과시키도록 구성.

### 옵션 B. nginx 리버스 프록시 + 토큰
- 본인 서버 nginx → 토큰 헤더 검증 → `proxy_pass http://127.0.0.1:11434`
- 헤더 미일치 시 401 반환

> **주의**: Ollama를 인증 없이 인터넷에 노출하면 누구나 사용 가능합니다. 토큰 검증은 필수.

---

## 13. Vercel Cron 활성화 확인 — 1분

`vercel.json`에 이미 등록됨:
```json
{
  "crons": [
    { "path": "/api/admin/purge-raw-text", "schedule": "0 18 * * *" }
  ]
}
```
- Vercel은 cron 호출 시 자동으로 헤더 `x-vercel-cron`을 붙입니다. 본 코드는 `x-cron-token` 검증을 사용하므로, **Vercel Cron만으로는 인증 통과를 못합니다.**
- 두 가지 해결책:
  - (a) `/api/admin/purge-raw-text` 라우트에서 `x-vercel-cron` 헤더가 있을 때도 통과시키도록 한 줄 추가
  - (b) GitHub Actions cron으로 `x-cron-token` 헤더와 함께 호출

원하시면 (a) 한 줄 패치 적용해 드리겠습니다.

---

## 14. 모니터링 / 점검 루틴 (월 1회 5분)

- Supabase Dashboard → Database → Usage (DB/Storage 잔량)
- Vercel → Usage (함수 실행시간, 대역폭)
- Ollama 서버 헬스 — 설정 화면 배지
- 마이그레이션 변경 시: dev에서 적용 → 검증 → main 머지 → production 적용

---

## 14. push 전 보안 체크 (매번 1분)

```powershell
git status                                  # .env* 없는지
npm run typecheck
npm test
npm run lint
```

비밀키가 실수로 커밋됐다면 **즉시 키 회전(Supabase Dashboard에서 Reset)**하고 히스토리 정리.

---

## 부록 — 자주 막히는 곳

| 증상 | 원인 / 해결 |
|---|---|
| 매직링크 클릭 후 로그인 실패 | Redirect URL 미등록 (6번) |
| 가입 후 카테고리 0개 | 0001 마이그레이션 미적용, 또는 트리거 누락 |
| `/api/upload`에서 RLS 거부 | 0002 storage 정책 미적용, 또는 버킷 이름 불일치 (`SUPABASE_STORAGE_BUCKET`) |
| AI 분석 시 503 | Ollama 미가동 / `OLLAMA_API_BASE_URL` 오타 / 토큰 헤더 검증 실패 |
| Tesseract 다운로드가 느림 | 첫 호출 시 언어 데이터 다운로드. 두 번째부터 빠름 |
| 모바일에서 카메라가 안 열림 | 일부 브라우저는 `capture="environment"` 무시. 파일 선택으로 폴백 가능 |
| Vercel build 실패 — env 누락 | Production Environment Variables 누락. CI 워크플로의 dummy 값과 다름 주의 |
