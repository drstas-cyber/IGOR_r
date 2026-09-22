import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkRejectedMarker, isUnmergedStatus, parsePorcelainZ } from './checkRejectedMarker.mjs';
import { handleTrippedGate, loadQuarantineState } from './generate.mjs';
import { getMergedMarkerTopics, pickNextEligibleTopic } from './topicAvailability.mjs';

// Fixed 2026-07-27: the prior inline-bash version silently treated "the
// .rejected/ directory doesn't exist" the same as "it exists and is
// empty" -- both reported `false`, so a checkpoint whose job is "was a
// marker written" gave a confident answer to a question it couldn't
// actually answer in the first case. `unknown` must be a distinct state.

const REJECTED_DIR = 'src/data/generated-articles/.rejected/';

// Mocked `git status --porcelain=v1 -z` output: NUL-terminated entries.
function porcelainZ(...entries) {
  return entries.map((e) => `${e}\0`).join('');
}

function checkWithStatus(status) {
  return checkRejectedMarker({
    rejectedDirPath: REJECTED_DIR,
    existsSync: () => true,
    exec: () => status,
  });
}

describe('checkRejectedMarker — three-state directory check (2026-07-27)', () => {
  test('directory does not exist at all -> "unknown", never a confident "false"', () => {
    const result = checkRejectedMarker({
      rejectedDirPath: REJECTED_DIR,
      existsSync: () => false,
      exec: () => { throw new Error('exec must never be called when the directory does not exist'); },
    });
    assert.equal(result.state, 'unknown');
    assert.match(result.reason, /does not exist/);
  });

  test('directory exists with a new untracked marker file -> "true"', () => {
    const result = checkRejectedMarker({
      rejectedDirPath: REJECTED_DIR,
      existsSync: () => true,
      exec: (cmd) => {
        assert.match(cmd, /git status --porcelain=v1 -z --untracked-files=all/);
        assert.match(cmd, /\.rejected\//);
        return porcelainZ(`?? ${REJECTED_DIR}some-topic.json`);
      },
    });
    assert.equal(result.state, 'true');
  });

  // Title is pinned verbatim by pipelinePaths.mjs (PR-04). Empty status:
  // no new AND no modified marker.
  test('directory exists but genuinely has no new untracked files -> "false"', () => {
    assert.equal(checkWithStatus('').state, 'false'); // clean git status output
  });

  test('default rejectedDirPath matches the real repo path used by handleTrippedGate', () => {
    let seenPath;
    checkRejectedMarker({
      existsSync: (p) => { seenPath = p; return true; },
      exec: () => '',
    });
    assert.equal(seenPath, REJECTED_DIR);
  });
});

// 2026-09-21, run 35640520872: the second Mello-Roos rejection rewrote the
// marker already tracked on main from its 2026-08-25 rejection. git showed
// ` M`, the old `^??` test returned "false", and the rejected-attempt PR
// never opened. This test used to assert exactly that ` M` -> "false";
// that behavior was the bug.
describe('checkRejectedMarker — new OR modified marker (repeat rejection, 2026-09-21)', () => {
  test('EXISTING COMMITTED marker modified in place (" M") -> "true"', () => {
    const result = checkWithStatus(porcelainZ(` M ${REJECTED_DIR}already-tracked.json`));
    assert.equal(result.state, 'true');
    assert.match(result.reason, /already-tracked\.json/);
  });

  // Every ordinary (non-conflicted) content change counts. R and C carry
  // the extra original-path field that -z emits for them.
  for (const xy of ['??', ' M', 'M ', 'MM', 'A ', 'AM', 'R ', 'C ', 'T ', ' T']) {
    test(`ordinary marker status ${JSON.stringify(xy)} -> "true"`, () => {
      const extra = xy[0] === 'R' || xy[0] === 'C' ? ['elsewhere/orig.json'] : [];
      assert.equal(checkWithStatus(porcelainZ(`${xy} ${REJECTED_DIR}a.json`, ...extra)).state, 'true');
    });
  }

  // Audit finding (2026-09-21): AA / AU / UA contain "A" and UM / MU /
  // UT / TU contain M or T, so a letter-only test accepted them. An
  // unmerged marker is never something this run wrote.
  for (const xy of ['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU', 'UM', 'MU', 'UT', 'TU']) {
    test(`unmerged/conflict marker status ${JSON.stringify(xy)} -> "false"`, () => {
      assert.equal(isUnmergedStatus(xy), true);
      assert.equal(checkWithStatus(porcelainZ(`${xy} ${REJECTED_DIR}a.json`)).state, 'false');
    });
  }

  test('a conflicted marker alongside a genuinely modified one -> "true" (the conflict is skipped, not fatal)', () => {
    const status = porcelainZ(`AA ${REJECTED_DIR}conflicted.json`, ` M ${REJECTED_DIR}rewritten.json`);
    const result = checkWithStatus(status);
    assert.equal(result.state, 'true');
    assert.doesNotMatch(result.reason, /conflicted\.json/);
  });

  test('only conflicted markers -> "false"', () => {
    assert.equal(checkWithStatus(porcelainZ(`AA ${REJECTED_DIR}a.json`, `UU ${REJECTED_DIR}b.json`)).state, 'false');
  });

  test('marker renamed INTO the marker directory -> "true", original path field is not misread as an entry', () => {
    const status = porcelainZ(`R  ${REJECTED_DIR}new.json`, 'elsewhere/old.json');
    assert.deepEqual(parsePorcelainZ(status), [{ xy: 'R ', path: `${REJECTED_DIR}new.json` }]);
    assert.equal(checkWithStatus(status).state, 'true');
  });

  test('deleted marker ("D " / " D") -> "false": a removed marker is not a written one', () => {
    assert.equal(checkWithStatus(porcelainZ(` D ${REJECTED_DIR}a.json`)).state, 'false');
    assert.equal(checkWithStatus(porcelainZ(`D  ${REJECTED_DIR}a.json`)).state, 'false');
  });

  test('non-JSON file in the marker directory -> "false"', () => {
    assert.equal(checkWithStatus(porcelainZ(`?? ${REJECTED_DIR}notes.txt`)).state, 'false');
  });

  test('unrelated dirty file outside .rejected/ -> "false"', () => {
    assert.equal(checkWithStatus(porcelainZ(' M src/data/blog-articles.json', '?? tools/blog-generator/.last-run-report.json')).state, 'false');
  });

  test('modified topic-quarantine.json only -> "false"', () => {
    assert.equal(checkWithStatus(porcelainZ(' M tools/blog-generator/topic-quarantine.json')).state, 'false');
  });

  test('a sibling directory sharing the prefix (.rejected-old/) -> "false"', () => {
    assert.equal(checkWithStatus(porcelainZ('?? src/data/generated-articles/.rejected-old/a.json')).state, 'false');
  });

  test('multiple dirty files where one is a changed marker -> "true"', () => {
    const status = porcelainZ(
      ' M tools/blog-generator/topic-quarantine.json',
      ' M tools/blog-generator/citation-host-log.json',
      ` M ${REJECTED_DIR}understanding-mello-roos-taxes-in-temecula-valley-communities.json`,
      '?? tools/blog-generator/.last-run-report.json'
    );
    assert.equal(checkWithStatus(status).state, 'true');
  });
});

// Real git, real functions: the production SHAPE of run 35640520872, with
// synthetic timestamps (never the incident's own -- this is not a backfill).
// A committed marker + a count-1 quarantine record whose retry has expired,
// the same topic re-selected, a second gate trip, then the detector -- both
// as a function and as the CLI the workflow redirects into $GITHUB_OUTPUT.
describe('second rejection of a topic with a MERGED marker — end to end in a temp git repo (2026-09-21)', () => {
  const TOPIC = 'Understanding Mello-Roos Taxes in Temecula Valley Communities';
  const MARKER_REL = `${REJECTED_DIR}understanding-mello-roos-taxes-in-temecula-valley-communities.json`;
  const QUARANTINE_REL = 'tools/blog-generator/topic-quarantine.json';
  const FIRST_REJECTED_AT = '2025-12-01T12:00:00.000Z';
  const SECOND_REJECTED_AT = '2026-01-15T12:00:00.000Z';
  const CLI_PATH = fileURLToPath(new URL('./checkRejectedMarker.mjs', import.meta.url));

  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'repeat-rejection-'));
  after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const git = (cmd) => execSync(`git ${cmd}`, { cwd: repo, encoding: 'utf8' });
  const generatedDir = path.join(repo, 'src/data/generated-articles');
  const quarantinePath = path.join(repo, QUARANTINE_REL);
  const topics = [{ topic: TOPIC }];

  function report() {
    return {
      topic: { topic: TOPIC, target_keyword: 'Mello-Roos tax explained Temecula' },
      layer1: { tripped: false, findings: [] },
      layer2: { tripped: true, checklist: { uncited_statistic: true } },
      layer3: { tripped: false, results: [], resolved: [], failed: [], unsupported: [], inconclusive: [] },
      outcome: 'skipped',
    };
  }

  test('merged marker is rewritten in place, quarantine goes to count 2 / +14d, and has_rejected_marker=true', () => {
    git('init -q');
    git('config user.email test@example.com');
    git('config user.name test');
    git('config core.autocrlf false');

    // State on main after the first rejection was MERGED (the Phase 3 seed).
    fs.mkdirSync(path.dirname(quarantinePath), { recursive: true });
    fs.writeFileSync(quarantinePath, `${JSON.stringify([{
      topic: TOPIC,
      status: 'quarantined',
      rejection_reason: 'gate_trip',
      rejection_count: 1,
      last_rejected_at: FIRST_REJECTED_AT,
      next_eligible_retry_at: '2025-12-08T12:00:00.000Z', // +7d, long expired by SECOND_REJECTED_AT
    }], null, 2)}\n`, 'utf8');
    fs.mkdirSync(path.join(repo, REJECTED_DIR), { recursive: true });
    fs.writeFileSync(path.join(repo, MARKER_REL), `${JSON.stringify({ sourceTopic: TOPIC, rejectedAt: FIRST_REJECTED_AT, failureClass: 'gate_trip' }, null, 2)}\n`, 'utf8');
    git('add -A');
    git('commit -q -m seed');
    assert.equal(git('status --porcelain'), '');

    // Retry expired: the same topic is selected again despite its merged marker.
    const quarantineRecords = loadQuarantineState(quarantinePath);
    const selected = pickNextEligibleTopic({
      topics,
      consumedTopics: new Set(),
      openPrTopics: new Set(),
      mergedMarkerTopics: getMergedMarkerTopics(generatedDir),
      quarantineRecords,
      now: SECOND_REJECTED_AT,
    });
    assert.equal(selected?.topic, TOPIC);

    // Second gate trip.
    const { markerPath, quarantineRecord } = handleTrippedGate(report(), {
      generatedDir, quarantinePath, topics, now: SECOND_REJECTED_AT,
    });
    assert.equal(path.relative(repo, markerPath).split(path.sep).join('/'), MARKER_REL);
    assert.equal(quarantineRecord.rejection_count, 2);
    assert.equal(quarantineRecord.last_rejected_at, SECOND_REJECTED_AT);
    assert.equal(quarantineRecord.next_eligible_retry_at, '2026-01-29T12:00:00.000Z'); // SECOND_REJECTED_AT + 14d
    assert.equal(JSON.parse(fs.readFileSync(markerPath, 'utf8')).rejectedAt, SECOND_REJECTED_AT);

    // The production shape: the SAME tracked path, modified -- not untracked.
    assert.equal(git(`status --porcelain -- ${REJECTED_DIR}`), ` M ${MARKER_REL}\n`);

    const result = checkRejectedMarker({
      rejectedDirPath: REJECTED_DIR,
      existsSync: (p) => fs.existsSync(path.join(repo, p)),
      exec: (cmd) => execSync(cmd, { cwd: repo, encoding: 'utf8' }),
    });
    assert.equal(result.state, 'true');

    // What the workflow step actually captures into $GITHUB_OUTPUT.
    const cli = spawnSync(process.execPath, [CLI_PATH], { cwd: repo, encoding: 'utf8' });
    assert.equal(cli.status, 0, cli.stderr);
    assert.equal(cli.stdout, 'has_rejected_marker=true\n');
  });
});
