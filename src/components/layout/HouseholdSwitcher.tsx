'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, User, Users, Check } from 'lucide-react';
import { useActiveHousehold } from '@/lib/active-household';
import { cn } from '@/lib/utils/cn';

export function HouseholdSwitcher() {
  const { activeId, households, setActive } = useActiveHousehold();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // dropdown 은 Portal 로 body 자식이라 ref(button container) 와 별개로 contains 체크 필요
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

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

  if (households.length === 0) return null;
  const active = households.find((h) => h.id === activeId);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'h-9 px-3 rounded-md text-sm inline-flex items-center gap-2 border transition-colors',
          active
            ? 'bg-primaryPinkSoft text-textPinkStrong border-primaryPinkBorder'
            : 'bg-white text-textSecondary border-borderDefault hover:bg-softPinkBackground',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {active ? <Users className="h-4 w-4" strokeWidth={1.75} /> : <User className="h-4 w-4" strokeWidth={1.75} />}
        {/* 모바일은 아이콘만 — 가로폭 절약 (헤더 가로 스크롤 방지) */}
        <span className="hidden sm:inline max-w-[120px] truncate">
          {active ? `${active.name} 모임` : '개인 가계부'}
        </span>
        <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
      {mounted && open &&
        createPortal(
          <div
            ref={dropdownRef}
            role="listbox"
            // 헤더의 backdrop-blur 가 stacking context 를 만들어 dropdown 이 헤더 안에 갇힘.
            // viewport 우상단 기준 fixed 로 고정 — ThemeSwitcher / NotificationBell 과 동일 패턴.
            className="fixed top-[3.75rem] right-3 w-56 max-w-[calc(100vw-1.5rem)] z-50 rounded-modal bg-pageBackground border border-borderDefault shadow-card overflow-hidden"
          >
            <Item
              icon={<User className="h-4 w-4" strokeWidth={1.75} />}
              label="개인 가계부"
              sub="나만 보기"
              selected={!activeId}
              onClick={() => {
                setActive(null);
                setOpen(false);
              }}
            />
            <div className="border-t border-divider" />
            {households.map((h) => (
              <Item
                key={h.id}
                icon={<Users className="h-4 w-4" strokeWidth={1.75} />}
                label={h.name}
                sub={h.is_owner ? 'owner' : 'member'}
                selected={activeId === h.id}
                onClick={() => {
                  setActive(h.id);
                  setOpen(false);
                }}
              />
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

function Item({
  icon,
  label,
  sub,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="option"
      aria-selected={selected}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors',
        selected ? 'bg-primaryPinkSoft text-textPinkStrong' : 'hover:bg-softPinkBackground text-textPrimary',
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 min-w-0 truncate">{label}</span>
      <span className="text-xs text-textMuted whitespace-nowrap">{sub}</span>
      {selected && <Check className="h-4 w-4 ml-1 shrink-0" strokeWidth={1.75} />}
    </button>
  );
}
