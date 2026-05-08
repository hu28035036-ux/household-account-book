'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ImageIcon,
  Calendar,
  Camera,
  FileSpreadsheet,
  ListChecks,
  PiggyBank,
  Repeat,
  BarChart3,
  Users,
  Download,
  PlayCircle,
  ArrowRight,
  Lightbulb,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardSubtle, CardTitle } from '@/components/common/Card';

// 가계부 "사용법" — 이 앱을 어떻게 쓰는지 풀페이지로 풀어쓴 가이드.
// HelpSheet (헤더 ❓) 의 슬라이드오버 콘텐츠를 풀페이지 카드 그리드로 옮겼다.
// 이미지 자산은 /public/guide/usage/*.svg (없으면 회색 placeholder fallback).

type FlowStep = { no: number; title: string; caption: string };

const FLOW: FlowStep[] = [
  { no: 1, title: '처음 셋업', caption: '카테고리·결제수단을 한 번 정리하고 이번 달 예산을 정하기.' },
  { no: 2, title: '매일 입력', caption: '손으로 / 영수증 사진 / 은행 파일 중 편한 방식으로 한 번씩.' },
  { no: 3, title: '후보 검토', caption: 'AI/파일이 만든 후보를 한 번에 살펴보고 안전한 행만 승인.' },
  { no: 4, title: '월말 회고', caption: '월 캘린더 + 통계 + AI 분석으로 다음 달 한 가지를 결정.' },
];

type UsageStep = {
  no: number;
  Icon: LucideIcon;
  title: string;
  caption: string;
  image: string;
  link: string;
  linkText: string;
};

const STEPS: UsageStep[] = [
  {
    no: 1,
    Icon: Calendar,
    title: '월 캘린더 — 매일 확인',
    caption:
      '홈에 들어오면 이번 달 캘린더, 일별 지출/수입, 남은 예산을 한 번에 봅니다. 셀을 누르면 그 날 거래만 필터링됩니다. 가장 자주 들르는 화면.',
    image: '/guide/usage/01-calendar.svg',
    link: '/dashboard',
    linkText: '월 캘린더 열기',
  },
  {
    no: 2,
    Icon: Camera,
    title: 'AI 영수증 분석',
    caption:
      '영수증 사진·카드 캡처·PDF를 올리면 OCR + AI가 가맹점·금액·카테고리를 자동으로 추정합니다. 추정 결과는 후보 페이지에 모이며, 검토 후 승인해야 거래내역에 들어갑니다.',
    image: '/guide/usage/02-ocr.svg',
    link: '/upload',
    linkText: 'AI 업로드 열기',
  },
  {
    no: 3,
    Icon: FileSpreadsheet,
    title: 'CSV/XLSX 가져오기',
    caption:
      '은행·카드사가 보내주는 거래내역 파일을 그대로 올리면 한 번에 수십~수백 건이 후보로 등록됩니다. 비밀번호가 걸린 파일도 자동으로 풀어 인식해요.',
    image: '/guide/usage/03-import.svg',
    link: '/upload',
    linkText: 'CSV/XLSX 열기',
  },
  {
    no: 4,
    Icon: ListChecks,
    title: '분석 후보 일괄 승인',
    caption:
      'AI/파일이 만든 후보를 보고 안전한 행만 한 번에 승인. 중복 가능성이 높은 행은 한 번에 거부할 수 있어요. 승인된 거래만 거래내역에 들어갑니다.',
    image: '/guide/usage/04-candidates.svg',
    link: '/candidates',
    linkText: '분석 후보 열기',
  },
  {
    no: 5,
    Icon: PiggyBank,
    title: '예산 — 한도 설정',
    caption:
      '이번 달 전체 예산 또는 카테고리별 예산을 정하면 캘린더 상단의 "남은 예산" 이 실시간으로 줄어듭니다. 80% 를 넘으면 주의 색으로 바뀝니다.',
    image: '/guide/usage/05-budget.svg',
    link: '/budgets',
    linkText: '예산 열기',
  },
  {
    no: 6,
    Icon: Repeat,
    title: '고정 거래 — 월급·구독료',
    caption:
      '매월 같은 날 발생하는 거래(월급·넷플릭스·통신비 등)를 한 번 등록하면 자동/수동으로 매달 거래에 들어갑니다. 사전 N일 전 알림도 가능.',
    image: '/guide/usage/06-recurring.svg',
    link: '/recurring',
    linkText: '고정 거래 열기',
  },
  {
    no: 7,
    Icon: BarChart3,
    title: '통계 — 월말 회고',
    caption:
      '이번 달 카테고리·카드별 지출, 6개월 흐름, 인사이트(전월 대비/주말 패턴)를 확인해요. "AI 분석" 버튼으로 기간을 골라 자동 요약 + 절약 팁을 받을 수 있어요.',
    image: '/guide/usage/07-stats.svg',
    link: '/stats',
    linkText: '통계 열기',
  },
  {
    no: 8,
    Icon: Users,
    title: '모임 — 가족·룸메이트와 공유',
    caption:
      '모임을 만들고 초대 코드로 합류하면 그 모임의 거래를 함께 기입할 수 있어요. 헤더 우상단의 컨텍스트 전환기로 개인 ↔ 모임을 오가며 따로 관리합니다.',
    image: '/guide/usage/08-household.svg',
    link: '/households',
    linkText: '모임 열기',
  },
  {
    no: 9,
    Icon: Download,
    title: '백업 — 데이터 내보내기',
    caption:
      '설정 페이지에서 거래 CSV/XLSX 또는 전체 백업(JSON, 7시트 XLSX)을 받을 수 있어요. 다른 도구로 옮기거나 보관용으로 안전하게 보관 가능.',
    image: '/guide/usage/09-export.svg',
    link: '/settings',
    linkText: '설정 열기',
  },
];

