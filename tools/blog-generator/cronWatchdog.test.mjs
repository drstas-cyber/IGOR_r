// Tests for the cron/stale-PR watchdog.
//
// The watchdog exists to detect non-events, so its tests are mostly about
// the two ways a non-event detector fails: crying wolf on a healthy day
// (which trains the reader to ignore it, making it worthless), and staying
// quiet on a genuinely broken one (which is the bug it exists to prevent).
// Both directions are asserted for every branch.
//
// The last describe block is the important one: it asserts the schedule
// data in cronWatchdog.mjs matches the REAL cron expressions in the
// workflow YAML. Without it, moving a cron would silently leave the
// watchdog watching for a firing at the old cadence -- a watchdog that
// disagrees with the thing it watches is worse than none, because it
// reports confidently and wrongly.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  WATCHED_SCHEDULES,
  STALE_PR_DAYS,
  checkMissedCrons,
  checkStalePrs,
  runWatchdog,
  renderWatchdogEmail,
} from './cronWatchdog.mjs';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// Normalised to LF -- see promptGatePairs.test.mjs for why.
const WF = (name) => fs.readFileSync(path.join(PROJECT_ROOT, '.github', 'workflows', name), 'utf8').replace(/\r\n/g, '\n');

// 2026-09-03 is a Thursday and an ODD day of month -> generate-article
// should have fired, weekly-retro should not.
const ODD_THURSDAY = new Date('2026-09-03T18:07:00Z');
// 2026-09-04 is a Friday and an EVEN day -> neither should have fired.
const EVEN_FRIDAY = new Date('2026-09-04T18:07:00Z');
// 2026-09-07 is a Monday and an ODD day -> BOTH should have fired.
const ODD_MONDAY = new Date('2026-09-07T18:07:00Z');

const ranToday = (iso) => [{ createdAt: iso, event: 'schedule', conclusion: 'success' }];

describe('checkMissedCrons — generate-article (odd days of month)', () => {
  test('odd day, a run exists today -> no finding', () => {
    const findings = checkMissedCrons({
      now: ODD_THURSDAY,
      runsByWorkflow: { 'generate-article.yml': ranToday('2026-09-03T13:31:00Z'), 'weekly-retro.yml': [] },
    });
    assert.deepEqual(findings, []);
  });

  test('odd day, NO run today -> a missed_cron finding naming the dispatch command', () => {
    const findings = checkMissedCrons({
      now: ODD_THURSDAY,
      runsByWorkflow: { 'generate-article.yml': ranToday('2026-09-01T13:31:00Z'), 'weekly-retro.yml': [] },
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].type, 'missed_cron');
    assert.equal(findings[0].workflow, 'generate-article.yml');
    assert.match(findings[0].dispatchCommand, /gh workflow run generate-article\.yml/);
  });

  test('EVEN day with no run -> no finding (it was never supposed to fire)', () => {
    const findings = checkMissedCrons({
      now: EVEN_FRIDAY,
      runsByWorkflow: { 'generate-article.yml': [], 'weekly-retro.yml': [] },
    });
    assert.deepEqual(findings, [], 'crying wolf on a day the cron was never scheduled would make this watchdog noise');
  });

  test('a FAILED run today still counts as the schedule having fired -- red runs are a different alarm', () => {
    const findings = checkMissedCrons({
      now: ODD_THURSDAY,
      runsByWorkflow: {
        'generate-article.yml': [{ createdAt: '2026-09-03T13:31:00Z', event: 'schedule', conclusion: 'failure' }],
        'weekly-retro.yml': [],
      },
    });
    assert.deepEqual(findings, [], 'a red run already emails; reporting it as a missed cron too would conflate two different failures');
  });

  test('a manual workflow_dispatch today counts -- the human already intervened', () => {
    const findings = checkMissedCrons({
      now: ODD_THURSDAY,
      runsByWorkflow: {
        'generate-article.yml': [{ createdAt: '2026-09-03T19:00:00Z', event: 'workflow_dispatch', conclusion: 'success' }],
        'weekly-retro.yml': [],
      },
    });
    assert.deepEqual(findings, []);
  });

  test('an empty run list on an odd day -> finding, never a crash', () => {
    const findings = checkMissedCrons({ now: ODD_THURSDAY, runsByWorkflow: {} });
    assert.equal(findings.length, 1);
  });

  test('an unparseable createdAt does not count as "ran today"', () => {
    const findings = checkMissedCrons({
      now: ODD_THURSDAY,
      runsByWorkflow: { 'generate-article.yml': [{ createdAt: 'not-a-date' }] },
    });
    assert.equal(findings.length, 1, 'garbage must never be read as evidence the cron fired');
  });
});

