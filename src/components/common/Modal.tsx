'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
};

export function Modal({ open, onClose, title, children, className }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden />
      <div
        className={cn(
          'relative bg-pageBackground w-full sm:max-w-md mx-0 sm:mx-4 rounded-t-modal sm:rounded-modal shadow-xl border border-borderDefault',
          'p-4 sm:p-5 max-h-[92vh] overflow-y-auto',
          className,
        )}
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-textPrimary">{title}</h3>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-softPinkBackground"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
