import { BookOpen } from 'lucide-react';
import { GuideTabs, type GuideTabKey } from '@/components/guide/GuideTabs';
import { UsageGuideClient } from '@/components/guide/UsageGuideClient';
import { WritingGuideClient } from '@/components/guide/WritingGuideClient';

export const dynamic = 'force-dynamic';

function sanitizeTab(v: unknown): GuideTabKey {
  return v === 'usage' ? 'usage' : 'writing';
}

// AppShell 은 (app)/layout.tsx 에서 한 번만 감쌈 — 페이지에서 다시 감싸면 헤더·사이드바
// 이중 노출됨. 페이지는 그냥 본문만 렌더한다.
export default function GuidePage({
  searchParams,
}: {
  searchParams?: { tab?: string };
}) {
  const tab = sanitizeTab(searchParams?.tab);
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <BookOpen className="h-6 w-6 text-textPinkStrong" strokeWidth={1.75} />
        <h2 className="text-2xl font-semibold text-textPrimary">가계부 가이드</h2>
        <span className="text-xs text-textMuted">
          {tab === 'usage' ? '앱 사용법' : '작성 9원칙'}
        </span>
      </div>
      <GuideTabs active={tab} />
      {tab === 'usage' ? <UsageGuideClient /> : <WritingGuideClient showHeader={false} />}
    </div>
  );
}