describe('checkMissedCrons — weekly-retro (Mondays)', () => {
  test('Monday with no retro run -> finding', () => {
    const findings = checkMissedCrons({
      now: ODD_MONDAY,
      runsByWorkflow: { 'generate-article.yml': ranToday('2026-09-07T13:31:00Z'), 'weekly-retro.yml': [] },
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].workflow, 'weekly-retro.yml');
  });

  test('Monday that is also an odd day, BOTH missing -> two findings', () => {
    const findings = checkMissedCrons({ now: ODD_MONDAY, runsByWorkflow: {} });
    assert.equal(findings.length, 2);
    assert.deepEqual(findings.map((f) => f.workflow).sort(), ['generate-article.yml', 'weekly-retro.yml']);
  });

  test('a Thursday never expects a retro run', () => {
    const findings = checkMissedCrons({
      now: ODD_THURSDAY,
      runsByWorkflow: { 'generate-article.yml': ranToday('2026-09-03T13:31:00Z'), 'weekly-retro.yml': [] },
    });
    assert.deepEqual(findings, []);
  });
});

describe('checkStalePrs', () => {
  const now = new Date('2026-09-03T18:07:00Z');

  test('a PR open longer than the threshold -> finding with its age and topic-blocking consequence', () => {
    const findings = checkStalePrs({
      now,
      openPrs: [{ number: 39, title: 'Rejected generation attempt', headRefName: 'blog-generator/rejected-33265677614', createdAt: '2026-08-29T17:28:51Z' }],
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].number, 39);
    assert.equal(findings[0].ageDays, 5);
    assert.equal(findings[0].isMarker, true, 'a rejected-* branch must be flagged as a marker so the email says Close, not Merge');
  });

  test('a fresh PR is not stale', () => {
    const findings = checkStalePrs({
      now,
      openPrs: [{ number: 42, title: 'x', headRefName: 'blog-generator/rejected-1', createdAt: '2026-09-03T17:06:00Z' }],
    });
    assert.deepEqual(findings, []);
  });

  test('a non-generator PR is ignored entirely -- this watchdog has no opinion on human branches', () => {
    const findings = checkStalePrs({
      now,
      openPrs: [{ number: 7, title: 'fix nav', headRefName: 'fix/nav-hash-links-route-aware', createdAt: '2026-01-01T00:00:00Z' }],
    });
    assert.deepEqual(findings, []);
  });

  test('an auto-* article PR is flagged as an article, not a marker', () => {
    const findings = checkStalePrs({
      now,
      openPrs: [{ number: 40, title: 'x', headRefName: 'blog-generator/auto-123', createdAt: '2026-08-20T00:00:00Z' }],
    });
    assert.equal(findings[0].isMarker, false);
  });

  test('an empty or missing PR list -> no findings, no crash', () => {
    assert.deepEqual(checkStalePrs({ now, openPrs: [] }), []);
    assert.deepEqual(checkStalePrs({ now, openPrs: undefined }), []);
  });

  test('exactly at the threshold is not yet stale (strictly older than STALE_PR_DAYS)', () => {
    const created = new Date(now.getTime() - STALE_PR_DAYS * 24 * 60 * 60 * 1000 + 1000).toISOString();
    assert.deepEqual(checkStalePrs({ now, openPrs: [{ number: 1, headRefName: 'blog-generator/auto-1', createdAt: created }] }), []);
  });
});

describe('runWatchdog — healthy vs unhealthy', () => {
  test('a fully healthy day reports healthy: true and produces NO findings', () => {
    const { healthy, findings } = runWatchdog({
      now: ODD_THURSDAY,
      runsByWorkflow: { 'generate-article.yml': ranToday('2026-09-03T13:31:00Z') },
      openPrs: [],
    });
    assert.equal(healthy, true);
    assert.deepEqual(findings, []);
  });

  test('any single finding flips healthy to false', () => {
    const { healthy } = runWatchdog({ now: ODD_THURSDAY, runsByWorkflow: {}, openPrs: [] });
    assert.equal(healthy, false);
  });
});

