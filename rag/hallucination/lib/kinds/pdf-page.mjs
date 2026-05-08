// 'pdf-page' citation kind — "PDF p<n>" refs. Two-pass extraction: locate "PDF"
// mentions, then look for p\d+ within ±60 chars.

const PDF_NEAR = /PDF/g;
const P_RE = /\bp\.?\s*(\d+)\b/g;

export const kind = 'pdf-page';

export function extract(text) {
  const out = [];
  let m;
  while ((m = PDF_NEAR.exec(text)) !== null) {
    const start = Math.max(0, m.index - 60);
    const end = Math.min(text.length, m.index + 60);
    const window = text.slice(start, end);
    let p;
    P_RE.lastIndex = 0;
    while ((p = P_RE.exec(window)) !== null) {
      out.push({ kind, value: Number(p[1]), raw: `p${p[1]}` });
    }
  }
  return out;
}

export async function check(citation, opts) {
  // 하네스엔지니어링.pdf is 24 pages. Pass opts.pdfPageCount to override.
  const totalPages = opts?.pdfPageCount ?? 24;
  if (typeof citation.value !== 'number' || citation.value < 1 || citation.value > totalPages) {
    return { ok: false, reason: `pdf page ${citation.value} out of range (1-${totalPages})` };
  }
  return { ok: true };
}
