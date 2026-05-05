# API_DESIGN

## 공통 규약
- 모든 라우트: `src/app/api/**/route.ts` (Next.js Route Handler).
- 인증: Supabase 세션 쿠키 또는 Authorization 헤더 → 서버에서 검증.
- 입력 검증: zod.
- 응답 형식: `{ data: T } | { error: { code: string; message: string; details?: unknown } }`.
- 에러 표준 코드: `UNAUTHORIZED` / `FORBIDDEN` / `BAD_REQUEST` / `NOT_FOUND` / `CONFLICT` / `RATE_LIMITED` / `INTERNAL` / `AI_UNAVAILABLE`.
- 모든 mutate 라우트: 본인 user_id 확인 후 서비스 호출.

## 엔드포인트 목록

### 파일 업로드 / 관리
| Method | Path | 설명 |
|---|---|---|
| POST | `/api/upload` | multipart/form-data. Storage 저장 + uploaded_files insert. 응답: `{ fileId }` |
| GET | `/api/files` | 본인 파일 목록(필터: status, range) |
| DELETE | `/api/files/:id` | Storage 객체 삭제 + 상태 `deleted`로 갱신 + 연관 데이터 정리 |

### OCR / 추출
| Method | Path | 설명 |
|---|---|---|
| POST | `/api/ocr/:fileId` | Tesseract.js 실행, ocr_results insert, 마스킹 텍스트 반환 |
| POST | `/api/extraction/:fileId` | 학습 사전 매칭 → Ollama 호출 → 검증 → 후처리 → candidates insert |

### 후보
| Method | Path | 설명 |
|---|---|---|
| GET | `/api/candidates` | 본인 후보 목록(필터: status, fileId) |
| PATCH | `/api/candidates/:id` | 단건 수정(필드별) |
| POST | `/api/candidates/:id/approve` | 단건 승인 → transactions insert + 학습 갱신 + correction_logs |
| POST | `/api/candidates/:id/reject` | 단건 제외 + correction_logs |
| POST | `/api/candidates/approve-bulk` | 다건 승인. 의심/확인 필요는 자동 제외(응답에 분리 표시) |

### 거래
| Method | Path | 설명 |
|---|---|---|
| GET | `/api/transactions` | 검색/필터/페이징 |
| POST | `/api/transactions` | 수동 거래 등록 |
| PATCH | `/api/transactions/:id` | 수정 |
| DELETE | `/api/transactions/:id` | 삭제 |

### 카테고리
| Method | Path | 설명 |
|---|---|---|
| GET | `/api/categories` | 본인+기본 |
| POST | `/api/categories` | 추가 |
| PATCH | `/api/categories/:id` | 수정 |
| DELETE | `/api/categories/:id` | 삭제 (기본은 비활성화 토글로 대체 검토) |

### 결제수단
| Method | Path | 설명 |
|---|---|---|
| GET | `/api/payment-methods` | 본인+기본 |
| POST | `/api/payment-methods` | 추가 (마지막 4자리만 입력) |
| PATCH | `/api/payment-methods/:id` | 수정 |
| DELETE | `/api/payment-methods/:id` | 삭제 |

### 대시보드
| Method | Path | 설명 |
|---|---|---|
| GET | `/api/dashboard/summary` | 월별 요약(지출/수입/잔액/카테고리/결제수단/대기 후보 수) |

### 학습
| Method | Path | 설명 |
|---|---|---|
| GET | `/api/learning/rules` | 본인 규칙 목록 |
| POST | `/api/learning/rules` | 직접 추가 |
| PATCH | `/api/learning/rules/:id` | 수정 |
| GET | `/api/learning/cache` | analysis_cache 조회(디버그용, 본인 분만) |

## 입력/응답 스키마 (대표 예)

### POST /api/extraction/:fileId
요청 body 없음. 서버는 fileId 기반으로 ocr_results 최신본을 사용.
응답:
```json
{
  "data": {
    "jobId": "uuid",
    "status": "success",
    "candidates": [
      {
        "id": "uuid",
        "transactionDate": "2026-05-05",
        "type": "expense",
        "merchantName": "스타벅스",
        "amount": 5800,
        "categorySuggestion": "카페/간식",
        "paymentMethodSuggestion": "카드",
        "confidence": 0.92,
        "duplicateStatus": "none",
        "rawTextBasis": "스타벅스 5,800",
        "warnings": []
      }
    ],
    "globalWarnings": []
  }
}
```

### POST /api/candidates/approve-bulk
요청:
```json
{ "ids": ["uuid1","uuid2","uuid3"] }
```
응답:
```json
{
  "data": {
    "approved": ["uuid1","uuid2"],
    "skipped": [
      { "id": "uuid3", "reason": "duplicate_suspected" }
    ]
  }
}
```

## Rate Limit
- 업로드/추출은 사용자당 분당 N회 제한(예: 30회). 헤더 `X-RateLimit-*` 노출.

## 멱등성
- POST `/api/upload`는 클라이언트가 `Idempotency-Key` 헤더를 보내면 중복 제출 무시.
- approve/reject도 동일.

## 보안 헤더
- CORS 화이트리스트(자기 도메인만).
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`.

## 에러 처리 가이드
- AI 서버 미응답 → 503 + `code: 'AI_UNAVAILABLE'`.
- Ollama JSON 파싱 실패 → 422 + `code: 'BAD_REQUEST'` + 사용자 안내.
- RLS로 막힌 접근 → 404 또는 403(존재 자체를 노출하지 않으려면 404 권장).
