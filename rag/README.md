# RAG — docs/ 인덱스 + 검색

가계부의 `docs/` 폴더에는 30+ 설계 문서가 있다. 에이전트가 작업 전 관련 문서를 빠르게 찾을 수 있도록 **경량 RAG 인덱스**를 운영한다.

운영 책임: `qa-harness` 에이전트 (read-only 운영)

---

## 동작 방식 (의도적으로 단순)

- **임베딩 없음 (1단계)**: 키워드/제목/헤딩/태그 기반 BM25-ish 점수
- 외부 의존성 없음 — Node.js 내장만 사용
- 추후 임베딩이 필요하면 `--embed` 모드로 확장 (OpenAI Embeddings API 키 필요)

이 단계의 목표는 **에이전트가 "어떤 문서를 읽어야 하는가" 질문에 30ms 안에 답하기**.

---

## 빌드

```bash
node rag/build.mjs
```

`rag/index.json` 산출. `docs/*.md` 외에 `AGENTS.md`, `CONTRACT.md`, `README.md`, `.claude/agents/*.md` 도 포함.

---

## 검색

```bash
node rag/search.mjs "RLS household 공유"
node rag/search.mjs "OCR raw_text 폐기"
node rag/search.mjs "마스킹 카드번호" --limit 3
node rag/search.mjs "예산 진척률" --json   # 머신 파싱용
```

기본 출력: 점수순 상위 5개 문서 + 매칭 헤딩 + 첫 줄 요약.

---

## 에이전트가 RAG를 쓰는 패턴

세션 시작 시 각 에이전트는 자기 영역 관련 키워드로 검색해서 컨텍스트를 짧게 끌어올 수 있다:

```bash
# ai-extraction 에이전트가 작업 시작 시
node rag/search.mjs "OCR Vision LLM 추출 후보"

# collab-security 에이전트가 새 마이그레이션 작성 전
node rag/search.mjs "RLS 정책 household"
```

검색 결과의 파일을 그대로 Read 도구로 열어 읽는다.

---

## 인덱싱 대상 / 제외

포함:
- `AGENTS.md`, `CONTRACT.md`, `README.md`
- `docs/**/*.md`
- `.claude/agents/*.md`
- `harness/README.md`, `rag/README.md`

제외:
- `node_modules/`
- `test-results/`
- `dist/`, `.next/`, `build/`
- 자동 생성 파일 (`tsconfig.tsbuildinfo` 등)

---

## 갱신 주기

- 새 문서 추가 / 큰 변경 후 `node rag/build.mjs` 실행
- CI 에서 머지 전 자동 빌드 (옵션)
- 에이전트가 `index.json` 수정날짜가 7일 이상 오래되면 재빌드 권장 안내

---

## 폴더 구조

```
rag/
├── README.md         ← 이 문서
├── build.mjs         ← 인덱싱
├── search.mjs        ← 검색 CLI
├── lib/
│   ├── tokenize.mjs  ← 한국어 + 영문 tokenizer (간단)
│   ├── score.mjs     ← BM25-ish
│   └── walk.mjs      ← 파일 수집
└── index.json        ← 빌드 산출물 (커밋 여부는 사용자 결정)
```
