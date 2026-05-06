'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'active_household_id';

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

export function ActiveHouseholdProvider({ children }: { children: ReactNode }) {
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
    setActiveIdState(v && v !== 'null' ? v : null);
    void refresh();
  }, [refresh]);

  // 활성 id가 더 이상 멤버가 아닌 가족이면 자동 해제
  useEffect(() => {
    if (!activeId || households.length === 0) return;
    if (!households.find((h) => h.id === activeId)) {
      setActive(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, households]);

  const setActive = useCallback((id: string | null) => {
    if (typeof window !== 'undefined') {
      if (id) window.localStorage.setItem(STORAGE_KEY, id);
      else window.localStorage.removeItem(STORAGE_KEY);
    }
    setActiveIdState(id);
  }, []);

  return (
    <ActiveHouseholdCtx.Provider value={{ activeId, households, loading, setActive, refresh }}>
      {children}
    </ActiveHouseholdCtx.Provider>
  );
}

export function useActiveHousehold() {
  return useContext(ActiveHouseholdCtx);
}
