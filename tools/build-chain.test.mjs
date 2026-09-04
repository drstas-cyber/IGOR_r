import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILD_STEPS, runBuild, PROJECT_ROOT } from './run-build.mjs';

// Regression tests for the build chain's failure semantics.
//
// HISTORY, and why this file was rewritten on 2026-09-04 (Phase 6A1):
//
// The original incident (eac8380) was that package.json's build script read
// "A && B || true && C && D && E". Because && and || share left-to-right
// precedence that parses as "((A && B) || true) && C ...", so a failure of
// A (fetch-blog-data.js) was swallowed and vite build ran anyway on stale
// data. The first version of this file caught that by substituting cheap
// stand-ins into the real script string and running it through
// `spawnSync(..., { shell: true })`.
//
// That approach had a blind spot that only shows on Windows: it tested the
// behavior of whatever shell the test machine happened to provide. The
// `|| true` construct needs a `true` EXECUTABLE, which Windows does not
// have -- so on a clean Windows box the build chain breaks, while on a
// developer machine with Git for Windows installed it silently works,
// because Git ships /usr/bin/true and npm hands the script to cmd.exe,
// which finds true.exe on PATH. Verified 2026-09-04 on this machine:
// `which -a true` -> /usr/bin/true, /bin/true, and the old test passed
// green here for exactly that reason. A test that passes because of an
// unrelated tool's PATH entry is not testing what it claims to.
//
// So the shell is gone (tools/run-build.mjs), and with it this file's
// dependency on one. Every test below injects a fake `run` and asserts on
// the returned structure. Consequences that matter:
//
//   - No process is spawned. Not vite, not fetch-blog-data, nothing.
//   - No tracked file is read for its content or written, ever. The real
//     build's first step rewrites src/data/blog-articles.json; this suite
//     cannot reach it, by construction rather than by care.
//   - The results are identical on win32, darwin and linux, because there
//     is no platform-specific mechanism left to differ.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// makeRun -- a fake spawner. `exits` maps step name -> exit code (default
// 0). Records call order so ordering assertions read directly off it.
function makeRun(exits = {}) {
  const calls = [];
  const run = (step) => {
    calls.push(step.name);
    return { status: exits[step.name] ?? 0, error: null };
  };
  return { run, calls };
}

const silent = { log: () => {}, warn: () => {} };

describe('build chain -- step order and shape', () => {
  test('the five steps run in exactly the documented order', () => {
    const { run, calls } = makeRun();
    const result = runBuild({ run, ...silent });
    assert.equal(result.ok, true);
    assert.deepEqual(calls, [
      'fetch-blog-data',
      'generate-llms',
      'vite build',
      'seo-prerender',
      'version-stamp',
    ]);
  });

  test('generate-llms is the ONLY non-fatal step', () => {
    const nonFatal = BUILD_STEPS.filter((s) => !s.fatal).map((s) => s.name);
    assert.deepEqual(
      nonFatal,
      ['generate-llms'],
      'widening the non-fatal set silently would let a real build failure ship; add it here deliberately or not at all',
    );
  });

  test('every step is a Node script -- no binaries, shims or shell builtins', () => {
    for (const step of BUILD_STEPS) {
      assert.match(step.script, /\.(js|mjs)$/, `${step.name} must be a JS file executed by process.execPath`);
    }
  });

  // Non-mutating proof that the chain would actually run: every script
  // path must exist on disk. A typo in BUILD_STEPS (or a dependency
  // reshuffle that moves vite's entry) would otherwise only surface on a
  // real deploy build, which this suite deliberately never runs.
  test('every step script exists on disk', () => {
    for (const step of BUILD_STEPS) {
      const abs = path.join(PROJECT_ROOT, step.script);
      assert.ok(fs.existsSync(abs), `${step.name}: ${step.script} does not exist -- the real build would fail here`);
    }
  });

  test('vite runs via its own JS entry, not a .bin shim', () => {
    const vite = BUILD_STEPS.find((s) => s.name === 'vite build');
    assert.ok(vite, 'the vite build step must exist');
    assert.equal(vite.script, 'node_modules/vite/bin/vite.js');
    assert.doesNotMatch(vite.script, /\.bin/, 'a .bin shim reintroduces PATHEXT and quoting rules on Windows');
    assert.deepEqual(vite.args, ['build']);
  });
});

