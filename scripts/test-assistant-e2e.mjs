#!/usr/bin/env node
/**
 * AI 어시스턴트 E2E (실 DB).
 *
 * Service role 로 임시 사용자 생성 → 실제 LLM 호출 → 실 transactions 테이블 INSERT →
 * 결과 SELECT 검증 → 정리.
 *
 * 실행: node scripts/test-assistant-e2e.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ----- env 로드 -----
const envText = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!SUPA_URL || !SERVICE_KEY || !OPENAI_KEY) {
  console.error('필수 env 누락');
  process.exit(2);
}

const admin = createClient(SUPA_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ----- 임시 사용자 보장 -----
const TEST_EMAIL = 'e2e-assistant-test@example.com';

async function ensureTestUser() {
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list.users.find((u) => u.email === TEST_EMAIL);
  if (existing) return existing.id;
  const { data: created, error } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    email_confirm: true,
  });
  if (error) throw error;
  return created.user.id;
}

// ----- LLM 호출 (assistantPrompt 와 동일 프롬프트 인라인) -----
const TODAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

async function llm(userInput) {
  const system = `너는 한국어 가계부 입력 비서다. 사용자의 짧은 자연어 명령을 정확한 JSON intent 로 변환한다.
출력은 반드시 JSON 한 객체. 다른 텍스트·마크다운 X.
type 중 정확히 하나 선택: add_transaction, update_transaction, delete_transaction, create_category, delete_category, create_payment_method, delete_payment_method, set_budget, create_recurring, navigate, clarify, unknown
오늘: ${TODAY}
짧은 페이지 키워드("통계", "예산", "후보", "고정거래" 등)는 navigate.
가맹점 줄임말: 스벅=스타벅스, 지에스=GS25, 씨유=CU, 넷플=넷플릭스.
금액: 5천=5000, 1.5만=15000, 350만=3500000.
수입 키워드: 월급, 환급, 들어옴 → income.
결제수단 종류: card | bank | cash | pay | other.
카테고리 용도: income | expense | common.

예시:
입력: "스벅 5천"
출력: {"type":"add_transaction","data":{"type":"expense","date":"${TODAY}","amount":5000,"merchant_name":"스타벅스","category_name":"카페/간식"}}

입력: "통계 보여줘"
출력: {"type":"navigate","data":{"destination":"stats"}}

입력: "운동 카테고리 만들어"
출력: {"type":"create_category","data":{"name":"운동","type":"common"}}

입력: "토스카드 결제수단 추가"
출력: {"type":"create_payment_method","data":{"name":"토스카드","type":"card"}}

입력: "현금 결제수단 만들어"
출력: {"type":"create_payment_method","data":{"name":"현금","type":"cash"}}

입력: "이번달 예산 80만"
출력: {"type":"set_budget","data":{"year_month":"${TODAY.slice(0, 7)}","amount":800000,"category_name":null}}

입력: "식비 예산 30만"
출력: {"type":"set_budget","data":{"year_month":"${TODAY.slice(0, 7)}","amount":300000,"category_name":"식비"}}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userInput },
      ],
    }),
  });
  const j = await res.json();
  return JSON.parse(j.choices[0].message.content);
}

// ----- assistantService.executeIntent 인라인 (DB 실 호출) -----
async function executeCreateCategory(userId, intent) {
  if (intent.type !== 'create_category') return null;
  const d = intent.data;
  const { data, error } = await admin
    .from('categories')
    .insert({ user_id: userId, name: d.name, type: d.type, is_default: false })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function executeCreatePaymentMethod(userId, intent) {
  if (intent.type !== 'create_payment_method') return null;
  const d = intent.data;
  const { data, error } = await admin
    .from('payment_methods')
    .insert({ user_id: userId, name: d.name, type: d.type, is_default: false })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function executeSetBudget(userId, intent) {
  if (intent.type !== 'set_budget') return null;
  const d = intent.data;
  const month_start = `${d.year_month}-01`;

  let category_id = null;
  if (d.category_name) {
    const { data: cat } = await admin
      .from('categories')
      .select('id')
      .eq('user_id', userId)
      .ilike('name', d.category_name)
      .limit(1)
      .maybeSingle();
    category_id = cat?.id ?? null;
  }

  // 기존 row check
  let exQ = admin
    .from('budgets')
    .select('id')
    .eq('user_id', userId)
    .is('household_id', null)
    .eq('month_start', month_start);
  if (category_id) exQ = exQ.eq('category_id', category_id);
  else exQ = exQ.is('category_id', null);
  const { data: existing } = await exQ.maybeSingle();

  if (existing) {
    const { data, error } = await admin
      .from('budgets')
      .update({ amount: d.amount, alert_threshold: 0.8 })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await admin
    .from('budgets')
    .insert({
      user_id: userId,
      category_id,
      month_start,
      amount: d.amount,
      alert_threshold: 0.8,
      household_id: null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function executeAddTransaction(userId, intent) {
  if (intent.type !== 'add_transaction') return null;
  const d = intent.data;

  let category_id = null;
  if (d.category_name) {
    const { data } = await admin
      .from('categories')
      .select('id')
      .eq('user_id', userId)
      .ilike('name', d.category_name)
      .limit(1)
      .maybeSingle();
    category_id = data?.id ?? null;
  }

  const { data: tx, error } = await admin
    .from('transactions')
    .insert({
      user_id: userId,
      transaction_date: d.date,
      type: d.type,
      amount: d.amount,
      merchant_name: d.merchant_name ?? null,
      description: d.description ?? '',
      category_id,
      payment_method_id: null,
      source_type: 'manual',
      is_ai_generated: false,
      is_confirmed: true,
    })
    .select('*')
    .single();
  if (error) throw error;
  return tx;
}

async function fetchUserCategories(userId) {
  const seedNames = [
    '식비', '카페/간식', '편의점', '교통', '주거', '통신', '여가', '쇼핑', '의료',
    '구독/서비스', '급여', '기타',
  ];
  // 시드 카테고리가 있는지 확인하고 없으면 생성
  const { data: existing } = await admin
    .from('categories')
    .select('name')
    .eq('user_id', userId);
  const have = new Set((existing ?? []).map((c) => c.name));
  const toInsert = seedNames
    .filter((n) => !have.has(n))
    .map((n) => ({ user_id: userId, name: n, type: 'common', is_default: true }));
  if (toInsert.length > 0) {
    await admin.from('categories').insert(toInsert);
  }
}

async function cleanup(userId) {
  await admin.from('transactions').delete().eq('user_id', userId);
  await admin.from('budgets').delete().eq('user_id', userId);
  // 테스트 카테고리 (시드가 아닌 것) + 결제수단 정리
  await admin
    .from('categories')
    .delete()
    .eq('user_id', userId)
    .in('name', ['운동', '반려동물', '여행']);
  await admin
    .from('payment_methods')
    .delete()
    .eq('user_id', userId)
    .in('name', ['토스카드', '현금', '카뱅체크']);
}

// ----- 테스트 케이스 -----
const TX_CASES = [
  {
    name: '스벅 5천 → 지출 5,000원 / 카테고리: 카페/간식',
    input: '스벅 5천',
    verify: (tx) =>
      tx.type === 'expense' &&
      tx.amount === 5000 &&
      tx.merchant_name === '스타벅스' &&
      tx.transaction_date === TODAY,
  },
  {
    name: '오늘 점심 8천 → 지출 8,000원',
    input: '오늘 점심 8천',
    verify: (tx) => tx.type === 'expense' && tx.amount === 8000 && tx.transaction_date === TODAY,
  },
  {
    name: '월급 100만 받음 → 수입 1,000,000원',
    input: '월급 100만 받음',
    verify: (tx) => tx.type === 'income' && tx.amount === 1000000,
  },
  {
    name: '넷플 17000 → 지출 17,000원 / 가맹점: 넷플릭스',
    input: '넷플 17000',
    verify: (tx) =>
      tx.type === 'expense' &&
      tx.amount === 17000 &&
      (tx.merchant_name?.includes('넷플') || tx.merchant_name?.includes('Netflix')),
  },
  {
    name: 'cu 1500 → 지출 1,500원',
    input: 'cu 1500',
    verify: (tx) => tx.type === 'expense' && tx.amount === 1500,
  },
];

const CAT_CASES = [
  {
    name: '"운동 카테고리 만들어" → name=운동',
    input: '운동 카테고리 만들어',
    verify: (cat) => cat.name === '운동' && ['common', 'expense'].includes(cat.type),
  },
  {
    name: '"반려동물 카테고리 추가" → name=반려동물',
    input: '반려동물 카테고리 추가',
    verify: (cat) => cat.name === '반려동물',
  },
];

const PM_CASES = [
  {
    name: '"토스카드 결제수단 추가" → type=card',
    input: '토스카드 결제수단 추가',
    verify: (pm) => pm.name === '토스카드' && pm.type === 'card',
  },
  {
    name: '"현금 결제수단 만들어" → type=cash',
    input: '현금 결제수단 만들어',
    verify: (pm) => pm.name === '현금' && pm.type === 'cash',
  },
];

const BUDGET_CASES = [
  {
    name: '"이번달 예산 80만" → 전체 예산 800,000원',
    input: '이번달 예산 80만',
    verify: (b) =>
      b.amount === 800000 &&
      b.category_id === null &&
      b.month_start === `${TODAY.slice(0, 7)}-01`,
  },
  {
    name: '"이번달 식비 30만으로" → 식비 카테고리 예산 300,000원',
    input: '이번달 식비 30만으로',
    verify: (b) =>
      b.amount === 300000 &&
      b.category_id !== null &&
      b.month_start === `${TODAY.slice(0, 7)}-01`,
  },
];

async function run() {
  const userId = await ensureTestUser();
  console.log(`테스트 사용자: ${TEST_EMAIL} (${userId.slice(0, 8)}…)`);

  await fetchUserCategories(userId);
  console.log('시드 카테고리 ready');

  await cleanup(userId);
  console.log('이전 테스트 데이터 cleanup\n');

  let pass = 0, fail = 0;

  console.log('\n=== 거래 추가 ===');
  for (const c of TX_CASES) {
    try {
      const intent = await llm(c.input);
      if (intent.type !== 'add_transaction') {
        console.log(`[FAIL] ${c.name}\n       LLM 이 ${intent.type} 응답`);
        fail++;
        continue;
      }
      const tx = await executeAddTransaction(userId, intent);
      if (c.verify(tx, intent)) {
        console.log(`[OK]   ${c.name}`);
        console.log(`       → tx ${tx.id.slice(0, 8)}… ${tx.type} ${tx.amount.toLocaleString('ko-KR')}원`);
        pass++;
      } else {
        console.log(`[FAIL] ${c.name}\n       got: ${JSON.stringify({ type: tx.type, amount: tx.amount, merchant: tx.merchant_name })}`);
        fail++;
      }
    } catch (e) {
      console.log(`[ERR]  ${c.name} — ${e.message}`);
      fail++;
    }
  }

  console.log('\n=== 카테고리 생성 ===');
  for (const c of CAT_CASES) {
    try {
      const intent = await llm(c.input);
      if (intent.type !== 'create_category') {
        console.log(`[FAIL] ${c.name}\n       LLM 이 ${intent.type} 응답`);
        fail++;
        continue;
      }
      const cat = await executeCreateCategory(userId, intent);
      if (c.verify(cat, intent)) {
        console.log(`[OK]   ${c.name} → cat ${cat.id.slice(0, 8)}… name="${cat.name}" type=${cat.type}`);
        pass++;
      } else {
        console.log(`[FAIL] ${c.name}\n       got: ${JSON.stringify({ name: cat.name, type: cat.type })}`);
        fail++;
      }
    } catch (e) {
      console.log(`[ERR]  ${c.name} — ${e.message}`);
      fail++;
    }
  }

  console.log('\n=== 결제수단 생성 ===');
  for (const c of PM_CASES) {
    try {
      const intent = await llm(c.input);
      if (intent.type !== 'create_payment_method') {
        console.log(`[FAIL] ${c.name}\n       LLM 이 ${intent.type} 응답`);
        fail++;
        continue;
      }
      const pm = await executeCreatePaymentMethod(userId, intent);
      if (c.verify(pm, intent)) {
        console.log(`[OK]   ${c.name} → pm ${pm.id.slice(0, 8)}… name="${pm.name}" type=${pm.type}`);
        pass++;
      } else {
        console.log(`[FAIL] ${c.name}\n       got: ${JSON.stringify({ name: pm.name, type: pm.type })}`);
        fail++;
      }
    } catch (e) {
      console.log(`[ERR]  ${c.name} — ${e.message}`);
      fail++;
    }
  }

  console.log('\n=== 예산 설정 ===');
  for (const c of BUDGET_CASES) {
    try {
      const intent = await llm(c.input);
      if (intent.type !== 'set_budget') {
        console.log(`[FAIL] ${c.name}\n       LLM 이 ${intent.type} 응답`);
        fail++;
        continue;
      }
      const b = await executeSetBudget(userId, intent);
      if (c.verify(b, intent)) {
        console.log(
          `[OK]   ${c.name} → budget ${b.id.slice(0, 8)}… ${b.amount.toLocaleString('ko-KR')}원 (${b.category_id ? '카테고리별' : '전체'})`,
        );
        pass++;
      } else {
        console.log(
          `[FAIL] ${c.name}\n       got: ${JSON.stringify({ amount: b.amount, category_id: b.category_id, month_start: b.month_start })}`,
        );
        fail++;
      }
    } catch (e) {
      console.log(`[ERR]  ${c.name} — ${e.message}`);
      fail++;
    }
  }

  console.log(`\n결과: ${pass}/${pass + fail} 통과`);

  // 정리
  await cleanup(userId);
  console.log('테스트 데이터 cleanup 완료');

  if (fail > 0) process.exit(1);
}

run().catch((e) => {
  console.error('치명적 오류:', e);
  process.exit(2);
});
