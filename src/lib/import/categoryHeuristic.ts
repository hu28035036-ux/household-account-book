/**
 * 가맹점 이름 → 한국 가계부 표준 카테고리 휴리스틱.
 *
 * 사용 우선순위:
 *  1) merchant_learning_rules (사용자 본인 데이터, 가장 정확)
 *  2) 이 휴리스틱 사전 (첫 import 일 때 70~80% 커버)
 *  3) (옵션) LLM 일괄 추정
 *
 * 카테고리 이름은 0001 마이그레이션의 시드 카테고리와 1:1 매칭.
 * 사용자가 카테고리를 삭제·이름 변경하면 매칭이 안 될 수 있는데,
 * 그건 정상 — 학습 규칙(1순위)이 알아서 사용자 정의 이름으로 수렴함.
 */

const RULES: Array<{ category: string; patterns: RegExp[] }> = [
  {
    category: '카페/간식',
    patterns: [
      /스타벅스|starbucks/i,
      /이디야|ediya/i,
      /투썸|twosome/i,
      /메가커피|mega\s*coffee/i,
      /컴포즈/,
      /할리스|hollys/i,
      /폴바셋|paul\s*bassett/i,
      /커피빈|coffee\s*bean/i,
      /빽다방/,
      /블루보틀|blue\s*bottle/i,
      /파리바게뜨|paris\s*baguette/i,
      /뚜레쥬르|tous\s*les\s*jours/i,
      /던킨|dunkin/i,
      /크리스피|krispy/i,
      /배스킨|baskin/i,
      /설빙/,
      /공차|gong\s*cha/i,
    ],
  },
  {
    category: '식비',
    patterns: [
      /김밥/,
      /맘스터치/,
      /롯데리아/,
      /맥도날드|mcdonald/i,
      /버거킹|burger\s*king/i,
      /서브웨이|subway/i,
      /피자|pizza/i,
      /치킨|chicken|bbq|네네치킨|굽네|bhc|교촌/i,
      /족발/,
      /보쌈/,
      /국밥|곰탕|돼지국밥/,
      /분식/,
      /백반|식당|식육|숯불|삼겹|돼지/,
      /이삭토스트/,
      /죽이야기/,
      /초밥|스시|sushi/i,
      /라멘|우동/,
      /떡볶이/,
    ],
  },
  {
    category: '편의점/마트',
    patterns: [
      /\bGS25\b/i,
      /\bCU\b/i,
      /이마트24|emart24/i,
      /세븐일레븐|7-?eleven/i,
      /미니스톱|ministop/i,
      /이마트|emart/i,
      /롯데마트|lotte\s*mart/i,
      /홈플러스|homeplus/i,
      /코스트코|costco/i,
      /트레이더스|traders/i,
      /하나로마트|hanaro/i,
      /마트(?!이로|에라)/,
    ],
  },
  {
    category: '교통',
    patterns: [
      /지하철|메트로/,
      /버스(?!요|카드)/,
      /카카오T|kakao\s*t/i,
      /우티|uber/i,
      /타다|tada/i,
      /티머니|tmoney|t-money/i,
      /GS칼텍스|gs\s*caltex/i,
      /SK주유|sk\s*energy/i,
      /S-?OIL|에쓰오일/i,
      /현대오일/,
      /주유소|주유|fuel/i,
      /택시|taxi/i,
      /KTX|ktx|기차|코레일/i,
      /고속버스|시외버스/,
    ],
  },
  {
    category: '통신비',
    patterns: [
      /\bSKT\b|sk텔레콤/i,
      /\bKT\b/i,
      /LG U\+|유플러스|lguplus/i,
      /통신요금|기본료/,
    ],
  },
  {
    category: '구독',
    patterns: [
      /넷플릭스|netflix/i,
      /디즈니|disney/i,
      /왓챠|watcha/i,
      /티빙|tving/i,
      /쿠팡플레이/,
      /유튜브\s*프리미엄|youtube\s*premium/i,
      /스포티파이|spotify/i,
      /애플\s*뮤직|apple\s*music/i,
      /애플\s*tv|apple\s*tv/i,
      /chatgpt|openai/i,
      /github|notion|figma/i,
      /icloud|구글\s*one|google\s*one/i,
    ],
  },
  {
    category: '의료',
    patterns: [
      /병원|의원|의료원|치과|한의원|클리닉|hospital|clinic/i,
      /약국|pharmacy/i,
      /세브란스|아산|삼성의료|서울대병원/,
    ],
  },
  {
    category: '주거/관리비',
    patterns: [
      /한국전력|kepco/i,
      /도시가스|gas\s*korea/i,
      /상수도|수도료/,
      /관리비|아파트관리/,
      /월세|전세/,
    ],
  },
  {
    category: '쇼핑',
    patterns: [
      /무신사|musinsa/i,
      /쿠팡|coupang/i,
      /11번가|11st/i,
      /G마켓|gmarket/i,
      /옥션|auction/i,
      /위메프|wemakeprice/i,
      /티몬|tmon/i,
      /알리(익스프레스)?|aliexpress/i,
      /아마존|amazon/i,
      /백화점|department/i,
      /아울렛|outlet/i,
      /면세점|duty\s*free/i,
      /올리브영|olive\s*young/i,
      /다이소|daiso/i,
      /이케아|ikea/i,
    ],
  },
  {
    category: '보험',
    patterns: [
      /생명보험|life\s*insurance/i,
      /손해보험|화재보험/,
      /삼성화재|현대해상|메리츠화재|kb손해|동부화재|롯데손해/i,
      /삼성생명|한화생명|교보생명|신한라이프|미래에셋생명/,
    ],
  },
  {
    category: '여가',
    patterns: [
      /CGV|cgv/i,
      /메가박스|megabox/i,
      /롯데시네마|lotte\s*cinema/i,
      /영화관/,
      /노래방/,
      /피시방|PC방/,
      /볼링|bowling/i,
      /당구/,
      /스크린골프|골프존|gdr/i,
      /놀이공원|에버랜드|롯데월드/,
    ],
  },
];

const INCOME_RULES: Array<{ category: string; patterns: RegExp[] }> = [
  { category: '저축', patterns: [/월급|급여|상여|성과급|보너스/, /salary|payroll/i] },
];

/**
 * 가맹점 이름으로 카테고리 추정. 매칭이 없으면 null.
 * @param merchantName 거래의 가맹점/적요 텍스트
 * @param hint 거래 유형(income/expense). income 이면 수입 사전 우선.
 */
export function suggestCategoryByMerchant(
  merchantName: string | null | undefined,
  hint?: 'income' | 'expense' | 'transfer',
): string | null {
  if (!merchantName) return null;
  const name = String(merchantName).trim();
  if (!name) return null;

  if (hint === 'income') {
    for (const r of INCOME_RULES) {
      if (r.patterns.some((p) => p.test(name))) return r.category;
    }
    return null;
  }

  for (const r of RULES) {
    if (r.patterns.some((p) => p.test(name))) return r.category;
  }
  // expense 가 없거나 hint 가 transfer 면 income 도 시도
  if (hint !== 'expense') {
    for (const r of INCOME_RULES) {
      if (r.patterns.some((p) => p.test(name))) return r.category;
    }
  }
  return null;
}
