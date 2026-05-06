# ADMIN_GUIDE — 지인 배포 + 운영자 관리

본 서비스는 **결제/구독이 없습니다**. 운영자가 지인을 직접 초대하고 사용자 관리를 수동으로 하는 사설 운영 모드입니다.

## 핵심 정책
- **결제·구독 없음** — Stripe 등 결제 모듈 미탑재.
- **이메일 화이트리스트** — `allowed_emails` 테이블에 등록된 이메일만 가입 가능. 트리거 단계에서 강제 거부.
- **운영자 식별** — 환경변수 `ADMIN_EMAILS=admin1@example.com,admin2@example.com` (콤마 구분, 대소문자 무시).
- **`/admin` 라우트** — 관리자만 보임. 일반 사용자는 404 처리.
- **사용자 차단** — Supabase `auth.admin.updateUserById({ ban_duration })`로 토큰 무효화.

## 초기 셋업 (1회)
1. Supabase SQL Editor에 `0006_allowed_emails.sql` 적용 (가입 트리거 교체 포함, 멱등).
2. Vercel 환경변수에 `ADMIN_EMAILS` 추가.
3. **첫 관리자 이메일을 미리 `allowed_emails`에 INSERT** (Dashboard SQL Editor):
   ```sql
   insert into public.allowed_emails(email, note)
   values ('admin@example.com', '운영자');
   ```
4. **Supabase Auth 메일 템플릿에 6자리 코드 표시**
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
5. 첫 로그인: `/login`에서 이메일 입력 → 6자리 코드 받기 → 같은 화면에 입력 → `/admin` 메뉴가 보이면 OK.

> **세션 자동 유지**: 한 번 인증하면 Supabase 브라우저 클라이언트가 refresh token으로 세션을 자동 갱신합니다. 같은 브라우저에서 다시 방문하면 `/login` 페이지가 자동으로 `/dashboard`로 이동합니다(매번 인증 X).

## 일상 운영
### 새 사용자 초대
1. `/admin`의 **이메일 화이트리스트**에 추가
2. 사용자에게 가입 페이지(`/login`) 링크 전달 + "이 이메일로 6자리 코드 받으세요" 안내
3. 사용자: `/login` → 이메일 입력 → 메일에 도착한 **6자리 코드를 같은 화면에 입력** → 자동 로그인
4. 가입 트리거가 화이트리스트 검증 → 통과 시 기본 카테고리/결제수단 자동 시드
5. 미등록 이메일은 **EMAIL_NOT_ALLOWED** 에러로 차단됨 (UI에 친절한 메시지)
6. **이후 같은 브라우저에서는 자동 로그인 유지** — 다시 인증 안 해도 됨

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
