# BUDGETS — 예산 기능

## 개념
- **카테고리별 월 예산**: 카테고리 + 월 단위 한도. 한 카테고리에 여러 달 가능.
- **전체 월 예산**: `category_id = NULL`인 한 행으로 월 합계 한도.
- 두 종류는 동시에 운영 가능. 대시보드에서 함께 표시.

## DB
- `budgets(id, user_id, category_id NULL, month_start date, amount bigint, alert_threshold numeric, memo, …)`
- partial unique index 2개로 (user_id, category_id, month_start) / (user_id, month_start where null) 중복 방지
- RLS: 사용자 소유만 select/insert/update/delete

## 진행률
- 진행률 = 이번 달 해당 카테고리의 expense 합 / 예산 amount
- `safe` (< threshold), `caution` (>= threshold, < 100%), `over` (>= 100%)
- threshold 기본 0.8 (80%), 사용자별로 조정 가능

## API
| Method | Path | 설명 |
|---|---|---|
| GET | `/api/budgets?ym=YYYY-MM` | 해당 월 예산 목록 |
| POST | `/api/budgets` | 신규 또는 동일 (category_id, month_start) 업서트 |
| DELETE | `/api/budgets/{id}` | 삭제 |
| GET | `/api/budgets/progress?ym=YYYY-MM` | 진행률(전체 + 카테고리별) |

## UI
- `/budgets` 라우트: 월 선택, 추가/수정/삭제, 카드 그리드에 BudgetBar
- 대시보드에 진행률 위젯(전체 + 카테고리 상위 6개)
- 사이드바에 "예산" 메뉴 (BottomNav는 모바일 5개 그대로 유지 — 필요하면 더보기로 묶기)

## 보안
- RLS 자동 적용. 다른 사용자 예산은 절대 접근 불가.
- amount는 정수(원). threshold는 0~1 numeric.

## 향후
- 예산 임계치 도달 시 메일/푸시 알림 (별도 작업)
- 카테고리 그룹 예산(예: 식비+카페+편의점 묶음)
