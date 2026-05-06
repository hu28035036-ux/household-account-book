import type { SupabaseClient } from '@supabase/supabase-js';

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type RecurringRule = {
  id: string;
  user_id: string;
  household_id: string | null;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  merchant_name: string | null;
  description: string | null;
  category_id: string | null;
  payment_method_id: string | null;
  frequency: RecurringFrequency;
  day_of_week: number | null;
  day_of_month: number | null;
  month_of_year: number | null;
  start_date: string;
  end_date: string | null;
  next_run_date: string | null;
  last_run_date: string | null;
  active: boolean;
  auto_post: boolean;
  notify_days_before: number;
  last_notified_for: string | null;
  memo: string | null;
};

export type RecurringRuleInput = {
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  merchant_name?: string | null;
  description?: string | null;
  category_id?: string | null;
  payment_method_id?: string | null;
  frequency: RecurringFrequency;
  day_of_week?: number | null;
  day_of_month?: number | null;
  month_of_year?: number | null;
  start_date: string;
  end_date?: string | null;
  active?: boolean;
  auto_post?: boolean;
  notify_days_before?: number;
  memo?: string | null;
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}
function ymdUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * 다음 발생일 계산. fromDate 기준으로 그 이후(또는 같은 날)의 첫 발생일.
 * frequency 별 규칙 필드(day_of_week/day_of_month/month_of_year)는 클라이언트가 채워서 전달.
 */
export function computeNextRun(rule: RecurringRuleInput, fromDate: Date): Date {
  const start = parseYmd(rule.start_date);
  const cursor = fromDate < start ? new Date(start) : new Date(fromDate);
  cursor.setUTCHours(0, 0, 0, 0);

  if (rule.frequency === 'daily') {
    return cursor;
  }
  if (rule.frequency === 'weekly') {
    const target = rule.day_of_week ?? cursor.getUTCDay();
    const diff = (target - cursor.getUTCDay() + 7) % 7;
    cursor.setUTCDate(cursor.getUTCDate() + diff);
    return cursor;
  }
  if (rule.frequency === 'monthly') {
    const dom = rule.day_of_month ?? cursor.getUTCDate();
    const candidate = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), dom),
    );
    if (candidate < cursor) {
      candidate.setUTCMonth(candidate.getUTCMonth() + 1);
    }
    // 31일 같이 그 달엔 없는 day → 마지막 날로 클램프
    const lastDayOfMonth = new Date(
      Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth() + 1, 0),
    ).getUTCDate();
    if (dom > lastDayOfMonth) candidate.setUTCDate(lastDayOfMonth);
    return candidate;
  }
  // yearly
  const moy = rule.month_of_year ?? cursor.getUTCMonth() + 1;
  const dom = rule.day_of_month ?? cursor.getUTCDate();
  const candidate = new Date(Date.UTC(cursor.getUTCFullYear(), moy - 1, dom));
  if (candidate < cursor) candidate.setUTCFullYear(candidate.getUTCFullYear() + 1);
  return candidate;
}

/** 한 번 발생한 후의 다음 발생일 — frequency 별로 한 칸 더 진행. */
export function computeAfter(rule: RecurringRule | RecurringRuleInput, runDate: Date): Date {
  const next = new Date(runDate);
  next.setUTCDate(next.getUTCDate() + 1);
  if (rule.frequency === 'daily') return next;
  if (rule.frequency === 'weekly') {
    next.setUTCDate(runDate.getUTCDate() + 7);
    return next;
  }
  if (rule.frequency === 'monthly') {
    const dom = (rule as any).day_of_month ?? runDate.getUTCDate();
    const target = new Date(Date.UTC(runDate.getUTCFullYear(), runDate.getUTCMonth() + 1, dom));
    const last = new Date(
      Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
    ).getUTCDate();
    if (dom > last) target.setUTCDate(last);
    return target;
  }
  // yearly
  const moy = (rule as any).month_of_year ?? runDate.getUTCMonth() + 1;
  const dom = (rule as any).day_of_month ?? runDate.getUTCDate();
  return new Date(Date.UTC(runDate.getUTCFullYear() + 1, moy - 1, dom));
}

