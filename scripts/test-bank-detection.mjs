// 다양한 은행/카드사 가상 파일 생성 → 비번 걸기 → 풀어서 인식 → 결과 표.
// 실제 production 코드(parsers.ts / columnMapping.ts / normalize.ts)와 똑같은 로직을 재현.

import * as XLSX from 'xlsx';
import officeCrypto from 'officecrypto-tool';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';

mkdirSync('samples/banks', { recursive: true });

// === 가상 은행 파일 fixture ===
const FIXTURES = [
  {
    label: '토스뱅크',
    fileName: '토스뱅크_거래내역_2026.xlsx',
    sheetName: '토스뱅크 거래내역',
    password: '123456',
    aoa: [
      ['토스뱅크 거래내역'],
      [],
      ['성명', '홍길동', '', '계좌', '110-1234-5678'],
      ['조회기간', '2026-04-01 ~ 2026-04-30'],
      [],
      ['거래일시', '적요', '메모', '입금', '출금', '거래후잔액'],
      ['2026-04-01 09:30:00', '월급', '4월 급여', 4000000, '', 4500000],
      ['2026-04-02 12:15:00', '스타벅스', '', '', 5800, 4494200],
      ['2026-04-03 19:40:00', 'GS25', '간식', '', 3200, 4491000],
    ],
  },
  {
    label: 'KB국민은행',
    fileName: 'KB국민_거래내역_202604.xlsx',
    sheetName: 'KB국민 거래내역',
    password: '960712',
    aoa: [
      ['KB국민은행 거래내역서'],
      [],
      ['성명', '홍길동'],
      ['계좌번호', '123-45-678901'],
      ['조회기간', '2026.04.01 - 2026.04.30'],
      [],
      ['거래일자', '거래시간', '적요', '출금액', '입금액', '잔액', '거래점', '종류'],
      ['2026-04-05', '11:20', '신세계백화점', 280000, '', 1500000, '강남점', '출금'],
      ['2026-04-12', '18:45', '한식당 봄날', 220000, '', 1280000, '인터넷', '출금'],
      ['2026-04-25', '09:10', '월급', '', 3000000, 4280000, 'ATM', '입금'],
    ],
  },
  {
    label: '신한은행',
    fileName: '신한_거래내역_2026.xlsx',
    sheetName: '신한은행 거래내역',
    password: 'shinhan2026',
    aoa: [
      ['신한은행 통장 거래내역'],
      [],
      ['예금주', '홍길동'],
      ['계좌번호', '110-***-456'],
      [],
      ['일자', '시간', '출금금액', '입금금액', '잔액', '거래내용', '거래점', '메모'],
      ['2026-04-10', '14:22', 50000, '', 1200000, '카카오페이', '인터넷', ''],
      ['2026-04-25', '09:00', '', 3000000, 4200000, '월급', 'ATM', '4월 급여'],
    ],
  },
  {
    label: 'NH농협',
    fileName: 'NH농협_거래내역.xlsx',
    sheetName: '거래내역',
    password: 'nh1234',
    aoa: [
      ['농협은행 거래내역'],
      [],
      ['거래일자', '출금금액', '입금금액', '잔액', '거래내용', '거래점'],
      ['2026-04-15', 150000, '', 850000, '한국전력', '자동이체'],
      ['2026-04-20', '', 100000, 950000, '용돈', '인터넷'],
    ],
  },
  {
    label: '현대카드',
    fileName: '현대카드_이용내역_202604.xlsx',
    sheetName: '현대카드 이용내역',
    password: '9999',
    aoa: [
      ['현대카드 이용내역서'],
      [],
      ['카드번호', '****-****-****-1234'],
      ['청구월', '2026년 4월'],
      [],
      ['이용일자', '이용처', '이용금액', '승인번호', '결제예정일'],
      ['2026-04-05', '신세계백화점 강남점', 280000, '12345678', '2026-05-25'],
      ['2026-04-12', '한식당 봄날', 220000, '23456789', '2026-05-25'],
      ['2026-04-22', '세브란스병원', 110000, '34567890', '2026-05-25'],
    ],
  },
];

