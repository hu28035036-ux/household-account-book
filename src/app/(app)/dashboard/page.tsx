import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCalendarMonth } from '@/services/calendarService';
import { MonthCalendar } from '@/components/calendar/MonthCalendar';
import { getActiveHouseholdContext } from '@/lib/auth/getActiveHouseholdContext';
import { getActiveHouseholdName } from '@/lib/auth/getActiveHouseholdName';

export const dynamic = 'force-dynamic';

function sanitizeYM(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined;
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(input) ? input : undefined;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { ym?: string };
}) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;

  const ym = sanitizeYM(searchParams?.ym);
  const householdContext = getActiveHouseholdContext();
  const month = await getCalendarMonth(supabase, u.user.id, ym, householdContext);
  const yearMonth = month.range.from.slice(0, 7);
  const householdName = householdContext
    ? await getActiveHouseholdName(supabase, householdContext)
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-2 flex-wrap">
        <h2 className="text-2xl font-semibold text-textPrimary">
          {householdName ? `${householdName} (모임비)` : '개인 가계부'}
        </h2>
        <span className="text-xs text-textMuted">월 캘린더</span>
      </div>
      <MonthCalendar
        yearMonth={yearMonth}
        daily={month.daily}
        recentByDate={month.recentByDate}
        totals={month.totals}
        budget={{
          total: month.budgetTotal,
          usedPct: month.budgetUsedPct,
          remaining: month.budgetRemaining,
        }}
      />
    </div>
  );
}
