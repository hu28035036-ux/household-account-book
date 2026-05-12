import Link from 'next/link';
import { BookOpen, Compass } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export type GuideTabKey = 'writing' | 'usage';

const TABS: { key: GuideTabKey; href: string; label: string; Icon: typeof BookOpen }[] = [
  { key: 'writing', href: '/guide?tab=writing', label: '작성 요령', Icon: BookOpen },
  { key: 'usage', href: '/guide?tab=usage', label: '사용법', Icon: Compass },
];

export function GuideTabs({ active }: { active: GuideTabKey }) {
  return (
    <div role="tablist" aria-label="가이드 탭" className="flex items-center gap-2">
      {TABS.map(({ key, href, label, Icon }) => {
        const isActive = key === active;
        return (
          <Link
            key={key}
            href={href}
            role="tab"
            aria-selected={isActive}
            aria-label={label}
            title={label}
            scroll={false}
            className={cn(
              'inline-flex items-center justify-center h-10 w-10 rounded-full transition-colors',
              isActive
                ? 'bg-primaryPink text-textOnPink shadow-card'
                : 'bg-pageBackground text-textSecondary border border-borderDefault hover:bg-softPinkBackground hover:text-textPinkStrong',
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={1.75} />
            <span className="sr-only">{label}</span>
          </Link>
        );
      })}
    </div>
  );
}
