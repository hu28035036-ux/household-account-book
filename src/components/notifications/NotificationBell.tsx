'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, AlertTriangle, AlertOctagon, Info } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { formatDateKST } from '@/lib/formatting/date';

type N = {
  id: string;
  type: 'budget_caution' | 'budget_over' | 'duplicate_warning' | 'extraction_failed' | 'general';
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

const TONE: Record<N['type'], string> = {
  budget_caution: 'text-warning',
  budget_over: 'text-danger',
  duplicate_warning: 'text-warning',
  extraction_failed: 'text-danger',
  general: 'text-info',
};

function Icon({ type }: { type: N['type'] }) {
  if (type === 'budget_over' || type === 'extraction_failed')
    return <AlertOctagon className={cn('h-4 w-4', TONE[type])} strokeWidth={1.75} />;
  if (type === 'budget_caution' || type === 'duplicate_warning')
    return <AlertTriangle className={cn('h-4 w-4', TONE[type])} strokeWidth={1.75} />;
  return <Info className={cn('h-4 w-4', TONE[type])} strokeWidth={1.75} />;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<N[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?scope=all&limit=20');
      const json = await res.json();
      setItems(json?.data?.items ?? []);
      setUnread(json?.data?.unread ?? 0);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(load, 60_000); // 1분마다 갱신
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  async function readOne(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
    void load();
  }
  async function readAll() {
    await fetch(`/api/notifications/read-all`, { method: 'POST' });
    void load();
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`알림 ${unread}건`}
        className={cn(
          'relative h-9 w-9 inline-flex items-center justify-center rounded-md border transition-colors',
          unread > 0
            ? 'bg-primaryPinkSoft text-textPinkStrong border-primaryPinkBorder'
            : 'bg-white text-textSecondary border-borderDefault hover:bg-softPinkBackground',
        )}
      >
        <Bell className="h-4 w-4" strokeWidth={1.75} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] inline-flex items-center justify-center rounded-full bg-primaryPink text-textOnPink text-[10px] font-semibold px-1">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[92vw] z-30 rounded-modal bg-pageBackground border border-borderDefault shadow-card overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-divider">
            <span className="text-sm font-semibold text-textPrimary">알림</span>
            <div className="flex items-center gap-2 text-xs">
              <button onClick={readAll} className="text-textSecondary hover:text-textPinkStrong">
                모두 읽음
              </button>
              <Link href="/notifications" className="text-textPinkStrong" onClick={() => setOpen(false)}>
                전체 보기
              </Link>
            </div>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-3 py-6 text-sm text-textSecondary text-center">알림이 없습니다.</div>
            ) : (
              <ul className="divide-y divide-divider">
                {items.map((n) => (
                  <li
                    key={n.id}
                    className={cn(
                      'px-3 py-2 cursor-pointer hover:bg-softPinkBackground',
                      !n.read_at && 'bg-primaryPinkSoft/40',
                    )}
                    onClick={() => readOne(n.id)}
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5">
                        <Icon type={n.type} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-textPrimary truncate">{n.title}</div>
                        <div className="text-xs text-textSecondary line-clamp-2 mt-0.5">{n.body}</div>
                        <div className="text-[10px] text-textMuted mt-1">{formatDateKST(n.created_at)}</div>
                      </div>
                      {!n.read_at && <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primaryPink shrink-0" />}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