// === parsers.ts 의 detectBank / findHeaderRow 정확히 재현 ===
function detectBank(fileName, sheetName, headers) {
  const text = `${fileName} ${sheetName}`.toLowerCase();
  if (/카카오뱅크|kakaobank/i.test(text)) return '카카오뱅크';
  if (/토스뱅크|tossbank/i.test(text)) return '토스뱅크';
  if (/케이뱅크|k뱅크|kbank/i.test(text)) return '케이뱅크';
  if (/kb국민|국민은행|kbstar/i.test(text)) return 'KB국민은행';
  if (/신한은행|shinhan\s*bank/i.test(text)) return '신한은행';
  if (/우리은행|wooribank/i.test(text)) return '우리은행';
  if (/하나은행|hana\s*bank/i.test(text)) return '하나은행';
  if (/nh농협|농협은행|nonghyup/i.test(text)) return 'NH농협은행';
  if (/현대카드|hyundaicard/i.test(text)) return '현대카드';
  if (/삼성카드|samsungcard/i.test(text)) return '삼성카드';
  if (/롯데카드|lottecard/i.test(text)) return '롯데카드';
  // 헤더 fallback
  const h = headers.join(' ').toLowerCase();
  if (/거래일시/.test(h) && /구분/.test(h) && /거래\s*후\s*잔액/.test(h))
    return '카카오뱅크 (헤더 추정)';
  if (/이용\s*일/.test(h) && /이용\s*처/.test(h) && /이용\s*금액/.test(h))
    return '신용카드 명세서';
  if (/출금\s*(금액|액)/.test(h) && /입금\s*(금액|액)/.test(h) && /잔액/.test(h))
    return '은행 거래내역';
  return null;
}
const HEADER_HINTS = [
  /거래\s*일/, /이용\s*일/, /승인\s*일/, /^일자$/, /^일시$/, /^날짜$/,
  /입금/, /출금/, /거래\s*금액/, /이용\s*금액/, /^금액$/,
  /^적요$/, /거래\s*내용/, /^내용$/, /가맹점/, /이용\s*처/,
  /^메모$/, /거래\s*메모/, /^비고$/,
  /^구분$/, /거래\s*구분/, /^종류$/,
  /^잔액$/, /거래\s*후\s*잔액/,
];
function findHeaderRow(aoa) {
  let bestRow = 0, bestScore = 0;
  for (let i = 0; i < Math.min(30, aoa.length); i++) {
    const row = aoa[i] ?? [];
    let score = 0;
    for (const c of row) {
      const s = String(c ?? '').trim();
      if (s && HEADER_HINTS.some((p) => p.test(s))) score++;
    }
    if (score > bestScore) { bestScore = score; bestRow = i; }
  }
  return bestScore >= 3 ? bestRow : 0;
}

// === 테스트 실행 ===
console.log('| 은행/카드사 | 파일 생성 | 암호화 | 복호화 | 헤더탐지 | 은행인식 | 행수 |');
console.log('|---|:---:|:---:|:---:|:---:|---|---:|');

