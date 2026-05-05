# VERCEL_DEPLOYMENT_PLAN

## 연결
- Vercel ↔ GitHub 저장소 연동.
- Production Branch: `main`.
- Preview Branch: `dev` 및 모든 feature/* 브랜치.

## 배포 트리거
- `main`에 push/merge → **Production 배포**.
- `dev` 또는 `feature/*` push → **Preview 배포**(고유 URL).
- PR마다 Preview URL 자동 코멘트(Vercel GitHub App).

## 환경변수 (Vercel Dashboard)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only, Sensitive 체크)
- `SUPABASE_STORAGE_BUCKET`
- `OLLAMA_API_BASE_URL`
- `OLLAMA_MODEL=gemma4:e4b`
- `OCR_LANGUAGE=kor+eng`
- `APP_ENV=production|preview|development`

> 환경별로 Production / Preview / Development 값을 다르게 설정 가능. AI 서버 URL은 dev/preview에서는 다른 로컬 주소나 mock으로 두기도 함.

## .env 파일 정책
- 로컬 `.env.local`만 사용. GitHub 커밋 금지.
- Vercel Dashboard 값이 진실 원본(source of truth).

## 빌드 설정
- Framework Preset: `Next.js`.
- Build Command: `next build` (기본).
- Output: 자동(.next).
- Node.js 버전: 최신 LTS(예: 20.x).

## 라우트 / 함수 한계
- Vercel Hobby 함수 실행시간 한계(약 10s)와 페이로드 한계(약 4.5 MB).
- OCR/AI 호출이 길어질 수 있음 → **Edge Function 대신 Node Runtime**, 가능하면 작업을 비동기로 분리(클라이언트 폴링 또는 서버 측 큐). 한계 도달 시 자체 Node 서버로 분리 검토(KNOWN_RISKS).

## 도메인
- Vercel 기본 도메인 사용으로 시작 → 추후 커스텀 도메인 연결.
- HTTPS는 Vercel 자동 처리.

## 배포 전 체크리스트
- [ ] `next build` 로컬 통과
- [ ] 환경변수 Production 값 확인
- [ ] DB 마이그레이션 적용 완료(production)
- [ ] secret 누락/오타 없음
- [ ] AI 서버 URL이 외부 접근 가능 상태인지(혹은 mock 모드인지) 확인
- [ ] CORS 화이트리스트 도메인 정확

## 배포 후 체크리스트
- [ ] 메인 페이지 200
- [ ] 로그인/회원가입 정상
- [ ] 업로드 → OCR → 분석 → 후보 → 승인 e2e 한 번 시연
- [ ] 모바일/PC 반응형 확인
- [ ] 콘솔 에러 0건(주요 페이지)
- [ ] 색상 시스템 적용 일관성
- [ ] AI 서버 미가동 시 에러 메시지 정상 노출

## 롤백
- Vercel Dashboard → Deployments → 이전 배포로 **Promote to Production**.
- DB 변경이 있는 배포의 롤백은 **DB 롤백 SQL 동반 필요**.

## Preview 사용 팁
- 디자인 변경/UX 변경은 PR 단위로 Preview URL 생성 → 모바일에서 직접 확인.
- Preview에서 실제 Production DB를 사용하지 않도록(원하지 않으면) 환경변수 분리.

## 비용
- Hobby 무료 한도 내에서 시작. 사용량 도달 시 알림 설정.
- 함수 실행시간/대역폭 한도 모니터링.
