# DATABASE_SCHEMA

## 설계 원칙
- 모든 사용자 소유 테이블은 **`user_id` (FK → auth.users.id)** 컬럼 + **RLS** 강제.
- 시간 컬럼은 `timestamptz`, 기본값 `now()`. updated_at은 트리거로 갱신.
- 금액은 `numeric(14,2)` (또는 정수 KRW이면 `bigint`). 본 프로젝트는 **`bigint` (원 단위 정수)** 사용.
- 카테고리/결제수단처럼 사용자 정의 + 기본 제공이 섞이는 테이블은 `is_default boolean`으로 구분.
- 민감정보 원문(카드번호 전체/승인번호 전체)은 컬럼 자체를 두지 않는다. 마스킹된 값만 저장.

## 표 목록
1. profiles
2. categories
3. payment_methods
4. uploaded_files
5. ocr_results
6. ai_extraction_jobs
7. transaction_candidates
8. transactions
9. user_learning_rules
10. global_learning_rules (사용자 식별 정보 없음)
11. merchant_learning_rules
12. category_learning_rules
13. payment_method_learning_rules
14. analysis_cache
15. user_correction_logs

## 테이블 정의 (요약)

### profiles
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| user_id | uuid UNIQUE | FK auth.users.id |
| display_name | text | |
| created_at, updated_at | timestamptz | |

### transactions
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | FK |
| transaction_date | date | |
| type | text CHECK in ('income','expense','transfer') | |
| amount | bigint | 원 단위 |
| merchant_name | text | |
| description | text | |
| category_id | uuid | FK categories |
| payment_method_id | uuid | FK payment_methods |
| source_type | text CHECK in ('manual','receipt_image','card_capture','bank_capture','pdf','csv','excel') | |
| source_file_id | uuid | nullable, FK uploaded_files |
| is_ai_generated | boolean | default false |
| is_confirmed | boolean | default true (이 테이블에 들어왔다는 건 승인된 것) |
| ai_confidence | numeric(4,3) | nullable |
| duplicate_group_id | uuid | nullable |
| memo | text | |
| created_at, updated_at | timestamptz | |

### transaction_candidates
| 컬럼 | 타입 |
|---|---|
| id, user_id, uploaded_file_id | uuid |
| transaction_date | date nullable |
| type | text |
| amount | bigint nullable |
| merchant_name | text nullable |
| description | text |
| category_suggestion | text (실제 category_id로 매핑은 승인 시점) |
| payment_method_suggestion | text |
| confidence | numeric(4,3) |
| duplicate_status | text CHECK in ('none','suspected','duplicate') default 'none' |
| raw_text_basis | text (마스킹된 근거 스니펫) |
| warnings | jsonb (string[] 형태) |
| user_action | text CHECK in ('pending','approved','rejected','edited') default 'pending' |
| created_at, updated_at | timestamptz |

### categories
| 컬럼 | 타입 |
|---|---|
| id, user_id | uuid |
| name | text |
| type | text CHECK in ('income','expense','common') |
| color | text |
| icon | text |
| is_default | boolean |
| created_at, updated_at | timestamptz |

### payment_methods
| 컬럼 | 타입 |
|---|---|
| id, user_id | uuid |
| name | text |
| type | text CHECK in ('card','bank','cash','pay','other') |
| issuer_name | text |
| masked_number | text  | (예: `****-****-****-1234`) |
| created_at, updated_at | timestamptz |

### uploaded_files
| 컬럼 | 타입 |
|---|---|
| id, user_id | uuid |
| file_name | text |
| file_type | text |
| file_size | bigint |
| storage_path | text |
| status | text CHECK in ('uploaded','ocr_processing','ocr_done','ai_processing','parsed','failed','approved','deleted') |
| created_at, updated_at | timestamptz |

### ocr_results
| 컬럼 | 타입 |
|---|---|
| id, user_id, uploaded_file_id | uuid |
| raw_text | text (단기 보관, 정책에 따라 NULL 처리 가능) |
| masked_text | text (장기 보관용 마스킹된 본문) |
| confidence | numeric(4,3) |
| engine | text CHECK in ('tesseract_js','other') |
| created_at | timestamptz |

> **정책 확정**: `raw_text`는 분석 완료 후 **7일** 경과 시 자동 NULL 처리(예약 잡 또는 정기 cron). `masked_text`만 장기 보관. 사용자가 즉시 폐기 요청 시 곧바로 NULL. 환경변수 `RAW_TEXT_TTL_DAYS=7`로 조정.

