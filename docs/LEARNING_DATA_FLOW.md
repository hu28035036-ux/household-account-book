# LEARNING_DATA_FLOW

## 핵심 원칙
- **Ollama 모델을 자동 재학습시키는 구조가 아니다.**
- 앱이 사용자의 행동(수정·승인·반복 가맹점)을 데이터로 모아두고, **분석 전·후에 참고**하여 정확도와 체감 속도를 높인다.
- 학습데이터는 **사용자별 개인화**와 **앱 공통 익명화**로 분리한다.
- 사용자별 데이터는 그 사용자 계정 안에서만 사용. 공통 데이터는 PII 없는 정규화된 패턴만.

## 데이터 종류
| 테이블 | 용도 | 사용자 식별 |
|---|---|---|
| user_learning_rules | 사용자별 일반 규칙 (merchant/category/payment_method/recurring/keyword) | O |
| merchant_learning_rules | 사용자별 가맹점→카테고리/결제수단 매핑 | O |
| category_learning_rules | 사용자별 키워드→카테고리 매핑 | O |
| payment_method_learning_rules | 사용자별 결제수단 패턴 | O |
| analysis_cache | 동일 OCR 입력 캐시 | O (user_id 단위) |
| user_correction_logs | 후보 수정/승인/제외 이력 | O |
| global_learning_rules | 익명화된 가맹점·키워드·카테고리 추천 | **X (PII 금지)** |

## 분석 전 활용
1. OCR 마스킹 텍스트의 input_hash 계산 → `analysis_cache` 적중 시 **Ollama 호출 생략**, 캐시 후보를 반환.
2. OCR 텍스트에서 가맹점 후보 토큰 추출 → `merchant_learning_rules`에서 정규화 매칭 → 매칭되면:
   - 카테고리/결제수단을 후보 기본값으로 미리 채움
   - 신뢰도 가중치 +
3. `category_learning_rules`의 키워드 매칭 → 카테고리 추천 보강.
4. `global_learning_rules`는 사용자별 데이터가 없을 때 **보조 추천**으로만 사용.
5. 위 정보를 **마스킹된 요약** 형태로 Ollama 프롬프트의 USER 컨텍스트에 주입.

## 분석 후 활용
1. Ollama 결과의 각 후보를 사용자 패턴과 비교.
2. 카테고리가 사용자 평소 패턴과 다르면 → confidence 하향, warning `"differs_from_user_pattern"`.
3. 가맹점이 자주 보던 가맹점인데 카테고리가 비어 있으면 → 사용자 기본값으로 채움.
4. 결제수단이 모호하면 → 평소 가장 많이 쓰는 결제수단으로 보강(단, suggestion만).
5. 반복 지출(예: 매월 같은 날, 같은 가맹점, 비슷한 금액) 후보면 warning `"recurring_candidate"` 부착.
6. 중복 의심 → `duplicate_status='suspected'`로 표시. 자동 저장 금지.

## 학습 갱신 시점
- **사용자가 후보를 승인/수정/제외할 때마다** `user_correction_logs`에 기록.
- 수정/승인 결과를 `merchant_learning_rules.match_count++`, `last_used_at` 갱신.
- 동일 가맹점·동일 카테고리 매칭이 N회(예: 3회) 누적되면 `confidence` 상향.
- 사용자가 카테고리를 바꿨다면, 기존 규칙의 confidence를 낮추고 새 규칙을 등록.

## global_learning_rules 갱신 정책
- 자동 갱신 금지(개인정보 유출 위험). 운영자가 별도의 정제·익명화 파이프라인을 거쳐 수동/관리도구로 추가.
- 자동화하려면:
  - PII 검사기를 통과해야 한다(카드/계좌/숫자/이름 패턴 모두 차단).
  - 가맹점명에서 점포명·지번 같은 식별 단서 제거(예: "스타벅스 강남점" → "스타벅스").
  - N명 이상의 사용자에게서 동일 정규화 패턴이 발견될 때만 등재(K-익명성 K≥N).

## 캐시 무효화
- 사용자가 같은 OCR을 분석 후 결과를 크게 수정하면, 해당 input_hash 캐시는 **재계산**한다(또는 만료 처리).
- `analysis_cache.expires_at`은 30일 권장(추후 조정).

## 분석 속도 개선 효과 (기대)
- 자주 보던 가맹점 = OCR 즉시 후보 생성, Ollama 호출 생략 가능 (애매 항목만 Ollama).
- 사용자 패턴 힌트가 있으면 Ollama가 더 일관된 카테고리 추천을 한다.
- 캐시 적중 시 응답 즉시 반환.

## 학습 데이터에 저장하지 않는 것
- 카드번호 전체, 계좌번호 전체, 승인번호 전체.
- 주민번호, 전화번호 원문, 사업자번호 원문.
- 원본 OCR 텍스트 전체 (장기 보관용 학습 키로 사용 금지).
- 원본 이미지.
- 사용자 메모(개인적인 자유 텍스트).
