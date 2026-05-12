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
  Files,
  Settings,
  History,
  Repeat,
  BookOpen,
  ShieldCheck,
  ShieldAlert,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// 하단 5칸 — 모두 평면 아이콘 (FAB 동그라미 제거).
// 사용자 지정 순서: 캘린더 → 거래 → 예산 → 통계 + 더보기.
const PRIMARY = [
  { href: '/dashboard', label: '캘린더', icon: Calendar, prominent: false },
  { href: '/transactions', label: '거래', icon: Receipt, prominent: false },
  { href: '/budgets', label: '예산', icon: PiggyBank, prominent: false },
  { href: '/stats', label: '통계', icon: BarChart3, prominent: false },
] as const;

// "더보기" 시트 항목. 업로드(자주 쓰지만 PRIMARY 4칸에서 빠짐) 를 맨 위로.
// 알림은 헤더 우상단의 NotificationBell 로 접근하므로 시트에서 제외.
const MORE = [
  { href: '/upload', label: 'AI 업로드', icon: Upload },
  { href: '/categories', label: '카테고리', icon: Tags },
  { href: '/payment-methods', label: '결제수단', icon: CreditCard },
  { href: '/recurring', label: '고정 거래', icon: Repeat },
  { href: '/households', label: '모임', icon: Users },
  { href: '/candidates', label: '분석 후보', icon: ListChecks },
  { href: '/ai-history', label: 'AI 기록', icon: History },
  { href: '/files', label: '원본 파일', icon: Files },
  { href: '/guide', label: '가계부 작성 가이드', icon: BookOpen },
  { href: '/settings', label: '설정', icon: Settings },
  { href: '/privacy', label: '개인정보처리방침', icon: ShieldCheck },
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
          {PRIMARY.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
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
