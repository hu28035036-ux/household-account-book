# OCR_FLOW

## OCR 엔진 선택
- **1차: Tesseract.js**
  - 클라이언트 측 또는 서버 측 실행 모두 가능. 본 프로젝트는 **서버측(Next.js Route Handler)** 실행을 우선 검토. 모바일 저전력 단말 부담 회피.
  - 언어 데이터: `kor`, `eng` (한국어+영어/숫자 혼합). 환경변수 `OCR_LANGUAGE=kor+eng`.
- **확장 검토 (Phase 11)**: PaddleOCR(별도 서버), Google Vision, Naver Clova OCR 등.

## 실행 단계
1. uploaded_files.status → `ocr_processing`.
2. Supabase Storage에서 파일을 임시로 받아 OCR.
3. 결과 텍스트를 `raw_text`로 메모리에 보관.
4. `lib/security`의 마스킹기로 `masked_text` 생성.
5. ocr_results insert (raw_text는 정책에 따라 단기 보관 또는 즉시 폐기, masked_text는 장기 보관).
6. uploaded_files.status → `ocr_done`.

## 마스킹 규칙 (OCR 결과에 적용)
- 카드번호: `\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}` → 마지막 4자리만 남기고 `****-****-****-1234`.
- 계좌번호 추정 패턴: 6자리 이상 연속 숫자(또는 하이픈/공백 섞인) → 끝 4자리만.
- 승인번호: `승인번호\s*[:#]?\s*\d{6,}` → 끝 3자리만.
- 주민번호: `\d{6}-\d{7}` → `******-*******`.
- 전화번호: `01\d-\d{3,4}-\d{4}` → 끝 4자리만.
- 사업자번호: `\d{3}-\d{2}-\d{5}` → 마지막 그룹만.

> 마스킹 함수는 `lib/security/masking.ts`로 유일화. 모든 외부 출력 경로에서 통과시킨다(저장 직전, 로그, AI 요청).

## 사용자 미리보기 UX
- OCR 직후 사용자에게 **OCR 텍스트 미리보기**를 보여준다.
- 사용자는 **수정 가능**: OCR 오인식이 명백한 경우 분석 전에 손볼 수 있어야 한다.
- "AI 분석 시작" 버튼을 누르면 그때부터 Ollama로 보낸다.
- 미리보기는 모바일에서 접기/펼치기로 제공해 화면 차지를 줄인다.

## 진행 상태 표시
- 업로드 진행률 → OCR 진행률(엔진이 page-level 콜백 제공) → 분석 진행률.
- OCR 단계 표시 텍스트: "텍스트 인식 중…", 진행률은 progress bar.

## 실패 처리
- OCR 실패: `ocr_results`에 confidence=0 + masked_text="" 기록 후 사용자에게 "텍스트 인식 실패. 직접 입력하시겠어요?" 안내.
- 사용자가 직접 입력한 텍스트는 `ocr_results.engine='manual'`로 저장(체크 제약 추가 필요).

## 보안
- raw_text 전체 로깅 금지. 디버그 로그에는 `masked_text`만.
- 클라이언트로 보내는 미리보기에는 마스킹된 텍스트를 우선 보낸다. 단, 사용자 자신이 텍스트를 수정할 수 있어야 하므로 **본인 화면에서는 raw 표시 가능** (서버 저장본은 별도). 정책 결정 포인트: `KNOWN_RISKS.md`.

## 캐시
- input_hash = SHA-256(normalized(masked_text)).
- normalize: 공백 압축, lowercase(영문 부분만), 양끝 trim.
- 같은 hash가 `analysis_cache`에 있으면 OCR 단계는 매번 새로 하지 않고, 분석 단계에서 캐시 활용.