export async function listRecurringRules(
  supabase: SupabaseClient,
  userId: string,
  householdContext: string | null,
): Promise<RecurringRule[]> {
  let q = supabase
    .from('recurring_rules')
    .select('*');
  if (householdContext) q = q.eq('household_id', householdContext);
  else q = q.eq('user_id', userId).is('household_id', null);
  const { data, error } = await q.order('next_run_date', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as RecurringRule[];
}

export async function createRecurringRule(
  supabase: SupabaseClient,
  userId: string,
  householdContext: string | null,
  input: RecurringRuleInput,
): Promise<RecurringRule> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const next = computeNextRun(input, today);

  const row = {
    user_id: userId,
    household_id: householdContext,
    type: input.type,
    amount: input.amount,
    merchant_name: input.merchant_name ?? null,
    description: input.description ?? null,
    category_id: input.category_id ?? null,
    payment_method_id: input.payment_method_id ?? null,
    frequency: input.frequency,
    day_of_week: input.day_of_week ?? null,
    day_of_month: input.day_of_month ?? null,
    month_of_year: input.month_of_year ?? null,
    start_date: input.start_date,
    end_date: input.end_date ?? null,
    next_run_date: ymdUTC(next),
    active: input.active ?? true,
    auto_post: input.auto_post ?? false, // 사용자 결정: 첫 등록 default = 수동
    notify_days_before: input.notify_days_before ?? 0,
    memo: input.memo ?? null,
  };

  const { data, error } = await supabase
    .from('recurring_rules')
    .insert(row)
    .select('*')
    .single();
  if (error) throw error;
  return data as RecurringRule;
}

export async function updateRecurringRule(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  patch: Partial<RecurringRuleInput>,
): Promise<RecurringRule> {
  // frequency 또는 시작일이 바뀌면 next_run_date 재계산
  const { data: existing, error: e1 } = await supabase
    .from('recurring_rules')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();
  if (e1) throw e1;

  const merged = { ...(existing as any), ...patch } as RecurringRuleInput & {
    next_run_date: string | null;
  };
  let next_run_date = (existing as any).next_run_date as string | null;
  const recalc =
    patch.frequency !== undefined ||
    patch.start_date !== undefined ||
    patch.day_of_week !== undefined ||
    patch.day_of_month !== undefined ||
    patch.month_of_year !== undefined;
  if (recalc) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    next_run_date = ymdUTC(computeNextRun(merged, today));
  }

  const { data, error } = await supabase
    .from('recurring_rules')
    .update({ ...patch, next_run_date })
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data as RecurringRule;
}

export async function deleteRecurringRule(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from('recurring_rules')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

/**
 * 룰 1건을 거래로 등록(발생) + next_run_date 갱신.
 * 수동 등록 / cron 자동 등록 둘 다에서 호출.
 */
export async function postRuleOccurrence(
  supabase: SupabaseClient,
  rule: RecurringRule,
  occurrenceDate?: string, // YYYY-MM-DD; 미지정시 next_run_date 또는 오늘
): Promise<{ transactionId: string; rule: RecurringRule }> {
  const dateStr = occurrenceDate ?? rule.next_run_date ?? ymdUTC(new Date());

  const { data: tx, error: e1 } = await supabase
    .from('transactions')
    .insert({
      user_id: rule.user_id,
      household_id: rule.household_id,
      transaction_date: dateStr,
      type: rule.type,
      amount: rule.amount,
      merchant_name: rule.merchant_name,
      description: rule.description ?? '',
      category_id: rule.category_id,
      payment_method_id: rule.payment_method_id,
      memo: rule.memo,
      source_type: 'manual',
      is_ai_generated: false,
      is_confirmed: true,
      recurring_rule_id: rule.id,
    })
    .select('id')
    .single();
  if (e1) throw e1;

  const ranAt = parseYmd(dateStr);
  const next = computeAfter(rule, ranAt);
  let nextStr: string | null = ymdUTC(next);
  if (rule.end_date && next > parseYmd(rule.end_date)) nextStr = null;

  const { data: updated, error: e2 } = await supabase
    .from('recurring_rules')
    .update({
      last_run_date: dateStr,
      next_run_date: nextStr,
      active: nextStr === null ? false : rule.active,
    })
    .eq('id', rule.id)
    .select('*')
    .single();
  if (e2) throw e2;

  return { transactionId: (tx as any).id as string, rule: updated as RecurringRule };
}
