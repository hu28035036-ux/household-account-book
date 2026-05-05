# HOUSEHOLDS — 가족 공유

## 개념
- 사용자는 여러 **household(가족)** 에 속할 수 있다.
- 각 household는 1명의 owner와 N명의 member로 구성.
- 거래·후보·카테고리·결제수단·예산은 `household_id`가 있으면 같은 household 멤버 전원에게 **read 공유**.
- **write(insert/update/delete)는 본인이 만든 행만** — 다른 멤버가 만든 행은 수정/삭제 불가(안전 우선).
- `household_id`가 NULL이면 평소처럼 개인 데이터.

## 데이터 모델
- `households(id, name, owner_id, …)`
- `household_members(id, household_id, user_id, role: 'owner'|'member', invited_by, joined_at)` — UNIQUE(household_id, user_id)
- `household_invites(id, household_id, code UNIQUE, invited_by, expires_at, used_at, used_by)`
- 공유 대상 테이블에 `household_id uuid NULL` 컬럼 추가
  - transactions / transaction_candidates / categories / payment_methods / budgets

## RLS 변경
| 테이블 | select | insert | update | delete |
|---|---|---|---|---|
| 공유 대상 5개 | 본인 OR (household_id 있고 멤버) | 본인 user_id | 본인 user_id | 본인 user_id |
| households | owner OR member | owner_id 본인 | owner | owner |
| household_members | 본인 OR 같은 household 멤버 | 본인이 본인 등록 OR owner가 추가 | — | 본인 탈퇴 OR owner 강제 |
| household_invites | owner OR member | owner | owner | owner |

## API
| Method | Path | 설명 |
|---|---|---|
| GET | `/api/households` | 내가 속한 가족 목록 |
| POST | `/api/households` | 새 가족 생성 (자동으로 owner 멤버) |
| PATCH | `/api/households/[id]` | 이름 변경 (owner만) |
| DELETE | `/api/households/[id]` | 삭제 (owner만, 멤버/초대 cascade) |
| GET | `/api/households/[id]/members` | 멤버 목록 |
| DELETE | `/api/households/[id]/members/[userId]` | 본인 탈퇴 또는 owner의 강제 제거 |
| GET | `/api/households/[id]/invites` | 초대 목록 |
| POST | `/api/households/[id]/invites` | 초대 코드 발급 (기본 7일 유효) |
| DELETE | `/api/households/[id]/invites/[inviteId]` | 코드 폐기 |
| POST | `/api/households/join` | 초대 코드로 합류 |

## UI
- `/households` 라우트: 좌측 가족 목록 / 우측 상세(멤버 + 초대 코드 발급/폐기)
- 사이드바에 "가족 공유" 메뉴 추가 (Users 아이콘)
- 초대 코드: 10자리 영숫자(혼동 글자 제외)
- "초대 코드로 합류" 모달 — 코드 입력 → join

## 다음 작업 (별도 응답)
- 거래/예산 추가·수정 시 "공유 범위" 토글 (개인 / 가족)
- 거래내역·대시보드 화면에 멤버 표시(누가 추가했는지) 옵션
- 후보 승인 시 활성 household로 자동 묶기 옵션

## 보안 메모
- 코드 자체는 client에 노출 가능(초대용). 단, owner와 같은 household 멤버만 조회 가능.
- 합류 시 used_at 갱신은 user 권한으로는 못 하므로(코드 자체 RLS UPDATE는 owner만), unique(household_id, user_id) 제약과 expires_at으로 보호. 추후 SECURITY DEFINER 함수로 단일-사용 보장 강화 검토.
- 다른 멤버가 만든 거래를 임의로 수정/삭제하지 못하게 막아 데이터 무결성 보호.
