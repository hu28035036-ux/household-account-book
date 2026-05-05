'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload as UploadIcon } from 'lucide-react';
import { Card, CardSubtle, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { parseClientFile, type SheetData } from '@/lib/import/parsers';
import {
  autoDetectMapping,
  FIELD_LABELS,
  FIELD_ORDER,
  type ColumnMapping,
  type FieldKey,
} from '@/lib/import/columnMapping';
import { normalizeRow } from '@/lib/import/normalize';
import { formatKRW } from '@/lib/formatting/money';

type Phase = 'idle' | 'parsing' | 'mapping' | 'preview' | 'committing' | 'done' | 'error';

export function ImportClient() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SheetData | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});

  async function pick(file: File) {
    setError(null);
    setPhase('parsing');
    try {
      const sheet = await parseClientFile(file);
      if (sheet.rows.length === 0) {
        setPhase('error');
        setError('데이터가 비어 있습니다. 헤더 행이 첫 줄에 있는지 확인해 주세요.');
        return;
      }
      setData(sheet);
      setMapping(autoDetectMapping(sheet.headers));
      setPhase('mapping');
    } catch (e) {
      setPhase('error');
      setError(e instanceof Error ? e.message : '파일 파싱 실패');
    }
  }

  const previewRows = data?.rows.slice(0, 200).map((r) => normalizeRow(r, mapping)) ?? [];
  const okCount = previewRows.filter(
    (r) =>
      r.transaction_date &&
      r.amount !== null &&
      !r.warnings.includes('date_uncertain') &&
      !r.warnings.includes('amount_uncertain'),
  ).length;

  async function commit() {
    if (!data) return;
    setPhase('committing');
    try {
      const candidates = data.rows.map((r) => normalizeRow(r, mapping));
      const res = await fetch('/api/import/commit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ candidates }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'import 실패');
      setPhase('done');
      router.push('/candidates');
    } catch (e) {
      setPhase('error');
      setError(e instanceof Error ? e.message : 'import 실패');
    }
  }

  return (
    <div className="space-y-4">
      {phase === 'idle' && (
        <Card>
          <CardTitle>CSV / XLSX 가져오기</CardTitle>
          <CardSubtle className="mt-1">
            카드사·은행 명세서를 다운로드한 CSV 또는 엑셀 파일을 올려보세요. 파일은 브라우저에서 파싱되어 서버에는 가공된 후보만 저장됩니다.
          </CardSubtle>
          <label className="mt-4 inline-flex h-11 px-4 items-center gap-2 rounded-lg bg-primaryPink text-textOnPink font-medium hover:bg-primaryPinkHover cursor-pointer">
            <UploadIcon className="h-4 w-4" strokeWidth={1.75} />
            파일 선택
            <input
              type="file"
              accept=".csv,.xlsx,.xls,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pick(f);
              }}
            />
          </label>
        </Card>
      )}

      {phase === 'parsing' && (
        <Card>
          <CardSubtle>파일을 읽고 있어요…</CardSubtle>
        </Card>
      )}

      {(phase === 'mapping' || phase === 'preview') && data && (
        <>
          <Card>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle>컬럼 매핑</CardTitle>
              <Badge tone="muted">총 {data.rows.length}행</Badge>
            </div>
            <CardSubtle className="mt-1">
              자동 감지된 결과를 확인하고, 잘못 잡혔으면 직접 골라주세요.
            </CardSubtle>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FIELD_ORDER.map((field) => (
                <label key={field} className="block">
                  <span className="text-xs text-textSecondary">{FIELD_LABELS[field]}</span>
                  <select
                    value={mapping[field] ?? ''}
                    onChange={(e) =>
                      setMapping((m) => ({ ...m, [field]: e.target.value || undefined }))
                    }
                    className="mt-1 w-full h-10 px-3 rounded-lg border border-borderDefault bg-white text-textPrimary text-sm"
                  >
                    <option value="">— 사용 안 함 —</option>
                    {data.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs text-textMuted">
              팁: 카드 명세서는 “이용 일자 / 가맹점 / 이용 금액”, 계좌 내역은 “거래일 / 적요 / 입금 / 출금” 컬럼 매핑을 권장합니다.
            </p>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle>미리보기 (앞 200행)</CardTitle>
              <Badge tone={okCount === previewRows.length ? 'success' : 'warning'}>
                안전 {okCount} / {previewRows.length}
              </Badge>
            </div>
            <div className="mt-3 overflow-x-auto rounded-lg border border-borderDefault">
              <table className="min-w-full text-sm">
                <thead className="bg-sectionBackground text-textSecondary">
                  <tr>
                    <th className="text-left px-3 py-2">날짜</th>
                    <th className="text-left px-3 py-2">유형</th>
                    <th className="text-right px-3 py-2">금액</th>
                    <th className="text-left px-3 py-2">가맹점</th>
                    <th className="text-left px-3 py-2">결제수단</th>
                    <th className="text-left px-3 py-2">카테고리</th>
                    <th className="text-left px-3 py-2">경고</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                  {previewRows.map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5">{r.transaction_date ?? '-'}</td>
                      <td className="px-3 py-1.5">
                        <span
                          className={
                            'tabular ' +
                            (r.type === 'income'
                              ? 'text-income'
                              : r.type === 'transfer'
                              ? 'text-transfer'
                              : 'text-expense')
                          }
                        >
                          {r.type === 'income' ? '수입' : r.type === 'transfer' ? '이체' : '지출'}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right tabular">
                        {r.amount === null ? '-' : formatKRW(r.amount)}
                      </td>
                      <td className="px-3 py-1.5 truncate max-w-[200px]">{r.merchant_name ?? '-'}</td>
                      <td className="px-3 py-1.5">{r.payment_method_suggestion ?? '-'}</td>
                      <td className="px-3 py-1.5">{r.category_suggestion ?? '-'}</td>
                      <td className="px-3 py-1.5 text-xs text-textMuted">{r.warnings.join(', ') || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setData(null);
                  setMapping({});
                  setPhase('idle');
                }}
              >
                다시 선택
              </Button>
              <Button
                onClick={commit}
                disabled={
                  !mapping.transaction_date || (!mapping.amount && !(mapping.amount_in && mapping.amount_out))
                }
              >
                후보로 가져오기 ({data.rows.length}건)
              </Button>
            </div>
            {!mapping.transaction_date && (
              <p className="mt-2 text-xs text-warning">날짜 컬럼을 선택해야 가져올 수 있어요.</p>
            )}
            {!mapping.amount && !(mapping.amount_in && mapping.amount_out) && (
              <p className="mt-2 text-xs text-warning">금액 컬럼(또는 입금/출금 두 컬럼)을 선택하세요.</p>
            )}
          </Card>
        </>
      )}

      {phase === 'committing' && (
        <Card>
          <CardSubtle>후보로 등록하는 중…</CardSubtle>
        </Card>
      )}

      {phase === 'error' && (
        <Card>
          <p className="text-sm rounded-md bg-dangerSoft text-danger px-3 py-2">{error}</p>
          <div className="mt-3 flex justify-end">
            <Button variant="ghost" onClick={() => setPhase('idle')}>
              다시 시도
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
