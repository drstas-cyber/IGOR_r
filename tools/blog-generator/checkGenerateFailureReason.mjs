#!/usr/bin/env node
/* eslint-disable no-console */
// Determines what generate-article.yml's red-run email should say, for the
// GitHub Actions step that builds that email. Extracted (2026-08-31, Task
// 3 of the notification-hardening pass) matching checkRejectedMarker.mjs's
// exact pattern: a pure, fail-closed, three-
// (here: multi-) state-aware core function, plus a thin CLI shell at the
// bottom that prints to stdout for the workflow to redirect into
// $GITHUB_OUTPUT.
//
// STRICT PRECEDENCE, never reordered:
//   1. Structured failure class from .last-run-report.json, when it
//      exists and parses -- name the real cause and, where the report
//      carries them, the specific findings (schemaErrors/
//      internalLinkErrors/identityErrors, or the layer1/2/3 findings for
//      a compliance gate trip). Reuses deriveFailureClassLabel() and
//      summarizeRejectionFindings() (notificationEmail.mjs) directly --
//      the SAME functions the rejected-attempt PR's own email already
//      uses for this, rather than a second, independently-written
//      summarizer that could drift out of sync.
//   2. Captured job log text, if no structured report exists (or it
//      exists but fails to parse -- treated identically to "does not
//      exist," same fail-closed posture this project's check* scripts
//      have always applied to their own parse failures). One specific, real signal is
//      recognized here: QUEUE_EXHAUSTED_MARKER, the same stable sentinel
//      generate.mjs's own `::error::` annotation already uses -- this is
//      a deliberately-designed, already-existing signal, not a guess (see
//      queueExhaustedMarker.mjs). Anything else in the log gets reported
//      verbatim (capped via notificationEmail.mjs's own
//      truncateFailureDetail -- shared, not re-implemented), with an
//      explicit "cause could not be pinned down from the report" caveat,
//      never a named cause.
//   3. The neutral message, if there's no log either. This is the
//      genuinely-cannot-distinguish case -- see this file's own header
//      and generate.mjs's early-exit reports for why precedence 1 now
//      covers what used to collapse into this bucket by default (missing
//      ANTHROPIC_API_KEY, missing GITHUB_REPOSITORY, any uncaught
//      exception during topic selection all write their own minimal
//      report now).
//
// THE TRAP this whole module exists to avoid, stated once more because
// it's the entire point: "no report" must NEVER be silently mapped to
// "queue exhausted" or any other specific named cause. A missing/
// unparseable report falls through to precedence 2, not a guess.
import fs from 'node:fs';
import { deriveFailureClassLabel, summarizeRejectionFindings, truncateFailureDetail } from './notificationEmail.mjs';
import { QUEUE_EXHAUSTED_MARKER } from './queueExhaustedMarker.mjs';

const NEUTRAL_MESSAGE = 'generation pipeline failed; no structured report and no captured log were available -- cause could not be determined from the artifacts available. See the run log directly.';

// deriveStructuredResult (module-private) -- report.outcome -> a full
// result, or null when the outcome isn't one this module recognizes
// (fail-closed: an unrecognized report is NOT "structured" for this
// module's purposes, it falls through to precedence 2/3 rather than
// rendering a blank or wrong-shaped detail).
function deriveStructuredResult(report) {
  const outcome = report?.outcome;

  if (outcome === 'identity_incomplete' || outcome === 'schema_invalid' || outcome === 'internal_link_invalid' || outcome === 'skipped') {
    const label = deriveFailureClassLabel(outcome === 'skipped' ? 'gate_trip' : outcome);
    const findings = summarizeRejectionFindings(report);
    return {
      source: 'structured',
      reason: label,
      detail: findings.length ? findings.join('\n') : '(no specific findings recorded in the report)',
      failureClass: 'no_article',
      slug: null,
    };
  }

  if (outcome === 'generated') {
    const slug = report.article?.slug || null;
    return {
      source: 'structured',
      reason: slug
        ? `статья "${slug}" сгенерирована, но пайплайн после генерации завершился с ошибкой`
        : 'статья сгенерирована, но пайплайн после генерации завершился с ошибкой',
      detail: `Генерация и все ворота комплаенса прошли успешно (Layer 1/2/3, self-review, schema, internal links, identity block), но последующий шаг (открытие PR, авто-мерж или публикация) завершился с ошибкой.${slug ? ` Статья "${slug}" существует в src/data/generated-articles/, но ещё не смержена/не опубликована.` : ''} Подробности — в логе прогона.`,
      failureClass: 'article_stranded',
      slug,
    };
  }

  if (outcome === 'missing_api_key') {
    return {
      source: 'structured',
      reason: 'не задан ANTHROPIC_API_KEY',
      detail: 'Пайплайн генерации остановился на первом шаге: секрет ANTHROPIC_API_KEY не задан. Ничего не сгенерировано, тема не выбиралась.',
      failureClass: 'no_article',
      slug: null,
    };
  }

  if (outcome === 'missing_repository') {
    return {
      source: 'structured',
      reason: 'не задан GITHUB_REPOSITORY',
      detail: 'Пайплайн остановился до выбора темы: переменная GITHUB_REPOSITORY не задана, а она нужна для проверки уже занятых тем по открытым PR. Ничего не сгенерировано.',
      failureClass: 'no_article',
      slug: null,
    };
  }

  if (outcome === 'uncaught_exception') {
    return {
      source: 'structured',
      reason: 'необработанное исключение в пайплайне генерации',
      detail: `Пайплайн упал с необработанным исключением до того, как что-либо было сгенерировано: ${report.errorMessage || '(сообщение об ошибке не сохранено)'}`,
      failureClass: 'no_article',
      slug: null,
    };
  }

  return null; // unrecognized outcome -- fail closed, not structured
}

