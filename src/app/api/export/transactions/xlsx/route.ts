import * as XLSX from 'xlsx';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fail } from '@/lib/http/response';

export const runtime = 'nodejs';

/**
 * transactions 만 .xlsx 한 파일로 내보내기.
 * 헤더: 날짜 / 유형 / 금액 / 가맹점 / 카테고리 / 결제수단 / 메모 / 출처 / AI생성 / AI신뢰도
 * 한글 컬럼 폭 자동 적용. 가져오기(import) 호환 헤더와 짝맞춤.
 */
export async function GET() {
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

  const TYPE_KR: Record<string, string> = { income: '수입', expense: '지출', transfer: '이체' };

  const headers = ['날짜', '유형', '금액', '가맹점', '카테고리', '결제수단', '메모', '출처', 'AI생성', 'AI신뢰도'];
  const rows = (data ?? []).map((t: any) => [
    t.transaction_date,
    TYPE_KR[t.type as string] ?? t.type,
    Number(t.amount),
    t.merchant_name ?? '',
    t.categories?.name ?? '',
    t.payment_methods?.name ?? '',
    t.memo ?? t.description ?? '',
    t.source_type ?? '',
    t.is_ai_generated ? 'O' : '',
    typeof t.ai_confidence === 'number' ? Math.round(t.ai_confidence * 100) + '%' : '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [
    { wch: 12 }, // 날짜
    { wch: 6 },  // 유형
    { wch: 12 }, // 금액
    { wch: 24 }, // 가맹점
    { wch: 14 }, // 카테고리
    { wch: 12 }, // 결제수단
    { wch: 22 }, // 메모
    { wch: 12 }, // 출처
    { wch: 8 },  // AI생성
    { wch: 10 }, // AI신뢰도
  ];
  // 금액 셀에 천 단위 콤마 포맷
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let R = 1; R <= range.e.r; R++) {
    const cell = ws[XLSX.utils.encode_cell({ r: R, c: 2 })];
    if (cell && typeof cell.v === 'number') cell.z = '#,##0';
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '거래내역');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  const u8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const today = new Date().toISOString().slice(0, 10);
  return new Response(u8, {
    status: 200,
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="transactions-${today}.xlsx"`,
      'content-length': String(u8.byteLength),
    },
  });
}
