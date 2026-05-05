import type { SupabaseClient } from '@supabase/supabase-js';
import { applyLearningPostprocess } from './learningService';
import { checkDuplicate } from '@/lib/duplicate/check';
import { maskAll } from '@/lib/security/masking';

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
) {
  // 중복 검사용 최근 30일 거래
  const thirty = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: recentTx } = await supabase
    .from('transactions')
    .select('transaction_date, amount, merchant_name, payment_method_id')
    .eq('user_id', userId)
    .gte('transaction_date', thirty);

  const inserted: any[] = [];
  for (const c of candidates) {
    let cc = {
      merchant_name: c.merchant_name,
      category_suggestion: c.category_suggestion,
      payment_method_suggestion: c.payment_method_suggestion,
      confidence: 0.7, // 시트 import는 OCR보다 안정적이라 기본 신뢰도 ↑
      warnings: [...c.warnings],
    };
    cc = await applyLearningPostprocess(supabase, userId, cc);

    const dup = checkDuplicate(
      {
        transaction_date: c.transaction_date,
        amount: c.amount,
        merchant_name: cc.merchant_name,
        payment_method_suggestion: cc.payment_method_suggestion,
      },
      (recentTx ?? []) as any[],
    );

    const { data: row, error } = await supabase
      .from('transaction_candidates')
      .insert({
        user_id: userId,
        uploaded_file_id: null,
        transaction_date: c.transaction_date,
        type: c.type,
        amount: c.amount,
        merchant_name: cc.merchant_name,
        description: c.description ?? '',
        category_suggestion: cc.category_suggestion,
        payment_method_suggestion: cc.payment_method_suggestion,
        confidence: cc.confidence,
        duplicate_status: dup,
        raw_text_basis: maskAll(c.raw_text_basis ?? ''),
        warnings: cc.warnings as any,
        user_action: 'pending',
      })
      .select('*')
      .single();
    if (error) throw error;
    inserted.push(row);
  }
  return { count: inserted.length };
}
