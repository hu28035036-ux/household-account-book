// BM25-ish scoring over a precomputed inverted index.

const K1 = 1.5;
const B = 0.75;

export function score(queryTokens, doc, idx) {
  const N = idx.docCount;
  const avgdl = idx.avgdl || 1;
  let s = 0;
  for (const q of queryTokens) {
    const df = idx.df[q];
    if (!df) continue;
    const tf = (doc.tf && doc.tf[q]) || 0;
    if (tf === 0) continue;
    const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
    const dl = doc.length || 1;
    const numerator = tf * (K1 + 1);
    const denominator = tf + K1 * (1 - B + B * (dl / avgdl));
    s += idf * (numerator / denominator);
  }
  // Title/heading boost
  const titleHit = queryTokens.filter((q) => doc.titleTokens && doc.titleTokens.includes(q)).length;
  s += titleHit * 1.5;
  const headingHit = queryTokens.filter((q) => doc.headingTokens && doc.headingTokens.includes(q)).length;
  s += headingHit * 0.5;
  return s;
}
