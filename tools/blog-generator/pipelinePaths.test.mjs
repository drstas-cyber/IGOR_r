// THE TABLE CANNOT LIE — verification for pipelinePaths.mjs.
//
// A path table is worthless the moment it drifts from the code. These
// tests make drift a build failure rather than a discovery:
//
//   1. STRUCTURAL — every row is well-formed, ids unique, kinds/categories
//      from the closed sets, and every row has exactly one of
//      `forcing` or `watchdog` (never both, never neither).
//   2. THE FORCING TEST REALLY EXISTS — every `forcing.test` string is
//      found in the file `forcing.file` names. A renamed or deleted test
//      cannot leave a row silently claiming coverage.
//   3. COVERAGE AGAINST REAL SOURCE — every `report.outcome = '...'`
//      literal in generate.mjs, every early-exit `outcome:` in a
//      writeReport call, every `kind === '...'` branch in
//      buildNotificationEmailCli.mjs, and every failureClass in
//      handleTrippedGate() must appear in the table. Add a branch to the
//      code without enumerating it here and this suite goes red.
//
// (3) is the one that matters most. (1) and (2) keep the table honest
// about what it already claims; (3) is what stops the pipeline from
// quietly growing a new unfired path six months from now.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PIPELINE_PATHS,
  FORCING_KINDS,
  CATEGORIES,
  coveredOutcomes,
  coveredEmailKinds,
  unforcedPaths,
  weakestProofPaths,
} from './pipelinePaths.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, '..', '..');

function readSource(relOrBare) {
  // A `forcing.file` is either repo-relative (workflows, actions) or a
  // bare filename in this directory (test files).
  const candidate = relOrBare.includes('/')
    ? path.join(PROJECT_ROOT, relOrBare)
    : path.join(HERE, relOrBare);
  // Normalised to LF -- see promptGatePairs.test.mjs for why (CRLF on a
  // Windows checkout, LF on the CI runner; a matcher must not care).
  return fs.readFileSync(candidate, 'utf8').replace(/\r\n/g, '\n');
}

describe('pipelinePaths — structural integrity', () => {
  test('every row has a unique id', () => {
    const ids = PIPELINE_PATHS.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length, `duplicate id(s): ${ids.filter((id, i) => ids.indexOf(id) !== i)}`);
  });

  test('every row has a category from the closed set', () => {
    for (const p of PIPELINE_PATHS) {
      assert.ok(CATEGORIES.has(p.category), `${p.id}: unknown category "${p.category}"`);
    }
  });

  test('every row has exactly one of forcing or watchdog — never both, never neither', () => {
    for (const p of PIPELINE_PATHS) {
      const hasForcing = Boolean(p.forcing);
      const hasWatchdog = Boolean(p.watchdog);
      assert.ok(
        hasForcing !== hasWatchdog,
        `${p.id} ("${p.name}"): must declare exactly one of forcing/watchdog (forcing=${hasForcing}, watchdog=${hasWatchdog}). A path with neither is an unfired path hiding in the table.`,
      );
    }
  });

  test('every forcing declares a kind from the closed set, a file, and a test', () => {
    for (const p of PIPELINE_PATHS.filter((x) => x.forcing)) {
      assert.ok(FORCING_KINDS.has(p.forcing.kind), `${p.id}: unknown forcing kind "${p.forcing.kind}"`);
      assert.ok(p.forcing.file, `${p.id}: forcing.file is required`);
      assert.ok(p.forcing.test, `${p.id}: forcing.test is required`);
    }
  });

  test('every watchdog names the workflow, the schedule, and what it detects', () => {
    for (const p of unforcedPaths()) {
      assert.ok(p.watchdog.workflow, `${p.id}: watchdog.workflow is required`);
      assert.ok(p.watchdog.schedule, `${p.id}: watchdog.schedule is required`);
      assert.ok(p.watchdog.detects, `${p.id}: watchdog.detects is required — "there is a watchdog" is not a detection story`);
    }
  });

  test('every row records a lastObserved date or an explicit reason it has none', () => {
    for (const p of PIPELINE_PATHS) {
      assert.ok(p.lastObserved, `${p.id}: lastObserved is required`);
    }
  });
});

describe('pipelinePaths — every forcing test actually exists', () => {
  test('each forcing.test string is present in the file forcing.file names', () => {
    const missing = [];
    for (const p of PIPELINE_PATHS.filter((x) => x.forcing)) {
      let src;
      try {
        src = readSource(p.forcing.file);
      } catch (err) {
        missing.push(`${p.id}: file "${p.forcing.file}" could not be read (${err.code || err.message})`);
        continue;
      }
      if (!src.includes(p.forcing.test)) {
        missing.push(`${p.id}: "${p.forcing.test}" not found in ${p.forcing.file}`);
      }
    }
    assert.deepEqual(missing, [], `path table claims coverage that does not exist:\n${missing.join('\n')}`);
  });

  test('every watchdog workflow file exists on disk', () => {
    for (const p of unforcedPaths()) {
      const wf = path.join(PROJECT_ROOT, '.github', 'workflows', `${p.watchdog.workflow}.yml`);
      assert.ok(fs.existsSync(wf), `${p.id}: watchdog workflow ${p.watchdog.workflow}.yml does not exist — the detection story is fiction`);
    }
  });
});

