// 은행/카드 Aggregator 추상화.
// 실제 구현체(Codef, Plaid, Mock) 가 모두 동일 인터페이스로 plug-in.

export type AuthMethod =
  | { kind: 'easy_auth'; channel: 'kakao' | 'pass' | 'naver' | 'samsung' }
  | { kind: 'id_password'; idLabel: string; passwordLabel: string }
  | { kind: 'cert' }; // 공동인증서 — 별도 호스트 환경 필요

export type LinkStartInput = {
  bankCode: string;        // BANKS.code
  authMethod: AuthMethod;
  /** id_password 일 때 */
  loginId?: string;
  loginPassword?: string;
  /** easy_auth 일 때 (간편인증으로 받은 사용자 정보) */
  birth?: string;          // YYMMDD
  phone?: string;          // 01012345678
  fullName?: string;
};

export type LinkStartResult =
  | {
      kind: 'pending';
      /** 사용자가 모바일에서 간편인증 완료 후 사용할 토큰 */
      sessionToken: string;
      message: string;
    }
  | {
      kind: 'completed';
      providerAccountId: string;
      bankCode: string;
      bankName: string;
      accountType: 'checking' | 'savings' | 'card' | 'loan' | 'other';
      accountNumberMasked: string;
      holderName: string | null;
      balance: number | null;
      /** 다음 동기화에 필요한 자격증명 (refresh token 등) — 서버에서 암호화 저장 */
      credentials: string;
    };

export type LinkCompleteInput = {
  sessionToken: string;
  /** 간편인증 push 승인 후 받은 검증 코드 (provider 별 상이) */
  verificationCode?: string;
};

export type FetchTransactionsInput = {
  /** linked_accounts.credentials_encrypted 를 복호화한 평문 */
  credentials: string;
  providerAccountId: string;
  bankCode: string;
  fromDate: string; // YYYY-MM-DD
  toDate: string;   // YYYY-MM-DD
};

export type ProviderTxn = {
  /** provider 측 고유 거래 id (있으면) — dedup 보조 */
  externalId?: string;
  date: string;        // YYYY-MM-DD
  amount: number;      // 항상 양수
  type: 'income' | 'expense' | 'transfer';
  merchantName: string | null;
  description: string | null;
  /** 잔액 (있으면) */
  balanceAfter?: number;
  /** 카드 거래일 때 */
  installments?: number;
  meta?: Record<string, unknown>;
};

export type FetchTransactionsResult = {
  transactions: ProviderTxn[];
  /** 갱신된 잔액 — 있으면 linked_accounts.balance 갱신 */
  latestBalance?: number;
  /** 자격증명 회전 — 있으면 저장 갱신 */
  rotatedCredentials?: string;
};

export interface BankingProvider {
  /** provider 식별자 — DB 의 linked_accounts.provider 와 일치 */
  readonly id: 'mock' | 'codef' | 'plaid';

  /** 이 provider 가 다룰 수 있는 은행/카드 코드 목록. UI 에서 미지원은 비활성. */
  supportedBankCodes(): string[];

  /** 특정 은행에서 사용 가능한 인증 방식 목록 */
  authMethodsFor(bankCode: string): AuthMethod[];

  /** 연동 시작 — 즉시 완료될 수도, pending(간편인증 push 대기) 일 수도 있음 */
  startLink(input: LinkStartInput): Promise<LinkStartResult>;

  /** pending 인 연동의 완료 처리 (간편인증 푸시 승인 후 호출) */
  completeLink(input: LinkCompleteInput): Promise<Extract<LinkStartResult, { kind: 'completed' }>>;

  /** 거래내역 조회 */
  fetchTransactions(input: FetchTransactionsInput): Promise<FetchTransactionsResult>;

  /** 연동 해제 — provider 측에서도 토큰 무효화. 실패해도 클라이언트는 row 만 삭제. */
  unlink(credentials: string, providerAccountId: string): Promise<void>;
}
