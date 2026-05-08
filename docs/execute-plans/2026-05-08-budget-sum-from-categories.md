# 월캘린더 — 전체 예산을 카테고리 합산으로 자동화

- 작성일: 2026-05-08
- 담당 에이전트: finance-core (주) + ux-design (UI 라벨)
- 관련 영역: 월캘린더 / 예산
- 사용자 승인 필요 여부: 명령 명시 — *"전체 예산 설정 → 카테고리별 합산으로"*

---

## 배경 / 동기

사용자 명시 명령:
> 월캘린더에서 맨위에 전체예산을 설정하는것보다 카테고리별 예산 총합산으로 나오는게 좋을거같아 ... 남은예산계산방식은 카테고리별 사용금액을 다 더하고 카테고리 전체예산에서 빼서 계산하는 방식으로

**현재 동작 (분석 결과)**:
- `calendarService.getCalendarMonth()` 가 `budgets.category_id IS NULL` 인 row 의 `amount` 를 *전체 예산* 으로 사용
- `budgetRemaining = budgetTotal − totalExpense` (total expense = 모든 거래 합)
- 전체 예산이 없으면 "예산 설정하기" 링크 표시
- 카테고리별 예산은 별도 카드로 아래에 표시

**문제**:
- 사용자가 카테고리별 예산을 잘 입력해도 *전체 예산* 을 따로 입력해야 월캘린더 헤더가 살아남
- 두 곳에 입력하면 정합 안 됨 (전체 예산 ≠ 카테고리 합) — 혼란
- 사용자 정신 모델: "예산은 카테고리별로 잡고, 전체는 그 합"

## 목표 / 비-목표

**목표**:
- 월캘린더 맨 위 "전체 예산" 표시를 카테고리 예산 *합산* 으로 자동화
- 잔액 = (카테고리별 예산 합) − (카테고리별 사용 합)
- 카테고리 예산이 0개면 "카테고리별 예산을 설정하세요" 안내

**비-목표**:
- DB 스키마 변경 없음 (`budgets` 테이블 그대로)
- 기존 *전체 예산 row* 데이터 삭제 안 함 (조회만 안 함 — 호환성)
- 카테고리 외 예산(예: 전체 한도 별도 설정) 는 후속 결정

## 영향 영역

| 파일 / 폴더 | 변경 종류 | 비고 |
|---|---|---|
| `src/services/calendarService.ts` | 수정 | `budgetTotal/UsedPct/Remaining` 계산식을 `categoryBudgets` 합산으로 |
| `src/components/calendar/MonthCalendar.tsx` | 수정 | 헤더 라벨 "이번 달 지출 / 예산" → "이번 달 지출 / 카테고리 합산" 같은 표현 + "예산 설정 안 됨" 메시지 변경 |
| `src/components/budgets/BudgetsClient.tsx` | 수정 | 전체 예산 입력 UI 제거 또는 비활성화 (안내 문구) |
| `src/app/api/budgets/route.ts` | 검토 | category_id null POST 거부할지 결정 (보수적: 그대로 두고 UI 만 제거) |

## CONTRACT 영향 점검

- §1 도메인 안전: 영향 없음 (사용자 입력 거래/후보 흐름 무관)
- §3 보안/개인정보: 영향 없음
- §4 아키텍처 불변: 영향 없음 (RLS / 마이그레이션 / service_role 모두 무관)
- §6 법규: 영향 없음
- §9-A 4가지 패턴: 추상 코드 추가 없음 / fallback 변경 없음 / 검증 게이트 통과 / 경계 명확 (영역 작업 finance-core + ux-design)
- §9-B 메타 격리: 본 작업은 가계부 src 영역 — `finance-core/*` 브랜치 prefix 로 영역 모드 자동 작동

## 단계

1. main 동기화 + `finance-core/budget-sum-from-categories` 브랜치 생성
2. calendarService 수정 — totalBudget 조회를 categoryBudgets 합산으로 대체
3. MonthCalendar 라벨 / 빈 상태 메시지 변경
4. BudgetsClient 의 전체 예산 입력 UI 제거 또는 안내 (사용자가 카테고리별로 입력하도록 유도)
5. typecheck + self-test (영역 모드)
6. commit + push + PR + auto-merge

## 검증 계획

- [x] typecheck (이미 그린 — PR #3 에서 회복됨)
- [ ] self-test 영역 모드 통과
- [ ] 캘린더 화면 확인 — 카테고리 합산 정상 표시, 카테고리 0개 시 안내
- [ ] 잔액 계산 = 합산 − 사용
- [ ] 기존 *전체 예산 row* 가 있는 사용자도 동작 (조회만 안 됨)

## 롤백 계획

코드 revert 만으로 복구 가능. DB 스키마 변경 없으니 마이그레이션 down 불필요. 5분 이내.

---

## 결과 (작업 종료 후 채움)

- 머지 PR / 커밋:
- verify 게이트 결과:
- 사용자 확인:

## 이슈 / 미해결

- (작성 시점) `/api/budgets` 의 `category_id null` POST 를 차단할지는 보수적 판단 — UI 에서 제거하면 신규 생성 안 됨, 기존 데이터는 조회만 안 함

## 다음 액션

- 작업 종료 시 채움
