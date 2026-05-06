// 생성된 .xlsx 파일이 실제 import 흐름에서 어떻게 인식되는지 검증.
// 앱의 columnMapping.ts / normalize.ts 로직을 그대로 재현.

import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';

const PATTERNS = {
  transaction_date: [/이용\s*일/, /거래\s*일/, /승인\s*일/, /일자/, /date/i, /날짜/],
  amount:           [/이용\s*금액/, /거래\s*금액/, /승인\s*금액/, /^금액$/, /amount/i, /total/i, /^합계$/],
  amount_in:        [/입금/, /수입/, /credit/i, /deposit/i],
  amount_out:       [/출금/, /지출/, /debit/i, /withdraw/i],
  merchant_name:    [/가맹점/, /상호/, /이용\s*처/, /적요/, /내용/, /merchant/i, /payee/i],
  description:      [/메모/, /비고/, /설명/, /description/i, /memo/i],
  payment_method:   [/결제\s*수단/, /카드/, /계좌/, /payment/i],
  category:         [/분류/, /카테고리/, /category/i],
};
const FIELD_LABEL = {
  transaction_date: '날짜',
  amount: '금액',
  amount_in: '입금/수입',
  amount_out: '출금/지출',
  merchant_name: '가맹점/상호',
  description: '메모/비고',
  payment_method: '결제수단',
  category: '카테고리',
};

function autoDetect(headers) {
  const out = {};
  for (const [field, regs] of Object.entries(PATTERNS)) {
    for (const h of headers) {
      if (regs.some((r) => r.test(h))) {
        out[field] = h;
        break;
      }
    }
  }
  return out;
}

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
  const ts = Date.parse(t);
  if (!Number.isNaN(ts)) {
    const d = new Date(ts);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }
  return null;
}

function normalizeRow(row, mapping) {
  const date = parseDate(row[mapping.transaction_date] ?? '');
  const merchant = row[mapping.merchant_name] ?? '';
  const description = row[mapping.description] ?? '';
  const payment = row[mapping.payment_method] ?? '';
  const category = row[mapping.category] ?? '';
  let amount = null;
  let type = 'expense';
  if (mapping.amount_in && mapping.amount_out) {
    const inAmt = parseAmount(row[mapping.amount_in]);
    const outAmt = parseAmount(row[mapping.amount_out]);
    if (inAmt && inAmt > 0) { amount = inAmt; type = 'income'; }
    else if (outAmt && outAmt > 0) { amount = outAmt; type = 'expense'; }
  } else if (mapping.amount) {
    const a = parseAmount(row[mapping.amount]);
    if (a !== null) {
      amount = Math.abs(a);
      type = a < 0 ? 'expense' : 'income';
      if (a > 0 && merchant) type = 'expense';
    }
  }
  const warnings = [];
  if (!date) warnings.push('date_uncertain');
  if (amount === null) warnings.push('amount_uncertain');
  if (!merchant) warnings.push('merchant_uncertain');
  return { date, type, amount, merchant, description, payment, category, warnings };
}

// === 검증 ===
const wb = XLSX.read(readFileSync('samples/2026-04-budget80.xlsx'), { type: 'buffer' });
const ws = wb.Sheets[wb.SheetNames[0]];
console.log(`시트명: ${wb.SheetNames[0]}`);
const json = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
const headers = Object.keys(json[0] ?? {});
console.log(`헤더: ${headers.join(' | ')}\n`);

const mapping = autoDetect(headers);
console.log('=== 자동 감지된 컬럼 매핑 ===');
for (const [field, label] of Object.entries(FIELD_LABEL)) {
  const v = mapping[field];
  console.log(`  ${label.padEnd(11, ' ')} → ${v ? v + '  ✅' : '(매칭 없음)'}`);
}

console.log('\n=== 정규화 미리보기 (처음 6건) ===');
for (let i = 0; i < 6; i++) {
  const r = json[i];
  const sheetRow = {};
  for (const h of headers) sheetRow[h] = String(r[h] ?? '').trim();
  const n = normalizeRow(sheetRow, mapping);
  const typeKr = n.type === 'income' ? '수입' : n.type === 'transfer' ? '이체' : '지출';
  const amtStr = n.amount === null ? '-' : n.amount.toLocaleString() + '원';
  console.log(
    `  ${n.date ?? '-'} | ${typeKr} | ${amtStr.padStart(11)} | ${(n.merchant || '-').padEnd(20)} | ${n.payment || '-'} | ${n.category || '-'} | warnings: ${n.warnings.join(',') || '-'}`,
  );
}

let okCount = 0;
let warnCount = 0;
for (const r of json) {
  const sheetRow = {};
  for (const h of headers) sheetRow[h] = String(r[h] ?? '').trim();
  const n = normalizeRow(sheetRow, mapping);
  if (n.warnings.length === 0) okCount++;
  else warnCount++;
}
console.log(`\n=== 전체 ${json.length}건 인식 결과 ===`);
console.log(`  안전(경고 0)        : ${okCount}건`);
console.log(`  경고 발생            : ${warnCount}건`);
console.log(`  → 안전 비율          : ${((okCount / json.length) * 100).toFixed(1)}%`);

const expenseSum = json.reduce((a, r) => {
  const sheetRow = {};
  for (const h of headers) sheetRow[h] = String(r[h] ?? '').trim();
  const n = normalizeRow(sheetRow, mapping);
  return n.type === 'expense' && n.amount ? a + n.amount : a;
}, 0);
const incomeSum = json.reduce((a, r) => {
  const sheetRow = {};
  for (const h of headers) sheetRow[h] = String(r[h] ?? '').trim();
  const n = normalizeRow(sheetRow, mapping);
  return n.type === 'income' && n.amount ? a + n.amount : a;
}, 0);
console.log(`\n=== 합계 ===`);
console.log(`  지출 합 : ${expenseSum.toLocaleString()}원  (예산 3,000,000원의 ${((expenseSum / 3_000_000) * 100).toFixed(1)}%)`);
console.log(`  수입 합 : ${incomeSum.toLocaleString()}원`);