// ---------------------------------------------------------------------------
// COVERAGE AGAINST REAL SOURCE. These parse the actual implementation
// files rather than a copy of what they used to say.
// ---------------------------------------------------------------------------
describe('pipelinePaths — coverage against the real source', () => {
  test('every outcome generate.mjs can set is enumerated in the table', () => {
    const src = readSource('tools/blog-generator/generate.mjs');
    const assigned = [...src.matchAll(/report\.outcome\s*=\s*'([a-z_]+)'/g)].map((m) => m[1]);
    const earlyExit = [...src.matchAll(/outcome:\s*'([a-z_]+)'/g)].map((m) => m[1]);
    const all = new Set([...assigned, ...earlyExit]);
    // 'null' initialization and the report shape's own key are not outcomes.
    all.delete('null');
    const covered = coveredOutcomes();
    const uncovered = [...all].filter((o) => !covered.has(o));
    assert.deepEqual(
      uncovered,
      [],
      `generate.mjs can produce outcome(s) with no row in pipelinePaths.mjs: ${uncovered.join(', ')}. Add a row AND a forcing test — an outcome with no path row is by definition an unfired path.`,
    );
  });

  test('the table claims no outcome generate.mjs cannot actually produce', () => {
    const src = readSource('tools/blog-generator/generate.mjs');
    const real = new Set([
      ...[...src.matchAll(/report\.outcome\s*=\s*'([a-z_]+)'/g)].map((m) => m[1]),
      ...[...src.matchAll(/outcome:\s*'([a-z_]+)'/g)].map((m) => m[1]),
    ]);
    for (const claimed of coveredOutcomes()) {
      if (claimed.startsWith('(')) continue; // explicit "no outcome written" rows
      assert.ok(real.has(claimed), `pipelinePaths.mjs enumerates outcome "${claimed}" that generate.mjs never sets — a stale row`);
    }
  });

  test('every email kind buildNotificationEmailCli.mjs handles is enumerated', () => {
    const src = readSource('tools/blog-generator/buildNotificationEmailCli.mjs');
    const kinds = new Set([...src.matchAll(/kind === '([a-z-]+)'/g)].map((m) => m[1]));
    assert.ok(kinds.size >= 5, `expected at least the five known email kinds, parsed: ${[...kinds]}`);
    const covered = coveredEmailKinds();
    const uncovered = [...kinds].filter((k) => !covered.has(k));
    assert.deepEqual(uncovered, [], `email kind(s) with no row in pipelinePaths.mjs: ${uncovered.join(', ')}`);
  });

  test('every failureClass handleTrippedGate can write is enumerated as an outcome row', () => {
    const src = readSource('tools/blog-generator/generate.mjs');
    const m = src.match(/FAILURE_CLASSES\s*=\s*new Set\(\[([^\]]*)\]\)/);
    assert.ok(m, 'could not locate FAILURE_CLASSES in generate.mjs');
    const classes = [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
    const covered = coveredOutcomes();
    for (const c of classes) {
      assert.ok(covered.has(c), `failureClass "${c}" has no path row`);
    }
  });

  test('every generator workflow that exists is represented by at least one row', () => {
    const wfDir = path.join(PROJECT_ROOT, '.github', 'workflows');
    const generatorWorkflows = fs
      .readdirSync(wfDir)
      .filter((f) => ['generate-article.yml', 'publish-on-merge.yml', 'weekly-retro.yml', 'test-email-notifications.yml'].includes(f));
    const referenced = new Set(
      PIPELINE_PATHS.flatMap((p) => [p.forcing?.file, p.watchdog ? `${p.watchdog.workflow}.yml` : null])
        .filter(Boolean)
        .map((f) => path.basename(f)),
    );
    for (const wf of generatorWorkflows) {
      assert.ok(referenced.has(wf), `workflow ${wf} is not referenced by any path row — its branches are unenumerated`);
    }
  });
});

describe('pipelinePaths — honesty about weak proof', () => {
  test('every static-only row explains why it cannot be executed and what detects a real failure', () => {
    for (const p of weakestProofPaths()) {
      assert.ok(
        p.note && /STATIC ONLY/.test(p.note),
        `${p.id}: a static-only row must carry a note beginning "STATIC ONLY" saying what does NOT get executed and what covers it instead`,
      );
    }
  });

  test('the unforced set is exactly the paths genuinely outside our control (cron drops, human inaction)', () => {
    const ids = unforcedPaths().map((p) => p.id).sort();
    assert.deepEqual(
      ids,
      ['CRON-02', 'CRON-03', 'CRON-05', 'HUM-05'],
      'the set of unforceable paths changed. That is either real progress (something became forceable — remove it from the watchdog set) or a regression (something forced became unforceable). Either way it is a deliberate decision, not a drift.',
    );
  });
});
