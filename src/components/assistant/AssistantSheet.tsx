'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Sparkles, X, Loader2, ArrowRight, AlertCircle } from 'lucide-react';
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
  '통계 보여줘',
  '이번달 분석',
  '거래내역 열어',
  '예산 페이지',
  '캘린더로',
  '후보 검토',
];

type HistoryItem = {
  id: number;
  command: string;
  result: string;
  ok: boolean;
};

export function AssistantSheet() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [command, setCommand] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
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
    // 그 외 의도 (add_transaction, set_budget 등) — 다음 Phase 에서 활성화
    setError(`"${labelOfIntent(intent.type)}" 기능은 곧 추가됩니다. 지금은 페이지 이동만 가능해요.`);
    pushHistory(cmd, '준비 중', false);
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
                      placeholder="예: 통계 보여줘 / 이번달 분석"
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
                  <div className="text-xs text-textSecondary mb-1.5">💡 이렇게 입력해 보세요</div>
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
                          <span className="font-medium truncate min-w-0 flex-1">{h.command}</span>
                          <ArrowRight className="h-3 w-3 text-textMuted shrink-0" />
                          <span
                            className={`shrink-0 ${
                              h.ok ? 'text-success' : 'text-textMuted'
                            }`}
                          >
                            {h.result}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <div className="text-[11px] text-textMuted leading-relaxed pt-2 border-t border-borderSoft">
                  현재 단계에서는 페이지 이동만 가능합니다. 거래 추가·예산 설정·카테고리 생성
                  등은 곧 단계적으로 추가됩니다. 단축키: <kbd className="px-1 bg-sectionBackground rounded text-[10px]">Ctrl</kbd> + <kbd className="px-1 bg-sectionBackground rounded text-[10px]">K</kbd>.
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
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
