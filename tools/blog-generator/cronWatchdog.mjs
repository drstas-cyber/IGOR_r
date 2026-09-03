#!/usr/bin/env node
/* eslint-disable no-console */
// CRON WATCHDOG — detects the failures that cannot be forced.
//
// GitHub's scheduler is not a contract. It delays firings (14-25 min is
// normal for this repo; 2h22m observed 2026-08-03; 5h39m observed on
// weekly-retro 2026-08-31) and it silently DROPS them. A dropped firing
// produces no run, no PR, no email, and no annotation -- it is
// indistinguishable from a healthy quiet day unless something goes
// looking. That is the entire justification for this module: we cannot
// make GitHub fire, so we detect when it didn't.
//
// It also covers a second non-event with no signal: an open generator PR
// nobody acts on. An open PR holds its topic out of the queue
// (getOpenPrAttemptedTopics), so an ignored PR silently shrinks the
// available topic set forever. Real instance: PR #39 sat open from
// 2026-08-29 to 2026-09-03 holding its topic hostage with zero signal.
// That is not a hypothetical class of bug, it is a live one this repo had
// while the watchdog was being written.
//
// PURE CORE, thin CLI shell -- the same split every check* script in this
// directory already uses. `now`, the run list and the PR list are all
// injected, so every branch below is unit-testable without touching the
// network or the clock.

import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// SCHEDULES, stated as data rather than re-derived from cron strings at
// runtime. A cron parser here would be a second source of truth that can
// disagree with the workflow file; instead, cronWatchdog.test.mjs asserts
// these match the real `cron:` lines in the workflow YAML, so the two
// cannot drift without a red test.
export const WATCHED_SCHEDULES = [
  {
    workflow: 'generate-article.yml',
    label: 'генерация статьи',
    // '23 13 */2 * *' -- every other DAY OF MONTH, i.e. odd days
    // (1,3,5,...,31). Note this makes Aug 31 -> Sep 1 consecutive, which
    // is real observed behavior, not a bug.
    firesOn: (date) => date.getUTCDate() % 2 === 1,
    scheduleDescription: 'нечётные числа месяца, 13:23 UTC',
    dispatchCommand: 'gh workflow run generate-article.yml',
  },
  {
    workflow: 'weekly-retro.yml',
    label: 'еженедельный аудит',
    firesOn: (date) => date.getUTCDay() === 1, // Monday
    scheduleDescription: 'понедельник, 15:17 UTC',
    dispatchCommand: 'gh workflow run weekly-retro.yml',
  },
];

// STALE_PR_DAYS -- how long an open generator PR may sit before it counts
// as abandoned. Three days is deliberately just past one full generation
// cycle (every other day): a PR still open after the NEXT article has
// already been generated is one nobody is coming back to on their own.
export const STALE_PR_DAYS = 3;

function sameUtcDay(a, b) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

// checkMissedCrons (exported, pure) -- for each watched schedule that
// SHOULD have fired today, is there a run created today?
//
// Deliberately counts ANY run created today, including a failed one and
// including a workflow_dispatch: this watchdog answers "did the schedule
// deliver a firing," never "did the run succeed." A red run is a
// different alarm with its own email already; conflating the two would
// mean a failing pipeline masks a broken scheduler or vice versa. A
// manual dispatch counts because the human has already been alerted --
// re-alerting them for a day they intervened on is noise.
export function checkMissedCrons({ now, runsByWorkflow }) {
  const findings = [];
  for (const schedule of WATCHED_SCHEDULES) {
    if (!schedule.firesOn(now)) continue;
    const runs = runsByWorkflow[schedule.workflow] || [];
    const ranToday = runs.some((r) => {
      const created = new Date(r.createdAt);
      return !Number.isNaN(created.getTime()) && sameUtcDay(created, now);
    });
    if (!ranToday) {
      findings.push({
        type: 'missed_cron',
        workflow: schedule.workflow,
        label: schedule.label,
        scheduleDescription: schedule.scheduleDescription,
        dispatchCommand: schedule.dispatchCommand,
      });
    }
  }
  return findings;
}

// checkStalePrs (exported, pure) -- open generator PRs older than
// STALE_PR_DAYS. Reports the topic-blocking consequence explicitly in the
// finding, because "an old PR" is not obviously urgent and "this topic is
// out of the queue until you act" is.
export function checkStalePrs({ now, openPrs, staleDays = STALE_PR_DAYS }) {
  const cutoffMs = staleDays * 24 * 60 * 60 * 1000;
  const findings = [];
  for (const pr of openPrs || []) {
    if (!pr?.headRefName?.startsWith('blog-generator/')) continue;
    const created = new Date(pr.createdAt);
    if (Number.isNaN(created.getTime())) continue;
    const ageMs = now.getTime() - created.getTime();
    if (ageMs < cutoffMs) continue;
    findings.push({
      type: 'stale_pr',
      number: pr.number,
      title: pr.title,
      headRefName: pr.headRefName,
      ageDays: Math.floor(ageMs / (24 * 60 * 60 * 1000)),
      isMarker: pr.headRefName.startsWith('blog-generator/rejected-'),
    });
  }
  return findings;
}

