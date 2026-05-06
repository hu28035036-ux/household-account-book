# ADMIN_GUIDE — 지인 배포 + 운영자 관리

본 서비스는 **결제/구독이 없습니다**. 운영자가 지인을 직접 초대하고 사용자 관리를 수동으로 하는 사설 운영 모드입니다.

## 핵심 정책
- **결제·구독 없음** — Stripe 등 결제 모듈 미탑재.
- **이메일 화이트리스트** — `allowed_emails` 테이블에 등록된 이메일만 가입 가능. 트리거 단계에서 강제 거부.
- **운영자 식별** — 환경변수 `ADMIN_EMAILS=admin1@example.com,admin2@example.com` (콤마 구분, 대소문자 무시).
- **`/admin` 라우트** — 관리자만 보임. 일반 사용자는 404 처리.
- **사용자 차단** — Supabase `auth.admin.updateUserById({ ban_duration })`로 토큰 무효화.

## 초기 셋업 (1회)
1. Supabase SQL Editor에 `0007_open_signup.sql` 적용 (자유 가입 트리거, 멱등).
   *(`0006_allowed_emails.sql`을 먼저 적용한 환경이면 0007이 가입 검증을 제거)*
2. Vercel 환경변수에 `ADMIN_EMAILS` 추가.
3. **Supabase Auth 메일 템플릿에 6자리 코드 표시**
   - Dashboard → Authentication → Email Templates → **Magic Link**
   - 본문에 `{{ .Token }}` 변수가 6자리 코드를 출력. 예시:
     ```
     안녕하세요,

     아래 6자리 코드를 사이트에 입력해 로그인하세요:

     {{ .Token }}

     코드는 1시간 내 유효합니다.
     ```
   - (선택) 본문에서 `{{ .ConfirmationURL }}` 매직링크 줄을 제거하면 코드 입력만 유도.
   - 코드 만료 시간은 Authentication → Settings에서 조정.
4. 첫 로그인: `/login`에서 이메일 입력 → 6자리 코드 받기 → 같은 화면에 입력. `ADMIN_EMAILS`에 등록된 이메일이면 사이드바에 **"관리자"** 메뉴(방패 아이콘)가 보임.

## 세션 영구 유지 정책

본 서비스는 **한 번 OTP 인증한 브라우저는 영구 자동 로그인**되도록 설정되어 있습니다.

### 코드 측 (자동)
`src/lib/supabase/client.ts`에서 `persistSession: true` / `autoRefreshToken: true`를 명시. localStorage에 토큰 저장, access token 만료 직전 자동 갱신.

### Supabase Dashboard 권장 설정 (1회)
**Authentication → Settings**에서 아래 값을 확인/조정하면 영구 세션이 안정적으로 동작합니다.

| 항목 | 권장값 | 의미 |
|---|---|---|
| JWT expiry (access token) | 3600 (1시간, 기본) | 자주 갱신되는 짧은 토큰. 보안상 짧게 유지하고 refresh로 영구화. |
| Refresh Token Rotation | **ON** | 사용 시마다 토큰 회전 → 토큰 탈취 위험 감소. |
| Refresh Token Reuse Interval | 10초 (기본) | rotation 직후 짧은 grace window. |
| Inactivity Timeout | (선택) **비활성화** 또는 매우 길게 | 켜두면 N일 동안 미사용 시 강제 로그아웃. 영구 정책이면 OFF. |

> Inactivity Timeout이 OFF이고 사용자가 명시적 로그아웃 / storage 삭제를 하지 않으면 **사실상 무기한** 자동 로그인됩니다.

### 다시 인증이 필요한 경우 (예외)
- 다른 기기/브라우저에서 첫 접속 → 그 기기에서 1회 OTP
- 시크릿/InPrivate 창 (storage 비휘발성이 아니므로 닫으면 사라짐)
- 사용자가 로그아웃 버튼 클릭
- 브라우저 storage/쿠키 직접 비움
- 관리자가 `/admin`에서 **차단** → 토큰 무효화 (해제하면 재인증 필요)

### 모든 기기에서 강제 로그아웃 (보안 사고 시)
Supabase Dashboard → Authentication → Users → 해당 사용자 → "Sign out user" 또는 SQL로:
```sql
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"force_logout_at": "..."}'::jsonb where id = '...';
```
(또는 `/admin`의 "차단" → "해제"로 토큰 회전)

## 일상 운영
### 새 사용자 가입 (자유 가입)
1. 누구든 사이트(`/login`) 접속
2. 이메일 입력 → **인증 코드 받기** → 메일함의 **6자리 코드를 같은 화면에 입력** → 자동 로그인
3. 가입 트리거가 기본 카테고리(17) + 결제수단(9)을 자동 시드
4. 별도 초대코드/화이트리스트 없음 — 인증된 이메일이면 누구나 가입
5. **이후 같은 브라우저에서는 자동 로그인 유지** — 다시 인증 안 해도 됨

### 부적절한 사용자 처리 (운영자)
- `/admin` 가입자 표 → **차단**: 토큰 즉시 무효화. 영구 차단(100년).
- **영구 삭제**: DELETE 입력 확인 후 `auth.admin.deleteUser` → CASCADE로 거래·파일 등 모두 제거.
- 차단/삭제는 사후 조치이므로, 봇/스팸 우려가 크면 Supabase Authentication → Settings에서 Email confirm 정책을 강화하거나 SMTP rate limit를 활용.

### 사용자 목록 / 사용량
- `/admin`의 가입자 표 — 이메일/가입일/최근 로그인/거래 수/상태(활성/차단/미인증)
- 거래 수가 비정상적으로 많거나 0인 사용자 추적 가능.

### 차단 / 해제
- "차단": ban_duration 100년(영구). 진행 중 토큰 새로 발급 안 됨.
- "해제": ban_duration `none`.

### 영구 삭제
- DELETE 버튼 → 콘솔 prompt에 `DELETE` 입력 시 진행.
- `auth.admin.deleteUser` 호출 → CASCADE로 거래·후보·파일·OCR·AI 결과·예산·학습 모두 제거.
- 본인 계정은 삭제 불가(공통 `/api/account` 사용).

## 보안 가드
- 모든 `/api/admin/*` 라우트가 `isAdminEmail` 검증 (서버 측). 우회 불가.
- `allowed_emails` SELECT는 본인 이메일 한정 RLS. 목록 전체는 service role만.
- service role key는 `SUPABASE_SERVICE_ROLE_KEY` 환경변수에서만, `lib/supabase/admin.ts` 외부 모듈은 import 금지.
- `/admin` 페이지는 비관리자에게 `notFound()`로 라우트 자체를 숨김.

## 화이트리스트 운영 팁
- 추가는 즉시 반영 (트리거가 매번 체크).
- 제거해도 **이미 가입한 사용자는 영향 없음** (탈퇴/차단으로 별도 처리).
- 대량 등록은 SQL Editor에서 한 번에:
  ```sql
  insert into public.allowed_emails(email, note) values
    ('a@x.com', '동아리 친구'),
    ('b@x.com', '가족');
  ```

## 주기 모니터링 (월 1회 권장)
- Supabase Database → Usage (DB/Storage 잔량)
- Vercel → Usage (함수 실행시간, 대역폭)
- `/admin` 가입자 거래 수 추세 — 이상 활동 감지

## 향후 확장 시
- 다중 운영자 / 운영자 권한 세분화 — `admins` 테이블 + RLS로 이전
- 결제 도입 — Stripe Customer Portal + webhook + `subscriptions` 테이블 (현재는 미적용)
- 가입 신청 폼 + 운영자 승인 큐 — `pending_signups` 테이블
