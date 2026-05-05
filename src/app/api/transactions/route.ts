import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CreateTransactionInput, TransactionListQuery } from '@/lib/validators/common';
import { listTransactions, createTransaction } from '@/services/transactionService';
import { fail, ok } from '@/lib/http/response';

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  try {
    const url = new URL(req.url);
    const q = TransactionListQuery.parse(Object.fromEntries(url.searchParams.entries()));
    const result = await listTransactions(supabase, u.user.id, q);
    return ok(result);
  } catch (e) {
    return fail('BAD_REQUEST', e instanceof Error ? e.message : '입력 오류');
  }
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  try {
    const input = CreateTransactionInput.parse(await req.json());
    const row = await createTransaction(supabase, u.user.id, input);
    return ok(row, { status: 201 });
  } catch (e) {
    return fail('BAD_REQUEST', e instanceof Error ? e.message : '입력 오류');
  }
}
