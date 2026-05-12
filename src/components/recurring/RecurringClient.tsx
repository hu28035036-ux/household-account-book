'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Repeat, Pencil, Trash2, Play, Pause, ZapOff, Zap, Bell } from 'lucide-react';
import { Card, CardSubtle, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import { formatKRW, parseKRWInput } from '@/lib/formatting/money';
import { formatDateKST } from '@/lib/formatting/date';
import { useActiveHousehold } from '@/lib/active-household';

type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
type Rule = {
  id: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  merchant_name: string | null;
  description: string | null;
  category_id: string | null;
  payment_method_id: string | null;
  frequency: Frequency;
  day_of_week: number | null;
  day_of_month: number | null;
  month_of_year: number | null;
  start_date: string;
  end_date: string | null;
  next_run_date: string | null;
  last_run_date: string | null;
  active: boolean;
  auto_post: boolean;
  notify_days_before: number;
  memo: string | null;
};
type Cat = { id: string; name: string; type: string };
type Pm = { id: string; name: string; type: string };

const FREQ_LABEL: Record<Frequency, string> = {
  daily: '매일',
  weekly: '매주',
  monthly: '매월',
  yearly: '매년',
};
const DOW_LABEL = ['일', '월', '화', '수', '목', '금', '토'];

function todayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
}
function ruleScheduleText(r: Rule): string {
  if (r.frequency === 'daily') return '매일';
  if (r.frequency === 'weekly') return `매주 ${DOW_LABEL[r.day_of_week ?? 0]}요일`;
  if (r.frequency === 'monthly') return `매월 ${r.day_of_month ?? 1}일`;
  return `매년 ${r.month_of_year ?? 1}월 ${r.day_of_month ?? 1}일`;
}
function daysFromToday(ymd: string | null): number | null {
  if (!ymd) return null;
  const t = new Date(todayYmd() + 'T00:00:00Z').getTime();
  const x = new Date(ymd + 'T00:00:00Z').getTime();
  return Math.round((x - t) / 86_400_000);
}

