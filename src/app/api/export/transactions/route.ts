import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fail } from '@/lib/http/response';

/**
 * transactions만 CSV로 내보내기.
 */
export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');

    const { data } = await supabase
      .from('transactions')
      .select(
        'transaction_date, type, amount, merchant_name, description, memo, source_type, is_ai_generated, ai_confidence, categories(name), payment_methods(name)',
      )
      .eq('user_id', u.user.id)
      .order('transaction_date', { ascending: false })
      .limit(20000);

    const header = [
      'date',
      'type',
      'amount',
      'merchant',
      'category',
      'payment_method',
      'memo',
      'source',
      'ai_generated',
      'ai_confidence',
    ];
    const escape = (v: unknown) => {
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const lines = [header.join(',')];
    for (const t of data ?? []) {
      lines.push(
        [
          t.transaction_date,
          t.type,
          t.amount,
          (t as any).merchant_name,
          (t as any).categories?.name ?? '',
          (t as any).payment_methods?.name ?? '',
          (t as any).memo ?? (t as any).description ?? '',
          (t as any).source_type,
          (t as any).is_ai_generated,
          (t as any).ai_confidence ?? '',
        ]
          .map(escape)
          .join(','),
      );
    }
    const csv = '﻿' + lines.join('\n'); // UTF-8 BOM (엑셀 한글 호환)

    return new Response(csv, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="transactions-${new Date()
          .toISOString()
          .slice(0, 10)}.csv"`,
      },
    });
  } catch (e) {
    return fail('INTERNAL', e instanceof Error ? e.message : '거래 CSV 내보내기 실패');
  }
}
