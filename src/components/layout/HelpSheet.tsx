'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  HelpCircle,
  X,
  PlayCircle,
  Camera,
  FileSpreadsheet,
  ListChecks,
  Calendar,
  PiggyBank,
  Repeat,
  BarChart3,
  Users,
  Download,
} from 'lucide-react';

const STORAGE_KEY = 'help-seen';

export function HelpSheet({ autoOnFirstVisit = true }: { autoOnFirstVisit?: boolean }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // SSR 안전: client mount 후에만 portal 사용
  useEffect(() => setMounted(true), []);

  // 처음 진입한 사용자에게 한 번 자동 노출 (한 번 닫으면 다시 안 뜸)
  useEffect(() => {
    if (!autoOnFirstVisit || typeof window === 'undefined') return;
    if (window.localStorage.getItem(STORAGE_KEY)) return;
    setOpen(true);
  }, [autoOnFirstVisit]);

  // body 스크롤 잠금 + Esc 닫기
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function close() {
    setOpen(false);
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, '1');
  }

  return (
    <>
      {/* 헤더 트리거 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="사용 가이드 열기"
        title="사용 가이드"
        className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-borderDefault bg-white hover:bg-softPinkBackground transition-colors"
      >
        <HelpCircle className="h-4 w-4 text-textSecondary" strokeWidth={1.75} />
      </button>

      {mounted && open && createPortal(
        <div
          className="fixed inset-0 z-[60]"
          role="dialog"
          aria-modal="true"
          aria-label="가계부 사용 가이드"
        >
          {/* backdrop */}
          <button
            type="button"
            aria-label="닫기"
            onClick={close}
            className="absolute inset-0 bg-black/40"
          />

          {/* 시트: 모바일 = 풀스크린, sm 이상 = 우측 슬라이드 */}
          <div
            className="absolute inset-x-0 bottom-0 sm:inset-y-0 sm:right-0 sm:left-auto sm:max-w-md w-full h-[88vh] sm:h-screen bg-pageBackground rounded-t-2xl sm:rounded-none border-t sm:border-t-0 sm:border-l border-borderDefault shadow-2xl flex flex-col"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
          >
            <div className="sticky top-0 bg-pageBackground/95 backdrop-blur flex items-center justify-between gap-2 px-4 py-3 border-b border-borderSoft">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-textPinkStrong" strokeWidth={1.75} />
                <h2 className="text-base font-semibold text-textPrimary">가계부 사용 가이드</h2>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="닫기"
                className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-softPinkBackground"
              >
                <X className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 text-sm leading-relaxed">
              {/* 큰 흐름 */}
              <section>
                <div className="flex items-center gap-2 text-textPrimary font-semibold">
                  <PlayCircle className="h-4 w-4 text-textPinkStrong" strokeWidth={1.75} /> 큰 흐름
                  4단계
                </div>
                <ol className="mt-2 space-y-1 list-decimal pl-5 text-textSecondary">
                  <li>
                    <b className="text-textPrimary">처음 셋업</b> — 카테고리·결제수단 확인, 이번 달 예산
                    설정.
                  </li>
                  <li>
                    <b className="text-textPrimary">매일 입력</b> — 손으로 / 영수증 사진 / 은행 파일 중
                    원하는 방식으로.
                  </li>
                  <li>
                    <b className="text-textPrimary">분석 후보 검토</b> — AI/파일이 만든 후보를 보고 한
                    번에 승인.
                  </li>
                  <li>
                    <b className="text-textPrimary">월말 회고</b> — 월 캘린더 + 통계 + AI 분석으로
                    돌아보기.
                  </li>
                </ol>
              </section>

              {/* 상세 */}
              <section className="space-y-3">
                <Step
                  icon={<Calendar className="h-4 w-4 text-textPinkStrong" strokeWidth={1.75} />}
                  title="① 매일 — 월 캘린더 확인"
                  body="홈에 들어오면 이번 달 캘린더, 일별 지출/수입, 남은 예산을 한 번에 봅니다. 셀을 누르면 그 날 거래만 필터링."
                  link="/dashboard"
                  linkText="월 캘린더 열기"
                />
                <Step
                  icon={<Camera className="h-4 w-4 text-textPinkStrong" strokeWidth={1.75} />}
                  title="② 거래 입력 — AI 영수증 분석"
                  body="영수증 사진/카드 캡처/PDF를 올리면 OCR + AI가 가맹점·금액·카테고리를 자동 추정. 후보 페이지에 모여 검토 후 승인."
                  link="/upload"
                  linkText="AI 업로드 열기"
                />
                <Step
                  icon={<FileSpreadsheet className="h-4 w-4 text-textPinkStrong" strokeWidth={1.75} />}
                  title="③ 거래 입력 — CSV/XLSX 가져오기"
                  body="은행/카드사가 보내준 거래내역 파일을 올리면 한 번에 수십~수백 건이 후보로 등록. 비밀번호 걸려 있어도 자동으로 풀어서 인식."
                  link="/upload"
                  linkText="CSV/XLSX 열기"
                />
                <Step
                  icon={<ListChecks className="h-4 w-4 text-textPinkStrong" strokeWidth={1.75} />}
                  title="④ 분석 후보에서 일괄 승인"
                  body="AI/파일이 만든 후보를 보고 안전한 행만 한 번에 승인. 중복 가능성 높은 행은 한 번에 거부 가능. 승인된 거래만 거래내역에 들어감."
                  link="/candidates"
                  linkText="분석 후보 열기"
                />
                <Step
                  icon={<PiggyBank className="h-4 w-4 text-textPinkStrong" strokeWidth={1.75} />}
                  title="⑤ 예산 설정"
                  body="이번 달 전체 예산 또는 카테고리별 예산을 매기면 캘린더 상단의 남은 예산이 실시간으로 줄어듭니다. 80% 넘으면 주의 색."
                  link="/budgets"
                  linkText="예산 열기"
                />
                <Step
                  icon={<Repeat className="h-4 w-4 text-textPinkStrong" strokeWidth={1.75} />}
                  title="⑥ 고정 거래 — 월급·구독료"
                  body="매월 같은 날 발생하는 거래(월급, 넷플릭스 등)를 한 번 등록하면 자동/수동으로 매달 거래에 들어갑니다. 사전 N일 전 알림 가능."
                  link="/recurring"
                  linkText="고정 거래 열기"
                />
                <Step
                  icon={<BarChart3 className="h-4 w-4 text-textPinkStrong" strokeWidth={1.75} />}
                  title="⑦ 통계 — 회고"
                  body="이번 달 카테고리/카드별 지출, 6개월 흐름, 인사이트(전월 대비/주말 패턴) 확인. 'AI 분석' 버튼으로 기간 선택 후 자동 요약 + 절약 팁."
                  link="/stats"
                  linkText="통계 열기"
                />
                <Step
                  icon={<Users className="h-4 w-4 text-textPinkStrong" strokeWidth={1.75} />}
                  title="⑧ 모임 — 가족/룸메이트와 공유"
                  body="모임을 만들고 초대 코드로 합류하면 그 모임의 거래를 함께 기입할 수 있어요. 헤더 우상단 컨텍스트 전환기로 개인↔모임을 오가며 따로 관리."
                  link="/households"
                  linkText="모임 열기"
                />
                <Step
                  icon={<Download className="h-4 w-4 text-textPinkStrong" strokeWidth={1.75} />}
                  title="⑨ 백업 — 데이터 내보내기"
                  body="설정 페이지에서 거래 CSV/XLSX 또는 전체 백업(JSON, 7시트 XLSX)으로 받을 수 있어요. 필요할 때 다른 도구로 옮기거나 보관용."
                  link="/settings"
                  linkText="설정 열기"
                />
              </section>

              {/* 팁 */}
              <section className="rounded-md bg-softPinkBackground/60 px-3 py-2.5 text-xs text-textPrimary leading-relaxed">
                <div className="font-medium">💡 팁</div>
                <ul className="mt-1 list-disc pl-4 space-y-0.5 text-textSecondary">
                  <li>같은 가맹점에 카테고리를 한 번 매기면 다음부터 자동 적용 (학습).</li>
                  <li>스타벅스·GS25 같은 흔한 가맹점은 첫 import 부터 자동 분류.</li>
                  <li>홈 화면에 추가하면 풀스크린 앱처럼 사용 가능 — 로그인 화면 안내 참고.</li>
                  <li>오류·건의는 설정 페이지의 '건의사항·오류 제보' 카드로 한 번에.</li>
                </ul>
              </section>
            </div>

            <div className="border-t border-borderSoft px-4 py-2 flex items-center justify-end gap-2 bg-pageBackground">
              <button
                type="button"
                onClick={close}
                className="h-9 px-3 rounded-md text-sm bg-primaryPink text-textOnPink hover:bg-primaryPinkHover"
              >
                알겠어요
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function Step({
  icon,
  title,
  body,
  link,
  linkText,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  link: string;
  linkText: string;
}) {
  return (
    <div className="rounded-md border border-borderSoft px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-textPrimary font-medium">
        {icon}
        <span>{title}</span>
      </div>
      <p className="mt-1 text-textSecondary">{body}</p>
      <Link
        href={link}
        className="mt-1.5 inline-block text-xs text-textPinkStrong hover:underline"
      >
        {linkText} →
      </Link>
    </div>
  );
}
