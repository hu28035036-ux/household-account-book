'use client';

import { useState } from 'react';
import { ImageIcon, BookOpen } from 'lucide-react';
import { Card, CardSubtle, CardTitle } from '@/components/common/Card';

// 가계부 "작성 요령" — 사용자가 따라할 좋은 습관 + 예시 이미지.
// 이미지 파일은 /public/guide/01-purpose.svg … 09-review.svg (SVG mockup).
// 파일이 없으면 회색 placeholder 가 보임. 이미지 추가 후 새로고침만 하면 됨.

type GuideStep = {
  no: number;
  title: string;
  caption: string;
  image: string; // /public 기준 경로
};

const STEPS: GuideStep[] = [
  {
    no: 1,
    title: '왜 쓰는지 한 가지를 정하기',
    caption:
      '"저축을 늘리고 싶어서" "외식비가 너무 많아서" 같은 구체적인 이유 한 줄을 먼저 정하세요. 목적이 흐릿하면 한 달 만에 손에서 놓게 됩니다. 가계부는 기록이 목표가 아니라 "내 돈이 어디로 가는지 알아보기" 위한 도구입니다.',
    image: '/guide/01-purpose.svg',
  },
  {
    no: 2,
    title: '매일 1번, 짧게라도 적는 습관',
    caption:
      '일주일에 한 번 몰아서 적으려고 하면 60%는 떠오르지 않습니다. 잠들기 전 1~2분이 가장 좋은 타이밍 — 영수증이 없어도, 기억나는 만큼이라도 그날 적는 게 훨씬 정확합니다.',
    image: '/guide/02-daily.svg',
  },
  {
    no: 3,
    title: '수입과 지출을 같은 곳에 적기',
    caption:
      '지출만 적으면 "왜 통장이 이러지" 하게 됩니다. 들어온 돈(월급·용돈·환급 등)과 나간 돈을 같은 페이지에 함께 적어야 "이번 달 +X원 / -Y원 = 잔액 Z원" 흐름이 한눈에 보입니다.',
    image: '/guide/03-income-expense.svg',
  },
  {
    no: 4,
    title: '분류(카테고리)는 처음에 정하고 일관되게',
    caption:
      '"커피값"을 어떤 날은 식비, 어떤 날은 카페로 적으면 한 달 후 통계가 의미를 잃습니다. 처음에 8~12개 정도(식비·교통·주거·통신·여가·의류·의료·기타 등) 정해두고, 그 안에서만 분류하세요. 한 번 정한 분류는 바꾸지 않는 게 핵심.',
    image: '/guide/04-category.svg',
  },
  {
    no: 5,
    title: '고정 지출과 변동 지출을 나눠보기',
    caption:
      '월세·통신비·구독료처럼 매월 거의 같은 금액인 "고정 지출" 과, 식비·여가·쇼핑처럼 매번 다른 "변동 지출" 을 따로 보세요. 줄일 수 있는 건 거의 항상 변동 지출 쪽입니다. 고정은 줄이려면 계약을 바꿔야 하니까요.',
    image: '/guide/05-fixed-variable.svg',
  },
  {
    no: 6,
    title: '월초에 예산(한도)을 정하기',
    caption:
      '"이번 달은 변동 지출 80만원 안에서" 같은 한도를 매월 1일에 정하세요. 한도가 없으면 자연스럽게 통장 잔액 끝까지 쓰게 됩니다. 처음에는 지난 두세 달 평균 × 0.9 정도가 현실적.',
    image: '/guide/06-budget.svg',
  },
  {
    no: 7,
    title: '작은 지출도 빼먹지 않기',
    caption:
      '편의점 1,500원, 자판기 700원, 1,000원짜리 간식… "이 정도는 됐지" 가 가계부의 가장 큰 적입니다. 한 달이면 5~10만원, 1년이면 100만원 차이가 납니다. 적기 귀찮으면 영수증만 모아 일주일에 한 번이라도 정리해 보세요.',
    image: '/guide/07-small.svg',
  },
  {
    no: 8,
    title: '결제수단(현금/체크/신용/이체)을 구분',
    caption:
      '같은 5만원이라도 신용카드면 다음 달 청구, 체크카드면 즉시 출금, 현금이면 흔적이 남지 않습니다. 결제수단을 구분해 적으면 "어디서 새는지" 보입니다 — 신용카드만 항상 한도 가까이 차오르면 그게 신호.',
    image: '/guide/08-payment.svg',
  },
  {
    no: 9,
    title: '월말 한 번, 5분만 돌아보기',
    caption:
      '한 달 끝에 가장 많이 쓴 카테고리 1~2개를 골라 "다음 달에 어디를 줄일까" 한 가지만 정하세요. 모든 걸 줄이려 하면 실패합니다. 그리고 다음 달 예산에 그 결심을 반영 — 이게 가계부가 살아있는 도구가 되는 유일한 방법입니다.',
    image: '/guide/09-review.svg',
  },
];

