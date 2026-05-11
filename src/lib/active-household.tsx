'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';

const STORAGE_KEY = 'active_household_id';
// 서버 컴포넌트(SSR 대시보드/통계)에서 cookies()로 읽기 위한 키.
const COOKIE_KEY = 'active_household_id';

// active_household_id 쿠키를 읽는 SSR 페이지 화이트리스트.
// 컨텍스트 전환 시 router.refresh() 가 필요한 페이지만 명시 — 나머지 클라이언트
// 컴포넌트 페이지는 activeId 변화에 직접 반응하므로 refresh 불필요.
//
// 새 SSR 페이지를 추가할 때 active_household_id 쿠키를 읽는다면 여기에도 추가.
const SSR_PATHS_NEEDING_REFRESH = ['/dashboard', '/stats'];

export type ActiveHousehold = {
  id: string;
  name: string;
  is_owner: boolean;
};

type Ctx = {
  activeId: string | null;
  households: ActiveHousehold[];
  loading: boolean;
  setActive: (id: string | null) => void;
  refresh: () => Promise<void>;
};

const ActiveHouseholdCtx = createContext<Ctx>({
  activeId: null,
  households: [],
  loading: false,
  setActive: () => {},
  refresh: async () => {},
});

function writeCookie(value: string | null) {
  if (typeof document === 'undefined') return;
  if (value) {
    document.cookie = `${COOKIE_KEY}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  } else {
    document.cookie = `${COOKIE_KEY}=; path=/; max-age=0; samesite=lax`;
  }
}

export function ActiveHouseholdProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [households, setHouseholds] = useState<ActiveHousehold[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/households');
      const json = await res.json();
      const rows: ActiveHousehold[] = (json?.data ?? []).map((h: any) => ({
        id: h.id,
        name: h.name,
        is_owner: !!h.is_owner,
      }));
      setHouseholds(rows);
    } catch {
      setHouseholds([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const v = window.localStorage.getItem(STORAGE_KEY);
    const next = v && v !== 'null' ? v : null;
    setActiveIdState(next);
    // localStorage 와 쿠키를 항상 동기화 (서버에선 쿠키만 보임)
    writeCookie(next);
    void refresh();
  }, [refresh]);

  // 활성 id가 더 이상 멤버가 아닌 모임이면 자동 해제
  useEffect(() => {
    if (!activeId || households.length === 0) return;
    if (!households.find((h) => h.id === activeId)) {
      setActive(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, households]);

  const setActive = useCallback(
    (id: string | null) => {
      if (typeof window !== 'undefined') {
        if (id) window.localStorage.setItem(STORAGE_KEY, id);
        else window.localStorage.removeItem(STORAGE_KEY);
        writeCookie(id);
      }
      setActiveIdState(id);
      // SSR 페이지(대시보드/통계 등 화이트리스트) 에서만 새 쿠키로 다시 렌더링 트리거.
      // 나머지 CSR 페이지는 activeId 변화에 직접 반응하므로 refresh 불필요 → 전환 속도 ↑.
      const needsRefresh =
        pathname != null &&
        SSR_PATHS_NEEDING_REFRESH.some((p) => pathname === p || pathname.startsWith(p + '/'));
      if (needsRefresh) router.refresh();
    },
    [router, pathname],
  );

  return (
    <ActiveHouseholdCtx.Provider value={{ activeId, households, loading, setActive, refresh }}>
      {children}
    </ActiveHouseholdCtx.Provider>
  );
}

export function useActiveHousehold() {
  return useContext(ActiveHouseholdCtx);
}
