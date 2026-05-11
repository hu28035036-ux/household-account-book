'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 자주 가는 라우트의 RSC 페이로드를 백그라운드에서 미리 가져옴.
// BottomNav 의 <Link> 가 이미 viewport-prefetch 를 해주지만, 모바일에서 BottomNav 위쪽으로
// 스크롤 중인 사용자는 prefetch 가 트리거되지 않을 수 있어 명시적으로 한 번 더 보강.
// 이 컴포넌트는 layout 에서 1회만 마운트되므로 호출도 1회뿐.
const CORE_ROUTES = ['/dashboard', '/transactions', '/upload', '/candidates', '/stats'];

export function RoutePrefetcher() {
  const router = useRouter();
  useEffect(() => {
    for (const r of CORE_ROUTES) router.prefetch(r);
  }, [router]);
  return null;
}
