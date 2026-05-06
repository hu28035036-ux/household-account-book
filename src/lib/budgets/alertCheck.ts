import type { SupabaseClient } from '@supabase/supabase-js';
import { getBudgetProgress, type BudgetProgressItem } from '@/services/budgetService';
import { createNotification } from '@/services/notificationService';
import { formatKRW } from '@/lib/formatting/money';

/**
 * 현재 월의 예산 진행률을 확인하고, caution/over 임계에 도달한 항목에 대해
 * 한 번씩 알림을 생성한다(같은 항목은 month 단위로 dedup 키로 1회).
 */
export async function checkBudgetAlertsForUser(
  supabase: SupabaseClient,
  userId: string,
  yearMonth?: string,
) {
  const progress = await getBudgetProgress(supabase, userId, yearMonth);
  const ym = progress.range.from.slice(0, 7);

  const items: BudgetProgressItem[] = [
    ...(progress.total ? [progress.total] : []),
    ...progress.items,
  ];

  const created: { type: string; title: string }[] = [];

  for (const item of items) {
    const key = item.category_id ?? 'total';
    if (item.status === 'over') {
      const dedupKey = `budget_over:${key}:${ym}`;
      const r = await createNotification(supabase, userId, {
        type: 'budget_over',
        title: `${item.category_name} 예산 초과`,
        body: `${ym} 사용률 ${item.percent}%, ${formatKRW(item.spent_amount)} / ${formatKRW(item.budget_amount)}`,
        metadata: { category_id: item.category_id, year_month: ym, percent: item.percent },
        dedupKey,
      });
      if (r) created.push({ type: 'budget_over', title: r.title });
    } else if (item.status === 'caution') {
      const dedupKey = `budget_caution:${key}:${ym}`;
      const r = await createNotification(supabase, userId, {
        type: 'budget_caution',
        title: `${item.category_name} 예산 ${item.percent}% 사용`,
        body: `${ym} 사용 ${formatKRW(item.spent_amount)} / 한도 ${formatKRW(item.budget_amount)} (알림 임계 ${Math.round(
          item.alert_threshold * 100,
        )}%)`,
        metadata: { category_id: item.category_id, year_month: ym, percent: item.percent },
        dedupKey,
      });
      if (r) created.push({ type: 'budget_caution', title: r.title });
    }
  }

  return { checked: items.length, created };
}
