#!/usr/bin/env node
/* eslint-disable no-console */
// CROSS-PLATFORM BUILD ORCHESTRATOR — Phase 6A1, 2026-09-04.
//
// Replaces the shell-dependent build script that used to live in
// package.json:
//
//   node tools/fetch-blog-data.js && (node tools/generate-llms.js || true)
//     && vite build && node tools/seo-prerender.js && node tools/version-stamp.js
//
// TWO PROBLEMS WITH THAT LINE, both fixed here.
//
// 1. `|| true` needs a `true` executable. On Windows there isn't one in the
//    OS. It happens to work on THIS machine only because Git for Windows
//    ships /usr/bin/true and that directory is on PATH -- verified
//    2026-09-04: `which -a true` resolves to /usr/bin/true and /bin/true,
//    and npm hands the script to cmd.exe, which then finds true.exe by
//    PATH lookup. Take Git-for-Windows off PATH (a clean Windows box, a
//    Windows CI runner, a PowerShell-launched build) and the parenthesised
//    group fails, which under cmd.exe's `&&` chain aborts the build.
//    The dependency is invisible precisely because it accidentally works
//    wherever a developer has git installed.
//
// 2. `vite build` resolved through npm's PATH shims. On Windows that means
//    node_modules/.bin/vite.cmd (or .ps1), which drags in shell quoting
//    and PATHEXT rules. This module never resolves a shim: it runs Vite's
//    own JS entry (node_modules/vite/bin/vite.js) with process.execPath,
//    the same way it runs every other step.
//
// The result is that EVERY step is `process.execPath <script> [args]` --
// one spawn shape, no shell, no quoting rules, no PATH lookup, identical
// on win32/darwin/linux. `shell: true` is never used anywhere in this file.
//
// SEMANTICS ARE UNCHANGED from the shell version, and that is the point:
// this is a portability fix, not a behavior change. Exactly one step
// (generate-llms) is non-fatal; every other step aborts the build on a
// non-zero exit, and no step runs after an aborted one.
//
// PURE CORE, thin CLI shell -- the same split the rest of tools/ uses. The
// step list and the runner are exported and the spawn function is
// injectable, so build-chain.test.mjs can exercise every ordering and
// failure branch without spawning a single real process. That matters more
// than usual here: the previous test drove the real shell string through
// `spawnSync(..., { shell: true })`, which is exactly the mechanism under
// test, so it could only ever confirm the behavior of whatever shell the
// test machine happened to have.
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(__dirname, '..');

// BUILD_STEPS -- the chain, in order. `script` is repo-relative and is
// always a JavaScript file executed by Node; there are deliberately no
// binaries, shims or shell builtins in this list.
//
// `fatal: false` appears exactly once. If a future step needs to be
// non-fatal, it must be added here explicitly -- build-chain.test.mjs
// asserts that generate-llms is the ONLY non-fatal step, so widening this
// silently is a red test rather than a silent loosening of the build's
// failure guarantees.
export const BUILD_STEPS = [
  {
    name: 'fetch-blog-data',
    script: 'tools/fetch-blog-data.js',
    args: [],
    fatal: true,
  },
  {
    name: 'generate-llms',
    script: 'tools/generate-llms.js',
    args: [],
    fatal: false,
    // Best-effort by design: llms.txt is a nice-to-have discovery file and
    // has never been a release blocker. Its failure must not cost a deploy.
    nonFatalReason: 'llms.txt is a best-effort discovery file; its absence never blocks a deploy',
  },
  {
    name: 'vite build',
    script: 'node_modules/vite/bin/vite.js',
    args: ['build'],
    fatal: true,
  },
  {
    name: 'seo-prerender',
    script: 'tools/seo-prerender.js',
    args: [],
    fatal: true,
  },
  {
    name: 'version-stamp',
    script: 'tools/version-stamp.js',
    args: [],
    fatal: true,
  },
];

// defaultRun -- the only place a process is actually spawned. No `shell`
// option is passed (Node defaults it to false), so the script path is
// handed to the OS as a single argv entry and never parsed by a shell.
// Spaces in the repo path are therefore safe without any quoting, which is
// the other thing the old string could not promise on Windows.
export function defaultRun(step, { cwd = PROJECT_ROOT } = {}) {
  const result = spawnSync(process.execPath, [path.join(cwd, step.script), ...(step.args || [])], {
    cwd,
    stdio: 'inherit',
  });
  // A spawn that never started (ENOENT, EACCES) has status === null. Treat
  // it as a failure with a synthetic non-zero code rather than letting
  // `null !== 0` decide it implicitly -- an unreadable step is a failed
  // step, and the caller should see a real reason string.
  if (result.error) {
    return { status: result.status === null ? 1 : result.status, error: result.error };
  }
  return { status: result.status === null ? 1 : result.status, error: null };
}

// runBuild (exported, pure apart from the injected `run`) -- executes the
// chain in order and returns a structured result. Never calls
// process.exit(): the CLI shell at the bottom owns the exit code, so tests
// can call this directly without killing the test runner.
export function runBuild({
  steps = BUILD_STEPS,
  run = defaultRun,
  log = console.log,
  warn = console.error,
  cwd = PROJECT_ROOT,
} = {}) {
  const ran = [];
  const warnings = [];

  for (const step of steps) {
    log(`[build] ${step.name}...`);
    const { status, error } = run(step, { cwd });
    ran.push(step.name);

    if (status === 0) continue;

    if (step.fatal) {
      // Abort immediately. Nothing after a fatal step runs -- same as the
      // shell chain's `&&`, and the reason a broken fetch-blog-data must
      // never let vite build ship stale data (the eac8380 incident).
      const reason = error ? `${error.code || error.name}: ${error.message}` : `exit code ${status}`;
      warn(`[build] FATAL: ${step.name} failed (${reason}). Aborting the build; no further steps will run.`);
      return { ok: false, ran, warnings, failed: { name: step.name, status, reason } };
    }

    // Non-fatal: warn loudly, keep going. The message names the step, the
    // exit code, and WHY it is tolerated, so a reader of CI output never
    // has to guess whether this was supposed to be survivable.
    const message =
      `[build] WARNING: ${step.name} failed (exit code ${status}) but is non-fatal -- ` +
      `${step.nonFatalReason || 'this step is best-effort'}. The build continues.`;
    warn(message);
    warnings.push({ name: step.name, status, message });
  }

  return { ok: true, ran, warnings, failed: null };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const result = runBuild();
  if (!result.ok) {
    process.exitCode = 1;
  } else if (result.warnings.length > 0) {
    // Still exit 0 -- a non-fatal warning must not fail the build -- but
    // restate it at the end so it is visible in a long CI log's tail.
    console.error(`[build] completed with ${result.warnings.length} non-fatal warning(s).`);
  } else {
    console.log('[build] all steps completed successfully.');
  }
}
