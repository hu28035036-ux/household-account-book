#!/usr/bin/env node
/**
 * 모든 smoke 를 한 번에 — dev 서버 띄우기 → 4개 스크립트 순차 실행 → kill.
 * 로컬 push 전 권장: `npm run smoke:all`.
 *
 * (CI 에서는 안 돌림 — supabase secrets 가 필요해서 안전 X.
 *  CI 는 이미 typecheck/lint/vitest/build/playwright 로 충분히 검증.)
 */
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';

const SCRIPTS = [
  'scripts/test-all-endpoints.mjs',
  'scripts/test-pages-as-user.mjs',
  'scripts/test-pages-content.mjs',
  'scripts/test-mutation-apis.mjs',
];

const isWin = process.platform === 'win32';
const cmd = isWin ? 'npm.cmd' : 'npm';
console.log('[smoke] dev 서버 시작…');
// Node 24+ Windows 에서 npm.cmd 직접 spawn 시 EINVAL — shell:true 로 cmd.exe 경유.
// incident-0015 후속 (docs/verification/2026-05-11-code-validation.md).
const dev = spawn(cmd, ['run', 'dev'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: process.env,
  shell: isWin,
});
dev.stdout.on('data', () => {});
dev.stderr.on('data', () => {});

// dev 서버 ready 대기 — http://localhost:3000 응답될 때까지 polling
async function waitReady(timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch('http://localhost:3000/login', { redirect: 'manual' });
      if (r.status === 200 || r.status === 307) return true;
    } catch {
      // not ready yet
    }
    await wait(800);
  }
  return false;
}

const ready = await waitReady();
if (!ready) {
  console.error('[smoke] dev 서버가 준비되지 않음 — 종료');
  dev.kill();
  process.exit(2);
}
console.log('[smoke] dev 서버 ready\n');

let totalFail = 0;
for (const s of SCRIPTS) {
  console.log(`\n========================================`);
  console.log(`▶ ${s}`);
  console.log(`========================================`);
  const r = await new Promise((resolve) => {
    const p = spawn('node', [s], { stdio: 'inherit' });
    p.on('close', (code) => resolve(code ?? 1));
  });
  if (r !== 0) totalFail++;
}

console.log('\n[smoke] dev 서버 종료');
dev.kill();
// Windows: dev pid 를 루트로 그 child tree 만 정리 (/T 옵션).
// 기존 `taskkill /F /IM node.exe` 는 모든 Node 프로세스 (smoke 자체 포함) 를
// 죽일 수 있어 위험 — pid 기반 tree-kill 로 좁힘.
if (isWin && dev.pid) {
  spawn('taskkill', ['/F', '/T', '/PID', String(dev.pid)], { stdio: 'ignore' }).on(
    'close',
    () => {},
  );
}

if (totalFail > 0) {
  console.error(`\n❌ ${totalFail} 개 smoke 스크립트 실패`);
  process.exit(1);
}
console.log('\n✅ 전체 smoke 통과');
