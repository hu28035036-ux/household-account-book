// 'commit' citation kind — git commit hashes (7+ hex chars, "commit "-prefixed only).

import { spawn } from 'node:child_process';

const COMMIT_RE = /\b(?:commit\s+)([0-9a-f]{7,40})\b/gi;

export const kind = 'commit';

export function extract(text) {
  const out = [];
  let m;
  while ((m = COMMIT_RE.exec(text)) !== null) {
    out.push({ kind, value: m[1].toLowerCase(), raw: m[0] });
  }
  return out;
}

export async function check(citation, opts) {
  const cwd = opts?.root;
  if (!cwd) return { ok: false, reason: 'no root configured' };
  return await new Promise((resolveStep) => {
    const child = spawn('git', ['rev-parse', '--verify', `${citation.value}^{commit}`], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.on('exit', (code) => {
      if (code === 0) resolveStep({ ok: true });
      else resolveStep({ ok: false, reason: `commit ${citation.value} not found in git history` });
    });
    child.on('error', () =>
      resolveStep({ ok: false, reason: 'git unavailable — cannot verify commit' })
    );
  });
}
