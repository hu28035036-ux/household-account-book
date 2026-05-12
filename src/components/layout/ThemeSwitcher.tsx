'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Palette, Check, Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const THEMES = [
  { id: 'pink', label: '핑크 (기본)', desc: '연핑크 톤', dot: '#F472B6' },
  { id: 'lavender', label: '라벤더', desc: '연보라 톤', dot: '#A78BFA' },
  { id: 'mint', label: '민트', desc: '청록 톤', dot: '#14B8A6' },
  { id: 'mocha', label: '모카', desc: '베이지·갈색 톤', dot: '#A78B6E' },
] as const;

type ThemeId = (typeof THEMES)[number]['id'];
const THEME_KEY = 'theme';

const MODES = [
  { id: 'system', label: '시스템', icon: Monitor, desc: 'OS 설정 따라가기' },
  { id: 'light', label: '라이트', icon: Sun, desc: '항상 밝게' },
  { id: 'dark', label: '다크', icon: Moon, desc: '항상 어둡게 (미드나잇)' },
] as const;

type ModeId = (typeof MODES)[number]['id'];
const MODE_KEY = 'themeMode';

function applyTheme(t: ThemeId) {
  if (typeof document === 'undefined') return;
  if (t === 'pink') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', t);
  }
}

// themeMode + prefers-color-scheme 조합으로 html.dark 토글.
// layout.tsx 의 init script 와 동일 규칙.
function applyMode(m: ModeId) {
  if (typeof document === 'undefined') return;
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = m === 'dark' || (m === 'system' && prefersDark);
  document.documentElement.classList.toggle('dark', isDark);
}

export function ThemeSwitcher() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState<ThemeId>('pink');
  const [mode, setMode] = useState<ModeId>('system');
  const ref = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // 초기 로드 — localStorage 값 복원
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedTheme = window.localStorage.getItem(THEME_KEY) as ThemeId | null;
    if (storedTheme && THEMES.some((t) => t.id === storedTheme)) {
      setActive(storedTheme);
      applyTheme(storedTheme);
    }
    const storedMode = window.localStorage.getItem(MODE_KEY) as ModeId | null;
    if (storedMode && MODES.some((m) => m.id === storedMode)) {
      setMode(storedMode);
      applyMode(storedMode);
    } else {
      applyMode('system');
    }
  }, []);

  // 모드가 system 인 경우 OS 다크 모드 변경에 즉시 반응 — addEventListener 로 감시.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    function onChange() {
      if (mode === 'system') applyMode('system');
    }
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, [mode]);

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

  function pickTheme(t: ThemeId) {
    setActive(t);
    applyTheme(t);
    if (typeof window !== 'undefined') window.localStorage.setItem(THEME_KEY, t);
  }

  function pickMode(m: ModeId) {
    setMode(m);
    applyMode(m);
    if (typeof window !== 'undefined') window.localStorage.setItem(MODE_KEY, m);
  }

  const current = THEMES.find((t) => t.id === active) ?? THEMES[0];
  const currentMode = MODES.find((m) => m.id === mode) ?? MODES[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="테마 변경"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-borderDefault bg-pageBackground hover:bg-softPinkBackground transition-colors"
        title={`테마: ${current.label} · ${currentMode.label}`}
      >
        <Palette className="h-4 w-4 text-textSecondary" strokeWidth={1.75} />
        <span
          className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-1 ring-pageBackground"
          style={{ backgroundColor: current.dot }}
        />
      </button>
      {mounted && open &&
        createPortal(
          <div
            ref={dropdownRef}
            role="dialog"
            aria-label="테마 선택"
            // 헤더 backdrop-blur stacking context 탈출 — Portal + viewport-fixed.
            // NotificationBell / HouseholdSwitcher 와 동일 패턴.
            className="fixed top-[3.75rem] right-3 w-56 max-w-[calc(100vw-1.5rem)] z-50 rounded-modal bg-pageBackground border border-borderDefault shadow-card overflow-hidden"
          >
            {/* 모드 (라이트/다크/시스템) */}
            <div className="px-3 pt-2 pb-1 text-[11px] text-textMuted">모드</div>
            <div className="px-2 pb-2 grid grid-cols-3 gap-1">
              {MODES.map((m) => {
                const Icon = m.icon;
                const selected = mode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => pickMode(m.id)}
                    aria-pressed={selected}
                    title={m.desc}
                    className={cn(
                      'flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-md text-[11px] transition-colors',
                      selected
                        ? 'bg-primaryPinkSoft text-textPinkStrong'
                        : 'text-textSecondary hover:bg-softPinkBackground',
                    )}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="border-t border-borderSoft" />

            {/* 컬러 테마 */}
            <div className="px-3 pt-2 pb-1 text-[11px] text-textMuted">컬러 테마</div>
            <div role="listbox" aria-label="컬러 테마 선택">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="option"
                  aria-selected={active === t.id}
                  onClick={() => pickTheme(t.id)}
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
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