export function checkGenerateFailureReason({
  reportPath = 'tools/blog-generator/.last-run-report.json',
  logPath = '/tmp/generate.log',
  existsSync = fs.existsSync,
  readFileSync = fs.readFileSync,
} = {}) {
  if (existsSync(reportPath)) {
    try {
      const report = JSON.parse(readFileSync(reportPath, 'utf8'));
      const structured = deriveStructuredResult(report);
      if (structured) return structured;
    } catch {
      // Falls through to precedence 2 -- an unparseable report is treated
      // identically to no report at all, never a crash here.
    }
  }

  let logText = '';
  if (existsSync(logPath)) {
    try {
      logText = readFileSync(logPath, 'utf8');
    } catch {
      logText = '';
    }
  }
  const trimmedLog = logText.trim();

  if (trimmedLog) {
    if (trimmedLog.includes(QUEUE_EXHAUSTED_MARKER)) {
      return {
        source: 'log',
        reason: 'очередь тем исчерпана (topics.json)',
        detail: `Очередь тем исчерпана — все темы в topics.json уже использованы (реальная статья или открытый PR с отклонённой попыткой). Это не сбой ворот и не баг: добавьте темы в topics.json.\n\n${truncateFailureDetail(trimmedLog)}`,
        failureClass: 'no_article',
        slug: null,
      };
    }
    return {
      source: 'log',
      reason: 'сбой пайплайна генерации (причина не определена по отчёту)',
      detail: `Причину сбоя не удалось однозначно определить по структурированному отчёту (его нет, или чтение не удалось) — далее приведён захваченный лог прогона:\n\n${truncateFailureDetail(trimmedLog)}`,
      failureClass: 'no_article',
      slug: null,
    };
  }

  return {
    source: 'neutral',
    reason: 'сбой пайплайна генерации',
    detail: NEUTRAL_MESSAGE,
    failureClass: 'no_article',
    slug: null,
  };
}

const isMain = process.argv[1] && process.argv[1].endsWith('checkGenerateFailureReason.mjs');
if (isMain) {
  // --report-path / --log-path (2026-08-31, tactical item 3a) -- optional
  // overrides of the two default paths, purely so
  // test-email-notifications.yml can dispatch this CLI against different
  // fixture files in the same job without them colliding on the same
  // default location. The real generate-article.yml workflow never passes
  // these -- it relies on the defaults, same as every other caller.
  const reportPathArg = process.argv.find((a) => a.startsWith('--report-path='))?.slice('--report-path='.length);
  const logPathArg = process.argv.find((a) => a.startsWith('--log-path='))?.slice('--log-path='.length);
  const result = checkGenerateFailureReason({
    ...(reportPathArg ? { reportPath: reportPathArg } : {}),
    ...(logPathArg ? { logPath: logPathArg } : {}),
  });
  // reason/failure_class/slug are always single-line -- printed straight
  // to stdout for the workflow to redirect into $GITHUB_OUTPUT, same
  // convention as checkRejectedMarker.mjs. detail can
  // be multi-line (findings lists, log excerpts) -- NOT safe for that same
  // plain-redirect convention, so it is written to a fixed file instead
  // (mirroring publish-on-merge.yml's own captured-log-to-file pattern);
  // the calling workflow step passes that file straight to
  // buildNotificationEmailCli.mjs's --detail-file flag, which reads it
  // verbatim with no reprocessing.
  const detailOutPath = process.argv.find((a) => a.startsWith('--detail-out='))?.slice('--detail-out='.length) || '/tmp/generate-failure-detail.txt';
  fs.writeFileSync(detailOutPath, result.detail, 'utf8');
  console.log(`reason=${result.reason}`);
  console.log(`failure_class=${result.failureClass}`);
  console.log(`slug=${result.slug ?? ''}`);
  console.error(`[checkGenerateFailureReason] source=${result.source} detail written to ${detailOutPath}`);
}
