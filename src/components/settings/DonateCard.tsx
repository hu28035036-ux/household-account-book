'use client';

import { useState } from 'react';
import { Coffee, Copy, Check, ExternalLink } from 'lucide-react';
import { Card, CardSubtle, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';

// 운영자 후원 정보 — Vercel env 에 NEXT_PUBLIC_DONATE_* 가 있으면 그 값 우선,
// 없으면 fallback 으로 코드에 박아둔 기본값. 본인 정보를 바꾸려면 env 만 갱신.
const KAKAOPAY_URL =
  process.env.NEXT_PUBLIC_DONATE_KAKAOPAY_URL || 'https://qr.kakaopay.com/Ej9Hx60Gu';
const BANK_NAME = process.env.NEXT_PUBLIC_DONATE_BANK_NAME || '';
const BANK_ACCOUNT = process.env.NEXT_PUBLIC_DONATE_BANK_ACCOUNT || '';
const BANK_HOLDER = process.env.NEXT_PUBLIC_DONATE_BANK_HOLDER || '';
const TOSS_URL = process.env.NEXT_PUBLIC_DONATE_TOSS_URL || '';

export function DonateCard() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  async function copy(key: string, value: string) {
    try {
      await navigator.clipboard?.writeText(value);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  }

  const hasBank = BANK_NAME && BANK_ACCOUNT;
  const fullAccount = hasBank
    ? `${BANK_NAME} ${BANK_ACCOUNT}${BANK_HOLDER ? ` (${BANK_HOLDER})` : ''}`
    : '';

  return (
    <Card>
      <div className="flex items-center gap-2">
        <Coffee className="h-5 w-5 text-textPinkStrong" strokeWidth={1.75} />
        <CardTitle>운영 후원</CardTitle>
      </div>
      <CardSubtle className="mt-1">
        이 앱은 개인이 운영합니다. 후원은 <b>전혀 강제가 아니고</b>, 영수증·세무 처리는
        발급하지 않습니다. 한 번의 커피값도 큰 힘이 됩니다 ☕
      </CardSubtle>

      <div className="mt-3 space-y-2">
        {/* 카카오페이 */}
        {KAKAOPAY_URL && (
          <a
            href={KAKAOPAY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-2 rounded-md border border-borderSoft px-3 py-2 hover:bg-softPinkBackground transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-block h-6 w-6 rounded-md bg-[#FEE500] text-[#3B1E1E] text-[11px] font-bold flex items-center justify-center shrink-0">
                pay
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium text-textPrimary">카카오페이 송금</div>
                <div className="text-xs text-textMuted truncate">QR / 링크 한 번에 송금</div>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-xs text-textPinkStrong">
              송금하기 <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
            </span>
          </a>
        )}

        {/* 토스 (env 있을 때만) */}
        {TOSS_URL && (
          <a
            href={TOSS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-2 rounded-md border border-borderSoft px-3 py-2 hover:bg-softPinkBackground transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-block h-6 w-6 rounded-md bg-[#0064FF] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                T
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium text-textPrimary">토스 송금</div>
                <div className="text-xs text-textMuted truncate">앱 자동 실행</div>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-xs text-textPinkStrong">
              송금하기 <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
            </span>
          </a>
        )}

        {/* 계좌이체 (env 있을 때만) */}
        {hasBank && (
          <div className="rounded-md border border-borderSoft px-3 py-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <div className="text-sm font-medium text-textPrimary">계좌이체</div>
                <div className="text-xs text-textMuted truncate">{fullAccount}</div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => copy('bank', fullAccount)}
                className="!h-8 !px-2 !text-xs !gap-1 shrink-0"
              >
                {copiedKey === 'bank' ? (
                  <>
                    <Check className="h-3.5 w-3.5" strokeWidth={1.75} /> 복사됨
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" strokeWidth={1.75} /> 복사
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-md bg-softPinkBackground/70 px-3 py-2.5 text-xs text-textPrimary leading-relaxed">
        <div className="font-medium">💌 후원해주신 분들께</div>
        <p className="mt-1 text-textSecondary">
          이 앱은 광고도, 결제도 없이 운영됩니다. 한 분 한 분의 응원이 큰 힘이 되어요.
          가계부가 도움이 됐다면 따뜻한 응원 한 잔 보내주세요 ☕
        </p>
        <p className="mt-2 text-textPinkStrong font-medium">진심으로 감사합니다 🙏</p>
      </div>
    </Card>
  );
}
