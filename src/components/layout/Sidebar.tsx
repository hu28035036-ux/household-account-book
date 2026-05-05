'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Receipt, Upload, ListChecks, Tags, CreditCard, Files, Settings, PiggyBank } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const NAV = [
  { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
  { href: '/transactions', label: '거래내역', icon: Receipt },
  { href: '/upload', label: 'AI 업로드', icon: Upload },
  { href: '/candidates', label: '분석 후보', icon: ListChecks },
  { href: '/budgets', label: '예산', icon: PiggyBank },
  { href: '/categories', label: '카테고리', icon: Tags },
  { href: '/payment-methods', label: '결제수단', icon: CreditCard },
  { href: '/files', label: '원본 파일', icon: Files },
  { href: '/settings', label: '설정', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-borderDefault bg-pageBackground">
      <div className="px-5 py-5 border-b border-borderDefault">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="inline-block h-7 w-7 rounded-lg bg-primaryPink" />
          <span className="text-lg font-semibold text-textPrimary">AI 가계부</span>
        </Link>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                active
                  ? 'bg-primaryPinkSoft text-textPinkStrong'
                  : 'text-textSecondary hover:bg-softPinkBackground hover:text-textPrimary',
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
