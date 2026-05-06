import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { listNotifications, unreadCount } from '@/services/notificationService';
import { fail, ok } from '@/lib/http/response';

const Query = z.object({
  scope: z.enum(['all', 'unread']).default('all'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  try {
    const url = new URL(req.url);
    const q = Query.parse(Object.fromEntries(url.searchParams.entries()));
    const [items, count] = await Promise.all([
      listNotifications(supabase, u.user.id, q.scope, q.limit),
      unreadCount(supabase, u.user.id),
    ]);
    return ok({ items, unread: count });
  } catch (e) {
    return fail('BAD_REQUEST', e instanceof Error ? e.message : '입력 오류');
  }
}
