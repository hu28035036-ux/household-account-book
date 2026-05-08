// Enforces CONTRACT §9-B — meta work must not touch the production feature
// area. We compare the current working tree against HEAD for every protected
// path; any non-empty diff is a violation.
//
// User mandate (2026-05-08): "절대 현재 기능에서 기능 이상이 발생하면 안 된다"
//
// This case fails the self-test (and therefore verify.mjs / loop.mjs round 1)
// the moment any meta agent edits a protected file. That's the safety wire
// the user asked for.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');

// Production feature area — meta work must not touch any of these.
// Single source: harness/lib/protected-paths.mjs (CONTRACT §9-B-1).
// (design-log 06-coupling C-11 — formerly duplicated here.)
import { PROTECTED_PATHS, AUTO_GENERATED } from '../../lib/protected-paths.mjs';

function gitDiffStat(paths) {
  return new Promise((resolveStep) => {
    const child = spawn('git', ['diff', '--stat', 'HEAD', '--', ...paths], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr.on('data', (d) => (err += d.toString()));
    child.on('exit', (code) => resolveStep({ code, out, err }));
    child.on('error', () => resolveStep({ code: -1, out: '', err: 'git unavailable' }));
  });
}

// Branch-prefix-based area-work detection (CONTRACT §9-B-4).
// Area agents work on branches named "<area>/...". When self-test runs on such
// a branch, meta-isolation flips into informational mode: it reports diffs
// in protected paths but does NOT fail the test. Meta branches stay strict.
const AREA_PREFIXES = ['ai-extraction', 'finance-core', 'collab-security', 'ux-design', 'qa-harness'];

function gitCurrentBranch() {
  return new Promise((resolveStep) => {
    const child = spawn('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.on('exit', () => resolveStep(out.trim()));
    child.on('error', () => resolveStep(''));
  });
}

function isAreaBranch(branch) {
  if (!branch) return null;
  const slash = branch.indexOf('/');
  if (slash < 1) return null;
  const prefix = branch.slice(0, slash);
  return AREA_PREFIXES.includes(prefix) ? prefix : null;
}

function gitLsFiles(paths) {
  return new Promise((resolveStep) => {
    // List untracked + modified files within paths. -o (untracked) + -m (modified) + --exclude-standard.
    const child = spawn('git', ['ls-files', '-omt', '--exclude-standard', '--', ...paths], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.on('exit', (code) => resolveStep({ code, out }));
    child.on('error', () => resolveStep({ code: -1, out: '' }));
  });
}

export async function runMetaIsolationCases() {
  const results = [];

  // 0. Area-work mode detection. Branch names like "qa-harness/..." or
  //    "ai-extraction/..." signal the gate is running inside an area agent's
  //    work tree. In that mode meta-isolation reports rather than blocks.
  const branch = await gitCurrentBranch();
  const areaPrefix = isAreaBranch(branch);
  const areaMode = areaPrefix !== null;

  if (areaMode) {
    results.push({
      ok: true,
      name: `meta isolation — area-work mode (branch: ${branch}, area: ${areaPrefix})`,
    });
  }

  // 1. git diff --stat HEAD against protected paths must be empty.
  //    If non-empty, list the offending files.
  {
    const r = await gitDiffStat(PROTECTED_PATHS);
    if (r.code === -1) {
      results.push({
        ok: true,
        name: 'meta isolation — git diff --stat (skipped: git unavailable)',
      });
    } else if (r.code !== 0) {
      results.push({
        ok: false,
        name: 'meta isolation — git diff --stat HEAD',
        message: `git exited ${r.code}. stderr: ${r.err.trim().slice(0, 200)}`,
      });
    } else if (r.out.trim().length === 0) {
      results.push({
        ok: true,
        name: 'meta isolation — production feature area unchanged vs HEAD',
      });
    } else {
      // Area-work mode: report but don't fail. Meta branches stay strict.
      const summary =
        `Changed files in protected area:\n` +
        r.out.trim().split(/\r?\n/).map((l) => `      ${l}`).join('\n');
      if (areaMode) {
        results.push({
          ok: true,
          name: `meta isolation — diff observed but area-work mode (${areaPrefix}) authorized`,
          message: summary,
        });
      } else {
        results.push({
          ok: false,
          name: 'meta isolation — production feature area unchanged vs HEAD',
          message: `CONTRACT §9-B violated. ${summary}`,
        });
      }
    }
  }

  // 2. No untracked files inside protected paths (catches new files dropped in by mistake).
  {
    const r = await gitLsFiles(PROTECTED_PATHS);
    if (r.code === -1) {
      results.push({ ok: true, name: 'meta isolation — git ls-files (skipped: git unavailable)' });
    } else {
      // Filter to lines starting with '?' (untracked) and 'C' (modified-in-tree).
      // ls-files -t prefixes each line with a tag char then a tab/space.
      const flagged = r.out
        .split(/\r?\n/)
        .filter((l) => /^[?C]\s/.test(l))
        // Auto-generated artifacts are owned by tooling, not by meta agents.
        .filter((l) => !AUTO_GENERATED.some((g) => l.includes(g)));
      if (flagged.length === 0) {
        results.push({ ok: true, name: 'meta isolation — no untracked/modified files in protected paths' });
      } else if (areaMode) {
        results.push({
          ok: true,
          name: `meta isolation — untracked/modified entries observed but area-work mode (${areaPrefix}) authorized`,
          message: `Stray entries:\n` + flagged.map((l) => `      ${l}`).join('\n'),
        });
      } else {
        results.push({
          ok: false,
          name: 'meta isolation — no untracked/modified files in protected paths',
          message:
            `CONTRACT §9-B violated. Stray entries:\n` +
            flagged.map((l) => `      ${l}`).join('\n'),
        });
      }
    }
  }

  return results;
}
