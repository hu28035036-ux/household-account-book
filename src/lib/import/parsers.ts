'use client';

/**
 * 클라이언트 측 CSV/XLSX 파서. SheetJS는 무겁기 때문에 동적 import.
 */

export type SheetRow = Record<string, string>;
export type SheetData = { headers: string[]; rows: SheetRow[] };

export async function parseClientFile(file: File): Promise<SheetData> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || file.type === 'text/csv') {
    const text = await readAsText(file);
    return parseCsv(text);
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const XLSX = await import('xlsx');
    const ab = await file.arrayBuffer();
    const wb = XLSX.read(ab, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) throw new Error('워크시트가 비어 있습니다.');
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false });
    if (json.length === 0) return { headers: [], rows: [] };
    const headers = Object.keys(json[0] ?? {});
    const rows: SheetRow[] = json.map((r) => {
      const out: SheetRow = {};
      for (const h of headers) out[h] = String(r[h] ?? '').trim();
      return out;
    });
    return { headers, rows };
  }
  throw new Error('CSV 또는 XLSX 파일만 지원합니다.');
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
