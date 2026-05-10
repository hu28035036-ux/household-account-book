import { useCallback, useEffect, useRef } from 'react';

/**
 * useAbortableFetch — 컴포넌트 unmount 또는 deps 변경 시 in-flight fetch 를
 * AbortController 로 취소. 같은 컴포넌트의 빠른 filter/search 변경 시 stale
 * 응답이 setState 를 덮어쓰는 race 방지.
 *
 * 사용 예:
 *   const aFetch = useAbortableFetch();
 *   useEffect(() => {
 *     (async () => {
 *       const res = await aFetch('/api/...');
 *       if (!res) return; // aborted
 *       const json = await res.json();
 *       setRows(json.data);
 *     })();
 *   }, [q, filter, aFetch]);
 *
 * 반환값은 Response 또는 null (aborted 시). caller 가 null 체크해서 setState 회피.
 */
export function useAbortableFetch() {
  const controllerRef = useRef<AbortController | null>(null);

  // unmount 시 in-flight 요청 모두 abort
  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  return useCallback(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response | null> => {
    // 새 요청 시작 — 이전 요청 abort
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const res = await fetch(input, { ...init, signal: controller.signal });
      // 같은 hook 의 다음 요청이 시작되며 controller 가 교체된 경우 stale
      if (controller.signal.aborted) return null;
      return res;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return null;
      throw e;
    }
  }, []);
}
