#!/usr/bin/env node
// Harness tooling self-test.
// Catches regressions in the harness/rag tools themselves.
//
// CONVENTION-BASED DISCOVERY (design-log 06-coupling C-01):
//   Every file under harness/test/cases/*.mjs that exports a function named
//   `run<Something>Cases` becomes a group automatically. No groups array to maintain.
//   Adding a new case file = create the file with the export. self-test picks it up.

import { discoverGroups } from './lib/discover.mjs';

const { groups, error } = await discoverGroups();
if (error) {
  console.error(`error: ${error}`);
  process.exit(2);
}

let totalPass = 0;
let totalFail = 0;

console.log('=== Harness self-test ===');
console.log(`Discovered ${groups.length} group${groups.length === 1 ? '' : 's'}\n`);
for (const g of groups) {
  process.stdout.write(`▶ ${g.name}\n`);
  let results;
  try {
    results = await g.run();
  } catch (err) {
    console.log(`  ! group threw: ${err.message}`);
    totalFail += 1;
    continue;
  }
  for (const r of results) {
    if (r.ok) {
      totalPass += 1;
      console.log(`  ✓ ${r.name}`);
    } else {
      totalFail += 1;
      console.log(`  ✗ ${r.name}: ${r.message}`);
    }
  }
}

console.log(`\n=== Self-test result ===`);
console.log(`Pass ${totalPass} / Fail ${totalFail}  (total ${totalPass + totalFail})`);
if (totalFail > 0) {
  console.log('\nRecord this run as a runbook incident if it failed without an existing matching one.');
  process.exit(1);
}
process.exit(0);
