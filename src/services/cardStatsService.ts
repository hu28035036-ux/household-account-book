import type { SupabaseClient } from '@supabase/supabase-js';
import { monthRangeKST } from '@/lib/formatting/date';

export type CardUsageRow = {
  payment_method_id: string;
  name: string;
  issuer_name: string | null;
  masked_number: string | null;
  spent_amount: number;
  transaction_count: number;
  avg_amount: number;
  share_percent: number; // 전체 카드 지출 대비
  top_categories: Array<{ name: string; color: string | null; amount: number; percent: number }>;
};

export type CardUsageReport = {
  range: { from: string; to: string };
  total_card_spent: number; // 모든 카드 합계
  total_card_count: number; // 거래 수
  cards: CardUsageRow[];
};

/**
 * 신용/체크카드 결제수단으로 발생한 거래만 집계.
 * - 카드별 합계·거래수·평균·점유율
 * - 카드별 카테고리 Top 3
 * - 정렬: 사용 금액 내림차순
 */
export async function getCardUsageReport(
  supabase: SupabaseClient,
  userId: string,
  yearMonth?: string,
  householdContext: string | null = null,
): Promise<CardUsageReport> {
  const { from, to } = monthRangeKST(yearMonth);

  // 1) 카드 type 인 결제수단 목록
  const { data: cards } = await supabase
    .from('payment_methods')
    .select('id, name, issuer_name, masked_number, type')
    .eq('user_id', userId)
    .eq('type', 'card');
  const cardMap = new Map<string, { id: string; name: string; issuer_name: string | null; masked_number: string | null }>();
  for (const c of (cards ?? []) as any[]) {
    cardMap.set(c.id as string, {
      id: c.id,
      name: c.name,
      issuer_name: c.issuer_name ?? null,
      masked_number: c.masked_number ?? null,
    });
  }
  if (cardMap.size === 0) {
    return { range: { from, to }, total_card_spent: 0, total_card_count: 0, cards: [] };
  }

  // 2) 그 카드들로 결제된 expense 거래
  let q = supabase
    .from('transactions')
    .select('amount, payment_method_id, category_id, categories(name, color)')
    .eq('type', 'expense')
    .gte('transaction_date', from)
    .lte('transaction_date', to)
    .in('payment_method_id', Array.from(cardMap.keys()));
  if (householdContext) q = q.eq('household_id', householdContext);
  else q = q.eq('user_id', userId).is('household_id', null);

  const { data: txs, error } = await q;
  if (error) throw error;

  // 3) 카드별 + 카드×카테고리 집계
  type Bucket = {
    spent: number;
    count: number;
    byCategory: Record<string, { name: string; color: string | null; amount: number }>;
  };
  const perCard = new Map<string, Bucket>();
  let totalSpent = 0;

  for (const t of (txs ?? []) as any[]) {
    const pmId = t.payment_method_id as string;
    if (!pmId || !cardMap.has(pmId)) continue;
    const a = Number(t.amount);
    totalSpent += a;
    const b = perCard.get(pmId) ?? { spent: 0, count: 0, byCategory: {} };
    b.spent += a;
    b.count += 1;
    const catId = (t.category_id as string | null) ?? '__uncat__';
    const c = t.categories as { name?: string; color?: string | null } | null;
    const catName = c?.name ?? '미지정';
    const catColor = c?.color ?? null;
    if (!b.byCategory[catId]) {
      b.byCategory[catId] = { name: catName, color: catColor, amount: 0 };
    }
    b.byCategory[catId].amount += a;
    perCard.set(pmId, b);
  }

  // 4) 결과 row 빌드
  const rows: CardUsageRow[] = [];
  for (const [pmId, b] of perCard.entries()) {
    const card = cardMap.get(pmId)!;
    const top = Object.values(b.byCategory)
      .sort((a, c) => c.amount - a.amount)
      .slice(0, 3)
      .map((cat) => ({
        name: cat.name,
        color: cat.color,
        amount: cat.amount,
        percent: b.spent > 0 ? Math.round((cat.amount / b.spent) * 100) : 0,
      }));
    rows.push({
      payment_method_id: pmId,
      name: card.name,
      issuer_name: card.issuer_name,
      masked_number: card.masked_number,
      spent_amount: b.spent,
      transaction_count: b.count,
      avg_amount: b.count > 0 ? Math.round(b.spent / b.count) : 0,
      share_percent: totalSpent > 0 ? Math.round((b.spent / totalSpent) * 100) : 0,
      top_categories: top,
    });
  }
  rows.sort((a, b) => b.spent_amount - a.spent_amount);

  const totalCount = rows.reduce((s, r) => s + r.transaction_count, 0);
  return {
    range: { from, to },
    total_card_spent: totalSpent,
    total_card_count: totalCount,
    cards: rows,
  };
}
