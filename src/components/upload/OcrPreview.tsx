'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';

type Props = {
  text: string;
  confidence: number;
  onChange: (text: string) => void;
  onAnalyze: () => void;
  pending?: boolean;
  disabledAnalyze?: boolean;
};

export function OcrPreview({
  text,
  confidence,
  onChange,
  onAnalyze,
  pending,
  disabledAnalyze,
}: Props) {
  const [open, setOpen] = useState(true);
  const conf = Math.round(confidence * 100);
  // 이미지 — 클라이언트 OCR 안 함, 서버 vision 으로 직접 분석
  const isImageVision = !text;

  if (isImageVision) {
    return (
      <Card>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-textPinkStrong" strokeWidth={1.75} />
          <span className="text-base font-semibold text-textPrimary">AI 분석 준비 완료</span>
        </div>
        <p className="mt-2 text-sm text-textSecondary leading-relaxed">
          이미지는 AI 가 직접 보고 분석합니다 (OpenAI Vision). 별도 OCR 단계 없이 가맹점·금액·날짜
          를 추출하므로 더 정확하고 빠릅니다.
        </p>
        <p className="mt-1 text-xs text-textMuted">
          * 카드/계좌/주민/전화/사업자번호는 자동 마스킹. 원본 이미지는 7일 후 자동 폐기.
        </p>
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            onClick={onAnalyze}
            disabled={pending || disabledAnalyze}
            className="h-11 px-5 rounded-lg bg-primaryPink text-textOnPink font-medium hover:bg-primaryPinkHover disabled:opacity-50 inline-flex items-center gap-2"
          >
            {pending ? '분석 중…' : 'AI 분석 시작'}
          </button>
        </div>
      </Card>
    );
  }

  // PDF 등 — 텍스트 미리보기 + 편집 + 분석
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base font-semibold text-textPrimary">텍스트 미리보기</span>
          <Badge tone={conf >= 70 ? 'success' : conf >= 40 ? 'warning' : 'review'}>
            신뢰도 {conf}%
          </Badge>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-sm text-textSecondary inline-flex items-center gap-1"
          aria-expanded={open}
        >
          {open ? '접기' : '펼치기'}
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>
      {open && (
        <>
          <textarea
            value={text}
            onChange={(e) => onChange(e.target.value)}
            rows={10}
            className="mt-3 w-full px-3 py-2 rounded-lg border border-borderDefault bg-pageBackground text-textPrimary text-sm font-mono"
            placeholder="추출된 텍스트가 여기에 표시됩니다. 잘못된 부분은 직접 수정한 뒤 분석하세요."
          />
          <p className="mt-2 text-xs text-textMuted">
            * 카드/계좌/주민/전화/사업자번호는 분석 직전 자동 마스킹됩니다. 원본은 7일 후 자동
            폐기됩니다.
          </p>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              onClick={onAnalyze}
              disabled={pending || disabledAnalyze}
              className="h-11 px-5 rounded-lg bg-primaryPink text-textOnPink font-medium hover:bg-primaryPinkHover disabled:opacity-50"
            >
              {pending ? '분석 중…' : 'AI 분석 시작'}
            </button>
          </div>
        </>
      )}
    </Card>
  );
}
