'use client';

import { useEffect, useState } from 'react';
import { FileText, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { formatKRW, parseKRWInput } from '@/lib/formatting/money';
import { formatDateKST } from '@/lib/formatting/date';

export type CandidateFile = {
  id: string;
  file_name: string | null;
  file_type: string | null;
  signed_url: string | null;
};

export type Candidate = {
  id: string;
  uploaded_file_id?: string | null;
  transaction_date: string | null;
  type: 'income' | 'expense' | 'transfer';
  amount: number | null;
  merchant_name: string | null;
  description: string | null;
  category_suggestion: string | null;
  payment_method_suggestion: string | null;
  confidence: number;
  duplicate_status: 'none' | 'suspected' | 'duplicate';
  raw_text_basis: string | null;
  warnings: string[];
  user_action: 'pending' | 'approved' | 'rejected' | 'edited';
  _file?: CandidateFile | null;
};

type Props = {
  c: Candidate;
  selected: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onChange: () => void;
};

const WARN_LABELS: Record<string, string> = {
  date_uncertain: '날짜 확인 필요',
  amount_uncertain: '금액 확인 필요',
  merchant_uncertain: '가맹점 확인 필요',
  category_uncertain: '카테고리 확인 필요',
  basis_not_found: '근거 텍스트 누락',
  differs_from_user_pattern: '평소 패턴과 다름',
  recurring_candidate: '반복 지출 가능성',
  amount_suspicious_magnitude: '금액 자릿수 의심',
};

export function CandidateCard({ c, selected, onSelect, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(c.transaction_date ?? '');
  const [type, setType] = useState(c.type);
  const [amountStr, setAmountStr] = useState(c.amount?.toString() ?? '');
  const [merchant, setMerchant] = useState(c.merchant_name ?? '');
  const [category, setCategory] = useState(c.category_suggestion ?? '');
  const [payment, setPayment] = useState(c.payment_method_suggestion ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    setDate(c.transaction_date ?? '');
    setType(c.type);
    setAmountStr(c.amount?.toString() ?? '');
    setMerchant(c.merchant_name ?? '');
    setCategory(c.category_suggestion ?? '');
    setPayment(c.payment_method_suggestion ?? '');
  }, [c.id, c.transaction_date, c.type, c.amount, c.merchant_name, c.category_suggestion, c.payment_method_suggestion]);

  const conf = Math.round(c.confidence * 100);
  const isDup = c.duplicate_status !== 'none';
  const isReview = c.warnings.includes('date_uncertain') || c.warnings.includes('amount_uncertain');
  const isSuspicious = c.warnings.includes('amount_suspicious_magnitude');
  const needsReview = isReview || isSuspicious || conf < 60;
  const canSelect = !isDup && !isReview;

  const file = c._file;
  const isImage = !!file?.file_type?.startsWith('image/');
  const isPdf =
    !!file?.file_type?.includes('pdf') || (file?.file_name && /\.pdf$/i.test(file.file_name));
  const hasPreview = !!file?.signed_url;

  async function saveEdit() {
    setPending(true);
    setError(null);
    try {
      const amount = parseKRWInput(amountStr);
      const body = {
        transaction_date: date || null,
        type,
        amount,
        merchant_name: merchant || null,
        category_suggestion: category || null,
        payment_method_suggestion: payment || null,
      };
      const res = await fetch(`/api/candidates/${c.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j?.error?.message ?? '수정 실패');
      }
      setEditing(false);
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : '수정 실패');
    } finally {
      setPending(false);
    }
  }

  async function approve() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/candidates/${c.id}/approve`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j?.error?.message ?? '승인 실패');
      }
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : '승인 실패');
    } finally {
      setPending(false);
    }
  }

  async function reject() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/candidates/${c.id}/reject`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j?.error?.message ?? '제외 실패');
      }
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : '제외 실패');
    } finally {
      setPending(false);
    }
  }

  return (
    <Card
      className={
        (needsReview
          ? 'border-l-4 border-l-warning '
          : isDup
            ? 'border-l-4 border-l-danger '
            : '') + '!p-2.5 sm:!p-3'
      }
    >
      <div className="flex items-start gap-2.5">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-borderDefault text-primaryPink focus:ring-primaryPinkBorder shrink-0"
          checked={selected}
          disabled={!canSelect}
          onChange={(e) => onSelect(c.id, e.target.checked)}
          aria-label="일괄 승인 선택"
        />
        {/* 원본 파일 썸네일 — 클릭하면 풀스크린 미리보기. 분석이 원본과 맞게 됐는지 즉시 대조. */}
        {hasPreview && isImage && (
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            aria-label="원본 이미지 크게 보기"
            className="h-11 w-11 rounded-md border border-borderDefault overflow-hidden shrink-0 hover:opacity-80 transition-opacity"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={file!.signed_url!}
              alt={file!.file_name ?? '원본'}
              className="h-full w-full object-cover"
            />
          </button>
        )}
        {hasPreview && !isImage && (
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            aria-label="원본 PDF 열기"
            className="h-11 w-11 rounded-md border border-borderDefault bg-sectionBackground inline-flex items-center justify-center shrink-0 text-textPinkStrong hover:bg-softPinkBackground"
          >
            <FileText className="h-4 w-4" strokeWidth={1.5} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                {needsReview && (
                  <AlertTriangle
                    className="h-3.5 w-3.5 text-warning shrink-0"
                    strokeWidth={2}
                    aria-label="검토 필요"
                  />
                )}
                <div className="text-sm font-semibold text-textPrimary truncate">
                  {c.merchant_name || '미지정 가맹점'}
                </div>
              </div>
              <div className="text-[11px] text-textSecondary truncate">
                {c.transaction_date ? formatDateKST(c.transaction_date) : '날짜 없음'} ·{' '}
                {c.category_suggestion ?? '카테고리 ?'} · {c.payment_method_suggestion ?? '결제수단 ?'}
              </div>
            </div>
            <div
              className={
                'tabular text-sm font-semibold whitespace-nowrap shrink-0 ' +
                (c.type === 'income' ? 'text-income' : c.type === 'transfer' ? 'text-transfer' : 'text-expense')
              }
            >
              {c.amount == null
                ? '금액 ?'
                : (c.type === 'income' ? '+' : c.type === 'expense' ? '-' : '') + formatKRW(c.amount)}
            </div>
          </div>

          <div className="mt-1 flex items-center gap-1 flex-wrap">
            <Badge
              tone={conf >= 70 ? 'success' : conf >= 40 ? 'warning' : 'review'}
              className="!px-1.5 !py-0 !text-[10px]"
            >
              {conf}%
            </Badge>
            {c.duplicate_status === 'suspected' && (
              <Badge tone="duplicate" className="!px-1.5 !py-0 !text-[10px]">
                중복 의심
              </Badge>
            )}
            {c.duplicate_status === 'duplicate' && (
              <Badge tone="review" className="!px-1.5 !py-0 !text-[10px]">
                중복
              </Badge>
            )}
            {c.warnings.map((w) => (
              <Badge
                key={w}
                tone={w === 'differs_from_user_pattern' ? 'warning' : 'review'}
                className="!px-1.5 !py-0 !text-[10px]"
              >
                {WARN_LABELS[w] ?? w}
              </Badge>
            ))}
            {c.raw_text_basis && (
              <span
                className="text-[10px] text-textMuted font-mono truncate max-w-[180px] sm:max-w-[260px]"
                title={c.raw_text_basis}
              >
                · {c.raw_text_basis}
              </span>
            )}
          </div>

          {editing && (
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              <label className="flex items-center gap-2 min-w-0">
                <span className="w-14 shrink-0 text-[11px] text-textSecondary">날짜</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="flex-1 min-w-0 h-9 px-2.5 rounded-md border border-borderDefault bg-white text-textPrimary text-sm"
                />
              </label>
              <label className="flex items-center gap-2 min-w-0">
                <span className="w-14 shrink-0 text-[11px] text-textSecondary">유형</span>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as 'income' | 'expense' | 'transfer')}
                  className="flex-1 min-w-0 h-9 px-2.5 rounded-md border border-borderDefault bg-white text-textPrimary text-sm"
                >
                  <option value="expense">지출</option>
                  <option value="income">수입</option>
                  <option value="transfer">이체</option>
                </select>
              </label>
              <label className="flex items-center gap-2 min-w-0">
                <span className="w-14 shrink-0 text-[11px] text-textSecondary">금액</span>
                <input
                  inputMode="numeric"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder="예: 12000"
                  className="flex-1 min-w-0 h-9 px-2.5 rounded-md border border-borderDefault bg-white text-textPrimary text-sm tabular"
                />
              </label>
              <label className="flex items-center gap-2 min-w-0">
                <span className="w-14 shrink-0 text-[11px] text-textSecondary">가맹점</span>
                <input
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  placeholder="예: 스타벅스 강남점"
                  className="flex-1 min-w-0 h-9 px-2.5 rounded-md border border-borderDefault bg-white text-textPrimary text-sm"
                />
              </label>
              <label className="flex items-center gap-2 min-w-0">
                <span className="w-14 shrink-0 text-[11px] text-textSecondary">카테고리</span>
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="예: 카페/간식"
                  className="flex-1 min-w-0 h-9 px-2.5 rounded-md border border-borderDefault bg-white text-textPrimary text-sm"
                />
              </label>
              <label className="flex items-center gap-2 min-w-0">
                <span className="w-14 shrink-0 text-[11px] text-textSecondary">결제수단</span>
                <input
                  value={payment}
                  onChange={(e) => setPayment(e.target.value)}
                  placeholder="예: 신용카드"
                  className="flex-1 min-w-0 h-9 px-2.5 rounded-md border border-borderDefault bg-white text-textPrimary text-sm"
                />
              </label>
            </div>
          )}

          {error && (
            <p className="mt-1.5 text-xs rounded-md bg-dangerSoft text-danger px-2 py-1.5">{error}</p>
          )}

          <div className="mt-1.5 flex items-center justify-end gap-1 flex-wrap">
            {editing ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing(false)}
                  disabled={pending}
                  className="!h-7 !px-2 !text-xs !rounded-md"
                >
                  취소
                </Button>
                <Button
                  size="sm"
                  onClick={saveEdit}
                  disabled={pending}
                  className="!h-7 !px-2.5 !text-xs !rounded-md"
                >
                  저장
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing(true)}
                  disabled={pending}
                  className="!h-7 !px-2 !text-xs !rounded-md"
                >
                  수정
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={reject}
                  disabled={pending}
                  className="!h-7 !px-2 !text-xs !rounded-md"
                >
                  제외
                </Button>
                <Button
                  size="sm"
                  onClick={approve}
                  disabled={pending}
                  className="!h-7 !px-2.5 !text-xs !rounded-md"
                >
                  승인
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {previewOpen && hasPreview && (
        <Modal
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          title={file?.file_name ?? '원본 파일'}
          className="!max-w-3xl"
        >
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={file!.signed_url!}
              alt={file!.file_name ?? '원본 이미지'}
              className="w-full h-auto rounded-lg border border-borderDefault"
            />
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-textSecondary">
                PDF 미리보기는 새 탭에서 엽니다.
              </p>
              <a
                href={file!.signed_url!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primaryPink text-textOnPink text-sm font-medium hover:bg-primaryPinkHover"
              >
                <FileText className="h-4 w-4" strokeWidth={1.75} />
                새 탭에서 열기
              </a>
            </div>
          )}
          <p className="mt-2 text-[11px] text-textMuted">
            원본은 업로드 후 7일이 지나면 자동 삭제됩니다.
          </p>
        </Modal>
      )}
    </Card>
  );
}
