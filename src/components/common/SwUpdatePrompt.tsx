'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

/**
 * Service Worker 업데이트 감지 → 사용자에게 한 줄 토스트.
 * 클릭하면 새 SW 활성화 + 페이지 reload — 항상 최신 빌드로 동기화.
 *
 * 마운트 위치: 인증된 영역(AppShell). 로그인 화면에서도 띄우려면 RootLayout 으로 옮기면 됨.
 *
 * 사용자가 "지금 새로고침" 또는 X 누르기 전까진 유지 — 잠깐 떴다 사라지지 않음.
 */
export function SwUpdatePrompt() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // SW image 캐시에 박힌 stale 4xx 응답을 1회 강제 청소.
  // next.config.mjs 의 cacheableResponse 추가는 신규 사용자에게만 효과 — 기존 사용자는
  // 이미 보관된 stale 응답을 30일간 들고 있으므로 한 번 비워줘야 회복.
  // localStorage 키로 1회만 실행. 이 useEffect 는 1~2주 뒤 다음 PR 에서 제거.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const PURGED_KEY = 'images-cache-purged-2026-05-10';
    if (window.localStorage.getItem(PURGED_KEY)) return;
    if (!('caches' in window)) return;
    caches
      .delete('images')
      .catch(() => {})
      .finally(() => {
        window.localStorage.setItem(PURGED_KEY, '1');
      });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    let cancelled = false;

    navigator.serviceWorker.ready.then((reg) => {
      if (cancelled) return;

      // 1) 페이지 진입 시 이미 대기 중인 SW 가 있으면 바로 토스트
      if (reg.waiting) setWaiting(reg.waiting);

      // 2) 새 SW 가 등록되면 install 이벤트 추적
      const handleUpdateFound = () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            setWaiting(installing);
          }
        });
      };
      reg.addEventListener('updatefound', handleUpdateFound);

      // 3) 30 분마다 백그라운드로 update 체크 (장시간 PWA 켜둔 사용자 대응)
      const interval = setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);

      return () => {
        clearInterval(interval);
        reg.removeEventListener('updatefound', handleUpdateFound);
      };
    });

    // 4) 새 SW 가 controller 가 되면(takeover) 자동 reload
    const onCtrlChange = () => {
      // SKIP_WAITING 후 reload 흐름에서만 한 번 실행되도록 — 무한 reload 방지 플래그
      if ((window as any).__swReloaded) return;
      (window as any).__swReloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onCtrlChange);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('controllerchange', onCtrlChange);
    };
  }, []);

  if (dismissed || !waiting) return null;

  function applyNow() {
    if (!waiting) return;
    waiting.postMessage({ type: 'SKIP_WAITING' });
    // controllerchange 가 트리거되어 reload 실행됨 — 직접 reload 도 fallback 으로 호출
    setTimeout(() => window.location.reload(), 800);
  }

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-md"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 5rem)' }}
      role="status"
      aria-live="polite"
    >
      <div className="rounded-modal bg-pageBackground border border-borderDefault shadow-card px-4 py-3 flex items-center gap-3">
        <RefreshCw className="h-5 w-5 text-textPinkStrong shrink-0" strokeWidth={1.75} />
        <div className="flex-1 min-w-0 text-sm">
          <div className="font-medium text-textPrimary truncate">새 버전이 준비됐어요</div>
          <div className="text-xs text-textMuted truncate">한 번 새로고침하면 즉시 적용됩니다.</div>
        </div>
        <button
          type="button"
          onClick={applyNow}
          className="h-9 px-3 rounded-md bg-primaryPink text-textOnPink text-sm font-medium hover:bg-primaryPinkHover shrink-0"
        >
          지금 적용
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="닫기"
          className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-softPinkBackground shrink-0"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