export function WritingGuideClient({ showHeader = true }: { showHeader?: boolean } = {}) {
  return (
    <div className="space-y-5">
      {showHeader && (
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-textPinkStrong" strokeWidth={1.75} />
          <h2 className="text-2xl font-semibold text-textPrimary">가계부 작성 가이드</h2>
        </div>
      )}

      <Card className="bg-softPinkBackground/50 border-softPinkBackground">
        <CardSubtle className="leading-relaxed">
          이 가이드는 종이 가계부·엑셀·다른 가계부 앱 어느 도구를 쓰시든 똑같이 적용되는,
          처음 가계부를 쓰는 분을 위한 9가지 보편 원칙입니다. 한꺼번에 다 지키지 않으셔도 됩니다 —
          한 가지씩 한 달에 1개 정도 추가해 보세요.
        </CardSubtle>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {STEPS.map((s) => (
          <StepCard key={s.no} step={s} />
        ))}
      </div>

      <Card className="bg-softPinkBackground/50 border-primaryPinkSoft">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-primaryPink text-textOnPink text-xs font-bold">
            ✨
          </span>
          <CardTitle>매일 적기 부담될 때 — AI 입력으로 한 줄</CardTitle>
        </div>
        <CardSubtle className="mt-2 leading-relaxed">
          위의 9가지 원칙 중 가장 중요한 건 <b className="text-textPrimary">매일 짧게라도 적는 습관</b>인데,
          이게 의외로 가장 어렵습니다. 이 앱에는{' '}
          <b className="text-textPrimary">화면 우상단의 ✨ AI 입력</b> 기능이 있어요. 거기에 한 줄만
          툭 넣으면 됩니다.
        </CardSubtle>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="rounded-md bg-pageBackground border border-borderSoft px-2.5 py-2">
            <div className="text-textPinkStrong font-medium mb-1">📝 거래 한 줄로</div>
            <div className="space-y-0.5 text-textSecondary">
              <div>
                <code>스벅 5천</code>
              </div>
              <div>
                <code>오늘 점심 8천</code>
              </div>
              <div>
                <code>월급 350만 받음</code>
              </div>
            </div>
          </div>
          <div className="rounded-md bg-pageBackground border border-borderSoft px-2.5 py-2">
            <div className="text-textPinkStrong font-medium mb-1">🧭 페이지도 한 줄로</div>
            <div className="space-y-0.5 text-textSecondary">
              <div>
                <code>이번달 분석</code>
              </div>
              <div>
                <code>예산 페이지</code>
              </div>
              <div>
                <code>후보 검토</code>
              </div>
            </div>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-textMuted leading-relaxed">
          단축키:{' '}
          <kbd className="px-1 bg-pageBackground border border-borderSoft rounded text-[10px]">Ctrl</kbd> +{' '}
          <kbd className="px-1 bg-pageBackground border border-borderSoft rounded text-[10px]">K</kbd>{' '}
          어디서든 1초 만에 열림. 거래 추가는 미리보기 후 [✓ 추가] 눌러야 저장됩니다.
        </p>
      </Card>

      <Card className="bg-pageBackground border-borderSoft">
        <CardTitle>마지막으로 — 너무 완벽하게 쓰려고 하지 마세요</CardTitle>
        <CardSubtle className="mt-1 leading-relaxed">
          가계부는 "100% 정확한 회계장부" 가 아니라 "내 소비 습관을 비춰보는 거울" 입니다.
          어떤 날 빠뜨려도, 카테고리를 잘못 적어도 괜찮아요. 한 달 평균 흐름만 보여도 충분히
          가치가 있습니다. 꾸준함이 정확함보다 훨씬 중요합니다.
          <br />
          <br />
          <span className="text-textMuted">
            이 앱의 사용법(어디 메뉴에서 무엇을 하는지)은 화면 우상단{' '}
            <b className="text-textPrimary">❓ 도움말</b> 버튼에서 확인하실 수 있어요.
          </span>
        </CardSubtle>
      </Card>
    </div>
  );
}

function StepCard({ step }: { step: GuideStep }) {
  // 첫 실패 시 cache-busting query 로 1회 retry — SW image 캐시에 stale 4xx 가
  // 박혀있는 사용자가 한 번에 회복되도록.
  const [retries, setRetries] = useState(0);
  const failed = retries >= 2;
  const src = retries === 0 ? step.image : `${step.image}?retry=${retries}`;

  return (
    <Card>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-primaryPinkSoft text-textPinkStrong text-sm font-bold">
          {step.no}
        </span>
        <CardTitle>{step.title}</CardTitle>
      </div>

      <div className="mt-3 rounded-md overflow-hidden border border-borderSoft bg-pageBackground">
        {!failed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={retries}
            src={src}
            alt={step.title}
            className="w-full h-auto block"
            loading="lazy"
            onError={() => setRetries((r) => r + 1)}
          />
        ) : (
          <div className="aspect-video flex flex-col items-center justify-center text-textMuted gap-1">
            <ImageIcon className="h-8 w-8" strokeWidth={1.5} />
            <p className="text-xs">이미지 준비 중 ({step.image})</p>
          </div>
        )}
      </div>

      <p className="mt-3 text-sm text-textSecondary leading-relaxed">{step.caption}</p>
    </Card>
  );
}
