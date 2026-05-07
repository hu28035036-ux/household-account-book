// KFTC 은행 코드 + 카드사. provider 전환에 무관하게 UI 라벨로 사용.
// "지원 여부"는 active provider 의 supports 에서 결정 (provider 가 못 다루면 비활성).

export type BankKind = 'bank' | 'card';

export type BankInfo = {
  code: string; // KFTC 코드 또는 카드사 코드 (자체 정의)
  name: string;
  kind: BankKind;
  /** 간편인증 가능 여부 (카카오/PASS/네이버) — UI 안내에 사용 */
  easyAuth?: boolean;
};

export const BANKS: BankInfo[] = [
  // 시중은행
  { code: '004', name: 'KB국민은행', kind: 'bank', easyAuth: true },
  { code: '088', name: '신한은행', kind: 'bank', easyAuth: true },
  { code: '020', name: '우리은행', kind: 'bank', easyAuth: true },
  { code: '081', name: '하나은행', kind: 'bank', easyAuth: true },
  { code: '003', name: 'IBK기업은행', kind: 'bank', easyAuth: true },
  { code: '011', name: 'NH농협은행', kind: 'bank', easyAuth: true },
  { code: '023', name: 'SC제일은행', kind: 'bank', easyAuth: true },
  { code: '027', name: '한국씨티은행', kind: 'bank', easyAuth: false },
  // 인터넷 전문은행
  { code: '090', name: '카카오뱅크', kind: 'bank', easyAuth: true },
  { code: '089', name: '케이뱅크', kind: 'bank', easyAuth: true },
  { code: '092', name: '토스뱅크', kind: 'bank', easyAuth: true },
  // 지방은행
  { code: '031', name: '대구은행', kind: 'bank', easyAuth: true },
  { code: '032', name: '부산은행', kind: 'bank', easyAuth: true },
  { code: '034', name: '광주은행', kind: 'bank', easyAuth: true },
  { code: '035', name: '제주은행', kind: 'bank', easyAuth: true },
  { code: '037', name: '전북은행', kind: 'bank', easyAuth: true },
  { code: '039', name: '경남은행', kind: 'bank', easyAuth: true },
  { code: '045', name: '새마을금고', kind: 'bank', easyAuth: true },
  { code: '048', name: '신협', kind: 'bank', easyAuth: true },
  { code: '050', name: '저축은행', kind: 'bank', easyAuth: false },
  { code: '064', name: '산림조합', kind: 'bank', easyAuth: false },
  { code: '071', name: '우체국', kind: 'bank', easyAuth: true },

  // 카드사
  { code: 'card_kb', name: 'KB국민카드', kind: 'card', easyAuth: true },
  { code: 'card_shinhan', name: '신한카드', kind: 'card', easyAuth: true },
  { code: 'card_samsung', name: '삼성카드', kind: 'card', easyAuth: true },
  { code: 'card_hyundai', name: '현대카드', kind: 'card', easyAuth: true },
  { code: 'card_lotte', name: '롯데카드', kind: 'card', easyAuth: true },
  { code: 'card_woori', name: '우리카드', kind: 'card', easyAuth: true },
  { code: 'card_hana', name: '하나카드', kind: 'card', easyAuth: true },
  { code: 'card_nh', name: 'NH농협카드', kind: 'card', easyAuth: true },
  { code: 'card_bc', name: 'BC카드', kind: 'card', easyAuth: true },
  { code: 'card_citi', name: '씨티카드', kind: 'card', easyAuth: false },
];

export function findBank(code: string): BankInfo | undefined {
  return BANKS.find((b) => b.code === code);
}
