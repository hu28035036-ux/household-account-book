import { PrivacyPolicyClient } from '@/components/privacy/PrivacyPolicyClient';

export const dynamic = 'force-dynamic';

// AppShell 은 (app)/layout.tsx 가 자동으로 감쌈 — 페이지에서 다시 감싸면 X.
export default function PrivacyPage() {
  return <PrivacyPolicyClient />;
}
