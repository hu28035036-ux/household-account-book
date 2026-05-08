#!/usr/bin/env node
// Unified verification gate.
// Runs: typecheck → vitest → harness/run → smoke (optional) → RLS audit (optional).
// Fails hard on any step. Stages can be skipped via flags so per-agent runs stay fast,
// but a full run before hand-off is mandatory (CONTRACT §9-A-3 — 검증 없는 종료 막기).

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { STAGES } from './lib/stages.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const args = process.argv.slice(2);
const flags = {
  // Defaults: run the cheap stages. Smoke + RLS take longer / need a running server.
  typecheck: true,
  vitest: true,
  harness: true,
  smoke: args.includes('--full') || args.includes('--smoke'),
  rls: args.includes('--full') || args.includes('--rls'),
};
if (args.includes('--no-typecheck')) flags.typecheck = false;
if (args.includes('--no-vitest')) flags.vitest = false;
if (args.includes('--no-harness')) flags.harness = false;
if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage: node harness/verify.mjs [flags]

  --full          run every stage (typecheck + vitest + harness + smoke + RLS audit)
  --smoke         add the smoke endpoint stage (needs a running dev server)
  --rls           add the RLS audit stage (needs Supabase env)
  --no-typecheck  skip TypeScript typecheck
  --no-vitest     skip vitest
  --no-harness    skip the domain harness (harness/run.mjs)
`);
  process.exit(0);
}

function run(label, cmd, cmdArgs) {
  return new Promise((resolveStep) => {
    const start = Date.now();
    process.stdout.write(`\n▶ ${label}  (${cmd} ${cmdArgs.join(' ')})\n`);
    const child = spawn(cmd, cmdArgs, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('exit', (code) => {
      const sec = ((Date.now() - start) / 1000).toFixed(1);
      resolveStep({ label, code: code ?? 1, sec });
    });
    child.on('error', (err) => {
      console.error(`  ! spawn error: ${err.message}`);
      resolveStep({ label, code: 1, sec: '0.0' });
    });
  });
}

// Stages pulled from harness/lib/stages.mjs (single source — design-log C-09).
// self-test runs first; verify-citations runs last after the repo state has settled.
const stages = [STAGES.selfTest];
if (flags.typecheck) stages.push(STAGES.typecheck);
if (flags.vitest) stages.push(STAGES.vitest);
if (flags.harness) stages.push(STAGES.harnessMock);
if (flags.smoke) stages.push(STAGES.smokeAll);
if (flags.rls) stages.push(STAGES.auditRls);
stages.push(STAGES.verifyCitations);

const results = [];
let firstFailure = null;
for (const s of stages) {
  const r = await run(s.label, s.cmd, s.args);
  results.push(r);
  if (r.code !== 0 && !firstFailure) {
    firstFailure = r;
    // CONTRACT §9-A-3: do not silently fall through. Stop on first failure, surface the reason.
    break;
  }
}

console.log('\n=== verify gate ===');
for (const r of results) {
  const tag = r.code === 0 ? '✅' : '❌';
  console.log(`${tag} ${r.label}  (${r.sec}s)`);
}
if (firstFailure) {
  console.log(`\nFAILED at: ${firstFailure.label}.`);
  console.log('Per CONTRACT §9-A-3, do not finish the task with a failing verify gate.');
  process.exit(1);
}
console.log('\nAll selected stages passed. Hand-off is allowed.');
