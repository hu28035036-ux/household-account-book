import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import officeCrypto from 'officecrypto-tool';

const path = process.argv[2];
const password = process.argv[3];
if (!path || !password) {
  console.error('Usage: node analyze-bank-file.mjs <path.xlsx> <password>');
  process.exit(1);
}

const buf = readFileSync(path);
console.log('파일 크기:', buf.length, 'bytes');

const encrypted = officeCrypto.isEncrypted(buf);
console.log('isEncrypted:', encrypted);

let inputBuf = buf;
if (encrypted) {
  const decrypted = await officeCrypto.decrypt(buf, { password });
  console.log('복호화 OK. 풀린 크기:', decrypted.length, 'bytes');
  inputBuf = decrypted;
}

const wb = XLSX.read(inputBuf, { type: 'buffer' });
console.log('\n시트 목록:', wb.SheetNames);

for (const sheetName of wb.SheetNames) {
  const ws = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
  console.log(`\n=== 시트 "${sheetName}" — ${aoa.length} 행 ===`);
  console.log('처음 25행:');
  aoa.slice(0, 25).forEach((row, i) => {
    const cells = (row).map((c) => String(c ?? '').slice(0, 25));
    console.log(`[${String(i).padStart(2)}]`, cells.join(' | '));
  });
  if (aoa.length > 25) {
    console.log('...');
    console.log(`마지막 행 [${aoa.length - 1}]:`, (aoa[aoa.length - 1] ?? []).join(' | '));
  }
}
