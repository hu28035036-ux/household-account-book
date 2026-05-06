'use client';

/**
 * 클라이언트 측 CSV/XLSX 파서. SheetJS는 무겁기 때문에 동적 import.
 */

export type SheetRow = Record<string, string>;
export type SheetData = {
  headers: string[];
  rows: SheetRow[];
  fileName?: string;
  sheetName?: string;
  detectedBank?: string | null;
};

/**
 * 파일/시트/헤더 텍스트로 은행·카드사 추정. 모르면 null.
 * 한국 시중·인터넷·지방 은행 + 카드사 + 페이/저축은행/우체국까지 폭넓게 매칭.
 */
export function detectBank(
  fileName: string,
  sheetName: string,
  headers: string[],
): string | null {
  const text = `${fileName} ${sheetName}`.toLowerCase();

  // === 인터넷전문은행 / 빅테크 ===
  if (/카카오뱅크|kakaobank/i.test(text)) return '카카오뱅크';
  if (/토스뱅크|tossbank/i.test(text)) return '토스뱅크';
  if (/케이뱅크|k뱅크|kbank/i.test(text)) return '케이뱅크';

  // === 시중은행 ===
  if (/kb국민|국민은행|kbstar/i.test(text)) return 'KB국민은행';
  if (/신한은행|shinhan\s*bank/i.test(text)) return '신한은행';
  if (/우리은행|wooribank/i.test(text)) return '우리은행';
  if (/하나은행|hana\s*bank/i.test(text)) return '하나은행';
  if (/nh농협|농협은행|nonghyup/i.test(text)) return 'NH농협은행';
  if (/ibk기업|기업은행/i.test(text)) return 'IBK기업은행';
  if (/sc제일|standard\s*chartered/i.test(text)) return 'SC제일은행';
  if (/씨티은행|citibank/i.test(text)) return '씨티은행';
  if (/산업은행|kdb/i.test(text)) return 'KDB산업은행';

  // === 지방은행 ===
  if (/부산은행|busan\s*bank/i.test(text)) return '부산은행';
  if (/경남은행|kyongnam/i.test(text)) return '경남은행';
  if (/대구은행|daegu\s*bank|imbank/i.test(text)) return '대구은행';
  if (/광주은행|kjbank/i.test(text)) return '광주은행';
  if (/전북은행|jbbank/i.test(text)) return '전북은행';
  if (/제주은행|jejubank/i.test(text)) return '제주은행';

  // === 협동/특수 ===
  if (/수협/i.test(text)) return '수협은행';
  if (/새마을금고|kfcc/i.test(text)) return '새마을금고';
  if (/신협/i.test(text)) return '신협';
  if (/우체국/i.test(text)) return '우체국';
  if (/저축은행/i.test(text)) return '저축은행';

  // === 페이 / 빅테크 ===
  if (/카카오\s*페이|kakaopay/i.test(text)) return '카카오페이';
  if (/네이버\s*페이|naverpay/i.test(text)) return '네이버페이';
  if (/토스\b|tossapp/i.test(text)) return '토스';
  if (/페이코|payco/i.test(text)) return '페이코';
  if (/삼성페이|samsungpay/i.test(text)) return '삼성페이';
  if (/애플페이|apple\s*pay/i.test(text)) return '애플페이';

  // === 카드사 ===
  if (/현대카드|hyundaicard/i.test(text)) return '현대카드';
  if (/삼성카드|samsungcard/i.test(text)) return '삼성카드';
  if (/롯데카드|lottecard/i.test(text)) return '롯데카드';
  if (/비씨카드|bccard|bc\s*카드/i.test(text)) return '비씨카드';
  if (/하나카드|hanacard/i.test(text)) return '하나카드';
  if (/우리카드|wooricard/i.test(text)) return '우리카드';
  if (/신한카드|shinhancard/i.test(text)) return '신한카드';
  if (/kb국민카드|국민카드|kbcard/i.test(text)) return 'KB국민카드';
  if (/nh농협카드|농협카드|nh\s*card/i.test(text)) return 'NH농협카드';
  if (/씨티카드|citicard/i.test(text)) return '씨티카드';
  if (/현대캐피탈|hyundaicapital/i.test(text)) return '현대캐피탈';

  // === 증권 / 보험 ===
  if (/미래에셋|mirae/i.test(text)) return '미래에셋증권';
  if (/한국투자|kis/i.test(text)) return '한국투자증권';
  if (/삼성증권|samsungsec/i.test(text)) return '삼성증권';
  if (/키움증권|kiwoom/i.test(text)) return '키움증권';
  if (/nh투자|nh\s*sec/i.test(text)) return 'NH투자증권';

  // === 헤더 조합 fallback ===
  const h = headers.join(' ').toLowerCase();
  if (/거래일시/.test(h) && /구분/.test(h) && /거래\s*후\s*잔액/.test(h)) {
    return '카카오뱅크 (헤더 추정)';
  }
  if (/이용\s*일/.test(h) && /이용\s*처/.test(h) && /이용\s*금액/.test(h)) {
    return '신용카드 명세서';
  }
  if (/출금\s*(금액|액)/.test(h) && /입금\s*(금액|액)/.test(h) && /잔액/.test(h)) {
    return '은행 거래내역';
  }
  return null;
}

