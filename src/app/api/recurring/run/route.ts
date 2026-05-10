import { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { postRuleOccurrence, type RecurringRule } from '@/services/recurringService';
import { fail, ok } from '@/lib/http/response';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Vercel Cron / GitHub Actions 에서 매일 호출.
 * - Vercel Cron: 자동 헤더 `x-vercel-cron` 통과
 * - 외부 호출: Authorization: Bearer ${CRON_TOKEN}
 *
 * - active=true AND auto_post=true AND next_run_date <= today → 거래 자동 등록
 * - 사전 알림(notify_days_before) 도래한 룰은 알림 row 생성
 */
async function handle(req: NextRequest) {
  // Vercel Cron 자동 호출은 헤더로 통과
  const isVercelCron = !!req.headers.get('x-vercel-cron');
  if (!isVercelCron) {
    const token = req.headers.get('authorization');
    const expected = process.env.CRON_TOKEN ? `Bearer ${process.env.CRON_TOKEN}` : null;
    if (!expected || token !== expected) {
      return fail('UNAUTHORIZED', '잘못된 cron 토큰');
    }
  }

  const admin = createSupabaseAdminClient();
  const todayStr = new Date().toISOString().slice(0, 10);

  // 1) 자동 등록
  const { data: dueRules, error: e1 } = await admin
    .from('recurring_rules')
    .select('*')
    .eq('active', true)
    .eq('auto_post', true)
    .lte('next_run_date', todayStr);
  if (e1) return fail('INTERNAL', e1.message);

  const posted: Array<{ ruleId: string; transactionId: string }> = [];
  for (const rule of (dueRules ?? []) as RecurringRule[]) {
    try {
      const r = await postRuleOccurrence(admin, rule, rule.next_run_date ?? todayStr);
      posted.push({ ruleId: rule.id, transactionId: r.transactionId });
    } catch (err) {
      // 한 룰 실패해도 다른 룰은 계속
      console.warn('[cron/recurring] post failed', rule.id, err);
    }
  }

  // 2) 사전 알림 발송 — notify_days_before > 0 이면서, 오늘 + N일 == next_run_date
  // 중복 방지: last_notified_for == 그 날짜면 skip
  const { data: notifyRules } = await admin
    .from('recurring_rules')
    .select('*')
    .eq('active', true)
    .gt('notify_days_before', 0);

  const notified: Array<{ ruleId: string; for: string }> = [];
  for (const rule of (notifyRules ?? []) as RecurringRule[]) {
    if (!rule.next_run_date) continue;
    const target = new Date(rule.next_run_date + 'T00:00:00Z');
    const today = new Date(todayStr + 'T00:00:00Z');
    const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);
    if (diffDays !== rule.notify_days_before) continue;
    if (rule.last_notified_for === rule.next_run_date) continue;

    try {
      await admin.from('notifications').insert({
        user_id: rule.user_id,
        type: 'recurring_due_soon',
        title: `${rule.notify_days_before}일 후 ${rule.merchant_name ?? '고정 항목'}`,
        body: `${rule.next_run_date} ${rule.amount.toLocaleString('ko-KR')}원 ${
          rule.type === 'income' ? '입금' : '지출'
        } 예정`,
        metadata: { recurring_rule_id: rule.id, run_date: rule.next_run_date },
      });
      await admin
        .from('recurring_rules')
        .update({ last_notified_for: rule.next_run_date })
        .eq('id', rule.id);
      notified.push({ ruleId: rule.id, for: rule.next_run_date });
    } catch (err) {
      console.warn('[cron/recurring] notify failed', rule.id, err);
    }
  }

  return ok({
    today: todayStr,
    posted_count: posted.length,
    notified_count: notified.length,
    posted,
    notified,
  });
}

// Vercel Cron 은 GET 으로 호출 — GET/POST 둘 다 지원
export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
