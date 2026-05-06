'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Calendar,
  BarChart3,
  Receipt,
  Upload,
  ListChecks,
  Tags,
  CreditCard,
  Files,
  Settings,
  PiggyBank,
  Users,
  Bell,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// PITFALLS §1.3: 새 보호 라우트는 middleware/Sidebar/(BottomNav)/e2e 4곳을 모두 갱신
const NAV = [
  { href: '/dashboard', label: '월 캘린더', icon: Calendar },
  { href: '/transactions', label: '거래내역', icon: Receipt },
  { href: '/upload', label: 'AI 업로드', icon: Upload },
  { href: '/candidates', label: '분석 후보', icon: ListChecks },
  { href: '/stats', label: '통계', icon: BarChart3 },
  { href: '/budgets', label: '예산', icon: PiggyBank },
  { href: '/categories', label: '카테고리', icon: Tags },
  { href: '/payment-methods', label: '결제수단', icon: CreditCard },
  { href: '/households', label: '모임', icon: Users },
  { href: '/notifications', label: '알림', icon: Bell },
  { href: '/files', label: '원본 파일', icon: Files },
  { href: '/settings', label: '설정', icon: Settings },
];

const ADMIN_ITEM = { href: '/admin', label: '관리자 (개발자)', icon: ShieldAlert };

export function Sidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const items = isAdmin ? [...NAV, ADMIN_ITEM] : NAV;
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-borderDefault bg-pageBackground">
      <div className="px-5 py-5 border-b border-borderDefault">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="inline-block h-7 w-7 rounded-lg bg-primaryPink" />
          <span className="text-lg font-semibold text-textPrimary">AI 가계부</span>
        </Link>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map(({ href, label, icon: Icon }) => {
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
