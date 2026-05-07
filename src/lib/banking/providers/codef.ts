import type {
  AuthMethod,
  BankingProvider,
  FetchTransactionsInput,
  FetchTransactionsResult,
  LinkCompleteInput,
  LinkStartInput,
  LinkStartResult,
} from '../types';

// Codef (https://developer.codef.io) — 한국 시장 점유율 1위 Aggregator.
// 정식 키 발급 후 fetch 호출만 채우면 됨. ENV:
//   CODEF_CLIENT_ID, CODEF_CLIENT_SECRET, CODEF_PUBLIC_KEY, CODEF_ENV ('demo'|'prod')
//
// Codef 인증 방식:
//   - 간편인증 (카카오/PASS/네이버/삼성패스/KB모바일/페이코/신한/토스)
//   - ID/PW (네이버페이 같은 일부)
//   - 공동인증서 (별도 인증 호스트 필요 — 일반 클라우드에서는 미지원)
//
// 본 stub 은 실제 호출을 하지 않고 명확한 에러를 던져서, 환경변수가 갖춰지지 않은 상태로
// 운영 배포되더라도 사용자에게 즉시 사유가 보이도록 함.

function notConfigured(): never {
  throw Object.assign(new Error('CODEF_NOT_CONFIGURED'), {
    userMessage:
      'Codef 연동이 아직 설정되지 않았습니다. 운영자에게 문의하세요. (BANKING_PROVIDER=mock 으로 시연 가능)',
  });
}

export const codefProvider: BankingProvider = {
  id: 'codef',

  supportedBankCodes() {
    // 실제로는 Codef 이 지원하는 기관 목록과 매핑. 정식 통합 전에는 빈 배열 → UI 자동 비활성.
    return [];
  },

  authMethodsFor(_bankCode): AuthMethod[] {
    return [
      { kind: 'easy_auth', channel: 'kakao' },
      { kind: 'easy_auth', channel: 'pass' },
    ];
  },

  async startLink(_input: LinkStartInput): Promise<LinkStartResult> {
    return notConfigured();
  },

  async completeLink(_input: LinkCompleteInput) {
    return notConfigured();
  },

  async fetchTransactions(_input: FetchTransactionsInput): Promise<FetchTransactionsResult> {
    return notConfigured();
  },

  async unlink(_credentials, _providerAccountId): Promise<void> {
    return notConfigured();
  },
};
