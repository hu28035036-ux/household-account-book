#!/usr/bin/env node
// 5-iteration stability gate. Each round broadens the verification surface;
// any failure resets the counter and bubbles up so the area agent can fix and retry.
// Rules (per loop-validator agent definition):
//   - 5 rounds must all return exit code 0 for PASS
//   - Any failed round → counter reset, return code 1, no Curator hand-off
//   - --round N runs only that round (debug)
//   - Round modes are fixed: do not reorder

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { STAGES } from './lib/stages.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ROUNDS = 5;

const args = process.argv.slice(2);
let onlyRound = null;
let diagnose = false;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--round') onlyRound = Number(args[++i]);
  else if (a === '--diagnose') diagnose = true;
  else if (a === '--help' || a === '-h') {
    console.log(`Usage: node harness/loop.mjs [--round N] [--diagnose]

Five-round stability gate. Pass requires all 5 rounds to return exit 0.
Any failure resets the counter and exits 1 (counter is informational here —
the actual reset semantics live in the loop-validator agent).
`);
    process.exit(0);
  }
}

// Round definitions — broaden coverage incrementally.
// Each step is { label, cmd, args, optional }.
// optional=true means the step is skipped if the underlying tool isn't available
// (e.g. dev server not running for smoke), but the round itself still must produce
// at least one passing step or it counts as failure.
// Round plans pulled from harness/lib/stages.mjs (design-log C-09).
// Each round broadens coverage; same step can appear in multiple plans across files.
const ROUND_PLANS = [
  {
    n: 1,
    title: 'self-test + typecheck + vitest',
    steps: [STAGES.selfTest, STAGES.typecheck, STAGES.vitest],
  },
  {
    n: 2,
    title: '+ harness/run --mock',
    steps: [STAGES.harnessMock],
  },
  {
    n: 3,
    title: '+ eslint + §9-A grep',
    steps: [STAGES.eslint, STAGES.antiPatternGrep],
  },
  {
    n: 4,
    title: '+ smoke:all',
    steps: [STAGES.smokeAll],
  },
  {
    n: 5,
    title: '+ audit-rls + responsive',
    steps: [STAGES.auditRls, STAGES.responsive],
  },
];

function runStep(step) {
  return new Promise((resolveStep) => {
    const start = Date.now();
    const child = spawn(step.cmd, step.args, {
      cwd: ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('exit', (code) => {
      resolveStep({ ...step, code: code ?? 1, ms: Date.now() - start });
    });
    child.on('error', () => resolveStep({ ...step, code: 1, ms: Date.now() - start }));
  });
}

async function runRound(plan) {
  console.log(`\n┌─ Round ${plan.n}/${ROUNDS}  —  ${plan.title}`);
  const results = [];
  for (const step of plan.steps) {
    process.stdout.write(`│  ▶ ${step.label}\n`);
    const r = await runStep(step);
    results.push(r);
    if (r.code !== 0) {
      if (step.optional) {
        console.log(`│  ↪ ${step.label} skipped/failed (optional, code ${r.code}, ${(r.ms / 1000).toFixed(1)}s)`);
        continue;
      }
      console.log(`└─ Round ${plan.n} FAILED at: ${step.label} (code ${r.code}, ${(r.ms / 1000).toFixed(1)}s)`);
      return { ok: false, plan, step, results };
    }
  }
  // For optional-only rounds, require at least one step that ran successfully.
  const anyRan = results.some((r) => r.code === 0);
  if (!anyRan) {
    console.log(`└─ Round ${plan.n} FAILED — no step succeeded (all optional steps skipped/errored)`);
    return { ok: false, plan, step: results[results.length - 1], results };
  }
  console.log(`└─ Round ${plan.n} PASS`);
  return { ok: true, plan, results };
}

const plans = onlyRound ? ROUND_PLANS.filter((p) => p.n === onlyRound) : ROUND_PLANS;
if (plans.length === 0) {
  console.error(`error: --round ${onlyRound} out of range (1-${ROUNDS})`);
  process.exit(2);
}

const summary = [];
let firstFailure = null;
for (const plan of plans) {
  const r = await runRound(plan);
  summary.push(r);
  if (!r.ok) {
    firstFailure = r;
    break; // counter reset semantics — agent will return to fix and restart from round 1
  }
}

console.log('\n=== loop-validator gate ===');
for (const r of summary) {
  const tag = r.ok ? '✅' : '❌';
  console.log(`${tag} Round ${r.plan.n}: ${r.plan.title}`);
}
if (firstFailure) {
  const f = firstFailure;
  console.log(`\nCOUNTER RESET. Failed at round ${f.plan.n} step "${f.step.label}".`);
  console.log('Per loop-validator: return to area agent → fix → verifier → loop-validator round 1.');
  if (diagnose) {
    console.log('\n--diagnose hints:');
    console.log('  - is the failure deterministic? rerun this round only:');
    console.log(`      node harness/loop.mjs --round ${f.plan.n}`);
    console.log('  - if it flickers, treat as flaky → fix the underlying nondeterminism, do not retry-loop.');
  }
  process.exit(1);
}
const total = onlyRound ? `round ${onlyRound}` : `${ROUNDS}/${ROUNDS} rounds`;
console.log(`\nPASS — ${total}. Hand-off to curator allowed.`);
