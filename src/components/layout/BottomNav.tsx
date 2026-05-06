'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Calendar,
  Receipt,
  Upload,
  BarChart3,
  MoreHorizontal,
  ListChecks,
  PiggyBank,
  Tags,
  CreditCard,
  Users,
  Bell,
  Files,
  Settings,
  ShieldAlert,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// 하단 5칸 — 가장 자주 쓰는 것만. 가운데 "업로드"는 핑크 FAB 형태로 강조.
const PRIMARY = [
  { href: '/dashboard', label: '캘린더', icon: Calendar, prominent: false },
  { href: '/transactions', label: '거래', icon: Receipt, prominent: false },
  { href: '/upload', label: '업로드', icon: Upload, prominent: true },
  { href: '/stats', label: '통계', icon: BarChart3, prominent: false },
] as const;

// "더보기" 시트에 노출할 항목. 사이드바와 1:1 동일한 9개.
const MORE = [
  { href: '/candidates', label: '분석 후보', icon: ListChecks },
  { href: '/budgets', label: '예산', icon: PiggyBank },
  { href: '/categories', label: '카테고리', icon: Tags },
  { href: '/payment-methods', label: '결제수단', icon: CreditCard },
  { href: '/households', label: '모임비', icon: Users },
  { href: '/notifications', label: '알림', icon: Bell },
  { href: '/files', label: '원본 파일', icon: Files },
  { href: '/settings', label: '설정', icon: Settings },
];

const ADMIN_ITEM = { href: '/admin', label: '관리자 (개발자)', icon: ShieldAlert };

type Props = { isAdmin?: boolean };

export function BottomNav({ isAdmin = false }: Props) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreItems = isAdmin ? [...MORE, ADMIN_ITEM] : MORE;
  const moreActive = moreItems.some(
    (m) => pathname === m.href || pathname.startsWith(m.href + '/'),
  );

  // 페이지가 바뀌면 시트 자동 닫힘
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // 시트 열려있는 동안 body 스크롤 잠금
  useEffect(() => {
    if (!moreOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [moreOpen]);

  return (
    <>
      <nav
        aria-label="모바일 메인 네비게이션"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-pageBackground border-t border-borderDefault"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="grid grid-cols-5">
          {PRIMARY.map(({ href, label, icon: Icon, prominent }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            if (prominent) {
              return (
                <li key={href} className="relative">
                  <Link
                    href={href}
                    className="flex flex-col items-center justify-end gap-0.5 py-1 min-h-[56px]"
                    aria-label={label}
                  >
                    <span
                      className={cn(
                        'h-12 w-12 -mt-3 rounded-full flex items-center justify-center text-textOnPink shadow-md ring-2 ring-pageBackground',
                        active ? 'bg-primaryPinkHover' : 'bg-primaryPink',
                      )}
                    >
                      <Icon className="h-6 w-6" strokeWidth={2} />
                    </span>
                    <span
                      className={cn(
                        'text-[11px] mt-0.5',
                        active ? 'text-textPinkStrong' : 'text-textSecondary',
                      )}
                    >
                      {label}
                    </span>
                  </Link>
                </li>
              );
            }
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] min-h-[56px]',
                    active ? 'text-textPinkStrong' : 'text-textSecondary',
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              aria-label="더보기 메뉴 열기"
              className={cn(
                'w-full flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] min-h-[56px]',
                moreActive ? 'text-textPinkStrong' : 'text-textSecondary',
              )}
            >
              <MoreHorizontal className="h-5 w-5" strokeWidth={1.75} />
              <span>더보기</span>
            </button>
          </li>
        </ul>
      </nav>

      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="더보기 메뉴">
          <button
            type="button"
            aria-label="더보기 메뉴 닫기"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMoreOpen(false)}
          />
          <div
            className="absolute inset-x-0 bottom-0 bg-pageBackground rounded-t-2xl border-t border-borderDefault max-h-[85vh] overflow-y-auto shadow-2xl"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}
          >
            <div className="sticky top-0 bg-pageBackground/95 backdrop-blur flex items-center justify-between px-4 pt-3 pb-2 border-b border-borderSoft">
              <h2 className="text-base font-semibold text-textPrimary">더보기</h2>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-softPinkBackground"
                aria-label="닫기"
              >
                <X className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </div>
            <ul className="grid grid-cols-3 gap-1.5 p-3">
              {moreItems.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + '/');
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        'h-20 flex flex-col items-center justify-center gap-1.5 rounded-lg text-xs transition-colors',
                        active
                          ? 'bg-primaryPinkSoft text-textPinkStrong'
                          : 'bg-cardBackground text-textSecondary hover:bg-softPinkBackground hover:text-textPrimary',
                      )}
                    >
                      <Icon className="h-6 w-6" strokeWidth={1.75} />
                      <span>{label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
