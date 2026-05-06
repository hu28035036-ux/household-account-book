import type { SupabaseClient } from '@supabase/supabase-js';
import { applyLearningPostprocess } from './learningService';
import { checkDuplicate } from '@/lib/duplicate/check';
import { maskAll } from '@/lib/security/masking';
import { suggestCategoryByMerchant } from '@/lib/import/categoryHeuristic';
import { llmGenerate, LLMUnavailableError } from '@/lib/ai/llmRouter';

type Candidate = {
  transaction_date: string | null;
  type: 'income' | 'expense' | 'transfer';
  amount: number | null;
  merchant_name: string | null;
  description: string;
  payment_method_suggestion: string | null;
  category_suggestion: string | null;
  raw_text_basis: string;
  warnings: string[];
};

export async function importCandidates(
  supabase: SupabaseClient,
  userId: string,
  candidates: Candidate[],
  options: { useLlmFallback?: boolean } = {},
) {
  // 중복 검사용 최근 30일 거래
  const thirty = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: recentTx } = await supabase
    .from('transactions')
    .select('transaction_date, amount, merchant_name, payment_method_id')
    .eq('user_id', userId)
    .gte('transaction_date', thirty);

  // 1차 가공: 학습 규칙(A) + 휴리스틱 사전(B) 적용
  type Enriched = Candidate & {
    cc: {
      merchant_name: string | null;
      category_suggestion: string | null;
      payment_method_suggestion: string | null;
      confidence: number;
      warnings: string[];
    };
  };
  const enriched: Enriched[] = [];
  for (const c of candidates) {
    let cc = {
      merchant_name: c.merchant_name,
      category_suggestion: c.category_suggestion,
      payment_method_suggestion: c.payment_method_suggestion,
      confidence: 0.7,
      warnings: [...c.warnings],
    };
    cc = await applyLearningPostprocess(supabase, userId, cc); // A
    if (!cc.category_suggestion) {
      const heur = suggestCategoryByMerchant(cc.merchant_name, c.type); // B
      if (heur) {
        cc.category_suggestion = heur;
        cc.confidence = Math.min(1, cc.confidence + 0.05);
      }
    }
    enriched.push({ ...c, cc });
  }

  // 2차 가공(옵션 C): 카테고리가 비어있는 행만 묶어 LLM 한 번 호출
  if (options.useLlmFallback) {
    const need = enriched.filter((e) => !e.cc.category_suggestion && e.cc.merchant_name);
    if (need.length > 0) {
      const { data: cats } = await supabase
        .from('categories')
        .select('name')
        .eq('user_id', userId);
      const categoryNames = (cats ?? []).map((c: any) => c.name as string);
      try {
        const map = await classifyMerchantsBatch(
          need.map((e) => e.cc.merchant_name as string),
          categoryNames,
        );
        for (const e of need) {
          const m = map[String(e.cc.merchant_name).trim()] ?? null;
          if (m && categoryNames.includes(m)) {
            e.cc.category_suggestion = m;
            e.cc.confidence = Math.min(1, e.cc.confidence + 0.1);
          }
        }
      } catch (err) {
        // LLM 실패해도 정상 흐름은 유지 — 카테고리 비어있는 채로 후보 등록.
        if (!(err instanceof LLMUnavailableError)) console.warn('[import] LLM batch failed', err);
      }
    }
  }

  // 3차: 끝까지 카테고리 매칭 안 된 행은 'category_uncertain' 경고 부착
  for (const e of enriched) {
    if (!e.cc.category_suggestion && e.cc.merchant_name) {
      if (!e.cc.warnings.includes('category_uncertain')) {
        e.cc.warnings.push('category_uncertain');
        e.cc.confidence = Math.max(0, e.cc.confidence - 0.1);
      }
    }
  }

  const inserted: any[] = [];
  for (const e of enriched) {
    const dup = checkDuplicate(
      {
        transaction_date: e.transaction_date,
        amount: e.amount,
        merchant_name: e.cc.merchant_name,
        payment_method_suggestion: e.cc.payment_method_suggestion,
      },
      (recentTx ?? []) as any[],
    );

    const { data: row, error } = await supabase
      .from('transaction_candidates')
      .insert({
        user_id: userId,
        uploaded_file_id: null,
        transaction_date: e.transaction_date,
        type: e.type,
        amount: e.amount,
        merchant_name: e.cc.merchant_name,
        description: e.description ?? '',
        category_suggestion: e.cc.category_suggestion,
        payment_method_suggestion: e.cc.payment_method_suggestion,
        confidence: e.cc.confidence,
        duplicate_status: dup,
        raw_text_basis: maskAll(e.raw_text_basis ?? ''),
        warnings: e.cc.warnings as any,
        user_action: 'pending',
      })
      .select('*')
      .single();
    if (error) throw error;
    inserted.push(row);
  }
  return { count: inserted.length };
}

/**
 * 분류 안 된 가맹점 N개를 LLM 한 번에 보내 카테고리 매핑.
 * 응답 JSON: { "<가맹점>": "<카테고리>" }
 */
async function classifyMerchantsBatch(
  merchants: string[],
  categoryNames: string[],
): Promise<Record<string, string>> {
  const unique = Array.from(new Set(merchants.map((m) => m.trim()).filter(Boolean)));
  if (unique.length === 0) return {};
  const list = unique.map((m) => `- ${m}`).join('\n');
  const cats = categoryNames.map((c) => `- ${c}`).join('\n');
  const prompt = `너는 한국어 가계부 분류기다. 아래 가맹점 각각에 가장 적절한 카테고리 1개를 골라라.
반드시 [카테고리 목록]에 있는 이름 그대로만 사용. 모르면 빈 문자열 "".

[카테고리 목록]
${cats}

[가맹점 목록]
${list}

[OUTPUT_JSON_SCHEMA]
{ "<가맹점 이름>": "<카테고리 이름 or 빈 문자열>", ... }
JSON 객체만 출력. 코드블록·추가 텍스트 금지.`;
  const { content } = await llmGenerate({ prompt, temperature: 0.1 });
  let s = content.trim();
  s = s.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  try {
    const parsed = JSON.parse(s) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string' && v) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}
