import { vi } from 'vitest';

/**
 * Supabase JS 클라이언트 chain 의 최소 mock — 단위 테스트에서 service 함수가
 * 어떤 컬럼·값으로 chain 메서드를 호출했는지 검증한다.
 *
 * 실제 통신은 하지 않고, terminal 메서드 (single, maybeSingle, await) 가
 * resolve 시 `result` 를 반환한다.
 */
export function makeMockChain(result: { data?: unknown; error?: unknown; count?: number } = {}) {
  type Call = { method: string; args: unknown[] };
  // eslint-disable-next-line
  const chain: any = { _calls: [] as Call[] };
  const builderMethods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'is', 'not', 'or', 'like', 'ilike',
    'order', 'range', 'limit', 'offset',
  ];
  for (const m of builderMethods) {
    chain[m] = vi.fn((...args: unknown[]) => {
      chain._calls.push({ method: m, args });
      return chain;
    });
  }
  // terminal: single / maybeSingle / await
  const finalResolved = { data: null, error: null, count: 0, ...result };
  chain.single = vi.fn(() => Promise.resolve(finalResolved));
  chain.maybeSingle = vi.fn(() => Promise.resolve(finalResolved));
  // await chain — thenable
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(finalResolved).then(resolve, reject);
  return chain;
}

/**
 * Supabase client mock — service 함수에 넘길 supabase 인자.
 * `client.from('table')` 호출 시 같은 chain 을 반환해 호출 추적 가능.
 */
export function makeMockSupabase(result: { data?: unknown; error?: unknown; count?: number } = {}) {
  const chain = makeMockChain(result);
  const from = vi.fn(() => chain);
  // eslint-disable-next-line
  return { client: { from } as any, chain, from };
}
