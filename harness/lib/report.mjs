export function printReport(results) {
  const pass = results.filter((r) => r.status === 'pass').length;
  const fail = results.filter((r) => r.status === 'fail').length;
  const err = results.filter((r) => r.status === 'error').length;

  console.log('\n=== Harness Report ===');
  for (const r of results) {
    const tag =
      r.status === 'pass' ? '[PASS]' : r.status === 'fail' ? '[FAIL]' : '[ERR ]';
    console.log(`${tag} ${r.id}  (${r.file})`);
    if (r.status === 'fail' && r.diffs) {
      for (const d of r.diffs) console.log(`        - ${d.path}: ${d.msg}`);
    }
    if (r.status === 'error') console.log(`        ! ${r.message}`);
  }
  console.log(`\nPass ${pass} / Fail ${fail} / Error ${err}  (total ${results.length})`);
}
