import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { fail, ok } from '@/lib/http/response';

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'receipts';

/**
 * 본인 계정 데이터 완전 삭제.
 * - Storage: {user_id}/ 하위 객체 일괄 제거
 * - DB: ON DELETE CASCADE 통해 auth.users 제거 시 모든 사용자 행 정리
 *   (admin client로 auth.admin.deleteUser 호출)
 *
 * 안전장치: 본문에 `{ confirm: "DELETE" }`가 정확히 들어와야만 진행.
 */
export async function DELETE(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* empty body */
  }
  if (body?.confirm !== 'DELETE') {
    return fail('BAD_REQUEST', '본문에 { "confirm": "DELETE" }가 필요합니다.');
  }

  try {
    const admin = createSupabaseAdminClient();
    const userId = u.user.id;

    // Storage 폴더 비우기 (재귀)
    const prefix = `${userId}/`;
    let cursor: string | undefined;
    while (true) {
      const { data: list } = await admin.storage.from(BUCKET).list(userId, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (!list || list.length === 0) break;
      const paths = list.map((f) => `${prefix}${f.name}`);
      await admin.storage.from(BUCKET).remove(paths);
      if (list.length < 100) break;
      cursor = list[list.length - 1].name;
    }

    // 사용자 삭제 (cascade로 모든 행 제거)
    await admin.auth.admin.deleteUser(userId);

    return ok({ deleted: true });
  } catch (e) {
    return fail('INTERNAL', e instanceof Error ? e.message : '계정 삭제 실패');
  }
}
