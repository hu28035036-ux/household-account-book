import type { SupabaseClient } from '@supabase/supabase-js';

function normalizeMerchant(name: string): string {
  return name
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[\(\)\[\]]/g, '');
}

export async function getLearningHints(supabase: SupabaseClient, userId: string) {
  const [merchants, categories, payments] = await Promise.all([
    supabase
      .from('merchant_learning_rules')
      .select('merchant_normalized_name, match_count')
      .eq('user_id', userId)
      .order('match_count', { ascending: false })
      .limit(20),
    supabase
      .from('categories')
      .select('name')
      .eq('user_id', userId)
      .order('name', { ascending: true })
      .limit(40),
    supabase
      .from('payment_methods')
      .select('name')
      .eq('user_id', userId)
      .order('name', { ascending: true })
      .limit(20),
  ]);

  return {
    topMerchants: (merchants.data ?? []).map((r) => r.merchant_normalized_name),
    topCategories: (categories.data ?? []).map((r) => r.name),
    topPaymentMethods: (payments.data ?? []).map((r) => r.name),
  };
}

export async function getCachedExtraction(
  supabase: SupabaseClient,
  userId: string,
  inputHashHex: string,
) {
  const { data } = await supabase
    .from('analysis_cache')
    .select('cached_result_json, expires_at')
    .eq('user_id', userId)
    .eq('input_hash', inputHashHex)
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return data.cached_result_json;
}

export async function setCachedExtraction(
  supabase: SupabaseClient,
  userId: string,
  inputHashHex: string,
  sourceType: string,
  json: unknown,
) {
  await supabase
    .from('analysis_cache')
    .upsert(
      {
        user_id: userId,
        input_hash: inputHashHex,
        source_type: sourceType,
        cached_result_json: json as any,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: 'user_id,input_hash' },
    );
}

/**
 * 후처리 보정: 사용자 가맹점 학습으로 카테고리/결제수단 보강 + warning 부착.
 */
export async function applyLearningPostprocess(
  supabase: SupabaseClient,
  userId: string,
  candidate: {
    merchant_name: string | null;
    category_suggestion: string | null;
    payment_method_suggestion: string | null;
    confidence: number;
    warnings: string[];
  },
) {
  if (!candidate.merchant_name) return candidate;
  const normalized = normalizeMerchant(candidate.merchant_name);
  if (!normalized) return candidate;

  const { data: rule } = await supabase
    .from('merchant_learning_rules')
    .select('default_category_id, default_payment_method_id, match_count, categories(name), payment_methods(name)')
    .eq('user_id', userId)
    .ilike('merchant_normalized_name', normalized)
    .order('match_count', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!rule) return candidate;

  const learnedCategoryName = (rule as any).categories?.name;
  const learnedPaymentName = (rule as any).payment_methods?.name;
  const out = { ...candidate };

  if (!out.category_suggestion && learnedCategoryName) {
    out.category_suggestion = learnedCategoryName;
    out.confidence = Math.min(1, out.confidence + 0.05);
  } else if (out.category_suggestion && learnedCategoryName && out.category_suggestion !== learnedCategoryName) {
    out.warnings = [...out.warnings, 'differs_from_user_pattern'];
    out.confidence = Math.max(0, out.confidence - 0.1);
  }
  if (!out.payment_method_suggestion && learnedPaymentName) {
    out.payment_method_suggestion = learnedPaymentName;
  }
  return out;
}

/**
 * 사용자 승인/수정 시 학습 규칙 갱신.
 */
export async function recordMerchantLearning(
  supabase: SupabaseClient,
  userId: string,
  merchantName: string,
  categoryId: string | null,
  paymentMethodId: string | null,
) {
  const normalized = normalizeMerchant(merchantName);
  if (!normalized) return;

  const { data: existing } = await supabase
    .from('merchant_learning_rules')
    .select('id, match_count')
    .eq('user_id', userId)
    .eq('merchant_normalized_name', normalized)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('merchant_learning_rules')
      .update({
        default_category_id: categoryId,
        default_payment_method_id: paymentMethodId,
        match_count: (existing.match_count ?? 0) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    await supabase.from('merchant_learning_rules').insert({
      user_id: userId,
      merchant_raw_name: merchantName.slice(0, 200),
      merchant_normalized_name: normalized,
      default_category_id: categoryId,
      default_payment_method_id: paymentMethodId,
      match_count: 1,
      last_used_at: new Date().toISOString(),
    });
  }
}

export async function logCorrection(
  supabase: SupabaseClient,
  userId: string,
  candidateId: string | null,
  fieldName: string,
  before: string | null,
  after: string | null,
  type: 'manual_edit' | 'approve' | 'reject' | 'bulk_approve' | 'bulk_reject',
) {
  await supabase.from('user_correction_logs').insert({
    user_id: userId,
    candidate_id: candidateId,
    field_name: fieldName,
    before_value_masked: before,
    after_value_masked: after,
    correction_type: type,
  });
}