export function UsageGuideClient() {
  return (
    <div className="space-y-5">
      <Card className="bg-softPinkBackground/50 border-softPinkBackground">
        <CardSubtle className="leading-relaxed">
          이 앱을 가장 빠르게 익히는 큰 흐름은 <b className="text-textPrimary">4단계</b>입니다 —
          처음 셋업 → 매일 입력 → 후보 검토 → 월말 회고. 아래 9개 카드는 그 흐름에서 자주 쓰는
          기능들이에요. 한꺼번에 다 읽지 않으셔도 됩니다.
        </CardSubtle>
      </Card>

      <Card>
        <div className="flex items-center gap-2">
          <PlayCircle className="h-5 w-5 text-textPinkStrong" strokeWidth={1.75} />
          <CardTitle>큰 흐름 4단계</CardTitle>
        </div>
        <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-2">
          {FLOW.map((f) => (
            <div
              key={f.no}
              className="rounded-md border border-borderSoft bg-pageBackground px-3 py-2.5"
            >
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primaryPinkSoft text-textPinkStrong text-xs font-bold">
                  {f.no}
                </span>
                <span className="text-sm font-semibold text-textPrimary">{f.title}</span>
              </div>
              <p className="mt-1 text-xs text-textSecondary leading-relaxed">{f.caption}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {STEPS.map((s) => (
          <UsageStepCard key={s.no} step={s} />
        ))}
      </div>

      <Card className="bg-softPinkBackground/50 border-primaryPinkSoft">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-primaryPink text-textOnPink text-xs font-bold">
            ✨
          </span>
          <CardTitle>한 줄로 빠르게 — ✨ AI 입력</CardTitle>
        </div>
        <CardSubtle className="mt-2 leading-relaxed">
          매일 적기가 부담될 때 가장 강력한 무기. 화면{' '}
          <b className="text-textPrimary">우상단의 ✨ 버튼</b> 또는 단축키{' '}
          <kbd className="px-1 bg-white border border-borderSoft rounded text-[10px]">Ctrl</kbd> +{' '}
          <kbd className="px-1 bg-white border border-borderSoft rounded text-[10px]">K</kbd>
          {' '}로 어디서든 1초 만에 열립니다. 자연어로 한 줄만 적으면 자동으로 분석해요.
        </CardSubtle>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="rounded-md bg-white border border-borderSoft px-2.5 py-2">
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
          <div className="rounded-md bg-white border border-borderSoft px-2.5 py-2">
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
          거래 추가는 미리보기 카드에서 [✓ 추가] 를 눌러야 실제로 저장됩니다. 카테고리·예산·고정거래
          설정 등은 단계적으로 추가 예정.
        </p>
      </Card>

      <Card className="bg-softPinkBackground/60 border-softPinkBackground">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-textPinkStrong" strokeWidth={1.75} />
          <CardTitle>알아두면 편한 팁 4가지</CardTitle>
        </div>
        <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          {[
            '같은 가맹점에 카테고리를 한 번 매기면 다음부터 자동 적용 (학습).',
            '스타벅스·GS25 같은 흔한 가맹점은 첫 import 부터 자동 분류.',
            '홈 화면에 추가하면 풀스크린 앱처럼 사용 가능 — 로그인 화면 안내 참고.',
            '오류·건의는 설정 페이지의 "건의사항·오류 제보" 카드로 한 번에.',
          ].map((tip, i) => (
            <li
              key={i}
              className="rounded-md bg-white border border-borderSoft px-3 py-2 text-textSecondary leading-relaxed"
            >
              <span className="text-textPinkStrong font-semibold mr-1.5">·</span>
              {tip}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="bg-pageBackground border-borderSoft">
        <CardTitle>더 짧게 보고 싶을 때</CardTitle>
        <CardSubtle className="mt-1 leading-relaxed">
          화면 우상단의{' '}
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-borderDefault bg-white align-middle">
            <HelpCircle className="h-3.5 w-3.5 text-textSecondary" strokeWidth={1.75} />
            <span className="text-xs">도움말</span>
          </span>{' '}
          버튼을 누르면 같은 내용이 옆에서 슬라이드로 빠르게 열려요. 작성 습관(왜·언제·얼마나)에
          대한 보편 원칙은{' '}
          <Link
            href="/guide?tab=writing"
            className="text-textPinkStrong font-medium hover:underline"
          >
            작성 요령 탭
          </Link>
          에서 확인할 수 있습니다.
        </CardSubtle>
      </Card>
    </div>
  );
}

function UsageStepCard({ step }: { step: UsageStep }) {
  const [errored, setErrored] = useState(false);
  const { Icon } = step;
  return (
    <Card className="flex flex-col">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-primaryPinkSoft text-textPinkStrong text-sm font-bold">
          {step.no}
        </span>
        <Icon className="h-4 w-4 text-textPinkStrong shrink-0" strokeWidth={1.75} />
        <CardTitle className="leading-tight">{step.title}</CardTitle>
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

      <div className="mt-3 pt-3 border-t border-borderSoft">
        <Link
          href={step.link}
          className="inline-flex items-center gap-1 text-sm font-medium text-textPinkStrong hover:underline"
        >
          {step.linkText}
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      </div>
    </Card>
  );
}
