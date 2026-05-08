// C-05: enforce that masking adapter has MIRROR_DATE / MIRROR_SOURCE markers.
// If src/lib/security/masking.ts is ever updated, the adapter must follow.
// Without these markers in place we can't even tell whether the adapter is stale.

import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');

const ADAPTER_PATH = resolve(ROOT, 'harness/lib/adapters/masking.mjs');
const SOURCE_PATH = resolve(ROOT, 'src/lib/security/masking.ts');

function ok(name, cond, message) {
  return cond ? { ok: true, name } : { ok: false, name, message: message ?? 'condition false' };
}

export async function runMaskingMirrorCases() {
  const results = [];

  let adapterText;
  try {
    adapterText = await readFile(ADAPTER_PATH, 'utf8');
  } catch (err) {
    return [{ ok: false, name: 'adapter file readable', message: err.message }];
  }

  const dateMatch = adapterText.match(/MIRROR_DATE:\s*(\d{4}-\d{2}-\d{2})/);
  const sourceMatch = adapterText.match(/MIRROR_SOURCE:\s*([^\s]+)/);

  results.push(ok('adapter declares MIRROR_DATE', !!dateMatch, 'no MIRROR_DATE marker found'));
  results.push(ok('adapter declares MIRROR_SOURCE', !!sourceMatch, 'no MIRROR_SOURCE marker found'));

  if (dateMatch && sourceMatch) {
    // If the source file exists, warn (not fail) when its mtime is newer than MIRROR_DATE.
    // We do not fail because the adapter might just need a date bump — but the signal is real.
    let srcStat;
    try {
      srcStat = await stat(SOURCE_PATH);
    } catch {
      srcStat = null;
    }
    if (srcStat) {
      const mirrorDate = new Date(dateMatch[1] + 'T00:00:00Z');
      const srcMtime = srcStat.mtime;
      // Allow 1 day grace so a same-day commit before adapter bump doesn't trip.
      const stale = srcMtime.getTime() - mirrorDate.getTime() > 24 * 60 * 60 * 1000;
      results.push({
        ok: !stale,
        name: 'adapter MIRROR_DATE not older than source mtime',
        message: stale
          ? `src mtime ${srcMtime.toISOString().slice(0, 10)} > MIRROR_DATE ${dateMatch[1]} — adapter may be stale, review and bump`
          : undefined,
      });
    } else {
      // Source file not present — informational, not a failure.
      results.push({ ok: true, name: 'mirror source file present (skipped — src missing)' });
    }
  }

  return results;
}
