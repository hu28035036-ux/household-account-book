# SECURITY_PRIVACY_RULES

## 1. 저장 금지 / 마스킹 의무
| 항목 | 규칙 |
|---|---|
| 카드번호 | 전체 저장 금지. 마지막 4자리 + `****-****-****-1234` 형태만 |
| 계좌번호 | 전체 저장 금지. 끝 4자리만 |
| 승인번호 | 전체 저장 금지. 끝 3자리만 (또는 미저장) |
| 주민등록번호 | 원문 저장 금지. `******-*******` |
| 전화번호 | 원문 저장 금지. 끝 4자리만 |
| 사업자등록번호 | 원문 저장 금지. 마지막 그룹만 |

## 2. RLS (행 수준 보안)
- 모든 사용자 소유 테이블에 RLS 활성화.
- 정책: `auth.uid() = user_id`인 행만 select/insert/update/delete.
- service role key는 클라이언트 노출 금지(서버 환경변수만).
- 다른 사용자의 거래/파일/OCR/AI 결과/학습데이터는 **결코 노출 금지**.

## 3. 파일 / Storage
- 버킷 정책에서 사용자 폴더(`{user_id}/...`)만 접근 가능하도록 정책 설정.
- 사용자가 파일 삭제 시 Storage 객체 + uploaded_files 상태(`deleted`) + 연관 ocr_results, ai_extraction_jobs까지 일관되게 처리.
- 원본 이미지는 사용자가 명시적으로 보관을 원하지 않으면 **N일 후 자동 정리** 옵션 제공.

## 4. 학습데이터
- `user_learning_rules`, `merchant_learning_rules`, `category_learning_rules`, `payment_method_learning_rules`, `user_correction_logs` 모두 사용자 소유 + RLS.
- `global_learning_rules`에는 PII 절대 금지(가맹점 정규화 키워드와 카테고리 정도만).
- before/after 값을 user_correction_logs에 기록할 때도 마스킹 후 저장.

## 5. 로그
- OCR 원본 텍스트 전체를 로그에 남기지 않는다.
- AI 응답 로그는 마스킹 후, 디버그 모드에서만, 짧은 보관기간으로.
- 운영 로그에는 user_id 대신 hashed_user_id 권장(분석/디버그 시).

## 6. 비밀키 관리
- `.env`, `.env.local`, `SUPABASE_SERVICE_ROLE_KEY`, `OLLAMA_API_TOKEN` 등 GitHub 커밋 금지.
- 저장소 루트에 `.gitignore` 정비:
  ```
  .env
  .env.local
  .env.*.local
  *.pem
  ```
- secret 스캐너 사용(예: gitleaks) — pre-commit 훅 또는 GitHub Action.
- 환경변수는 Vercel Dashboard / 로컬 `.env.local` 두 곳에서만 관리.

## 7. AI 요청 데이터 최소화
- AI 서버에 보낼 텍스트는 **마스킹 + 트림 + 필요한 부분만**.
- 사용자 학습 힌트는 **상위 N개 정규화된 키워드**만 전달(원문 가맹점/메모 그대로 보내지 않음).
- 전송 채널은 HTTPS. 자체 서명 인증서 사용 시 인증서 검증을 끄지 말 것.

## 8. 인증 / 세션
- Supabase Auth 사용. 매직 링크 또는 이메일+비밀번호.
- Next.js 서버 라우트에서 세션 검증 후에만 DB/Storage 접근.
- 클라이언트에서 anon key만 사용. 모든 민감 작업은 서버 라우트 경유.

## 9. CSRF / XSS
- App Router의 Route Handler는 동일 출처 요청만 허용(CORS 화이트리스트).
- 사용자 입력은 서버에서 zod로 1차 검증, DB에 저장 후 클라이언트 표시 시 React가 기본적으로 escape.
- `dangerouslySetInnerHTML` 금지(꼭 필요한 경우 sanitize-html 통해).

## 10. 의존성
- `npm audit` 정기 실행, Dependabot 활성화.
- 최소 권한 SDK 사용. 필요 없는 패키지 제거.

## 11. 사용자 권리
- 데이터 내보내기(JSON/CSV) 기능 — 본인 거래/파일 메타데이터.
- 계정 삭제 시 거래/파일/OCR/AI 결과/학습데이터 완전 삭제 절차 문서화.

## 12. 위반 발견 시
- secret 커밋 발견 시: 즉시 키 회전(rotate) + 히스토리에서 제거(BFG 등). PR 메시지 또는 Slack 통보 자동화 검토.
