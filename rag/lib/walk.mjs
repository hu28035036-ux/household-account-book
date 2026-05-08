import { readdir } from 'node:fs/promises';

const ROOT = new URL('../../', import.meta.url);

// Convention-based: index every .md file in the repo EXCEPT under explicit excludes.
// Previous version used an INCLUDE allowlist that broke whenever a new doc folder
// appeared (incident-0009 / design-log 06-coupling C-02). Inverting to a
// blocklist removes that recurring oversight.
//
// To keep the index lean, we exclude generated/build/test-output trees.
// Source/code files are always excluded (handled by the .md-only filter).
const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.next',
  'dist',
  'build',
  'test-results',
  '.git',
  'venv',
  '__pycache__',
  '.tmp.drivedownload',
  '.tmp.driveupload',
  // Test fixtures should never be indexed — they intentionally contain
  // anti-patterns / fake citations as examples.
  'fixtures',
]);

// Optional: skip specific .md files that are noisy or auto-generated.
const EXCLUDE_FILES = new Set([
  // none currently — add here if a generated CHANGELOG.md or similar shows up
]);

export async function* walkMarkdown() {
  const stack = [{ url: ROOT, rel: '' }];
  while (stack.length) {
    const { url, rel } = stack.pop();
    let entries;
    try {
      entries = await readdir(url, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (EXCLUDE_DIRS.has(e.name)) continue;
        // Hidden dirs (.claude, .vscode, …) — index .claude (contains agents),
        // skip other dotted dirs.
        if (e.name.startsWith('.') && e.name !== '.claude') continue;
        stack.push({ url: new URL(`${e.name}/`, url), rel: childRel });
      } else if (e.name.endsWith('.md') && !EXCLUDE_FILES.has(e.name)) {
        yield { url: new URL(e.name, url), rel: childRel };
      }
    }
  }
}
