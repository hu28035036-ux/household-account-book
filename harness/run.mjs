#!/usr/bin/env node
import { runAll } from './lib/runner.mjs';
import { printReport } from './lib/report.mjs';

const args = process.argv.slice(2);
const opts = {
  tag: null,
  case: null,
  domain: null,
  mock: false,
};

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--tag') opts.tag = args[++i];
  else if (a === '--case') opts.case = args[++i];
  else if (a === '--domain') opts.domain = args[++i];
  else if (a === '--mock') opts.mock = true;
  else if (a === '--help' || a === '-h') {
    console.log(`Usage: node harness/run.mjs [options]
  --tag <tag>        run only cases with this tag
  --case <id>        run a single case by id
  --domain <name>    run cases under cases/<domain>/
  --mock             skip live LLM calls (parser/masking/mapping only)
`);
    process.exit(0);
  }
}

try {
  const results = await runAll(opts);
  printReport(results);
  const failed = results.filter((r) => r.status === 'fail').length;
  process.exit(failed > 0 ? 1 : 0);
} catch (err) {
  console.error('[harness] runtime error:', err.message);
  process.exit(2);
}
