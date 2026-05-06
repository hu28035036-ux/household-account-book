import * as XLSX from 'xlsx';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fail } from '@/lib/http/response';

export const runtime = 'nodejs';

/**
 * 본인 데이터 전체를 .xlsx 한 파일에 — 테이블별로 시트가 따로.
 * - 거래내역 / 카테고리 / 결제수단 / 예산 / 후보 / 모임 같이 일상에서
 *   쓸만한 9개 시트만 노출. 시스템 로그성 테이블(uploaded_files,
 *   ocr_results, ai_extraction_jobs 등)은 JSON 내보내기에서만 제공.
 */
export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  const userId = u.user.id;

  const TYPE_KR: Record<string, string> = { income: '수입', expense: '지출', transfer: '이체' };

  const wb = XLSX.utils.book_new();

  // 1) 거래내역
  {
    const { data } = await supabase
      .from('transactions')
      .select(
        'transaction_date, type, amount, merchant_name, description, memo, source_type, categories(name), payment_methods(name)',
      )
      .eq('user_id', userId)
      .order('transaction_date', { ascending: false });
    const rows = (data ?? []).map((t: any) => [
      t.transaction_date,
      TYPE_KR[t.type] ?? t.type,
      Number(t.amount),
      t.merchant_name ?? '',
      t.categories?.name ?? '',
      t.payment_methods?.name ?? '',
      t.memo ?? t.description ?? '',
      t.source_type ?? '',
    ]);
    const ws = XLSX.utils.aoa_to_sheet([
      ['날짜', '유형', '금액', '가맹점', '카테고리', '결제수단', '메모', '출처'],
      ...rows,
    ]);
    ws['!cols'] = [
      { wch: 12 }, { wch: 6 }, { wch: 12 }, { wch: 24 }, { wch: 14 }, { wch: 12 }, { wch: 22 }, { wch: 12 },
    ];
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let R = 1; R <= range.e.r; R++) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: 2 })];
      if (cell && typeof cell.v === 'number') cell.z = '#,##0';
    }
    XLSX.utils.book_append_sheet(wb, ws, '거래내역');
  }

  // 2) 카테고리
  {
    const { data } = await supabase
      .from('categories')
      .select('name, type, color, icon, is_default')
      .eq('user_id', userId)
      .order('name');
    const ws = XLSX.utils.aoa_to_sheet([
      ['이름', '유형', '색상', '아이콘', '기본'],
      ...(data ?? []).map((c: any) => [c.name, c.type, c.color ?? '', c.icon ?? '', c.is_default ? 'O' : '']),
    ]);
    ws['!cols'] = [{ wch: 18 }, { wch: 8 }, { wch: 10 }, { wch: 16 }, { wch: 6 }];
    XLSX.utils.book_append_sheet(wb, ws, '카테고리');
  }

  // 3) 결제수단
  {
    const { data } = await supabase
      .from('payment_methods')
      .select('name, type, issuer_name, masked_number, is_default')
      .eq('user_id', userId)
      .order('name');
    const ws = XLSX.utils.aoa_to_sheet([
      ['이름', '유형', '발급사', '카드번호 끝4', '기본'],
      ...(data ?? []).map((p: any) => [
        p.name,
        p.type,
        p.issuer_name ?? '',
        p.masked_number ?? '',
        p.is_default ? 'O' : '',
      ]),
    ]);
    ws['!cols'] = [{ wch: 18 }, { wch: 8 }, { wch: 14 }, { wch: 16 }, { wch: 6 }];
    XLSX.utils.book_append_sheet(wb, ws, '결제수단');
  }

  // 4) 예산
  {
    const { data } = await supabase
      .from('budgets')
      .select('month_start, amount, alert_threshold, memo, household_id, categories(name)')
      .eq('user_id', userId)
      .order('month_start', { ascending: false });
    const ws = XLSX.utils.aoa_to_sheet([
      ['월', '카테고리', '한도', '알림 임계치', '메모', '모임'],
      ...(data ?? []).map((b: any) => [
        String(b.month_start).slice(0, 7),
        b.categories?.name ?? '전체',
        Number(b.amount),
        Math.round(Number(b.alert_threshold ?? 0) * 100) + '%',
        b.memo ?? '',
        b.household_id ? '모임' : '개인',
      ]),
    ]);
    ws['!cols'] = [{ wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 22 }, { wch: 8 }];
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let R = 1; R <= range.e.r; R++) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: 2 })];
      if (cell && typeof cell.v === 'number') cell.z = '#,##0';
    }
    XLSX.utils.book_append_sheet(wb, ws, '예산');
  }

  // 5) 고정 거래 (recurring_rules)
  {
    const { data } = await supabase
      .from('recurring_rules')
      .select(
        'type, amount, merchant_name, frequency, day_of_week, day_of_month, month_of_year, start_date, end_date, next_run_date, active, auto_post, notify_days_before, memo',
      )
      .eq('user_id', userId);
    const ws = XLSX.utils.aoa_to_sheet([
      ['유형', '금액', '가맹점', '주기', '요일', '일', '월', '시작', '종료', '다음 발생', '활성', '자동등록', '사전알림(일)', '메모'],
      ...(data ?? []).map((r: any) => [
        TYPE_KR[r.type] ?? r.type,
        Number(r.amount),
        r.merchant_name ?? '',
        r.frequency,
        r.day_of_week ?? '',
        r.day_of_month ?? '',
        r.month_of_year ?? '',
        r.start_date,
        r.end_date ?? '',
        r.next_run_date ?? '',
        r.active ? 'O' : '',
        r.auto_post ? 'O' : '',
        r.notify_days_before,
        r.memo ?? '',
      ]),
    ]);
    XLSX.utils.book_append_sheet(wb, ws, '고정 거래');
  }

  // 6) 분석 후보
  {
    const { data } = await supabase
      .from('transaction_candidates')
      .select(
        'transaction_date, type, amount, merchant_name, category_suggestion, payment_method_suggestion, confidence, duplicate_status, user_action, created_at',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    const ws = XLSX.utils.aoa_to_sheet([
      ['날짜', '유형', '금액', '가맹점', '카테고리(추천)', '결제수단(추천)', '신뢰도', '중복', '상태', '생성'],
      ...(data ?? []).map((c: any) => [
        c.transaction_date ?? '',
        TYPE_KR[c.type] ?? c.type,
        c.amount ?? '',
        c.merchant_name ?? '',
        c.category_suggestion ?? '',
        c.payment_method_suggestion ?? '',
        typeof c.confidence === 'number' ? Math.round(c.confidence * 100) + '%' : '',
        c.duplicate_status,
        c.user_action,
        c.created_at,
      ]),
    ]);
    XLSX.utils.book_append_sheet(wb, ws, '분석 후보');
  }

  // 7) AI 통계 분석 기록
  {
    const { data } = await supabase
      .from('ai_stats_analyses')
      .select('range_from, range_to, totals, transaction_count, summary, tips, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    const ws = XLSX.utils.aoa_to_sheet([
      ['시작', '종료', '거래 수', '지출', '수입', '잔액', '요약', '팁 수', '생성'],
      ...(data ?? []).map((r: any) => [
        r.range_from,
        r.range_to,
        r.transaction_count,
        Number(r.totals?.expense ?? 0),
        Number(r.totals?.income ?? 0),
        Number(r.totals?.balance ?? 0),
        r.summary,
        Array.isArray(r.tips) ? r.tips.length : 0,
        r.created_at,
      ]),
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'AI 분석 기록');
  }

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  const u8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const today = new Date().toISOString().slice(0, 10);
  return new Response(u8, {
    status: 200,
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="ledger-export-${today}.xlsx"`,
      'content-length': String(u8.byteLength),
    },
  });
}
