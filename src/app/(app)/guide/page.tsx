import { WritingGuideClient } from '@/components/guide/WritingGuideClient';

export const dynamic = 'force-dynamic';

// AppShell 은 (app)/layout.tsx 에서 한 번만 감쌈 — 페이지에서 다시 감싸면 헤더·사이드바
// 이중 노출됨. 페이지는 그냥 본문만 렌더한다.
export default function GuidePage() {
  return <WritingGuideClient />;
}
