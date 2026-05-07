#!/usr/bin/env node
/**
 * AI 어시스턴트 LLM 통합 테스트.
 * 실제 OpenAI API 호출. 한 번 실행 ~10원 비용.
 *
 * 실행: node scripts/test-assistant-llm.mjs
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ----- .env.local 로드 -----
const envText = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) {
  console.error('OPENAI_API_KEY 누락');
  process.exit(2);
}

// ----- system prompt 인라인 (TS 임포트 회피) -----
const TODAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

const CATEGORIES = ['식비', '카페/간식', '편의점', '교통', '주거', '통신', '여가', '쇼핑', '의료', '구독/서비스', '급여', '기타'];
const PMS = ['신한카드', '국민카드', '현금'];

function buildSystemPrompt() {
  return `너는 한국어 가계부 입력 비서다. 사용자의 짧은 자연어 명령을 정확한 JSON intent 로 변환한다.

# 출력 규칙
- 출력은 반드시 JSON 한 객체. 다른 텍스트·마크다운 X.
- type 중 정확히 하나 선택: add_transaction, update_transaction, delete_transaction, create_category, delete_category, create_payment_method, delete_payment_method, set_budget, create_recurring, navigate, clarify, unknown
- 가계부와 무관한 인사·잡담만 unknown.
- 짧은 페이지 이름 키워드("고정거래", "모임", "가이드", "설정", "후보", "통계", "예산", "캘린더", "거래" 등) 는 무조건 navigate.
- navigate 의 destination 은 정확히 다음 enum 중 하나 (오타 X, 단복수 X):
  calendar | stats | transactions | candidates | budgets | categories | payment_methods | recurring | households | ai_history | files | guide | settings

# 컨텍스트
- 오늘: ${TODAY}
- 카테고리: ${CATEGORIES.join(', ')}
- 결제수단: ${PMS.join(', ')}

# 변환 규칙
- 날짜: YYYY-MM-DD. "오늘"=오늘, "어제"=오늘-1.
- 금액: 정수 원. "5천"=5000, "1.5만"=15000, "350만"=3500000.
- 가맹점 줄임말: 스벅=스타벅스, 지에스=GS25, 씨유=CU, 넷플=넷플릭스 등.
- 수입 키워드: 월급, 급여, 환급, 들어옴, 입금 → income.

# 예시
입력: "스벅 5천"
출력: {"type":"add_transaction","data":{"type":"expense","date":"${TODAY}","amount":5000,"merchant_name":"스타벅스","category_name":"카페/간식"}}

입력: "이번달 분석"
출력: {"type":"navigate","data":{"destination":"stats","year_month_hint":"this_month"}}

입력: "운동 카테고리 만들어"
출력: {"type":"create_category","data":{"name":"운동","type":"common"}}

입력: "이번달 예산 80만"
출력: {"type":"set_budget","data":{"year_month":"${TODAY.slice(0, 7)}","amount":800000,"category_name":null}}

입력: "방금 거 취소"
출력: {"type":"delete_transaction","target":{"selector":"last"}}

입력: "방금거 만오천으로"
출력: {"type":"update_transaction","target":{"selector":"last"},"patch":{"amount":15000}}

입력: "고정거래"
출력: {"type":"navigate","data":{"destination":"recurring"}}

입력: "모임"
출력: {"type":"navigate","data":{"destination":"households"}}

입력: "가이드"
출력: {"type":"navigate","data":{"destination":"guide"}}

입력: "설정"
출력: {"type":"navigate","data":{"destination":"settings"}}

입력: "후보"
출력: {"type":"navigate","data":{"destination":"candidates"}}

입력: "예산 페이지"
출력: {"type":"navigate","data":{"destination":"budgets"}}

입력: "월급 350만 매월 25일"
출력: {"type":"create_recurring","data":{"type":"income","amount":3500000,"merchant_name":"월급","frequency":"monthly","day_of_month":25,"category_name":"급여","auto_post":false}}

입력: "5천"
출력: {"type":"clarify","question":"어디에서 쓰셨어요?","suggestions":["스벅 5천","GS 5천"]}

입력: "ㅎㅇ"
출력: {"type":"unknown","reason":"가계부 명령으로 보이지 않습니다."}

이제 다음 사용자 입력을 분석해서 위 형식 중 하나로만 응답하라.`;
}

async function callOpenAI(system, command) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: command },
      ],
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? '';
}

const TESTS = [
  // --- navigate ---
  { input: '통계 보여줘', expectType: 'navigate', expect: (o) => o.data.destination === 'stats' },
  { input: '이번달 분석', expectType: 'navigate', expect: (o) => o.data.destination === 'stats' && o.data.year_month_hint === 'this_month' },
  { input: '지난달 통계', expectType: 'navigate', expect: (o) => o.data.destination === 'stats' && o.data.year_month_hint === 'last_month' },
  { input: '캘린더로 가', expectType: 'navigate', expect: (o) => o.data.destination === 'calendar' },
  { input: '거래내역 열어', expectType: 'navigate', expect: (o) => o.data.destination === 'transactions' },
  { input: '예산 페이지', expectType: 'navigate', expect: (o) => o.data.destination === 'budgets' },
  { input: '후보 검토', expectType: 'navigate', expect: (o) => o.data.destination === 'candidates' },
  { input: '고정거래', expectType: 'navigate', expect: (o) => o.data.destination === 'recurring' },
  { input: '모임', expectType: 'navigate', expect: (o) => o.data.destination === 'households' },
  { input: '가이드', expectType: 'navigate', expect: (o) => o.data.destination === 'guide' },
  { input: '설정', expectType: 'navigate', expect: (o) => o.data.destination === 'settings' },

  // --- add_transaction ---
  { input: '스벅 5천', expectType: 'add_transaction', expect: (o) => o.data.amount === 5000 && (o.data.merchant_name?.includes('스타벅스') || o.data.merchant_name?.includes('스벅')) },
  { input: '오늘 점심 8천', expectType: 'add_transaction', expect: (o) => o.data.amount === 8000 && o.data.type === 'expense' },
  { input: '월급 350만 받음', expectType: 'add_transaction', expect: (o) => o.data.type === 'income' && o.data.amount === 3500000 },
  { input: '넷플 17000', expectType: 'add_transaction', expect: (o) => o.data.amount === 17000 && (o.data.merchant_name?.includes('넷플') || o.data.merchant_name?.includes('Netflix')) },
  { input: 'cu 1500', expectType: 'add_transaction', expect: (o) => o.data.amount === 1500 },

  // --- update / delete ---
  { input: '방금거 만오천으로', expectType: 'update_transaction', expect: (o) => o.target?.selector === 'last' && o.patch?.amount === 15000 },
  { input: '방금 거 취소', expectType: 'delete_transaction', expect: (o) => o.target.selector === 'last' },

  // --- create category / pm / budget ---
  { input: '운동 카테고리 만들어줘', expectType: 'create_category', expect: (o) => o.data.name.includes('운동') },
  { input: '토스카드 결제수단 추가', expectType: 'create_payment_method', expect: (o) => o.data.name.includes('토스') },
  { input: '이번달 예산 80만', expectType: 'set_budget', expect: (o) => o.data.amount === 800000 },
  { input: '이번달 식비 30만으로', expectType: 'set_budget', expect: (o) => o.data.amount === 300000 && o.data.category_name === '식비' },

  // --- create_recurring ---
  { input: '월급 350만 매월 25일 자동등록', expectType: 'create_recurring', expect: (o) => o.data.frequency === 'monthly' && o.data.day_of_month === 25 && o.data.amount === 3500000 },
  { input: '넷플 17000 매월 5일', expectType: 'create_recurring', expect: (o) => o.data.frequency === 'monthly' && o.data.day_of_month === 5 },

  // --- clarify / unknown ---
  { input: '5천', expectType: 'clarify' },
  // "분석해줘" 는 navigate(stats) 로 가도 합리적 — 둘 다 OK
  { input: '분석해줘', expectType: ['clarify', 'navigate'] },
  { input: '삭제', expectType: 'clarify' },
  { input: 'ㅎㅇ', expectType: 'unknown' },
  { input: '날씨 어때', expectType: 'unknown' },
];

async function run() {
  const system = buildSystemPrompt();
  let pass = 0, fail = 0;
  const failures = [];

  for (const t of TESTS) {
    try {
      const raw = await callOpenAI(system, t.input);
      const obj = JSON.parse(raw);
      const expectTypes = Array.isArray(t.expectType) ? t.expectType : [t.expectType];
      const typeOk = expectTypes.includes(obj.type);
      const dataOk = typeOk && (!t.expect || t.expect(obj));
      if (typeOk && dataOk) {
        console.log(`[OK]   "${t.input}" → ${obj.type}`);
        pass++;
      } else {
        console.log(`[FAIL] "${t.input}" → ${obj.type} (기대: ${t.expectType})`);
        console.log(`       ${JSON.stringify(obj)}`);
        fail++;
        failures.push({ input: t.input, got: obj, expected: t.expectType });
      }
    } catch (e) {
      console.log(`[ERR]  "${t.input}" — ${e.message}`);
      fail++;
      failures.push({ input: t.input, error: e.message });
    }
  }

  console.log(`\n결과: ${pass}/${pass + fail} 통과`);
  if (fail > 0) {
    console.log('\n실패 목록:');
    for (const f of failures) console.log(JSON.stringify(f, null, 2));
    process.exit(1);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(2);
});
