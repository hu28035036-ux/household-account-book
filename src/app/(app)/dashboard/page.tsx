import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCalendarMonth } from '@/services/calendarService';
import { MonthCalendar } from '@/components/calendar/MonthCalendar';

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
  const month = await getCalendarMonth(supabase, u.user.id, ym);
  const yearMonth = month.range.from.slice(0, 7);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-textPrimary">월 캘린더</h2>
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