for (const fx of FIXTURES) {
  let row = `| ${fx.label} `;
  // 1) 가상 .xlsx 생성
  const ws = XLSX.utils.aoa_to_sheet(fx.aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, fx.sheetName);
  const plainBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const plainPath = `samples/banks/_plain_${fx.fileName}`;
  writeFileSync(plainPath, plainBuf);
  row += '| ✅ ';
  // 2) 비번 걸기
  let encryptedBuf;
  try {
    encryptedBuf = await officeCrypto.encrypt(plainBuf, { password: fx.password });
    writeFileSync(`samples/banks/${fx.fileName}`, encryptedBuf);
    row += '| ✅ ';
  } catch (e) {
    row += '| ❌ |  |  |  |  |';
    console.log(row);
    console.log(`  └─ encrypt 실패: ${e.message}`);
    continue;
  }
  // 3) 복호화 + 인식
  try {
    const enc = readFileSync(`samples/banks/${fx.fileName}`);
    const isEnc = officeCrypto.isEncrypted(enc);
    const decrypted = isEnc
      ? await officeCrypto.decrypt(enc, { password: fx.password })
      : enc;
    row += '| ✅ ';
    const wb2 = XLSX.read(decrypted, { type: 'buffer' });
    const sn = wb2.SheetNames[0];
    const ws2 = wb2.Sheets[sn];
    const aoa = XLSX.utils.sheet_to_json(ws2, { header: 1, defval: '', raw: false });
    const headerIdx = findHeaderRow(aoa);
    const rawHeaders = (aoa[headerIdx] ?? []).map((c) => String(c ?? '').trim());
    const headers = rawHeaders.map((h, i) => h || `col_${i + 1}`);
    const dataRows = aoa.slice(headerIdx + 1).filter((r) => r.some((c) => String(c ?? '').trim()));
    row += `| 행 ${headerIdx} `;
    const detected = detectBank(fx.fileName, sn, headers);
    row += `| ${detected ?? '인식 불가'} `;
    row += `| ${dataRows.length} |`;
  } catch (e) {
    row += '| ❌  |  |  |';
    console.log(row);
    console.log(`  └─ 복호화/파싱 실패: ${e.message}`);
    continue;
  }
  console.log(row);
}

console.log('\n생성된 파일:');
for (const fx of FIXTURES) console.log(`  samples/banks/${fx.fileName} (비번: ${fx.password})`);

// === 컬럼 매핑까지 풀 시뮬레이션 ===
const PATTERNS = {
  transaction_date: [/거래\s*일\s*시/, /거래\s*일\s*자/, /거래\s*일/, /이용\s*일\s*자/, /이용\s*일/, /^일자$/, /^일시$/, /^날짜$/, /date/i],
  amount: [/이용\s*금액/, /거래\s*금액/, /^금액$/, /amount/i],
  amount_in: [/입금\s*금액/, /입금\s*액/, /^입금$/, /^수입$/, /credit/i],
  amount_out: [/출금\s*금액/, /출금\s*액/, /^출금$/, /^지출$/, /debit/i],
  merchant_name: [/가맹점/, /상호/, /이용\s*처/, /^적요$/, /거래\s*내용/, /^내용$/],
  description: [/거래\s*메모/, /^메모$/, /^비고$/, /memo/i],
  payment_method: [/결제\s*수단/, /^카드$/, /^계좌$/, /payment/i],
  category: [/^분류$/, /^카테고리$/, /category/i],
  type_column: [/^구분$/, /거래\s*구분/, /^종류$/, /입출금/],
};
function autoDetect(headers) {
  const out = {};
  for (const [field, regs] of Object.entries(PATTERNS)) {
    for (const h of headers) if (regs.some((r) => r.test(h))) { out[field] = h; break; }
  }
  return out;
}
console.log('\n\n=== 컬럼 매핑 결과 ===');
for (const fx of FIXTURES) {
  const enc = readFileSync(`samples/banks/${fx.fileName}`);
  const decrypted = officeCrypto.isEncrypted(enc) ? await officeCrypto.decrypt(enc, { password: fx.password }) : enc;
  const wb2 = XLSX.read(decrypted, { type: 'buffer' });
  const ws2 = wb2.Sheets[wb2.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(ws2, { header: 1, defval: '', raw: false });
  const headerIdx = findHeaderRow(aoa);
  const headers = (aoa[headerIdx] ?? []).map((c) => String(c ?? '').trim()).map((h, i) => h || `col_${i + 1}`);
  const m = autoDetect(headers);
  console.log(`\n[${fx.label}]`);
  console.log(`  헤더: ${headers.filter(Boolean).join(' | ')}`);
  console.log(`  날짜=${m.transaction_date ?? '-'}, 금액=${m.amount ?? '-'}, 입금=${m.amount_in ?? '-'}, 출금=${m.amount_out ?? '-'}, 가맹점=${m.merchant_name ?? '-'}, 메모=${m.description ?? '-'}, 구분=${m.type_column ?? '-'}`);
}