describe('build chain -- fatal steps abort, non-fatal does not', () => {
  test('fetch-blog-data failure is FATAL and nothing after it runs (the eac8380 regression)', () => {
    const { run, calls } = makeRun({ 'fetch-blog-data': 1 });
    const result = runBuild({ run, ...silent });
    assert.equal(result.ok, false);
    assert.equal(result.failed.name, 'fetch-blog-data');
    assert.deepEqual(calls, ['fetch-blog-data'], 'vite build must NOT run on stale data after a fetch failure');
  });

  test('generate-llms failure is NON-FATAL: the chain completes and every later step still runs', () => {
    const { run, calls } = makeRun({ 'generate-llms': 1 });
    const result = runBuild({ run, ...silent });
    assert.equal(result.ok, true, 'a best-effort step must never fail the build');
    assert.equal(result.failed, null);
    assert.deepEqual(calls, [
      'fetch-blog-data',
      'generate-llms',
      'vite build',
      'seo-prerender',
      'version-stamp',
    ]);
  });

  test('vite build failure is FATAL and stops seo-prerender/version-stamp', () => {
    const { run, calls } = makeRun({ 'vite build': 1 });
    const result = runBuild({ run, ...silent });
    assert.equal(result.ok, false);
    assert.equal(result.failed.name, 'vite build');
    assert.deepEqual(calls, ['fetch-blog-data', 'generate-llms', 'vite build']);
  });

  test('seo-prerender failure is FATAL and stops version-stamp', () => {
    const { run, calls } = makeRun({ 'seo-prerender': 1 });
    const result = runBuild({ run, ...silent });
    assert.equal(result.ok, false);
    assert.equal(result.failed.name, 'seo-prerender');
    assert.deepEqual(calls, ['fetch-blog-data', 'generate-llms', 'vite build', 'seo-prerender']);
  });

  test('version-stamp failure is FATAL', () => {
    const { run } = makeRun({ 'version-stamp': 1 });
    const result = runBuild({ run, ...silent });
    assert.equal(result.ok, false);
    assert.equal(result.failed.name, 'version-stamp');
  });

  test('a non-fatal generate-llms failure does NOT mask a later fatal failure', () => {
    // The exact bug the original "|| true" precedence created, asserted in
    // the new shape: tolerating one step must absorb that step's exit code
    // and nothing else.
    const { run } = makeRun({ 'generate-llms': 1, 'vite build': 1 });
    const result = runBuild({ run, ...silent });
    assert.equal(result.ok, false, 'a real tail failure must still fail the build');
    assert.equal(result.failed.name, 'vite build');
    assert.equal(result.warnings.length, 1, 'the tolerated step is still reported as a warning');
  });

  test('a step that cannot be spawned at all (ENOENT) is treated as a failure, not a success', () => {
    const run = (step) =>
      step.name === 'seo-prerender'
        ? { status: 1, error: Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' }) }
        : { status: 0, error: null };
    const result = runBuild({ run, ...silent });
    assert.equal(result.ok, false);
    assert.equal(result.failed.name, 'seo-prerender');
    assert.match(result.failed.reason, /ENOENT/);
  });
});

describe('build chain -- the non-fatal warning is explicit', () => {
  test('the warning names the step, the exit code, and why it is tolerated', () => {
    const { run } = makeRun({ 'generate-llms': 1 });
    const warnings = [];
    runBuild({ run, log: () => {}, warn: (m) => warnings.push(m) });
    const text = warnings.join('\n');
    assert.match(text, /generate-llms/, 'must name the step');
    assert.match(text, /exit code 1/, 'must give the exit code');
    assert.match(text, /non-fatal/i, 'must say it is tolerated');
    assert.match(text, /llms\.txt/, 'must say WHY it is tolerated, not just that it is');
    assert.match(text, /continues/i, 'must state the build carries on');
  });

  test('a fatal failure says the build is aborting and that later steps will not run', () => {
    const { run } = makeRun({ 'vite build': 1 });
    const warnings = [];
    runBuild({ run, log: () => {}, warn: (m) => warnings.push(m) });
    const text = warnings.join('\n');
    assert.match(text, /FATAL/);
    assert.match(text, /vite build/);
    assert.match(text, /no further steps/i);
  });

  test('a clean run emits no warnings at all', () => {
    const { run } = makeRun();
    const warnings = [];
    const result = runBuild({ run, log: () => {}, warn: (m) => warnings.push(m) });
    assert.deepEqual(warnings, []);
    assert.deepEqual(result.warnings, []);
  });
});

// ---------------------------------------------------------------------------
// PORTABILITY GUARDS. These assert on package.json's text so the shell
// construct cannot come back -- the failure mode is silent on any machine
// with Git for Windows installed, so a human reviewer will not reliably
// catch its return.
// ---------------------------------------------------------------------------
describe('package.json build script -- no shell dependency may return', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));
  const buildScript = pkg.scripts.build;

  test('the build script delegates to the Node orchestrator', () => {
    assert.equal(buildScript, 'node tools/run-build.mjs');
  });

  test('no "|| true" anywhere in the build script', () => {
    assert.doesNotMatch(buildScript, /\|\|\s*true/, 'the Unix `true` executable does not exist on Windows');
  });

  test('no shell operators (&&, ||, parentheses, pipes) in the build script', () => {
    assert.doesNotMatch(buildScript, /&&|\|\||[()|]/, 'chaining belongs in run-build.mjs, not in a shell string');
  });

  // stripComments -- these two guards must inspect CODE, not prose. Both
  // files below discuss `shell: true` and spawnSync at length in their own
  // header comments (explaining the bug being fixed), and a naive text
  // match flags those explanations as violations. Caught on the first run
  // of this suite, 2026-09-04. Block comments and whole-line // comments
  // are removed; trailing // is deliberately NOT stripped, so a `https://`
  // inside a string literal can never be mangled.
  function stripComments(src) {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');
  }

  test('run-build.mjs itself never uses shell: true', () => {
    const code = stripComments(fs.readFileSync(path.join(__dirname, 'run-build.mjs'), 'utf8'));
    assert.doesNotMatch(
      code,
      /shell:\s*true/,
      'shell: true reintroduces cmd.exe/sh differences, which is the entire bug being fixed',
    );
  });

  test('this test file spawns nothing -- no child_process import at all', () => {
    // The guard on the guard: if a future edit reaches for spawnSync here,
    // the suite is back to testing the host machine's shell instead of the
    // orchestrator, and could touch real build outputs.
    // The forbidden tokens are ASSEMBLED at runtime, never written as
    // contiguous literals. This file reads its own source, so a literal
    // /spawnSync/ inside the assertion matches itself and fails the very
    // guard it implements -- caught on the second run of this suite,
    // 2026-09-04. Same self-reference trap as the comment-matching one
    // above, one layer deeper.
    const forbiddenSpawn = new RegExp(['spawn' + 'Sync', 'exec' + 'Sync', 'spawn' + '\\('].join('|'));
    const forbiddenImport = new RegExp('node:' + 'child_process');
    const code = stripComments(fs.readFileSync(path.join(__dirname, 'build-chain.test.mjs'), 'utf8'));
    assert.doesNotMatch(code, forbiddenImport, 'these tests must never spawn a process');
    assert.doesNotMatch(code, forbiddenSpawn, 'these tests must never spawn a process');
  });
});
