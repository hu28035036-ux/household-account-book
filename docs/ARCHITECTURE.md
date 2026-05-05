# ARCHITECTURE

## 시스템 구성 요소
```
[사용자 브라우저(모바일/PC)]
   │  HTTPS
   ▼
[Vercel: Next.js (App Router) + API Routes]
   │
   ├── Supabase Auth (로그인/세션)
   ├── Supabase PostgreSQL (DB, RLS 적용)
   ├── Supabase Storage (원본 파일)
   │
   └── HTTP(S) ──► [로컬/별도 AI 서버: Ollama gemma4:e4b]
                    (Vercel 외부, 사용자 PC 또는 전용 서버)
```

## 레이어 분리
| Layer | 위치 | 역할 |
|---|---|---|
| UI | `src/app/**`, `src/components/**` | 페이지/컴포넌트 |
| Server | `src/app/api/**` | Next.js Route Handler (인증·검증·DB 호출) |
| Service | `src/services/**` | 도메인 로직(거래·후보·OCR·추출·학습) |
| Lib | `src/lib/**` | 인프라(Supabase, OCR, Ollama, 마스킹, 중복, 학습) |
| Types | `src/types/**` | 타입 |
| Tests | `src/tests/**` | 단위/통합/AI 하네스 |

## 컴포넌트 구조 (역할 분리)
```
src/
  app/
    page.tsx                # 랜딩(또는 대시보드 리다이렉트)
    dashboard/
    transactions/
    upload/
    candidates/
    categories/
    payment-methods/
    settings/
    files/
    api/
      transactions/
      upload/
      ocr/
      extraction/
      candidates/
      approve/
      categories/
      payment-methods/
      dashboard/
  components/
    layout/                 # AppShell, Header, Sidebar, BottomNav
    dashboard/              # 요약 카드, 차트
    transactions/           # TransactionTable, TransactionCardList
    upload/                 # Dropzone, CameraInput, OcrPreview
    candidates/             # CandidateTable, CandidateCardList, CandidateEditModal
    categories/
    payment-methods/
    charts/
    common/                 # Button, Badge, Modal, BottomSheet
    responsive/             # ResponsiveSwitch, useBreakpoint
  lib/
    supabase/               # client, server, admin
    auth/
    ocr/                    # Tesseract 래퍼
    ollama/                 # Ollama HTTP 클라이언트
    ai/                     # 프롬프트, 결과 검증
    validators/             # zod schema
    security/               # masking, redaction, hash
    duplicate/              # 중복 검사기
    learning/               # 사전 매칭/후처리 보정
    formatting/             # 통화/날짜 포맷
  services/
    transactionService.ts
    categoryService.ts
    paymentMethodService.ts
    fileService.ts
    ocrService.ts
    extractionService.ts
    candidateService.ts
    approvalService.ts
    duplicateService.ts
    learningService.ts
    dashboardService.ts
  types/
  tests/
    unit/
    integration/
    harness/
```

## 데이터 흐름 (런타임)
```
1) 클라이언트 → POST /api/upload          (파일 업로드)
2) 서버      → Supabase Storage 저장 + uploaded_files insert
3) 클라이언트 → POST /api/ocr/:fileId
4) 서버      → Tesseract.js 실행 → 마스킹 → ocr_results insert
5) 클라이언트 → POST /api/extraction/:fileId
6) 서버      → 학습 사전 매칭 → Ollama 호출 → JSON 검증
             → 학습 후처리 → 중복 검사 → transaction_candidates insert
7) 클라이언트 → GET  /api/candidates       (목록/수정/제외)
8) 클라이언트 → POST /api/candidates/:id/approve (또는 approve-bulk)
9) 서버      → transactions insert + 학습 규칙 업데이트
10) 클라이언트→ GET  /api/dashboard/summary
```

## 신뢰 경계
- **클라이언트**: anon key만 사용. 민감 작업은 항상 서버 라우트 경유.
- **서버 라우트**: service role key는 서버 환경변수에서만 읽음. 사용자 컨텍스트(JWT) 검증 후 RLS 우회가 필요한 경우에만 admin client 사용.
- **AI 서버**: 인터넷에 직접 노출 금지. Cloudflare Tunnel 등 프록시 또는 Vercel→AI 서버 사이의 인증 토큰 필수.

## 책임 분담 원칙
- UI는 **데이터 표시·입력**만 책임. 비즈니스 규칙은 service에.
- service는 **도메인 규칙(승인/중복/학습)** 만 알고, DB 호출은 lib/supabase 통해서만.
- lib/security의 마스킹은 **모든 외부 출력(로그/AI 요청/저장 직전) 경로에서 통과**시킨다.
- 큰 page.tsx 금지. 화면은 page → 섹션 컴포넌트 → 카드/테이블 컴포넌트로 분해.
