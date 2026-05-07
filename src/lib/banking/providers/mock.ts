import { randomUUID } from 'node:crypto';
import type {
  AuthMethod,
  BankingProvider,
  FetchTransactionsInput,
  FetchTransactionsResult,
  LinkCompleteInput,
  LinkStartInput,
  LinkStartResult,
  ProviderTxn,
} from '../types';
import { findBank, BANKS } from '../banks';

// 개발/시연용. 실제 외부 API 호출 없이 그럴듯한 거래 내역을 합성.
// BANKING_PROVIDER=mock 일 때 활성.

const MERCHANT_POOL: Array<{ name: string; type: 'income' | 'expense' | 'transfer'; min: number; max: number }> = [
  { name: '스타벅스 강남R점', type: 'expense', min: 4500, max: 7800 },
  { name: 'GS25 역삼점', type: 'expense', min: 1200, max: 8900 },
  { name: '쿠팡', type: 'expense', min: 8900, max: 89000 },
  { name: '배달의민족', type: 'expense', min: 12000, max: 38000 },
  { name: '서울교통공사', type: 'expense', min: 1250, max: 1450 },
  { name: '카카오T택시', type: 'expense', min: 4800, max: 18900 },
  { name: '넷플릭스', type: 'expense', min: 17000, max: 17000 },
  { name: '롯데마트', type: 'expense', min: 12500, max: 145000 },
  { name: 'CU 편의점', type: 'expense', min: 1500, max: 12000 },
  { name: '메가커피', type: 'expense', min: 1500, max: 4500 },
  { name: '월급', type: 'income', min: 3500000, max: 4200000 },
  { name: '이체 — 가족', type: 'transfer', min: 50000, max: 300000 },
  { name: '한국전력공사', type: 'expense', min: 32000, max: 78000 },
  { name: 'SKT 통신요금', type: 'expense', min: 49000, max: 89000 },
];

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomAccountNumber(): string {
  const seg = () => String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `****-**-${seg()}-${seg().slice(0, 2)}`;
}

function generateTxns(fromDate: string, toDate: string): ProviderTxn[] {
  const start = new Date(fromDate + 'T00:00:00Z');
  const end = new Date(toDate + 'T00:00:00Z');
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const txns: ProviderTxn[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    // 0~3건/일
    const count = Math.random() < 0.2 ? 0 : Math.random() < 0.8 ? randomBetween(1, 3) : randomBetween(3, 5);
    for (let j = 0; j < count; j++) {
      const m = MERCHANT_POOL[Math.floor(Math.random() * MERCHANT_POOL.length)];
      txns.push({
        externalId: randomUUID(),
        date: dateStr,
        amount: randomBetween(m.min, m.max),
        type: m.type,
        merchantName: m.name,
        description: null,
      });
    }
  }
  return txns;
}

export const mockProvider: BankingProvider = {
  id: 'mock',

  supportedBankCodes() {
    return BANKS.map((b) => b.code);
  },

  authMethodsFor(_bankCode): AuthMethod[] {
    return [
      { kind: 'easy_auth', channel: 'kakao' },
      { kind: 'easy_auth', channel: 'pass' },
      { kind: 'id_password', idLabel: '아이디', passwordLabel: '비밀번호' },
    ];
  },

  async startLink(input: LinkStartInput): Promise<LinkStartResult> {
    const bank = findBank(input.bankCode);
    if (!bank) throw new Error(`UNKNOWN_BANK: ${input.bankCode}`);
    // mock 은 즉시 완료
    return {
      kind: 'completed',
      providerAccountId: 'mock_' + randomUUID(),
      bankCode: bank.code,
      bankName: bank.name,
      accountType: bank.kind === 'card' ? 'card' : 'checking',
      accountNumberMasked: randomAccountNumber(),
      holderName: input.fullName ?? '홍길동',
      balance: randomBetween(120000, 8500000),
      credentials: JSON.stringify({
        provider: 'mock',
        token: randomUUID(),
        issuedAt: new Date().toISOString(),
      }),
    };
  },

  async completeLink(_input: LinkCompleteInput) {
    // mock 은 startLink 에서 바로 완료되므로 호출되지 않을 것이지만, 인터페이스 준수
    throw new Error('MOCK_PROVIDER_NO_PENDING');
  },

  async fetchTransactions(input: FetchTransactionsInput): Promise<FetchTransactionsResult> {
    const txns = generateTxns(input.fromDate, input.toDate);
    return {
      transactions: txns,
      latestBalance: randomBetween(120000, 8500000),
    };
  },

  async unlink(_credentials, _providerAccountId): Promise<void> {
    // no-op
  },
};