// runWatchdog (exported, pure) -- the whole check. Returns
// { findings, healthy }. `healthy: true` means send nothing at all: a
// watchdog that emails on quiet days trains its reader to ignore it, and
// then it is not a watchdog.
export function runWatchdog({ now, runsByWorkflow, openPrs }) {
  const findings = [
    ...checkMissedCrons({ now, runsByWorkflow }),
    ...checkStalePrs({ now, openPrs }),
  ];
  return { findings, healthy: findings.length === 0 };
}

// renderWatchdogEmail (exported, pure) -- subject + HTML body. Russian,
// matching every other notification in this pipeline (notificationEmail.mjs).
export function renderWatchdogEmail(findings, { repoUrl = 'https://github.com/drstas-cyber/IGOR_r' } = {}) {
  const missed = findings.filter((f) => f.type === 'missed_cron');
  const stale = findings.filter((f) => f.type === 'stale_pr');

  const subjectParts = [];
  if (missed.length) subjectParts.push(`крон не отработал (${missed.length})`);
  if (stale.length) subjectParts.push(`зависших PR: ${stale.length}`);
  const subject = `🔴 Сторож пайплайна: ${subjectParts.join(', ')}`;

  const sections = [];
  if (missed.length) {
    sections.push(
      '<h3>Крон не отработал</h3>',
      '<p>GitHub не запустил запланированный прогон сегодня. Это не сбой пайплайна — это пропущенный запуск планировщиком, который иначе не оставляет никаких следов.</p>',
      '<ul>',
      ...missed.map(
        (f) =>
          `<li><strong>${f.label}</strong> (<code>${f.workflow}</code>, расписание: ${f.scheduleDescription}) — сегодня прогона нет.<br>Запустить вручную: <code>${f.dispatchCommand}</code></li>`,
      ),
      '</ul>',
    );
  }
  if (stale.length) {
    sections.push(
      '<h3>Зависшие PR</h3>',
      '<p>Открытый PR генератора держит свою тему занятой — она не вернётся в очередь, пока PR не закрыт или не смержен. Пока он висит, тема просто выпадает из ротации.</p>',
      '<ul>',
      ...stale.map(
        (f) =>
          `<li>PR <a href="${repoUrl}/pull/${f.number}">#${f.number}</a> — ${f.ageDays} дн. открыт — <code>${f.headRefName}</code><br>${
            f.isMarker
              ? '⛔ Это маркер отклонения: <strong>закрыть</strong> (Close), не мержить — мерж заблокирует тему навсегда.'
              : 'Статья: прочитать и смержить, либо закрыть, чтобы вернуть тему в очередь.'
          }</li>`,
      ),
      '</ul>',
    );
  }

  return { subject, html_body: sections.join('\n') };
}

// ---------------------------------------------------------------------------
// THIN CLI SHELL — same pattern as checkRejectedMarker.mjs and
// checkGenerateFailureReason.mjs: everything above is pure and unit-tested,
// everything below is the I/O the workflow needs and nothing else.
//
// Writes `healthy`, `subject` and `html_body` to stdout in $GITHUB_OUTPUT
// form. Exits 0 even when unhealthy -- the watchdog reports, it does not
// fail the run; a red watchdog run would be a second, redundant signal
// competing with the email it just built.
// ---------------------------------------------------------------------------
export function gatherState({ repo, exec = execSync }) {
  const runsByWorkflow = {};
  for (const schedule of WATCHED_SCHEDULES) {
    // --limit 20 is comfortably more than a day's worth for either
    // workflow; `createdAt` filtering happens in the pure core.
    const raw = exec(
      `gh run list --repo ${repo} --workflow=${schedule.workflow} --limit 20 --json createdAt,event,conclusion`,
      { encoding: 'utf8' },
    );
    runsByWorkflow[schedule.workflow] = JSON.parse(raw);
  }
  const prRaw = exec(
    `gh pr list --repo ${repo} --state open --limit 100 --json number,title,headRefName,createdAt`,
    { encoding: 'utf8' },
  );
  return { runsByWorkflow, openPrs: JSON.parse(prRaw) };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) {
    console.error('[cronWatchdog] GITHUB_REPOSITORY not set — refusing to guess which repo to watch.');
    process.exitCode = 1;
  } else {
    const now = new Date();
    const { runsByWorkflow, openPrs } = gatherState({ repo });
    const { findings, healthy } = runWatchdog({ now, runsByWorkflow, openPrs });

    console.log(`healthy=${healthy}`);
    if (!healthy) {
      const { subject, html_body } = renderWatchdogEmail(findings);
      console.log(`subject=${subject}`);
      console.log('html_body<<WATCHDOG_BODY_EOF');
      console.log(html_body);
      console.log('WATCHDOG_BODY_EOF');
    }
    // Findings also go to stderr so the job log shows them even when the
    // email path no-ops (no SMTP secrets, or a send failure).
    for (const f of findings) {
      console.error(`[cronWatchdog] ${f.type}: ${JSON.stringify(f)}`);
    }
  }
}
