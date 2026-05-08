// Lightweight tokenizer for Korean + English mixed Markdown.
// Strategy:
//  - lowercase
//  - split on non-letter / non-digit / non-Hangul boundaries
//  - drop very short tokens (<2) and pure stopwords
//  - keep Hangul as-is (no morphological analysis — code names and Hangul terms both work in BM25)

const STOPWORDS = new Set([
  '그리고', '하지만', '또한', '이는', '있는', '되는', '수', '및', '등',
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were',
  'to', 'of', 'in', 'on', 'for', 'with', 'as', 'at', 'by', 'this', 'that',
  'be', 'it', 'from', 'we', 'you', 'i', 'he', 'she', 'they',
]);

export function tokenize(text) {
  if (!text) return [];
  const lowered = text.toLowerCase();
  // Keep ASCII letters/digits, Hangul (U+AC00–U+D7A3 syllables, U+1100–U+11FF jamo)
  const tokens = lowered
    .replace(/[^a-z0-9ᄀ-ᇿ가-힣]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
  return tokens;
}
