import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function getSession() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}
