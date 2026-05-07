'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  X,
  Loader2,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Store,
  Coins,
  Tag,
  CreditCard,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { Intent } from '@/lib/ai/assistantSchema';

const NAV_DESTINATIONS: Record<string, { path: string; label: string }> = {
  calendar: { path: '/dashboard', label: '월 캘린더' },
  stats: { path: '/stats', label: '통계' },
  transactions: { path: '/transactions', label: '거래내역' },
  candidates: { path: '/candidates', label: '분석 후보' },
  budgets: { path: '/budgets', label: '예산' },
  categories: { path: '/categories', label: '카테고리' },
  payment_methods: { path: '/payment-methods', label: '결제수단' },
  recurring: { path: '/recurring', label: '고정 거래' },
  households: { path: '/households', label: '모임' },
  ai_history: { path: '/ai-history', label: 'AI 기록' },
  files: { path: '/files', label: '원본 파일' },
  guide: { path: '/guide', label: '가계부 작성 가이드' },
  settings: { path: '/settings', label: '설정' },
};

const EXAMPLES = [
  '스벅 5천',
  '방금거 만오천으로',
  '방금 거 취소',
  '이번달 예산 80만',
  '운동 카테고리 만들어',
  '이번달 분석',
];

type AddTxData = Extract<Intent, { type: 'add_transaction' }>['data'];
type CreateCategoryData = Extract<Intent, { type: 'create_category' }>['data'];
type CreatePaymentMethodData = Extract<Intent, { type: 'create_payment_method' }>['data'];
type SetBudgetData = Extract<Intent, { type: 'set_budget' }>['data'];
type UpdateTxIntent = Extract<Intent, { type: 'update_transaction' }>;
type DeleteTxIntent = Extract<Intent, { type: 'delete_transaction' }>;

const CATEGORY_TYPE_LABEL: Record<CreateCategoryData['type'], string> = {
  income: '수입',
  expense: '지출',
  common: '공용',
};

const PM_TYPE_LABEL: Record<CreatePaymentMethodData['type'], string> = {
  card: '카드',
  bank: '계좌',
  cash: '현금',
  pay: '간편결제',
  other: '기타',
};

type HistoryItem = {
  id: number;
  command: string;
  result: string;
  ok: boolean;
};

type Phase = 'idle' | 'preview' | 'success';

type CategoryOption = { id: string; name: string; type: 'income' | 'expense' | 'common' };
type PaymentMethodOption = {
  id: string;
  name: string;
  type: 'card' | 'bank' | 'cash' | 'pay' | 'other';
};

