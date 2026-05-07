'use client';

import { useState } from 'react';
import { ImageIcon, BookOpen } from 'lucide-react';
import { Card, CardSubtle, CardTitle } from '@/components/common/Card';

// 가계부 "작성 요령" — 사용자가 따라할 좋은 습관 + 예시 이미지.
// 이미지 파일은 /public/guide/01-daily.png … 09-review.png 형태로 추가하면 자동 표시.
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
    title: '매일 1번, 짧게라도 적기',
    caption:
      '가장 중요한 습관입니다. 잠들기 전 1분만 시간을 내서 그 날 쓴 내역을 떠올려 적어보세요. 영수증이 없어도 기억나는 만큼이면 충분합니다.',
    image: '/guide/01-daily.png',
  },
  {
    no: 2,
    title: '영수증은 받은 날 바로 사진으로',
    caption:
      '영수증을 받자마자 카메라로 찍어 AI 업로드에 올리면 OCR + AI가 자동으로 분석해 후보로 만들어 줍니다. 시간 지나면 분실·빛바램으로 인식이 어려워집니다.',
    image: '/guide/02-receipt.png',
  },
  {
    no: 3,
    title: '카테고리는 처음에 일관되게',
    caption:
      '"커피"를 어떤 날은 카페/간식, 어떤 날은 식비로 적으면 통계가 의미 없어집니다. 한 번 정한 분류는 가능한 같은 카테고리로 — 처음 등록한 매장은 학습 규칙이 만들어져 다음부터 자동 적용됩니다.',
    image: '/guide/03-category.png',
  },
  {
    no: 4,
    title: '월초에 예산을 먼저 정하기',
    caption:
      '"이번 달은 80만원 안에서 살아보자" 같은 목표를 매월 1일에 세워두면, 월 캘린더 상단의 "남은 예산" 이 실시간으로 줄어들어 절제 동기가 됩니다.',
    image: '/guide/04-budget.png',
  },
  {
    no: 5,
    title: '정기 지출은 고정 거래로 등록',
    caption:
      '월급, 넷플릭스, 통신비 등 매월 같은 날 발생하는 항목은 "고정 거래"에 한 번만 등록해 두면 매달 자동/수동으로 들어옵니다. 같은 걸 매월 다시 입력하는 수고가 사라집니다.',
    image: '/guide/05-recurring.png',
  },
  {
    no: 6,
    title: '작은 지출도 빼먹지 않기',
    caption:
      '편의점 1,500원, 자판기 700원도 모이면 한 달 5만원이 됩니다. "이 정도는 됐지" 보다는 짧게라도 기록하는 편이 한 달 후 결과를 더 정직하게 보여줍니다.',
    image: '/guide/06-small.png',
  },
  {
    no: 7,
    title: '카드 거래내역은 매주 한 번 가져오기',
    caption:
      '은행/카드 앱에서 거래내역 CSV/XLSX 를 받아 업로드하면 한 번에 수십 건이 후보로 들어옵니다. 일주일에 한 번 일요일 저녁이 좋은 타이밍.',
    image: '/guide/07-import.png',
  },
  {
    no: 8,
    title: '분석 후보는 그날 바로 검토',
    caption:
      'AI/파일이 만든 후보는 검토 전엔 거래내역에 들어가지 않습니다. 후보가 쌓이면 일괄 승인이 부담돼 점점 미루게 되니 그날그날 비우는 습관을 추천드립니다.',
    image: '/guide/08-candidates.png',
  },
  {
    no: 9,
    title: '월말 한 번 회고하기',
    caption:
      '통계 페이지의 카테고리별 지출 / 6개월 흐름 / 인사이트를 보고 "다음 달 어디를 줄일까" 한 가지만 정해도 충분합니다. 큰 그림은 통계, 결심은 다음 달 예산에 반영.',
    image: '/guide/09-review.png',
  },
];

export function WritingGuideClient() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <BookOpen className="h-6 w-6 text-textPinkStrong" strokeWidth={1.75} />
        <h2 className="text-2xl font-semibold text-textPrimary">가계부 작성 가이드</h2>
      </div>

      <Card className="bg-softPinkBackground/50 border-softPinkBackground">
        <CardSubtle className="leading-relaxed">
          가계부는 매일 짧게, 일관되게, 그리고 회고하면서 쓰는 게 핵심입니다. 아래 9가지 습관 중
          하나씩 해보면 한 달 뒤 가계부가 살아있는 도구가 됩니다.
        </CardSubtle>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {STEPS.map((s) => (
          <StepCard key={s.no} step={s} />
        ))}
      </div>

      <Card className="bg-pageBackground border-borderSoft">
        <CardTitle>도움이 더 필요하신가요?</CardTitle>
        <CardSubtle className="mt-1 leading-relaxed">
          앱 사용법은 헤더 우상단의 <b className="text-textPrimary">❓ 도움말</b> 버튼에서 확인하실
          수 있어요. 운영자에게 직접 묻고 싶다면 설정 페이지의{' '}
          <b className="text-textPrimary">건의사항·오류 제보</b> 카드를 이용해 주세요.
        </CardSubtle>
      </Card>
    </div>
  );
}

function StepCard({ step }: { step: GuideStep }) {
  const [errored, setErrored] = useState(false);
  return (
    <Card>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-primaryPinkSoft text-textPinkStrong text-sm font-bold">
          {step.no}
        </span>
        <CardTitle>{step.title}</CardTitle>
      </div>

      <div className="mt-3 rounded-md overflow-hidden border border-borderSoft bg-pageBackground">
        {!errored ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={step.image}
            alt={step.title}
            className="w-full h-auto block"
            loading="lazy"
            onError={() => setErrored(true)}
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