### ai_extraction_jobs
| 컬럼 | 타입 |
|---|---|
| id, user_id, uploaded_file_id, ocr_result_id | uuid |
| model_name | text (예: 'gemma4:e4b') |
| status | text CHECK in ('pending','running','success','failed') |
| input_text_masked | text |
| extracted_json | jsonb |
| error_message | text |
| created_at, updated_at | timestamptz |

### user_learning_rules
| 컬럼 | 타입 |
|---|---|
| id, user_id | uuid |
| rule_type | text CHECK in ('merchant','category','payment_method','recurring','keyword') |
| raw_pattern | text |
| normalized_pattern | text |
| category_id | uuid nullable |
| payment_method_id | uuid nullable |
| confidence | numeric(4,3) |
| match_count | integer default 0 |
| last_used_at | timestamptz |
| created_at, updated_at | timestamptz |

### global_learning_rules (개인정보 절대 금지)
| 컬럼 | 타입 |
|---|---|
| id | uuid |
| rule_type | text CHECK in ('merchant','category','keyword') |
| normalized_pattern | text |
| suggested_category_name | text |
| confidence | numeric(4,3) |
| match_count | integer |
| created_at | timestamptz |

> **금지**: user_id, 카드번호, 계좌번호, 승인번호, 원본 OCR, 메모, 이미지. 가맹점은 사람 이름·주소가 섞이지 않는 형태로 정규화된 키워드만.

### merchant_learning_rules
| 컬럼 | 타입 |
|---|---|
| id, user_id | uuid |
| merchant_raw_name | text |
| merchant_normalized_name | text |
| default_category_id | uuid |
| default_payment_method_id | uuid |
| match_count | integer |
| last_used_at | timestamptz |

### category_learning_rules
| 컬럼 | 타입 |
|---|---|
| id, user_id | uuid |
| keyword | text |
| category_id | uuid |
| confidence | numeric(4,3) |
| match_count | integer |
| created_at | timestamptz |

### payment_method_learning_rules
| 컬럼 | 타입 |
|---|---|
| id, user_id | uuid |
| raw_text_pattern | text |
| masked_pattern | text |
| payment_method_id | uuid |
| confidence | numeric(4,3) |
| match_count | integer |

### analysis_cache
| 컬럼 | 타입 |
|---|---|
| id, user_id | uuid |
| input_hash | text (SHA-256 of normalized OCR text) |
| source_type | text |
| cached_result_json | jsonb |
| created_at, expires_at | timestamptz |

### user_correction_logs
| 컬럼 | 타입 |
|---|---|
| id, user_id, candidate_id | uuid |
| field_name | text |
| before_value_masked | text |
| after_value_masked | text |
| correction_type | text CHECK in ('manual_edit','approve','reject','bulk_approve','bulk_reject') |
| created_at | timestamptz |

## 인덱스 권장
- `transactions(user_id, transaction_date desc)` — 거래 목록.
- `transactions(user_id, category_id, transaction_date)` — 카테고리 통계.
- `transaction_candidates(user_id, user_action, created_at desc)` — 후보 목록.
- `merchant_learning_rules(user_id, merchant_normalized_name)` — 사전 매칭.
- `analysis_cache(user_id, input_hash)` UNIQUE.

## RLS 정책 (모든 사용자 소유 테이블 공통)
```sql
alter table TABLE_NAME enable row level security;
create policy "own rows select"  on TABLE_NAME for select using (auth.uid() = user_id);
create policy "own rows insert"  on TABLE_NAME for insert with check (auth.uid() = user_id);
create policy "own rows update"  on TABLE_NAME for update using (auth.uid() = user_id);
create policy "own rows delete"  on TABLE_NAME for delete using (auth.uid() = user_id);
```
- `global_learning_rules`만 user_id가 없으므로 select-only public + 쓰기는 service role.

## 기본 시드
**카테고리**: 식비, 카페/간식, 편의점/마트, 교통, 주거/관리비, 통신비, 의료, 쇼핑, 구독, 보험, 교육, 여가, 경조사, 이체, 저축, 투자, 기타
**결제수단**: 현금, 카드, 계좌이체, 체크카드, 신용카드, 네이버페이, 카카오페이, 토스페이, 기타

## 마이그레이션/롤백
- 마이그레이션은 `supabase/migrations/<timestamp>__name.sql`로 버전 관리.
- 모든 마이그레이션은 **down 스크립트**(롤백)를 동반.
- production 적용 전 dev/preview 환경에 우선 적용 후 검증.