/**
 * 호출 측에서 빈 비번이면 평범하게 파싱 시도, 비번이 걸려있으면
 * EncryptedFileError 를 throw. UI 가 그걸 잡아서 비번 입력 모달을 띄우고,
 * 다시 password 인자와 함께 호출해 풀어서 파싱한다.
 */
export class EncryptedFileError extends Error {
  constructor() {
    super('이 파일은 비밀번호가 걸려 있습니다.');
    this.name = 'EncryptedFileError';
  }
}
export class WrongPasswordError extends Error {
  constructor() {
    super('비밀번호가 올바르지 않습니다.');
    this.name = 'WrongPasswordError';
  }
}

export async function parseClientFile(file: File, password?: string): Promise<SheetData> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || file.type === 'text/csv') {
    const text = await readAsText(file);
    const csv = parseCsv(text);
    return {
      ...csv,
      fileName: file.name,
      detectedBank: detectBank(file.name, '', csv.headers),
    };
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const XLSX = await import('xlsx');
    const ab = await file.arrayBuffer();

    // 1) 비밀번호 보호된 OOXML 파일인지 검사
    let buffer: ArrayBuffer = ab;
    try {
      const officeCrypto = (await import('officecrypto-tool')).default ?? (await import('officecrypto-tool'));
      const inputBuf = (globalThis as any).Buffer
        ? (globalThis as any).Buffer.from(ab)
        : ab;
      const encrypted = (officeCrypto as any).isEncrypted(inputBuf);
      if (encrypted) {
        if (!password) throw new EncryptedFileError();
        try {
          const decrypted = await (officeCrypto as any).decrypt(inputBuf, { password });
          // Buffer → ArrayBuffer
          if (decrypted instanceof ArrayBuffer) {
            buffer = decrypted;
          } else {
            const u8 = decrypted as Uint8Array;
            const ab2 = new ArrayBuffer(u8.byteLength);
            new Uint8Array(ab2).set(u8);
            buffer = ab2;
          }
        } catch {
          throw new WrongPasswordError();
        }
      }
    } catch (e) {
      // 라이브러리 자체 로드 실패는 무시하고 평소 흐름
      if (e instanceof EncryptedFileError || e instanceof WrongPasswordError) throw e;
    }

    const wb = XLSX.read(buffer, { type: 'array' });
    const sheetName = wb.SheetNames[0] ?? '';
    const ws = wb.Sheets[sheetName];
    if (!ws) throw new Error('워크시트가 비어 있습니다.');
    // 한국 은행 파일은 1행에 메타정보(성명/계좌번호/조회기간 등)가 있고,
    // 5~15행 어디쯤에 진짜 헤더 행이 있다. 헤더 행을 휴리스틱으로 탐지.
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: '',
      raw: false,
    });
    if (aoa.length === 0) return { headers: [], rows: [] };
    const headerRowIdx = findHeaderRow(aoa);
    const rawHeaders = (aoa[headerRowIdx] ?? []).map((c) => String(c ?? '').trim());
    // 빈 헤더 셀은 col_N 으로 채워서 사용자가 매핑 드롭다운에서 골라낼 수 있게.
    const headers: string[] = rawHeaders.map((h, i) => h || `col_${i + 1}`);
    const rows: SheetRow[] = aoa
      .slice(headerRowIdx + 1)
      .filter((r) => r.some((c) => String(c ?? '').trim().length > 0))
      .map((r) => {
        const out: SheetRow = {};
        for (let i = 0; i < headers.length; i++) {
          out[headers[i]] = String(r[i] ?? '').trim();
        }
        return out;
      });
    return {
      headers,
      rows,
      fileName: file.name,
      sheetName,
      detectedBank: detectBank(file.name, sheetName, headers),
    };
  }
  throw new Error('CSV 또는 XLSX 파일만 지원합니다.');
}

