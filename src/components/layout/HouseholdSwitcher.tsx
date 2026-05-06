'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, User, Users, Check } from 'lucide-react';
import { useActiveHousehold } from '@/lib/active-household';
import { cn } from '@/lib/utils/cn';

export function HouseholdSwitcher() {
  const { activeId, households, setActive } = useActiveHousehold();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
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
        <span className="max-w-[120px] truncate">{active ? active.name : '개인'}</span>
        <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 mt-2 w-56 z-30 rounded-modal bg-pageBackground border border-borderDefault shadow-card overflow-hidden"
        >
          <Item
            icon={<User className="h-4 w-4" strokeWidth={1.75} />}
            label="개인"
            sub="공유 안 함"
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
        </div>
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
