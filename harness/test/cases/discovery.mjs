// Self-test for the discovery mechanism itself.
// Without this, a regression in discover.mjs would silently hide all groups
// and the self-test would falsely report "0 fail" — defeating the safety net.

import { discoverGroups, CASE_EXPORT_PATTERN } from '../lib/discover.mjs';

export async function runDiscoveryCases() {
  const results = [];

  // 1. discoverGroups returns at least one group from the real cases dir.
  {
    const { groups, error } = await discoverGroups();
    if (error) {
      results.push({ ok: false, name: 'real cases dir is readable', message: error });
    } else if (groups.length === 0) {
      results.push({
        ok: false,
        name: 'real cases dir has at least one group',
        message: 'discovered 0 groups — convention broken or cases dir empty',
      });
    } else {
      results.push({ ok: true, name: `real cases dir has ${groups.length} group(s)` });
    }
  }

  // 2. Each discovered group exposes the contract: { name, run, source }.
  {
    const { groups } = await discoverGroups();
    const broken = groups.filter(
      (g) => typeof g.name !== 'string' || typeof g.run !== 'function' || typeof g.source !== 'string'
    );
    if (broken.length === 0) {
      results.push({ ok: true, name: 'all groups expose name / run / source' });
    } else {
      results.push({
        ok: false,
        name: 'all groups expose name / run / source',
        message: `${broken.length} group(s) malformed: ${broken.map((g) => g.name).join(', ')}`,
      });
    }
  }

  // 3. discoverGroups gracefully handles a missing dir (returns empty + error,
  //    not a thrown exception).
  {
    const { groups, error } = await discoverGroups({ casesDir: '/__definitely_no_such_dir__' });
    const ok = groups.length === 0 && typeof error === 'string';
    results.push({
      ok,
      name: 'missing cases dir → empty groups + error string',
      message: ok ? undefined : `groups=${groups.length}, error=${error}`,
    });
  }

  // 4. Convention regex accepts the canonical names and rejects misnamed ones.
  //    Without this, a typo like "runFoo" (lowercase) would silently drop the group.
  {
    const accepts = ['runFooCases', 'runDiscoveryCases', 'runABCases', 'runZCases'];
    const rejects = ['runfooCases', 'RunFooCases', 'runFooCase', 'runFoo', 'foo', ''];
    const acceptFails = accepts.filter((n) => !CASE_EXPORT_PATTERN.test(n));
    const rejectFails = rejects.filter((n) => CASE_EXPORT_PATTERN.test(n));
    const ok = acceptFails.length === 0 && rejectFails.length === 0;
    results.push({
      ok,
      name: 'CASE_EXPORT_PATTERN matches conventional names only',
      message: ok
        ? undefined
        : `accept-but-rejected: [${acceptFails.join(', ')}]; reject-but-accepted: [${rejectFails.join(', ')}]`,
    });
  }

  // 5. Group label is derived from the FILENAME, not the export name. Catches the
  //    accidental case where someone names a file like "runFooCases.mjs" (matching
  //    the export pattern), which would mask whether the label came from filename
  //    or export. Filenames must look like filenames (kebab-case, no Cases suffix).
  {
    const { groups } = await discoverGroups();
    const labelLeak = groups.filter((g) => CASE_EXPORT_PATTERN.test(g.name));
    results.push({
      ok: labelLeak.length === 0,
      name: 'group label uses filename, not export name',
      message:
        labelLeak.length === 0
          ? undefined
          : `groups whose filename matches the export pattern (ambiguous): ${labelLeak
              .map((g) => g.name)
              .join(', ')}`,
    });
  }

  return results;
}
