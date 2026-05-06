import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * 헤더/페이지 라벨 표시 용도. 실패해도 null 반환 (RLS 차단 / 삭제된 모임 등).
 */
export async function getActiveHouseholdName(
  supabase: SupabaseClient,
  householdId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('households')
    .select('name')
    .eq('id', householdId)
    .maybeSingle();
  return (data as any)?.name ?? null;
}
