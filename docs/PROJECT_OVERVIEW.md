# PROJECT_OVERVIEW

## 프로젝트 한 줄 정의
사용자가 영수증·카드/계좌 캡처·문자 결제내역 이미지를 업로드하면 OCR과 로컬 LLM(Ollama gemma4:e4b)이 거래내역 후보를 만들고, 사용자가 확인/수정/승인한 항목만 최종 가계부에 저장되는 **승인형 AI 가계부 웹앱**.

## 핵심 가치
- AI가 자동으로 다 해주지 않는다. **AI는 후보를 제안하고, 최종 결정은 사용자**가 한다.
- 사용자의 수정/승인 기록이 앱 학습데이터가 되어, 다음 분석부터는 같은 가맹점·같은 패턴을 더 빠르고 정확하게 처리한다.
- Ollama 모델 자체를 자동 재학습시키지 않는다. **앱이 사용자 패턴을 저장하고, 분석 전·후에 활용**하는 구조.

## 사용자 시나리오
1. 모바일에서 영수증을 카메라로 찍어 업로드한다.
2. 앱이 OCR로 텍스트를 뽑고, 사용자에게 미리보기를 보여준다.
3. 학습데이터에 같은 가맹점이 이미 있으면 카테고리·결제수단을 미리 채운다.
4. Ollama가 거래 후보 JSON을 만든다.
5. 학습 규칙으로 후보를 보정하고, 중복/확인 필요 항목에 표시를 붙인다.
6. 사용자가 카드 단위로 수정/제외/승인 → 승인된 것만 transactions에 들어간다.
7. 사용자의 수정 패턴이 user_correction_logs와 학습 규칙에 반영되어, 다음번 정확도를 높인다.

## 기술 스택 요약
| 계층 | 선택 |
|---|---|
| Framework | Next.js (App Router) + Node.js |
| Language | TypeScript |
| Style | Tailwind CSS |
| DB | Supabase PostgreSQL |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| OCR | Tesseract.js (1차), 추후 PaddleOCR 등 검토 |
| LLM | Ollama + gemma4:e4b (로컬/별도 서버) |
| Hosting | Vercel (GitHub 연동 자동 배포) |
| VCS | GitHub |

## 핵심 데이터 흐름 (요약)
```
업로드 → Supabase Storage → OCR(Tesseract.js)
       → 마스킹 → 학습데이터 사전 매칭
       → Ollama 분석 → 학습데이터 후처리 보정
       → transaction_candidates → 사용자 승인
       → transactions(최종 저장) + 학습데이터 업데이트
```

## 절대 원칙
- AI 결과를 transactions에 **직접 저장하지 않는다**.
- 사용자 승인 없는 자동 최종 저장 금지.
- 카드번호/계좌번호/승인번호/주민번호 등 민감정보 원문 저장 금지.
- 사용자 데이터는 **Supabase RLS로 사용자별 격리**.
- 큰 파일 하나에 기능을 몰아넣지 않는다.

## 무료 플랜 기준 MVP
- Vercel Hobby + Supabase Free + 로컬/전용 머신 Ollama 조합.
- **다중 사용자 운영이 1차 목표**. 사용자 데이터는 Supabase Auth user_id 기준으로 분리하고 RLS로 격리.
- 초기에는 본인 1명으로 e2e 검증 후 외부 사용자에게 점진 오픈. 다중 사용자 동시 처리에 대비해 AI 서버는 24/7 가동 가능한 머신을 권장.

## 디자인 컨셉
화이트 + 밝고 부드러운 핑크 계열 SaaS/금융 대시보드. 핑크는 강조에만, 배경은 밝게. 위험/경고는 핑크와 충돌하지 않는 별도 색상으로 분리.

## 반응형 컨셉
- **PC**: 사이드바 + 표 + 다열 카드 그리드 (정보 밀도 ↑)
- **모바일**: 하단 네비게이션 + 카드 리스트 + 큰 업로드/승인 버튼 (한 손 조작)

## 다음 문서로 이어지는 큰 그림
| 영역 | 상세 문서 |
|---|---|
| 시스템 구조 | ARCHITECTURE.md |
| DB | DATABASE_SCHEMA.md |
| 분석 흐름 | AI_EXTRACTION_FLOW.md, OCR_FLOW.md, OLLAMA_GEMMA_FLOW.md |
| 학습 | LEARNING_DATA_FLOW.md |
| 보안 | SECURITY_PRIVACY_RULES.md |
| UI | UI_UX_STRUCTURE.md, DESIGN_SYSTEM.md, RESPONSIVE_DESIGN_PLAN.md |
| API/DB/배포 | API_DESIGN.md, SUPABASE_SETUP.md, GITHUB_VERSIONING_PLAN.md, VERCEL_DEPLOYMENT_PLAN.md, LOCAL_AI_SERVER_PLAN.md |
| 검증 | TEST_HARNESS_PLAN.md |
| 일정 | DEVELOPMENT_PHASES.md |
| 위험 | KNOWN_RISKS.md |
