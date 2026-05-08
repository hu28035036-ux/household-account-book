#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { walkMarkdown } from './lib/walk.mjs';
import { tokenize } from './lib/tokenize.mjs';

function parseTitleAndHeadings(md) {
  const lines = md.split(/\r?\n/);
  let title = '';
  const headings = [];
  for (const line of lines) {
    const m = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (!m) continue;
    if (!title && m[1].length === 1) title = m[2];
    headings.push(m[2]);
  }
  return { title, headings };
}

function summarize(md) {
  // first non-empty, non-heading paragraph, trimmed to ~200 chars
  const lines = md.split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#') || t.startsWith('---') || t.startsWith('|')) continue;
    return t.slice(0, 200);
  }
  return '';
}

const docs = [];
for await (const { url, rel } of walkMarkdown()) {
  const text = await readFile(url, 'utf8');
  const { title, headings } = parseTitleAndHeadings(text);
  const tokens = tokenize(text);
  const tf = {};
  for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
  docs.push({
    path: rel.replaceAll('\\', '/'),
    title: title || rel,
    summary: summarize(text),
    titleTokens: tokenize(title),
    headingTokens: tokenize(headings.join(' ')),
    tf,
    length: tokens.length,
  });
}

const df = {};
for (const d of docs) {
  for (const t of Object.keys(d.tf)) df[t] = (df[t] || 0) + 1;
}
const avgdl = docs.reduce((a, d) => a + d.length, 0) / Math.max(docs.length, 1);

const index = {
  builtAt: new Date().toISOString(),
  docCount: docs.length,
  avgdl,
  df,
  docs,
};

const outUrl = new URL('./index.json', import.meta.url);
await writeFile(outUrl, JSON.stringify(index, null, 0), 'utf8');

console.log(`[rag] indexed ${docs.length} docs → ${outUrl.pathname}`);
console.log(`[rag] vocabulary: ${Object.keys(df).length}, avg length: ${avgdl.toFixed(1)}`);
