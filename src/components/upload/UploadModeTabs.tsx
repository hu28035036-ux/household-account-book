'use client';

import { useState } from 'react';
import { Image as ImageIcon, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { UploadClient } from './UploadClient';
import { ImportClient } from './ImportClient';

type Mode = 'image' | 'sheet';

export function UploadModeTabs() {
  const [mode, setMode] = useState<Mode>('image');
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg bg-sectionBackground p-1 border border-borderDefault">
        <TabButton active={mode === 'image'} onClick={() => setMode('image')}>
          <ImageIcon className="h-4 w-4" strokeWidth={1.75} />
          이미지 (영수증·캡처)
        </TabButton>
        <TabButton active={mode === 'sheet'} onClick={() => setMode('sheet')}>
          <FileSpreadsheet className="h-4 w-4" strokeWidth={1.75} />
          CSV / XLSX
        </TabButton>
      </div>
      {mode === 'image' ? <UploadClient /> : <ImportClient />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-10 px-3 rounded-md text-sm font-medium inline-flex items-center gap-2 transition-colors',
        active
          ? 'bg-pageBackground text-textPinkStrong shadow-card'
          : 'text-textSecondary hover:text-textPrimary',
      )}
    >
      {children}
    </button>
  );
}
