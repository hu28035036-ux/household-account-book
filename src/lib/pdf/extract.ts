'use client';

/**
 * 클라이언트에서 PDF의 텍스트를 추출. pdfjs-dist 동적 import로 번들 부담 최소화.
 * 영수증 사진 PDF(텍스트 없음)는 결과가 비거나 의미 없는 텍스트만 나올 수 있다.
 * 그런 경우 사용자가 미리보기에서 보고 OCR 모드를 권장하는 안내를 띄운다.
 */

let workerSrcSetup = false;

async function ensureWorker() {
  if (workerSrcSetup) return;
  // Next.js 환경에서 worker는 same-origin 또는 CDN을 통해 제공.
  // 번들러 호환을 위해 worker URL을 동적으로 잡는다.
  const pdfjs = await import('pdfjs-dist');
  // pdfjs 5.x/4.x는 worker를 따로 지정해야 함. CDN 경로 사용(보안: jsdelivr 또는 unpkg).
  const version = (pdfjs as any).version || '4.7.76';
  // GlobalWorkerOptions이 있으면 설정.
  const anyPdf = pdfjs as any;
  if (anyPdf.GlobalWorkerOptions) {
    anyPdf.GlobalWorkerOptions.workerSrc =
      `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
  }
  workerSrcSetup = true;
}

export type PdfExtractResult = {
  text: string;
  pageCount: number;
};

export async function extractPdfText(
  file: File | Blob,
  onProgress?: (p: number) => void,
): Promise<PdfExtractResult> {
  await ensureWorker();
  const pdfjs = await import('pdfjs-dist');
  const buf = await file.arrayBuffer();
  const doc = await (pdfjs as any).getDocument({ data: buf }).promise;
  const pageCount = doc.numPages as number;
  const lines: string[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const items: any[] = content.items ?? [];
    // y좌표를 기준으로 행 단위 묶기 (간단히 transform[5] 반올림으로 그룹).
    const byRow: Map<number, { x: number; s: string }[]> = new Map();
    for (const it of items) {
      const tr = it.transform as number[] | undefined;
      const y = tr ? Math.round(tr[5]) : 0;
      const x = tr ? tr[4] : 0;
      const s = String(it.str ?? '');
      if (!byRow.has(y)) byRow.set(y, []);
      byRow.get(y)!.push({ x, s });
    }
    const ys = Array.from(byRow.keys()).sort((a, b) => b - a); // 위에서 아래로
    for (const y of ys) {
      const row = byRow.get(y)!.sort((a, b) => a.x - b.x).map((r) => r.s).join(' ');
      const trimmed = row.replace(/\s+/g, ' ').trim();
      if (trimmed) lines.push(trimmed);
    }
    onProgress?.(i / pageCount);
  }

  return { text: lines.join('\n'), pageCount };
}
