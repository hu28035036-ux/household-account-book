import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { llmGenerate } from '@/lib/ai/llmRouter';

// gpt-4o-mini 가격 (2026 기준). 모델이 바뀌어도 코드만 한 줄 수정.
const PRICE_USD_PER_M = { input: 0.15, output: 0.6 };
const USD_TO_KRW = 1400;

export type StatsAiResult = {
  range: { from: string; to: string };
  totals: { expense: number; income: number; balance: number };
  transaction_count: number;
  summary: string;
  tips: Array<{ title: string; body: string; savable_won: number | null }>;
  model: string;
  cost: { input_tokens: number; output_tokens: number; usd: number; krw: number };
  generated_at: string;
};

const ResultSchema = z.object({
  summary: z.string().max(2000).default('').catch(''),
  tips: z
    .array(
      z.object({
        title: z.string().max(120).default('').catch(''),
        body: z.string().max(500).default('').catch(''),
        savable_won: z.number().nullable().optional().catch(null),
      }),
    )
    .default([])
    .catch([]),
});

export async function runStatsAiAnalysis(
  supabase: SupabaseClient,
  userId: string,
  from: string, // YYYY-MM-DD
  to: string,
  householdContext: string | null = null,
): Promise<StatsAiResult> {
  // 1) 기간 + 컨텍스트 거래 fetch
  let q = supabase
    .from('transactions')
    .select('type, amount, transaction_date, categories(name)')
    .gte('transaction_date', from)
    .lte('transaction_date', to);
  if (householdContext) q = q.eq('household_id', householdContext);
  else q = q.eq('user_id', userId).is('household_id', null);

  const { data: txs, error } = await q;
  if (error) throw error;

  // 2) 집계
  let totalExpense = 0;
  let totalIncome = 0;
  const byCategory: Record<string, number> = {};
  for (const t of txs ?? []) {
    const amt = Number(t.amount);
    if (t.type === 'expense') {
      totalExpense += amt;
      const name = (t as any).categories?.name ?? '미지정';
      byCategory[name] = (byCategory[name] ?? 0) + amt;
    } else if (t.type === 'income') {
      totalIncome += amt;
    }
  }
  const topCategories = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const transactionCount = (txs ?? []).length;

  // 3) 거래가 너무 적으면 LLM 호출 생략 (비용 보호)
  if (transactionCount === 0) {
    return {
      range: { from, to },
      totals: { expense: totalExpense, income: totalIncome, balance: totalIncome - totalExpense },
      transaction_count: 0,
      summary: '선택한 기간에 거래가 없어 분석을 건너뜁니다.',
      tips: [],
      model: 'skip',
      cost: { input_tokens: 0, output_tokens: 0, usd: 0, krw: 0 },
      generated_at: new Date().toISOString(),
    };
  }

  // 4) 프롬프트
  const lines: string[] = [];
  lines.push(`기간: ${from} ~ ${to}`);
  lines.push(`총 지출: ${totalExpense.toLocaleString('ko-KR')}원`);
  lines.push(`총 수입: ${totalIncome.toLocaleString('ko-KR')}원`);
  lines.push(`순 잔액: ${(totalIncome - totalExpense).toLocaleString('ko-KR')}원`);
  lines.push(`거래 수: ${transactionCount}건`);
  lines.push('');
  lines.push('카테고리별 지출 합계:');
  for (const [name, amount] of topCategories) {
    const pct = totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0;
    lines.push(`- ${name}: ${amount.toLocaleString('ko-KR')}원 (${pct}%)`);
  }

  const prompt = `너는 한국어 가계부 분석기다. 아래 데이터를 바탕으로
(A) 한 단락(2~4문장)의 요약과
(B) 절약 제안 3~5개를 작성한다.
요약은 어디에 많이 썼고 어떤 패턴이 보이는지 설명하라.
제안은 실용적으로, 가능하면 월 절약액 추정치(savable_won, 정수 원 단위)를 포함하라.
추정 어려우면 savable_won 은 null.
JSON 객체만 출력. 코드블록 / 추가 텍스트 금지.

[DATA]
${lines.join('\n')}

[OUTPUT_JSON_SCHEMA]
{
  "summary": "string",
  "tips": [
    { "title": "string", "body": "string", "savable_won": number | null }
  ]
}`;

  // 5) LLM 호출
  const { content, usage, model } = await llmGenerate({ prompt, temperature: 0.3 });

  // 6) 응답 파싱 (코드블록 제거 + JSON 부분만)
  let s = content.trim();
  s = s.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  const parsed = ResultSchema.parse(JSON.parse(s));

  // 7) 비용 계산
  const usd =
    (usage.input * PRICE_USD_PER_M.input + usage.output * PRICE_USD_PER_M.output) / 1_000_000;
  const krw = Math.round(usd * USD_TO_KRW * 100) / 100;

  return {
    range: { from, to },
    totals: { expense: totalExpense, income: totalIncome, balance: totalIncome - totalExpense },
    transaction_count: transactionCount,
    summary: parsed.summary,
    tips: parsed.tips.map((t) => ({
      title: t.title,
      body: t.body,
      savable_won: t.savable_won ?? null,
    })),
    model,
    cost: { input_tokens: usage.input, output_tokens: usage.output, usd, krw },
    generated_at: new Date().toISOString(),
  };
}

/**
 * 분석 결과를 ai_stats_analyses 테이블에 저장.
 * 모임 컨텍스트면 household_id 도 함께 저장 → 모임 멤버 전체가 select 가능.
 */
export async function saveStatsAiAnalysis(
  supabase: SupabaseClient,
  userId: string,
  householdContext: string | null,
  result: StatsAiResult,
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('ai_stats_analyses')
    .insert({
      user_id: userId,
      household_id: householdContext,
      range_from: result.range.from,
      range_to: result.range.to,
      totals: result.totals as any,
      transaction_count: result.transaction_count,
      summary: result.summary,
      tips: result.tips as any,
      model: result.model,
      input_tokens: result.cost.input_tokens,
      output_tokens: result.cost.output_tokens,
      cost_usd: result.cost.usd,
      cost_krw: result.cost.krw,
    })
    .select('id')
    .single();
  if (error) throw error;
  return { id: data.id as string };
}

export type StatsAiHistoryRow = StatsAiResult & {
  id: string;
  created_at: string;
  household_id: string | null;
};

export async function listStatsAiHistory(
  supabase: SupabaseClient,
  userId: string,
  householdContext: string | null,
  limit = 20,
): Promise<StatsAiHistoryRow[]> {
  let q = supabase
    .from('ai_stats_analyses')
    .select(
      'id, user_id, household_id, range_from, range_to, totals, transaction_count, summary, tips, model, input_tokens, output_tokens, cost_usd, cost_krw, created_at',
    );
  if (householdContext) {
    q = q.eq('household_id', householdContext);
  } else {
    q = q.eq('user_id', userId).is('household_id', null);
  }
  const { data, error } = await q.order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    range: { from: r.range_from, to: r.range_to },
    totals: r.totals,
    transaction_count: r.transaction_count,
    summary: r.summary,
    tips: r.tips,
    model: r.model,
    cost: {
      input_tokens: r.input_tokens,
      output_tokens: r.output_tokens,
      usd: Number(r.cost_usd),
      krw: Number(r.cost_krw),
    },
    generated_at: r.created_at,
    created_at: r.created_at,
    household_id: r.household_id,
  }));
}

export async function deleteStatsAiHistory(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from('ai_stats_analyses')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}
