# [작업 제목]

- 작성일: YYYY-MM-DD
- 담당 에이전트: ai-extraction / finance-core / collab-security / ux-design / qa-harness
- 관련 영역: (touched files / scope)
- 사용자 승인 필요 여부: yes / no

---

## 배경 / 동기

이 변경이 왜 필요한가. 한두 단락. 외부 트리거(사용자 요청, 사고, PDF 인사이트 등)도 명시.

## 목표 / 비-목표

- 목표: 이번에 달성할 것
- 비-목표: 이번에는 일부러 안 건드리는 것 (스코프 보호)

## 영향 영역

| 파일 / 폴더 | 변경 종류 | 비고 |
|---|---|---|
| `src/services/...` | 신규 / 수정 / 삭제 | |
| `src/app/api/...` | | |
| `supabase/migrations/...` | up + down 함께 | |
| `.claude/agents/<name>.md` | Scope 확장 시 사용자 승인 필요 | |

## CONTRACT 영향 점검

- §1 도메인 안전: 영향 없음 / 영향 있음 → ...
- §3 보안/개인정보: ...
- §4 아키텍처 불변: ...
- §6 법규: ...
- §9-A 4가지 패턴 (추상/fallback/검증 종료/경계): ...

## 단계

1. ...
2. ...
3. ...

## 검증 계획

- [ ] typecheck
- [ ] vitest (영역)
- [ ] harness/run.mjs (영역)
- [ ] smoke (필요 시 어떤 항목)
- [ ] 시각/responsive (UI 변경 시)
- [ ] RLS audit (보안 변경 시)
- [ ] `node harness/verify.mjs --full` 통과

## 롤백 계획

- 5분 이내 복구 가능한가
- DB 변경 시 down 마이그레이션 / backward-compat 어느 쪽인가
- Vercel 이전 배포 promote 으로 충분한가

---

## 결과 (작업 종료 후 채움)

- 머지 PR / 커밋:
- verify 게이트 결과:
- 사용자 확인:

## 이슈 / 미해결

- ...

## 다음 액션

- ...
