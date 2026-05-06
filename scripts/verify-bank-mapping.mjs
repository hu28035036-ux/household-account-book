// 보강된 헤더 탐지 + 매핑이 카카오뱅크 파일을 정확히 인식하는지 검증.

import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import officeCrypto from 'officecrypto-tool';

const path = process.argv[2];
const password = process.argv[3];
if (!path || !password) {
  console.error('Usage: node verify-bank-mapping.mjs <path.xlsx> <password>');
  process.exit(1);
}

// === parsers.ts 의 헤더 탐지 로직 재현 ===
const HEADER_HINTS = [
  /거래\s*일/, /이용\s*일/, /승인\s*일/, /^일자$/, /^일시$/, /^날짜$/,
  /입금/, /출금/, /거래\s*금액/, /이용\s*금액/, /^금액$/,
  /^적요$/, /거래\s*내용/, /^내용$/, /가맹점/, /이용\s*처/,
  /^메모$/, /거래\s*메모/, /^비고$/,
  /^구분$/, /거래\s*구분/, /^종류$/,
  /^잔액$/, /거래\s*후\s*잔액/,
];

function findHeaderRow(aoa) {
  let bestRow = 0;
  let bestScore = 0;
  const limit = Math.min(30, aoa.length);
  for (let i = 0; i < limit; i++) {
    const row = aoa[i] ?? [];
    let score = 0;
    for (const cell of row) {
      const s = String(cell ?? '').trim();
      if (!s) continue;
      if (HEADER_HINTS.some((p) => p.test(s))) score++;
    }
    if (score > bestScore) { bestScore = score; bestRow = i; }
  }
  return bestScore >= 3 ? bestRow : 0;
}

// === columnMapping.ts 의 PATTERNS 재현 ===
const PATTERNS = {
  transaction_date: [/거래\s*일\s*시/, /거래\s*일\s*자/, /거래\s*일/, /이용\s*일\s*자/, /이용\s*일/, /승인\s*일/, /^일자$/, /^일시$/, /^날짜$/, /date/i],
  amount: [/이용\s*금액/, /거래\s*금액/, /승인\s*금액/, /^금액$/, /amount/i, /^total$/i, /^합계$/],
  amount_in: [/입금\s*금액/, /입금\s*액/, /^입금$/, /^수입$/, /credit/i, /deposit/i],
  amount_out: [/출금\s*금액/, /출금\s*액/, /^출금$/, /^지출$/, /debit/i, /withdraw/i],
  merchant_name: [/가맹점/, /상호/, /이용\s*처/, /^적요$/, /거래\s*내용/, /^내용$/, /보낸\s*분/, /받는\s*분/, /merchant/i, /payee/i],
  description: [/거래\s*메모/, /^메모$/, /^비고$/, /^설명$/, /description/i, /memo/i],
  payment_method: [/결제\s*수단/, /^카드$/, /^계좌$/, /payment/i],
  category: [/^분류$/, /^카테고리$/, /category/i],
  type_column: [/^구분$/, /거래\s*구분/, /^종류$/, /입출금/],
};

function autoDetect(headers) {
  const out = {};
  for (const [field, regs] of Object.entries(PATTERNS)) {
    for (const h of headers) {
      if (regs.some((r) => r.test(h))) { out[field] = h; break; }
    }
  }
  return out;
}

// === normalize.ts 재현 (요지) ===
function parseAmount(s) {
  if (!s) return null;
  const cleaned = String(s).replace(/[^\d-.]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n) : null;
}
function parseDate(s) {
  if (!s) return null;
  const t = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const m = t.match(/^(\d{4})[.\-/년\s]*(\d{1,2})[.\-/월\s]*(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return null;
}
function normalize(row, mapping) {
  const date = parseDate(row[mapping.transaction_date] ?? '');
  const merchant = row[mapping.merchant_name] ?? '';
  const description = row[mapping.description] ?? '';

  let typeFromColumn = null;
  if (mapping.type_column) {
    const v = (row[mapping.type_column] ?? '').trim();
    if (/이체/.test(v)) typeFromColumn = 'transfer';
    else if (/입금|수입|받음/.test(v)) typeFromColumn = 'income';
    else if (/출금|지출|보냄/.test(v)) typeFromColumn = 'expense';
  }

  let amount = null;
  let type = 'expense';
  if (mapping.amount_in && mapping.amount_out) {
    const inAmt = parseAmount(row[mapping.amount_in] ?? '');
    const outAmt = parseAmount(row[mapping.amount_out] ?? '');
    if (inAmt && inAmt > 0) { amount = inAmt; type = 'income'; }
    else if (outAmt && outAmt > 0) { amount = outAmt; type = 'expense'; }
  } else if (mapping.amount) {
    const a = parseAmount(row[mapping.amount] ?? '');
    if (a !== null) {
      amount = Math.abs(a);
      if (typeFromColumn) type = typeFromColumn;
      else if (a < 0) type = 'expense';
      else if (/이용\s*금액|승인\s*금액/.test(mapping.amount)) type = 'expense';
      else type = 'income';
    }
  }
  if (typeFromColumn && (mapping.amount_in || mapping.amount_out || mapping.amount)) type = typeFromColumn;
  return { date, type, amount, merchant, description };
}

// === 실행 ===
const buf = readFileSync(path);
const decrypted = officeCrypto.isEncrypted(buf)
  ? await officeCrypto.decrypt(buf, { password })
  : buf;
const wb = XLSX.read(decrypted, { type: 'buffer' });
const ws = wb.Sheets[wb.SheetNames[0]];
const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });

const headerIdx = findHeaderRow(aoa);
console.log(`헤더 행 인덱스: ${headerIdx} (자동 탐지)`);
const rawHeaders = (aoa[headerIdx] ?? []).map((c) => String(c ?? '').trim());
const headers = rawHeaders.map((h, i) => h || `col_${i + 1}`);
console.log('헤더:', headers);

const mapping = autoDetect(headers);
console.log('\n=== 자동 매핑 결과 ===');
for (const [k, v] of Object.entries(mapping)) console.log(`  ${k.padEnd(18)} → ${v}`);

const rows = aoa
  .slice(headerIdx + 1)
  .filter((r) => r.some((c) => String(c ?? '').trim().length > 0))
  .map((r) => {
    const obj = {};
    for (let i = 0; i < headers.length; i++) obj[headers[i]] = String(r[i] ?? '').trim();
    return obj;
  });

console.log(`\n총 데이터 행: ${rows.length}건`);
console.log('\n=== 정규화 미리보기 (처음 8건) ===');
for (let i = 0; i < Math.min(8, rows.length); i++) {
  const n = normalize(rows[i], mapping);
  const typeKr = n.type === 'income' ? '수입' : n.type === 'transfer' ? '이체' : '지출';
  console.log(
    `  ${n.date ?? '-'} | ${typeKr} | ${(n.amount ?? '-').toString().padStart(10)}원 | ${(n.merchant || '-').padEnd(30)}`,
  );
}

let okCount = 0, expense = 0, income = 0;
for (const r of rows) {
  const n = normalize(r, mapping);
  if (n.date && n.amount !== null) okCount++;
  if (n.type === 'expense' && n.amount) expense += n.amount;
  if (n.type === 'income' && n.amount) income += n.amount;
}
console.log(`\n정상 인식: ${okCount}/${rows.length}건`);
console.log(`지출 합: ${expense.toLocaleString()}원 / 수입 합: ${income.toLocaleString()}원`);
