'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Palette, Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const THEMES = [
  { id: 'pink', label: '핑크 (기본)', desc: '연핑크 톤', dot: '#F472B6' },
  { id: 'lavender', label: '라벤더', desc: '연보라 톤', dot: '#A78BFA' },
  { id: 'mint', label: '민트', desc: '청록 톤', dot: '#14B8A6' },
  { id: 'mocha', label: '모카', desc: '베이지·갈색 톤', dot: '#A78B6E' },
] as const;

type ThemeId = (typeof THEMES)[number]['id'];
const STORAGE_KEY = 'theme';

function applyTheme(t: ThemeId) {
  if (typeof document === 'undefined') return;
  if (t === 'pink') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', t);
  }
}

export function ThemeSwitcher() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState<ThemeId>('pink');
  const ref = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // 초기 로드 — localStorage 값 복원
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    if (stored && THEMES.some((t) => t.id === stored)) {
      setActive(stored);
      applyTheme(stored);
    }
  }, []);

  // 바깥 클릭 + Esc 닫기 — Portal 자식이므로 dropdownRef 별도 contains 검사 필수
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      const insideButton = ref.current?.contains(t) ?? false;
      const insideDropdown = dropdownRef.current?.contains(t) ?? false;
      if (!insideButton && !insideDropdown) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function pick(t: ThemeId) {
    setActive(t);
    applyTheme(t);
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, t);
    setOpen(false);
  }

  const current = THEMES.find((t) => t.id === active) ?? THEMES[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="테마 변경"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-borderDefault bg-white hover:bg-softPinkBackground transition-colors"
        title={`테마: ${current.label}`}
      >
        <Palette className="h-4 w-4 text-textSecondary" strokeWidth={1.75} />
        <span
          className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-1 ring-white"
          style={{ backgroundColor: current.dot }}
        />
      </button>
      {mounted && open &&
        createPortal(
          <div
            ref={dropdownRef}
            role="listbox"
            aria-label="테마 선택"
            // 헤더 backdrop-blur stacking context 탈출 — Portal + viewport-fixed.
            // NotificationBell / HouseholdSwitcher 와 동일 패턴.
            className="fixed top-[3.75rem] right-3 w-48 max-w-[calc(100vw-1.5rem)] z-50 rounded-modal bg-pageBackground border border-borderDefault shadow-card overflow-hidden"
          >
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="option"
                aria-selected={active === t.id}
                onClick={() => pick(t.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors',
                  active === t.id
                    ? 'bg-primaryPinkSoft text-textPinkStrong'
                    : 'hover:bg-softPinkBackground text-textPrimary',
                )}
              >
                <span
                  className="inline-block h-4 w-4 rounded-full border border-borderDefault shrink-0"
                  style={{ backgroundColor: t.dot }}
                />
                <span className="flex-1 min-w-0">
                  <div className="truncate">{t.label}</div>
                  <div className="text-[11px] text-textMuted">{t.desc}</div>
                </span>
                {active === t.id && (
                  <Check className="h-4 w-4 ml-1 shrink-0" strokeWidth={1.75} />
                )}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
