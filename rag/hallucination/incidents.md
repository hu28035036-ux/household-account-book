# Hallucination Incidents — 발생 사례 영구 기록

[`/harness/runbook.md`](../../harness/runbook.md) 가 검증/테스트 실수 기록이라면, 이 문서는 **에이전트 / RAG 가 만든 가짜 인용·정보의 영구 기록**.

운영 책임: `curator` (메타 흐름 7단계에서 발견 시 기록).

---

## 0. 왜 별도 파일인가

- runbook 은 *도구 / 게이트* 의 실수
- 본 파일은 *사용자에게 도달했거나 도달할 뻔한 가짜 정보*
- 두 카테고리를 섞으면 우선순위 / 운영자 / 재발 방지 메커니즘이 흐려짐

---

## 1. 기록 형식

```markdown
### hi-NNNN — <짧은 제목>
- 발생 시점: YYYY-MM-DD HH:MM
- 단계: agent-answer | rag-citation | extraction | other
- 사용자 영향: yes / no / nearly (송출 전 차단)
- 발견자: 본인 자기 점검 / verify-citations / 사용자 / curator

**가짜 인용 / 정보**
- raw text: "<원문 그대로>"
- citation: <kind, value>
- 실재 검증 결과: <어떻게 가짜인지 입증>

**왜 일어났나** (원인 분석)
- 추측 진행했나 / 검색 우회했나 / 컨텍스트 혼동인가

**시도한 수정과 결과**
1. ... → 통과/실패

**최종 해결**
- 답변에서 제거 / 정정 / 사용자 보고

**재발 방지**
- patterns.json 에 추가한 패턴: <id>
- self-test 케이스 추가: <id>
- 흐름 갱신: <어디>
```

`hi-` prefix = "hallucination incident". runbook 의 `incident-` 와 구별.

---

## 2. 시드 — 본 시스템 구축 직전 / 중에 마주칠 수 있는 패턴

### hi-0000 — 시드: 본 도구 자체의 첫 가짜 시나리오 (예시)
- 발생 시점: 2026-05-08 (도구 첫 작성 + self-test 작성 시 가상 시나리오)
- 단계: agent-answer (가상)
- 사용자 영향: no (실제 발생 아님 — self-test 의 hallucination-001 케이스 그대로)
- 발견자: verify-citations.mjs 도구 첫 시험 실행

**가짜 인용 / 정보**
- raw text (예시; 백틱으로 감싸 verify-citations 가 무시):
  `src/lib/budget/calculator.ts 에서 §9-A-77 위반. incident-0042 참고. commit abc1234567890.`
- citations: file, section, incident, commit — 4건 모두 가짜
- 실재 검증 결과: 모두 fs/CONTRACT/runbook/git 에서 미발견

**왜 일어났나**
- 이 항목은 *도구 검증 시드* 다. 실제 사고가 아니라 도구가 어떻게 가짜를 잡는지 보여주는 예시.

**최종 해결**
- 본 도구 (verify-citations.mjs) 가 4건 모두 차단 → 사용자 송출 전 단계에서 잡힘

**재발 방지**
- self-test: `harness/test/cases/hallucination.mjs` 가 `rag/hallucination/cases/agent-fake-citations-001.json` 케이스 회귀
- patterns.json: agent-fake-file-path, agent-fake-contract-section, agent-fake-incident, agent-fake-commit 4개 등록

---

## 3. 진짜 사고가 발생하면 (운영 가이드)

1. **즉시 사용자 보고** — 가짜를 보낸 게 확인되면 정정. AGENT_BEHAVIOR §1 "냉정 판단" 직접 적용.
2. **본 파일에 hi-NNNN 추가** — 양식 그대로
3. **patterns.json 갱신** — 새 패턴이면 등록
4. **self-test 케이스 추가** — `rag/hallucination/cases/<id>.json` + 회귀로 누적
5. **CONTRACT / AGENT_BEHAVIOR 영향** 재검토 — 새 가드 필요한지

---

## 4. 통계

| 분기 | 누적 hi | 사용자 도달 | nearly (송출 전 차단) |
|---|---|---|---|
| 2026-Q2 | 1 (시드) | 0 | 0 |

진짜 사고는 0건. 본 도구가 운영 시작.

---

## 운영 메모

- hi 번호는 4자리 zero-pad
- 추가만, 기존 항목 수정 금지
- 정정은 `hi-NNNN-correction` 항목 신규 추가
- 분기별 통계는 §4 갱신만, 본 항목 자체는 보존
