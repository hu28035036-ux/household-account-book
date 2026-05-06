'use client';

import { MessageSquare, Lightbulb, Bug } from 'lucide-react';
import { Card, CardSubtle, CardTitle } from '@/components/common/Card';

// 운영자 연락 이메일 — Vercel env 에 NEXT_PUBLIC_SUPPORT_EMAIL 가 있으면 그 값,
// 없으면 fallback 으로 ADMIN_EMAILS 첫 사용자 (hu28035036@gmail.com).
const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'hu28035036@gmail.com';

const FEEDBACK_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
  'AI 가계부 — 건의사항',
)}&body=${encodeURIComponent(
  [
    '운영자님께,',
    '',
    '아래 자유롭게 적어주세요.',
    '',
    '어떤 기능이 추가되면 좋을지: ',
    '어떤 부분이 어색하거나 불편한지: ',
    '',
  ].join('\n'),
)}`;

const BUG_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
  'AI 가계부 — 오류 제보',
)}&body=${encodeURIComponent(
  [
    '운영자님께,',
    '',
    '아래 정보를 채워 보내주시면 빠르게 확인하겠습니다.',
    '',
    '발생 화면(URL): ',
    '발생 시각: ',
    '어떤 동작을 했나요: ',
    '어떤 결과가 나왔나요: ',
    '사용 기기 / 브라우저: ',
    '',
    '※ 가능하면 화면 캡처를 함께 첨부해주세요.',
    '',
  ].join('\n'),
)}`;

export function SupportCard() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-textPinkStrong" strokeWidth={1.75} />
        <CardTitle>건의사항 · 오류 제보</CardTitle>
      </div>
      <CardSubtle className="mt-1">
        써보시면서 어색한 점·새 기능 아이디어·버그가 보이면 운영자에게 직접 알려주세요. 받는
        즉시 확인하고 가능한 빠르게 반영합니다.
      </CardSubtle>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <a
          href={FEEDBACK_MAILTO}
          className="rounded-md border border-borderSoft px-3 py-2.5 hover:bg-softPinkBackground transition-colors flex items-start gap-2"
        >
          <Lightbulb className="h-5 w-5 text-textPinkStrong shrink-0 mt-0.5" strokeWidth={1.75} />
          <div className="min-w-0">
            <div className="text-sm font-medium text-textPrimary">💡 건의사항</div>
            <div className="text-xs text-textMuted">새 기능 / 개선 아이디어</div>
          </div>
        </a>
        <a
          href={BUG_MAILTO}
          className="rounded-md border border-borderSoft px-3 py-2.5 hover:bg-softPinkBackground transition-colors flex items-start gap-2"
        >
          <Bug className="h-5 w-5 text-danger shrink-0 mt-0.5" strokeWidth={1.75} />
          <div className="min-w-0">
            <div className="text-sm font-medium text-textPrimary">🐛 오류 제보</div>
            <div className="text-xs text-textMuted">동작 안 하거나 이상한 화면</div>
          </div>
        </a>
      </div>

      <p className="mt-3 text-[11px] text-textMuted text-right">
        ✉ {SUPPORT_EMAIL}
      </p>
    </Card>
  );
}