export function AssistantSheet() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [command, setCommand] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [previewIntent, setPreviewIntent] = useState<Intent | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setMounted(true), []);

  // Ctrl+K / Cmd+K 단축키 — 어디서나 열기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape' && open) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // 시트 열리면 입력 포커스 + body 스크롤 잠금
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setTimeout(() => inputRef.current?.focus(), 50);
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // 시트 첫 열림에 카테고리/결제수단 목록 캐시 (편집용)
  useEffect(() => {
    if (!open) return;
    if (categories.length > 0 || paymentMethods.length > 0) return;
    Promise.all([
      fetch('/api/categories', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/payment-methods', { cache: 'no-store' }).then((r) => r.json()),
    ])
      .then(([catRes, pmRes]) => {
        if (Array.isArray(catRes?.data)) setCategories(catRes.data);
        if (Array.isArray(pmRes?.data)) setPaymentMethods(pmRes.data);
      })
      .catch(() => {
        // 무시 — 편집 dropdown 이 빈 채로 보일 뿐
      });
  }, [open, categories.length, paymentMethods.length]);

  async function submit(rawCmd?: string) {
    const cmd = (rawCmd ?? command).trim();
    if (!cmd) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/assistant/parse', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? '분석 실패');
      const intent = json.data.intent as Intent;
      handleIntent(cmd, intent);
    } catch (e) {
      setError(e instanceof Error ? e.message : '분석 실패');
    } finally {
      setBusy(false);
    }
  }

  function handleIntent(cmd: string, intent: Intent) {
    if (intent.type === 'navigate') {
      const dest = NAV_DESTINATIONS[intent.data.destination];
      if (!dest) {
        pushHistory(cmd, '알 수 없는 페이지', false);
        return;
      }
      // year_month_hint → 쿼리 파라미터로 변환
      let path = dest.path;
      const hint = intent.data.year_month_hint;
      if (hint && (intent.data.destination === 'stats' || intent.data.destination === 'calendar')) {
        const ym = resolveYmHint(hint);
        if (ym) path = `${dest.path}?ym=${ym}`;
      }
      pushHistory(cmd, `→ ${dest.label}`, true);
      setCommand('');
      setOpen(false);
      router.push(path);
      return;
    }
    if (intent.type === 'clarify') {
      setError(intent.question);
      return;
    }
    if (intent.type === 'unknown') {
      setError(intent.reason || '명령을 이해하지 못했어요.');
      return;
    }
    if (
      intent.type === 'add_transaction' ||
      intent.type === 'create_category' ||
      intent.type === 'create_payment_method' ||
      intent.type === 'set_budget' ||
      intent.type === 'update_transaction' ||
      intent.type === 'delete_transaction'
    ) {
      setPreviewIntent(intent);
      setPhase('preview');
      setError(null);
      return;
    }
    // 이후 Phase 에서 enable: recurring / delete_category / delete_payment_method
    setError(
      `"${labelOfIntent(intent.type)}" 기능은 곧 추가됩니다. 현재는 페이지 이동·거래 추가/수정/삭제·카테고리/결제수단 생성·예산 설정이 가능해요.`,
    );
    pushHistory(cmd, '준비 중', false);
  }

  async function executePreview() {
    if (!previewIntent) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/assistant/execute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ intent: previewIntent }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? '실행 실패');
      const message = json.data?.message ?? '완료';
      pushHistory(command, message, true);
      setSuccessMessage(message);
      setPhase('success');
      setPreviewIntent(null);
      setCommand('');
      // 1.5초 후 닫기
      setTimeout(() => {
        setPhase('idle');
        setSuccessMessage(null);
      }, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : '실행 실패');
    } finally {
      setBusy(false);
    }
  }

  function cancelPreview() {
    setPreviewIntent(null);
    setPhase('idle');
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function pushHistory(command: string, result: string, ok: boolean) {
    setHistory((h) => [{ id: Date.now(), command, result, ok }, ...h].slice(0, 8));
  }

  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="AI 입력 (준비 중)"
        title="AI 입력"
        className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-borderDefault bg-white"
      >
        <Sparkles className="h-4 w-4 text-textSecondary" strokeWidth={1.75} />
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="AI 입력"
        title="AI 입력 (Ctrl+K)"
        className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-borderDefault bg-white hover:bg-softPinkBackground transition-colors"
      >
        <Sparkles className="h-4 w-4 text-textPinkStrong" strokeWidth={1.75} />
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="AI 입력">
            <button
              type="button"
              aria-label="닫기"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/40"
            />
            <div
              className="absolute inset-x-0 bottom-0 sm:inset-y-0 sm:right-0 sm:left-auto sm:max-w-md w-full h-[80vh] sm:h-screen bg-pageBackground rounded-t-2xl sm:rounded-none border-t sm:border-t-0 sm:border-l border-borderDefault shadow-2xl flex flex-col"
              style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
            >
              <div className="sticky top-0 bg-pageBackground/95 backdrop-blur flex items-center justify-between gap-2 px-4 py-3 border-b border-borderSoft">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-textPinkStrong" strokeWidth={1.75} />
                  <h2 className="text-base font-semibold text-textPrimary">AI 입력</h2>
                  <span className="text-[10px] text-textMuted bg-sectionBackground rounded px-1.5 py-0.5">
                    Phase 1: 페이지 이동
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="닫기"
                  className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-softPinkBackground"
                >
                  <X className="h-5 w-5" strokeWidth={1.75} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {phase === 'success' && successMessage && (
                  <div className="rounded-md bg-successSoft text-success px-3 py-2 text-sm flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" strokeWidth={1.75} />
                    <span>{successMessage}</span>
                  </div>
                )}

                {phase === 'preview' && previewIntent?.type === 'add_transaction' ? (
                  <AddTransactionPreview
                    data={previewIntent.data}
                    categories={categories}
                    paymentMethods={paymentMethods}
                    busy={busy}
                    onConfirm={executePreview}
                    onCancel={cancelPreview}
                    onChange={(patch) =>
                      setPreviewIntent({
                        ...previewIntent,
                        data: { ...previewIntent.data, ...patch },
                      })
                    }
                  />
                ) : phase === 'preview' && previewIntent?.type === 'create_category' ? (
                  <CreateCategoryPreview
                    data={previewIntent.data}
                    busy={busy}
                    onConfirm={executePreview}
                    onCancel={cancelPreview}
                  />
                ) : phase === 'preview' && previewIntent?.type === 'create_payment_method' ? (
                  <CreatePaymentMethodPreview
                    data={previewIntent.data}
                    busy={busy}
                    onConfirm={executePreview}
                    onCancel={cancelPreview}
                  />
                ) : phase === 'preview' && previewIntent?.type === 'set_budget' ? (
                  <SetBudgetPreview
                    data={previewIntent.data}
                    busy={busy}
                    onConfirm={executePreview}
                    onCancel={cancelPreview}
                  />
                ) : phase === 'preview' && previewIntent?.type === 'update_transaction' ? (
                  <UpdateTransactionPreview
                    intent={previewIntent}
                    busy={busy}
                    onConfirm={executePreview}
                    onCancel={cancelPreview}
                  />
                ) : phase === 'preview' && previewIntent?.type === 'delete_transaction' ? (
                  <DeleteTransactionPreview
                    intent={previewIntent}
                    busy={busy}
                    onConfirm={executePreview}
                    onCancel={cancelPreview}
                  />
                ) : (
                  <>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        submit();
                      }}
                    >
                      <div className="relative">
                        <input
                          ref={inputRef}
                          value={command}
                          onChange={(e) => setCommand(e.target.value)}
                          placeholder="예: 스벅 5천 / 통계 보여줘"
                          disabled={busy}
                          className="w-full h-12 pr-10 px-3 rounded-md border border-borderDefault bg-white text-sm text-textPrimary placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-primaryPinkSoft"
                        />
                        {busy && (
                          <Loader2
                            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-textPinkStrong"
                            strokeWidth={1.75}
                          />
                        )}
                      </div>
                    </form>

                    {error && (
                      <div className="rounded-md bg-warningSoft text-warning px-3 py-2 text-sm flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" strokeWidth={1.75} />
                        <span>{error}</span>
                      </div>
                    )}

                    <section>
                      <div className="text-xs text-textSecondary mb-1.5">
                        💡 이렇게 입력해 보세요
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {EXAMPLES.map((ex) => (
                          <button
                            key={ex}
                            type="button"
                            onClick={() => {
                              setCommand(ex);
                              submit(ex);
                            }}
                            disabled={busy}
                            className="text-xs px-2.5 h-7 rounded-full border border-borderDefault text-textSecondary hover:bg-softPinkBackground"
                          >
                            {ex}
                          </button>
                        ))}
                      </div>
                    </section>

                    {history.length > 0 && (
                      <section>
                        <div className="text-xs text-textSecondary mb-1.5">최근 입력</div>
                        <ul className="space-y-1">
                          {history.map((h) => (
                            <li
                              key={h.id}
                              className="flex items-center gap-2 text-xs text-textPrimary"
                            >
                              <span className="font-medium truncate min-w-0 flex-1">
                                {h.command}
                              </span>
                              <ArrowRight className="h-3 w-3 text-textMuted shrink-0" />
                              <span
                                className={`shrink-0 ${h.ok ? 'text-success' : 'text-textMuted'}`}
                              >
                                {h.result}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}

                    <div className="text-[11px] text-textMuted leading-relaxed pt-2 border-t border-borderSoft">
                      페이지 이동 · 거래 추가/수정/삭제 · 카테고리·결제수단 생성 · 예산 설정이
                      가능합니다. 고정거래 등록은 곧 추가됩니다. 단축키:{' '}
                      <kbd className="px-1 bg-sectionBackground rounded text-[10px]">Ctrl</kbd> +{' '}
                      <kbd className="px-1 bg-sectionBackground rounded text-[10px]">K</kbd>.
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function AddTransactionPreview({
  data,
  categories,
  paymentMethods,
  busy,
  onConfirm,
  onCancel,
  onChange,
}: {
  data: AddTxData;
  categories: CategoryOption[];
  paymentMethods: PaymentMethodOption[];
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onChange: (patch: Partial<AddTxData>) => void;
}) {
  const isIncome = data.type === 'income';
  const TypeIcon = isIncome ? TrendingUp : TrendingDown;
  const typeColor = isIncome ? 'text-success' : 'text-textPrimary';

  // 타입에 맞는 카테고리만 필터링 (지출은 expense+common, 수입은 income+common)
  const filteredCats = categories.filter((c) =>
    isIncome ? c.type !== 'expense' : c.type !== 'income',
  );

  return (
    <div className="space-y-3">
      <div className="text-xs text-textSecondary">
        AI 가 분석한 결과입니다. 틀린 항목은 바로 아래에서 직접 수정할 수 있어요.
      </div>
      <div className="rounded-modal border border-borderDefault bg-white p-4 space-y-3">
        {/* 타입 (수입/지출/이체) — 핑크 토글 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-textSecondary w-16 shrink-0 inline-flex items-center gap-1.5">
            <Coins className="h-4 w-4 text-textPinkStrong" strokeWidth={1.75} /> 종류
          </span>
          <div className="flex gap-1.5 flex-1">
            {(['expense', 'income', 'transfer'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onChange({ type: t })}
                disabled={busy}
                className={`text-xs px-2.5 h-7 rounded-full border transition-colors ${
                  data.type === t
                    ? 'bg-primaryPinkSoft text-textPinkStrong border-primaryPinkSoft'
                    : 'border-borderDefault text-textSecondary hover:bg-softPinkBackground'
                }`}
              >
                {t === 'expense' ? '지출' : t === 'income' ? '수입' : '이체'}
              </button>
            ))}
          </div>
        </div>

        {/* 날짜 */}
        <EditableRow icon={<Calendar className="h-4 w-4" strokeWidth={1.75} />} label="날짜">
          <input
            type="date"
            value={data.date}
            onChange={(e) => onChange({ date: e.target.value })}
            disabled={busy}
            className="flex-1 h-8 rounded-md border border-borderDefault bg-white px-2 text-sm text-textPrimary"
          />
        </EditableRow>

        {/* 가맹점 */}
        <EditableRow icon={<Store className="h-4 w-4" strokeWidth={1.75} />} label="가맹점">
          <input
            type="text"
            value={data.merchant_name ?? ''}
            onChange={(e) => onChange({ merchant_name: e.target.value || null })}
            disabled={busy}
            placeholder="가맹점 이름"
            className="flex-1 h-8 rounded-md border border-borderDefault bg-white px-2 text-sm text-textPrimary"
          />
        </EditableRow>

        {/* 금액 */}
        <EditableRow icon={<Coins className="h-4 w-4" strokeWidth={1.75} />} label="금액">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={100}
            value={data.amount}
            onChange={(e) => {
              const n = Math.max(0, Math.floor(Number(e.target.value) || 0));
              onChange({ amount: n });
            }}
            disabled={busy}
            className="flex-1 h-8 rounded-md border border-borderDefault bg-white px-2 text-sm text-textPrimary text-right font-semibold"
          />
          <span className="text-xs text-textMuted shrink-0">원</span>
        </EditableRow>
        <div className="ml-[68px] -mt-1 flex items-center gap-1.5 text-xs">
          <TypeIcon className={`h-3.5 w-3.5 ${typeColor}`} strokeWidth={2} />
          <span className={`${typeColor} font-medium`}>
            {(isIncome ? '+' : '-') + data.amount.toLocaleString('ko-KR')}원
          </span>
        </div>

        {/* 카테고리 */}
        <EditableRow icon={<Tag className="h-4 w-4" strokeWidth={1.75} />} label="카테고리">
          <select
            value={data.category_name ?? ''}
            onChange={(e) => onChange({ category_name: e.target.value || null })}
            disabled={busy}
            className="flex-1 h-8 rounded-md border border-borderDefault bg-white px-2 text-sm text-textPrimary"
          >
            <option value="">— 미정 —</option>
            {filteredCats.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
            {data.category_name &&
              !filteredCats.some((c) => c.name === data.category_name) && (
                <option value={data.category_name}>
                  {data.category_name} (목록에 없음)
                </option>
              )}
          </select>
        </EditableRow>

        {/* 결제수단 */}
        <EditableRow icon={<CreditCard className="h-4 w-4" strokeWidth={1.75} />} label="결제수단">
          <select
            value={data.payment_method_name ?? ''}
            onChange={(e) => onChange({ payment_method_name: e.target.value || null })}
            disabled={busy}
            className="flex-1 h-8 rounded-md border border-borderDefault bg-white px-2 text-sm text-textPrimary"
          >
            <option value="">— 미정 —</option>
            {paymentMethods.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </EditableRow>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="h-9 px-3 rounded-md text-sm border border-borderDefault text-textSecondary hover:bg-softPinkBackground disabled:opacity-50"
        >
          ✗ 취소
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy || data.amount <= 0}
          className="h-9 px-4 rounded-md text-sm bg-primaryPink text-textOnPink hover:bg-primaryPinkHover inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
          )}
          추가
        </button>
      </div>
    </div>
  );
}

function EditableRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-textSecondary w-16 shrink-0 inline-flex items-center gap-1.5">
        <span className="h-4 w-4 text-textPinkStrong shrink-0 inline-flex items-center justify-center">
          {icon}
        </span>
        <span>{label}</span>
      </span>
      {children}
    </div>
  );
}

function CreateCategoryPreview({
  data,
  busy,
  onConfirm,
  onCancel,
}: {
  data: CreateCategoryData;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="text-xs text-textSecondary">아래 카테고리를 새로 만들까요?</div>
      <div className="rounded-modal border border-borderDefault bg-white p-4 space-y-2.5">
        <Row
          icon={<Tag className="h-4 w-4" strokeWidth={1.75} />}
          label="이름"
          value={data.name}
        />
        <Row
          icon={<Sparkles className="h-4 w-4" strokeWidth={1.75} />}
          label="용도"
          value={CATEGORY_TYPE_LABEL[data.type]}
        />
      </div>
      <ConfirmRow busy={busy} onConfirm={onConfirm} onCancel={onCancel} confirmLabel="만들기" />
      <p className="text-[11px] text-textMuted">
        같은 이름의 카테고리가 이미 있으면 만들 수 없어요. 카테고리 페이지에서 색상·아이콘은
        나중에 변경 가능합니다.
      </p>
    </div>
  );
}

function CreatePaymentMethodPreview({
  data,
  busy,
  onConfirm,
  onCancel,
}: {
  data: CreatePaymentMethodData;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="text-xs text-textSecondary">아래 결제수단을 새로 만들까요?</div>
      <div className="rounded-modal border border-borderDefault bg-white p-4 space-y-2.5">
        <Row
          icon={<CreditCard className="h-4 w-4" strokeWidth={1.75} />}
          label="이름"
          value={data.name}
        />
        <Row
          icon={<Sparkles className="h-4 w-4" strokeWidth={1.75} />}
          label="종류"
          value={PM_TYPE_LABEL[data.type]}
        />
      </div>
      <ConfirmRow busy={busy} onConfirm={onConfirm} onCancel={onCancel} confirmLabel="만들기" />
      <p className="text-[11px] text-textMuted">
        결제수단 페이지에서 카드번호 끝 4자리 등 추가 정보를 나중에 입력할 수 있어요.
      </p>
    </div>
  );
}

function targetLabel(target: UpdateTxIntent['target'] | DeleteTxIntent['target']): string {
  if (target.selector === 'last') return '가장 최근에 추가한 거래';
  if (target.selector === 'duplicate') return '중복 의심 거래';
  const parts: string[] = [];
  if (target.date) parts.push(target.date);
  if (target.merchant_name) parts.push(target.merchant_name);
  return parts.length > 0 ? `${parts.join(' · ')} 거래` : '조건에 맞는 거래';
}

function UpdateTransactionPreview({
  intent,
  busy,
  onConfirm,
  onCancel,
}: {
  intent: UpdateTxIntent;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const patch = intent.patch;
  const changes: { label: string; value: string }[] = [];
  if (patch.amount != null) changes.push({ label: '금액', value: `${patch.amount.toLocaleString('ko-KR')}원` });
  if (patch.merchant_name) changes.push({ label: '가맹점', value: patch.merchant_name });
  if (patch.category_name) changes.push({ label: '카테고리', value: patch.category_name });
  if (patch.payment_method_name) changes.push({ label: '결제수단', value: patch.payment_method_name });
  if (patch.date) changes.push({ label: '날짜', value: patch.date });

  return (
    <div className="space-y-3">
      <div className="text-xs text-textSecondary">아래 거래를 수정할까요?</div>
      <div className="rounded-modal border border-borderDefault bg-white p-4 space-y-3">
        <div className="rounded-md bg-sectionBackground px-3 py-2 text-xs">
          <div className="text-textMuted">대상</div>
          <div className="text-textPrimary font-medium mt-0.5">{targetLabel(intent.target)}</div>
        </div>

        <div>
          <div className="text-xs text-textSecondary mb-1.5 flex items-center gap-1">
            <Pencil className="h-3 w-3" strokeWidth={2} />
            <span>변경할 내용</span>
          </div>
          {changes.length > 0 ? (
            <div className="space-y-1.5">
              {changes.map((c) => (
                <div
                  key={c.label}
                  className="flex items-center gap-2 text-sm rounded-md bg-primaryPinkSoft px-3 py-1.5"
                >
                  <span className="text-xs text-textSecondary w-16 shrink-0">{c.label}</span>
                  <span className="text-textPrimary font-medium">→ {c.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-textMuted">변경할 내용이 없습니다.</div>
          )}
        </div>
      </div>
      <ConfirmRow busy={busy} onConfirm={onConfirm} onCancel={onCancel} confirmLabel="수정" />
      <p className="text-[11px] text-textMuted">
        조건과 일치하는 가장 최근 1건만 수정됩니다. 잘못 매칭됐다면 [취소] 후 더 구체적으로
        입력해 주세요. (예: "어제 스타벅스 만원으로")
      </p>
    </div>
  );
}

function DeleteTransactionPreview({
  intent,
  busy,
  onConfirm,
  onCancel,
}: {
  intent: DeleteTxIntent;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-md bg-dangerSoft text-danger px-3 py-2 text-sm flex items-start gap-2">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" strokeWidth={1.75} />
        <span>이 거래를 삭제합니다. 되돌릴 수 없습니다.</span>
      </div>
      <div className="rounded-modal border border-borderDefault bg-white p-4 space-y-2.5">
        <Row
          icon={<Trash2 className="h-4 w-4" strokeWidth={1.75} />}
          label="대상"
          value={targetLabel(intent.target)}
        />
        {intent.target.selector === 'last' && (
          <p className="text-[11px] text-textMuted leading-relaxed pt-1 border-t border-borderSoft">
            가장 최근에 추가된 거래 1건이 삭제됩니다. 방금 잘못 입력한 거래를 되돌리는
            용도입니다.
          </p>
        )}
        {intent.target.selector !== 'last' && (
          <p className="text-[11px] text-textMuted leading-relaxed pt-1 border-t border-borderSoft">
            조건과 일치하는 가장 최근 거래 1건이 삭제됩니다. 여러 건 일괄 삭제는 거래내역
            페이지에서 직접 선택해 주세요.
          </p>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="h-9 px-3 rounded-md text-sm border border-borderDefault text-textSecondary hover:bg-softPinkBackground disabled:opacity-50"
        >
          ✗ 취소
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="h-9 px-4 rounded-md text-sm bg-danger text-white hover:opacity-90 inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
          ) : (
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
          )}
          삭제
        </button>
      </div>
    </div>
  );
}

function SetBudgetPreview({
  data,
  busy,
  onConfirm,
  onCancel,
}: {
  data: SetBudgetData;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [y, m] = data.year_month.split('-');
  const monthLabel = `${y}년 ${Number(m)}월`;
  const isAll = !data.category_name;
  return (
    <div className="space-y-3">
      <div className="text-xs text-textSecondary">
        아래 예산을 설정할까요? 같은 기간·카테고리에 이미 예산이 있으면 덮어씁니다.
      </div>
      <div className="rounded-modal border border-borderDefault bg-white p-4 space-y-2.5">
        <Row
          icon={<Calendar className="h-4 w-4" strokeWidth={1.75} />}
          label="기간"
          value={monthLabel}
        />
        <Row
          icon={<Tag className="h-4 w-4" strokeWidth={1.75} />}
          label="범위"
          valueNode={
            <span className={isAll ? 'text-textPrimary font-medium' : 'text-textPrimary font-medium'}>
              {isAll ? (
                <span className="inline-flex items-center gap-1.5">
                  전체 예산
                  <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-sectionBackground text-textSecondary">
                    카테고리 무관
                  </span>
                </span>
              ) : (
                data.category_name
              )}
            </span>
          }
        />
        <Row
          icon={<PiggyBank className="h-4 w-4" strokeWidth={1.75} />}
          label="한도"
          valueNode={
            <span className="text-textPrimary font-semibold">
              {data.amount.toLocaleString('ko-KR')}원
            </span>
          }
        />
      </div>
      <ConfirmRow busy={busy} onConfirm={onConfirm} onCancel={onCancel} confirmLabel="설정" />
      <p className="text-[11px] text-textMuted">
        예산은 월 단위입니다. 80% 도달 시 알림이 발송돼요. 카테고리 이름이 정확히 일치하지
        않으면 전체 예산으로 적용됩니다.
      </p>
    </div>
  );
}

function ConfirmRow({
  busy,
  onConfirm,
  onCancel,
  confirmLabel,
}: {
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel: string;
}) {
  return (
    <div className="flex items-center justify-end gap-2 pt-1">
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="h-9 px-3 rounded-md text-sm border border-borderDefault text-textSecondary hover:bg-softPinkBackground disabled:opacity-50"
      >
        ✗ 취소
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={busy}
        className="h-9 px-4 rounded-md text-sm bg-primaryPink text-textOnPink hover:bg-primaryPinkHover inline-flex items-center gap-1.5 disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
        )}
        {confirmLabel}
      </button>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  valueNode,
  muted,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  valueNode?: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="h-4 w-4 text-textPinkStrong shrink-0 inline-flex items-center justify-center">
        {icon}
      </span>
      <span className="text-xs text-textSecondary w-16 shrink-0">{label}</span>
      {valueNode ?? (
        <span className={muted ? 'text-textMuted' : 'text-textPrimary font-medium'}>{value}</span>
      )}
    </div>
  );
}

function formatYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  const dow = ['일', '월', '화', '수', '목', '금', '토'][new Date(y, m - 1, d).getDay()];
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} (${dow})`;
}

function resolveYmHint(hint: string): string | null {
  const now = new Date();
  const kst = new Date(now.getTime());
  const ymDirect = hint.match(/^(\d{4})-(\d{2})$/);
  if (ymDirect) return hint;
  if (hint === 'this_month') {
    return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}`;
  }
  if (hint === 'last_month') {
    const d = new Date(kst);
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  return null;
}

function labelOfIntent(t: Intent['type']): string {
  switch (t) {
    case 'add_transaction':
      return '거래 추가';
    case 'update_transaction':
      return '거래 수정';
    case 'delete_transaction':
      return '거래 삭제';
    case 'create_category':
      return '카테고리 생성';
    case 'delete_category':
      return '카테고리 삭제';
    case 'create_payment_method':
      return '결제수단 생성';
    case 'delete_payment_method':
      return '결제수단 삭제';
    case 'set_budget':
      return '예산 설정';
    case 'create_recurring':
      return '고정 거래 등록';
    default:
      return t;
  }
}