export function RecurringClient() {
  const { activeId, households } = useActiveHousehold();
  const activeName = activeId ? households.find((h) => h.id === activeId)?.name ?? null : null;

  const [rules, setRules] = useState<Rule[]>([]);
  const [categories, setCategories] = useState<Cat[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<Pm[]>([]);
  const [loading, setLoading] = useState(true);

  // 모달 상태
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState<'income' | 'expense' | 'transfer'>('expense');
  const [amountStr, setAmountStr] = useState('');
  const [merchant, setMerchant] = useState('');
  const [memo, setMemo] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [paymentMethodId, setPaymentMethodId] = useState<string>('');
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [monthOfYear, setMonthOfYear] = useState(1);
  const [startDate, setStartDate] = useState(todayYmd());
  const [endDate, setEndDate] = useState('');
  const [autoPost, setAutoPost] = useState(false); // 사용자 결정: 첫 등록 default = 수동
  const [notifyDays, setNotifyDays] = useState(0);
  const [active, setActive] = useState(true);
  const [pending, setPending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [rRes, cRes, pRes] = await Promise.all([
      fetch('/api/recurring').then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
      fetch('/api/payment-methods').then((r) => r.json()),
    ]);
    setRules((rRes?.data ?? []) as Rule[]);
    setCategories((cRes?.data ?? []) as Cat[]);
    setPaymentMethods((pRes?.data ?? []) as Pm[]);
    setLoading(false);
  }, [activeId]);

  useEffect(() => {
    load();
  }, [load]);

  function startCreate() {
    setEditingId(null);
    setType('expense');
    setAmountStr('');
    setMerchant('');
    setMemo('');
    setCategoryId('');
    setPaymentMethodId('');
    setFrequency('monthly');
    setDayOfWeek(1);
    setDayOfMonth(new Date().getDate());
    setMonthOfYear(new Date().getMonth() + 1);
    setStartDate(todayYmd());
    setEndDate('');
    setAutoPost(false); // 첫 등록은 수동 default
    setNotifyDays(0);
    setActive(true);
    setSaveError(null);
    setOpen(true);
  }

  function startEdit(r: Rule) {
    setEditingId(r.id);
    setType(r.type);
    setAmountStr(String(r.amount));
    setMerchant(r.merchant_name ?? '');
    setMemo(r.memo ?? '');
    setCategoryId(r.category_id ?? '');
    setPaymentMethodId(r.payment_method_id ?? '');
    setFrequency(r.frequency);
    setDayOfWeek(r.day_of_week ?? 1);
    setDayOfMonth(r.day_of_month ?? 1);
    setMonthOfYear(r.month_of_year ?? 1);
    setStartDate(r.start_date);
    setEndDate(r.end_date ?? '');
    setAutoPost(r.auto_post);
    setNotifyDays(r.notify_days_before);
    setActive(r.active);
    setSaveError(null);
    setOpen(true);
  }

  async function save() {
    setPending(true);
    setSaveError(null);
    try {
      const amount = parseKRWInput(amountStr);
      if (amount === null || amount < 0) throw new Error('금액을 입력하세요.');
      const body: any = {
        type,
        amount,
        merchant_name: merchant.trim() || null,
        description: null,
        memo: memo.trim() || null,
        category_id: categoryId || null,
        payment_method_id: paymentMethodId || null,
        frequency,
        start_date: startDate,
        end_date: endDate || null,
        active,
        auto_post: autoPost,
        notify_days_before: notifyDays,
      };
      if (frequency === 'weekly') body.day_of_week = dayOfWeek;
      if (frequency === 'monthly') body.day_of_month = dayOfMonth;
      if (frequency === 'yearly') {
        body.day_of_month = dayOfMonth;
        body.month_of_year = monthOfYear;
      }

      const url = editingId ? `/api/recurring/${editingId}` : '/api/recurring';
      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error?.message ?? '저장 실패');
      setOpen(false);
      load();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setPending(false);
    }
  }

  async function remove(r: Rule) {
    if (!confirm(`'${r.merchant_name ?? '고정 항목'}' 규칙을 삭제할까요? 이미 등록된 거래는 유지됩니다.`))
      return;
    const res = await fetch(`/api/recurring/${r.id}`, { method: 'DELETE' });
    if (res.ok) load();
  }

  async function toggleActive(r: Rule) {
    const res = await fetch(`/api/recurring/${r.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ active: !r.active }),
    });
    if (res.ok) load();
  }

  async function toggleAuto(r: Rule) {
    const res = await fetch(`/api/recurring/${r.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ auto_post: !r.auto_post }),
    });
    if (res.ok) load();
  }

  async function postNow(r: Rule) {
    if (!confirm(`'${r.merchant_name ?? '고정 항목'}' ${formatKRW(r.amount)}을 지금 등록할까요?`)) return;
    const res = await fetch(`/api/recurring/${r.id}/post`, { method: 'POST' });
    if (res.ok) load();
    else {
      const j = await res.json();
      alert(j?.error?.message ?? '등록 실패');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold text-textPrimary flex items-center gap-2">
            <Repeat className="h-6 w-6 text-textPinkStrong" strokeWidth={1.75} /> 고정 거래
          </h2>
          <p className="mt-0.5 text-xs text-textMuted">
            {activeName ? `${activeName} (모임)` : '개인 가계부'} · 매일/매주/매월/매년 반복되는 거래를 관리합니다.
            첫 등록은 수동(직접 “지금 등록”) 기본, 자동 전환 가능.
          </p>
        </div>
        <Button size="sm" onClick={startCreate}>
          <Plus className="h-4 w-4" strokeWidth={1.75} /> 추가
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardSubtle className="text-center py-6">불러오는 중…</CardSubtle>
        </Card>
      ) : rules.length === 0 ? (
        <Card>
          <CardTitle>아직 고정 거래가 없어요</CardTitle>
          <CardSubtle className="mt-1">
            구독료, 월급, 매월 관리비 같이 반복되는 항목을 추가하세요.
          </CardSubtle>
        </Card>
      ) : (
        <ul className="space-y-2">
          {rules.map((r) => {
            const dDay = daysFromToday(r.next_run_date);
            const dDayText =
              dDay === null
                ? '—'
                : dDay === 0
                ? '오늘'
                : dDay > 0
                ? `${dDay}일 후`
                : `${-dDay}일 지남`;
            return (
              <li key={r.id}>
                <Card className={r.active ? '' : 'opacity-60'}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-semibold text-textPrimary truncate">
                          {r.merchant_name || '(이름 없음)'}
                        </span>
                        <Badge tone={r.auto_post ? 'success' : 'muted'}>
                          {r.auto_post ? '자동' : '수동'}
                        </Badge>
                        {!r.active && <Badge tone="muted">일시정지</Badge>}
                        {r.notify_days_before > 0 && (
                          <Badge tone="info">
                            <Bell className="h-3 w-3" strokeWidth={1.75} /> {r.notify_days_before}일 전 알림
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-textSecondary">
                        {ruleScheduleText(r)} · 다음:{' '}
                        <span className="text-textPrimary tabular">
                          {r.next_run_date ?? '—'}
                        </span>{' '}
                        ({dDayText})
                        {r.last_run_date && (
                          <>
                            {' · 마지막: '}
                            <span className="tabular">{formatDateKST(r.last_run_date)}</span>
                          </>
                        )}
                      </div>
                      {r.memo && <p className="mt-1 text-xs text-textMuted">{r.memo}</p>}
                    </div>
                    <div
                      className={
                        'tabular text-base font-semibold whitespace-nowrap ' +
                        (r.type === 'income'
                          ? 'text-income'
                          : r.type === 'transfer'
                          ? 'text-transfer'
                          : 'text-expense')
                      }
                    >
                      {r.type === 'income' ? '+' : r.type === 'expense' ? '-' : ''}
                      {formatKRW(r.amount)}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-1 flex-wrap">
                    {r.active && r.next_run_date && dDay !== null && dDay <= 0 && (
                      <Button size="sm" onClick={() => postNow(r)} className="!h-8 !px-2 !text-xs !gap-1">
                        <Play className="h-3.5 w-3.5" strokeWidth={1.75} /> 지금 등록
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleAuto(r)}
                      className="!h-8 !px-2 !text-xs !gap-1"
                    >
                      {r.auto_post ? (
                        <>
                          <ZapOff className="h-3.5 w-3.5" strokeWidth={1.75} /> 수동으로
                        </>
                      ) : (
                        <>
                          <Zap className="h-3.5 w-3.5" strokeWidth={1.75} /> 자동으로
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleActive(r)}
                      className="!h-8 !px-2 !text-xs !gap-1"
                    >
                      {r.active ? (
                        <>
                          <Pause className="h-3.5 w-3.5" strokeWidth={1.75} /> 일시정지
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5" strokeWidth={1.75} /> 재개
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEdit(r)}
                      className="!h-8 !px-2 !text-xs !gap-1"
                    >
                      <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} /> 수정
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => remove(r)}
                      className="!h-8 !px-2 !text-xs !gap-1"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-danger" strokeWidth={1.75} /> 삭제
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? '고정 거래 수정' : '고정 거래 추가'}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {(['expense', 'income'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={
                  'h-9 px-3 rounded-md text-sm border ' +
                  (type === t
                    ? 'bg-primaryPinkSoft text-textPinkStrong border-primaryPinkBorder'
                    : 'bg-pageBackground text-textSecondary border-borderDefault')
                }
              >
                {t === 'expense' ? '지출' : '수입'}
              </button>
            ))}
          </div>

          <label className="block">
            <span className="text-xs text-textSecondary">이름 / 가맹점</span>
            <input
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="예: 넷플릭스"
              className="mt-1 w-full h-11 px-3 rounded-lg border border-borderDefault bg-pageBackground text-textPrimary"
            />
          </label>

          <label className="block">
            <span className="text-xs text-textSecondary">금액</span>
            <input
              inputMode="numeric"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="예: 17000"
              className="mt-1 w-full h-11 px-3 rounded-lg border border-borderDefault bg-pageBackground text-textPrimary tabular"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs text-textSecondary">카테고리</span>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="mt-1 w-full h-11 px-3 rounded-lg border border-borderDefault bg-pageBackground text-textPrimary"
              >
                <option value="">미지정</option>
                {categories
                  .filter((c) => (type === 'income' ? c.type !== 'expense' : c.type !== 'income'))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-textSecondary">결제수단</span>
              <select
                value={paymentMethodId}
                onChange={(e) => setPaymentMethodId(e.target.value)}
                className="mt-1 w-full h-11 px-3 rounded-lg border border-borderDefault bg-pageBackground text-textPrimary"
              >
                <option value="">미지정</option>
                {paymentMethods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* 반복 주기 */}
          <div className="space-y-2">
            <span className="text-xs text-textSecondary">반복</span>
            <div className="flex items-center gap-2 flex-wrap">
              {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFrequency(f)}
                  className={
                    'h-9 px-3 rounded-md text-sm border ' +
                    (frequency === f
                      ? 'bg-primaryPinkSoft text-textPinkStrong border-primaryPinkBorder'
                      : 'bg-pageBackground text-textSecondary border-borderDefault')
                  }
                >
                  {FREQ_LABEL[f]}
                </button>
              ))}
            </div>
            {frequency === 'weekly' && (
              <div className="flex items-center gap-1 flex-wrap">
                {DOW_LABEL.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDayOfWeek(i)}
                    className={
                      'h-9 w-9 rounded-md text-sm border ' +
                      (dayOfWeek === i
                        ? 'bg-primaryPinkSoft text-textPinkStrong border-primaryPinkBorder'
                        : 'bg-pageBackground text-textSecondary border-borderDefault')
                    }
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}
            {frequency === 'monthly' && (
              <div className="flex items-center gap-2">
                <span className="text-sm">매월</span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(Math.max(1, Math.min(31, Number(e.target.value))))}
                  className="h-10 w-20 px-3 rounded-lg border border-borderDefault bg-pageBackground text-textPrimary tabular"
                />
                <span className="text-sm">일</span>
                <span className="text-xs text-textMuted">(31일이면 그 달 마지막 날로 자동 보정)</span>
              </div>
            )}
            {frequency === 'yearly' && (
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={monthOfYear}
                  onChange={(e) =>
                    setMonthOfYear(Math.max(1, Math.min(12, Number(e.target.value))))
                  }
                  className="h-10 w-20 px-3 rounded-lg border border-borderDefault bg-pageBackground text-textPrimary tabular"
                />
                <span className="text-sm">월</span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(Math.max(1, Math.min(31, Number(e.target.value))))}
                  className="h-10 w-20 px-3 rounded-lg border border-borderDefault bg-pageBackground text-textPrimary tabular"
                />
                <span className="text-sm">일</span>
              </div>
            )}
          </div>

          {/* 시작/종료 */}
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs text-textSecondary">시작일</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full h-11 px-3 rounded-lg border border-borderDefault bg-pageBackground text-textPrimary"
              />
            </label>
            <label className="block">
              <span className="text-xs text-textSecondary">종료일 (선택)</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full h-11 px-3 rounded-lg border border-borderDefault bg-pageBackground text-textPrimary"
              />
            </label>
          </div>

          {/* 자동/수동 + 알림 */}
          <div className="rounded-md border border-borderSoft p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoPost}
                onChange={(e) => setAutoPost(e.target.checked)}
                className="h-4 w-4 accent-primaryPink"
              />
              <span>자동 등록 — 다음 발생일 도래 시 거래로 자동 입력</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-xs text-textSecondary">사전 알림</span>
              <input
                type="number"
                min={0}
                max={30}
                value={notifyDays}
                onChange={(e) => setNotifyDays(Math.max(0, Math.min(30, Number(e.target.value))))}
                className="h-9 w-20 px-3 rounded-md border border-borderDefault bg-pageBackground text-textPrimary tabular text-sm"
              />
              <span className="text-xs text-textMuted">일 전 (0이면 알림 없음)</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 accent-primaryPink"
              />
              <span>활성</span>
            </label>
          </div>

          <label className="block">
            <span className="text-xs text-textSecondary">메모</span>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-borderDefault bg-pageBackground text-textPrimary"
            />
          </label>

          {saveError && (
            <p className="text-sm rounded-md bg-dangerSoft text-danger px-3 py-2">{saveError}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              취소
            </Button>
            <Button size="sm" onClick={save} disabled={pending}>
              {pending ? '저장 중…' : '저장'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
