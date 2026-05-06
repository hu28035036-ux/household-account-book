'use client';

import { useEffect, useState } from 'react';
import { Monitor, Copy, Check } from 'lucide-react';
import { Card, CardSubtle, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';

/**
 * 모바일/PWA 사용자가 PC 브라우저로 같은 사이트에 접속할 때
 * URL 을 한 번 클릭으로 복사할 수 있게 하는 카드.
 * window.location.origin 을 그대로 사용 — PWA standalone 모드에서도
 * 정확히 production 도메인이 잡힘.
 */
export function PcUrlCard() {
  const [url, setUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') setUrl(window.location.origin);
  }, []);

  async function copy() {
    setError(null);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // fallback (구형 브라우저, 일부 WebView)
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : '복사 실패');
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Monitor className="h-5 w-5 text-textPinkStrong" strokeWidth={1.75} />
          <CardTitle>PC 접속 주소</CardTitle>
        </div>
      </div>
      <CardSubtle className="mt-1">
        모바일에서 보고 있는 이 가계부를 PC 브라우저로도 열고 싶을 때 사용하세요.
        같은 계정으로 로그인하면 데이터는 동일하게 보입니다.
      </CardSubtle>
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <code className="flex-1 min-w-0 px-3 py-2 rounded-md bg-sectionBackground text-textPrimary text-xs sm:text-sm break-all select-all">
          {url || '...'}
        </code>
        <Button
          size="sm"
          onClick={copy}
          disabled={!url}
          className="!h-9 !px-3 !text-xs !gap-1"
        >
          {copied ? (
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
      {error && (
        <p className="mt-2 text-xs rounded-md bg-dangerSoft text-danger px-3 py-2">{error}</p>
      )}
    </Card>
  );
}