describe('renderWatchdogEmail', () => {
  test('a missed cron renders the workflow, the schedule, and a copy-pasteable dispatch command', () => {
    const { subject, html_body } = renderWatchdogEmail([
      { type: 'missed_cron', workflow: 'generate-article.yml', label: 'генерация статьи', scheduleDescription: 'нечётные числа', dispatchCommand: 'gh workflow run generate-article.yml' },
    ]);
    assert.match(subject, /крон не отработал/);
    assert.match(html_body, /generate-article\.yml/);
    assert.match(html_body, /gh workflow run generate-article\.yml/);
  });

  test('a stale MARKER PR says Close, never Merge', () => {
    const { html_body } = renderWatchdogEmail([
      { type: 'stale_pr', number: 39, title: 'x', headRefName: 'blog-generator/rejected-1', ageDays: 5, isMarker: true },
    ]);
    assert.match(html_body, /закрыть/i);
    assert.match(html_body, /не мержить/i, 'merging a marker permanently blocks the topic — the email must say so');
  });

  test('a stale ARTICLE PR does not tell the reader to close it without reading', () => {
    const { html_body } = renderWatchdogEmail([
      { type: 'stale_pr', number: 40, title: 'x', headRefName: 'blog-generator/auto-1', ageDays: 5, isMarker: false },
    ]);
    assert.match(html_body, /прочитать/i);
  });

  test('both finding kinds together render both sections and a combined subject', () => {
    const { subject, html_body } = renderWatchdogEmail([
      { type: 'missed_cron', workflow: 'weekly-retro.yml', label: 'аудит', scheduleDescription: 'пн', dispatchCommand: 'gh workflow run weekly-retro.yml' },
      { type: 'stale_pr', number: 39, title: 'x', headRefName: 'blog-generator/rejected-1', ageDays: 5, isMarker: true },
    ]);
    assert.match(subject, /крон не отработал/);
    assert.match(subject, /зависших PR/);
    assert.match(html_body, /<h3>Крон не отработал<\/h3>/);
    assert.match(html_body, /<h3>Зависшие PR<\/h3>/);
  });
});

// ---------------------------------------------------------------------------
// THE ANTI-DRIFT CHECK. A watchdog that disagrees with the schedule it
// watches reports confidently and wrongly, which is worse than silence.
// ---------------------------------------------------------------------------
describe('watchdog schedule data matches the real workflow cron expressions', () => {
  test('every watched workflow exists and declares a schedule', () => {
    for (const s of WATCHED_SCHEDULES) {
      const yml = WF(s.workflow);
      assert.match(yml, /schedule:/, `${s.workflow} has no schedule: block — the watchdog is watching a workflow that does not run on a cron`);
    }
  });

  test("generate-article's cron is still every-other-day-of-month, matching firesOn", () => {
    const yml = WF('generate-article.yml');
    const m = yml.match(/cron:\s*'(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)'/);
    assert.ok(m, 'could not parse a cron expression from generate-article.yml');
    const [, minute, , dayOfMonth] = m;
    assert.equal(dayOfMonth, '*/2', `day-of-month field is "${dayOfMonth}", but the watchdog assumes odd days (*/2). Update WATCHED_SCHEDULES.firesOn together with the cron.`);
    assert.notEqual(minute, '0', 'the cron minute must stay off :00 — the hour boundary is the contended slot that caused three documented delay incidents');
  });

  test("weekly-retro's cron is still Monday, and off the hour boundary", () => {
    const yml = WF('weekly-retro.yml');
    const m = yml.match(/cron:\s*'(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)'/);
    assert.ok(m, 'could not parse a cron expression from weekly-retro.yml');
    const [, minute, , , , dayOfWeek] = m;
    assert.equal(dayOfWeek, '1', `day-of-week is "${dayOfWeek}", but the watchdog assumes Monday. Update WATCHED_SCHEDULES.firesOn together with the cron.`);
    assert.notEqual(minute, '0', 'weekly-retro fired 5h39m late against a :00 cron on 2026-08-31 — the minute must stay off the hour boundary');
  });
});
