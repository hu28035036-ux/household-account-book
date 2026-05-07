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
  '오늘 점심 8천',
  '월급 350만',
  '통계 보여줘',
  '이번달 분석',
  '예산 페이지',
];

type AddTxData = Extract<Intent, { type: 'add_transaction' }>['data'];

type HistoryItem = {
  id: number;
  command: string;
  result: string;
  ok: boolean;
};

type Phase = 'idle' | 'preview' | 'success';

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
    if (intent.type === 'add_transaction') {
      setPreviewIntent(intent);
      setPhase('preview');
      setError(null);
      return;
    }
    // Phase 3+ 에서 enable: update/delete/category/pm/budget/recurring
    setError(`"${labelOfIntent(intent.type)}" 기능은 곧 추가됩니다. 현재는 페이지 이동·거래 추가만 가능해요.`);
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
                      페이지 이동 · 거래 추가가 가능합니다. 예산·카테고리 등은 곧 추가됩니다.
                      단축키:{' '}
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
  busy,
  onConfirm,
  onCancel,
}: {
  data: AddTxData;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isIncome = data.type === 'income';
  const TypeIcon = isIncome ? TrendingUp : TrendingDown;
  const typeColor = isIncome ? 'text-success' : 'text-textPrimary';
  return (
    <div className="space-y-3">
      <div className="text-xs text-textSecondary">아래 내용으로 추가할까요?</div>
      <div className="rounded-modal border border-borderDefault bg-white p-4 space-y-2.5">
        <Row
          icon={<Calendar className="h-4 w-4" strokeWidth={1.75} />}
          label="날짜"
          value={formatYmd(data.date)}
        />
        <Row
          icon={<Store className="h-4 w-4" strokeWidth={1.75} />}
          label="가맹점"
          value={data.merchant_name || '—'}
        />
        <Row
          icon={<Coins className="h-4 w-4" strokeWidth={1.75} />}
          label="금액"
          valueNode={
            <div className={`flex items-center gap-1.5 font-semibold ${typeColor}`}>
              <TypeIcon className="h-4 w-4" strokeWidth={2} />
              <span>
                {(isIncome ? '+' : '-') + data.amount.toLocaleString('ko-KR')}원
              </span>
              <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-sectionBackground text-textSecondary">
                {isIncome ? '수입' : data.type === 'transfer' ? '이체' : '지출'}
              </span>
            </div>
          }
        />
        <Row
          icon={<Tag className="h-4 w-4" strokeWidth={1.75} />}
          label="카테고리"
          value={data.category_name || '미정'}
          muted={!data.category_name}
        />
        <Row
          icon={<CreditCard className="h-4 w-4" strokeWidth={1.75} />}
          label="결제수단"
          value={data.payment_method_name || '미정'}
          muted={!data.payment_method_name}
        />
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

      <p className="text-[11px] text-textMuted">
        틀린 내용이 있다면 [취소] 후 다시 입력해 주세요. 카테고리/결제수단은 추가 후 거래내역
        페이지에서 변경할 수 있어요.
      </p>
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