// 한국 은행/카드사 거래내역 헤더 키워드. 하나라도 매칭되면 후보 점수 +1.
const HEADER_HINTS: RegExp[] = [
  /거래\s*일/, /이용\s*일/, /승인\s*일/, /^일자$/, /^일시$/, /^날짜$/,
  /입금/, /출금/, /거래\s*금액/, /이용\s*금액/, /^금액$/,
  /^적요$/, /거래\s*내용/, /^내용$/, /가맹점/, /이용\s*처/,
  /^메모$/, /거래\s*메모/, /^비고$/,
  /^구분$/, /거래\s*구분/, /^종류$/,
  /^잔액$/, /거래\s*후\s*잔액/,
];

/**
 * 시트의 처음 30행을 검사해 가장 헤더 키워드 매칭 점수가 높은 행 인덱스를 반환.
 * 매칭이 약하면(점수 < 3) 그냥 첫 행을 헤더로 가정 (단순 CSV/엑셀 케이스).
 */
function findHeaderRow(aoa: unknown[][]): number {
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
    if (score > bestScore) {
      bestScore = score;
      bestRow = i;
    }
  }
  return bestScore >= 3 ? bestRow : 0;
}

async function readAsText(file: File): Promise<string> {
  // 한국어 CSV는 종종 EUC-KR/CP949. UTF-8로 먼저 시도, 깨진 문자 비율 높으면 EUC-KR 재시도.
  const utf8 = await file.text();
  const replacementCount = (utf8.match(/�/g) ?? []).length;
  if (replacementCount < 3) return utf8;
  try {
    const buf = await file.arrayBuffer();
    const decoder = new TextDecoder('euc-kr');
    return decoder.decode(buf);
  } catch {
    return utf8;
  }
}

/**
 * 작은 CSV 파서: 따옴표 안의 콤마/개행 처리.
 */
export function parseCsv(text: string): SheetData {
  const stripped = text.replace(/^﻿/, ''); // BOM
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < stripped.length; i++) {
    const ch = stripped[i];
    if (inQuotes) {
      if (ch === '"') {
        if (stripped[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        cur.push(field);
        field = '';
      } else if (ch === '\n') {
        cur.push(field);
        rows.push(cur);
        cur = [];
        field = '';
      } else if (ch === '\r') {
        // skip
      } else {
        field += ch;
      }
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = (rows.shift() ?? []).map((s) => s.trim()).map((s, i) => s || `col_${i + 1}`);
  const out: SheetRow[] = rows
    .filter((r) => r.some((c) => c && c.trim().length > 0))
    .map((r) => {
      const obj: SheetRow = {};
      for (let i = 0; i < headers.length; i++) obj[headers[i]] = (r[i] ?? '').trim();
      return obj;
    });
  return { headers, rows: out };
}
