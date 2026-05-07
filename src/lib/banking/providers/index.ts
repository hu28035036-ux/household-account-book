import type { BankingProvider } from '../types';
import { mockProvider } from './mock';
import { codefProvider } from './codef';

// BANKING_PROVIDER env 로 active provider 결정. 미설정 시 mock.
//   - mock  : 샘플 데이터로 UI/UX 시연
//   - codef : 실제 Codef API (CODEF_CLIENT_ID 등 필요)
//   - plaid : (미구현)

export type ProviderId = BankingProvider['id'];

const REGISTRY: Record<ProviderId, BankingProvider> = {
  mock: mockProvider,
  codef: codefProvider,
  // plaid: 추후 추가
  // @ts-expect-error 'plaid' provider not implemented yet
  plaid: undefined,
};

export function getActiveProvider(): BankingProvider {
  const id = (process.env.BANKING_PROVIDER ?? 'mock') as ProviderId;
  const provider = REGISTRY[id];
  if (!provider) {
    throw new Error(`Unknown BANKING_PROVIDER='${id}'. Use one of: mock, codef`);
  }
  return provider;
}

/** 특정 row 의 provider 로 작업할 때 (다양한 provider 혼재 운영) */
export function getProviderById(id: ProviderId): BankingProvider {
  const p = REGISTRY[id];
  if (!p) throw new Error(`Provider '${id}' not registered.`);
  return p;
}
