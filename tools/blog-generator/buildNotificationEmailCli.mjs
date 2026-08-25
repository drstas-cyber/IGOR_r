#!/usr/bin/env node
/* eslint-disable no-console */
// Thin CLI glue for the four email templates (notificationEmail.mjs) --
// reads whatever JSON/args a given trigger has available, calls the right
// pure builder, and writes `subject`/`html_body` to $GITHUB_OUTPUT so the
// calling workflow step can pass them straight into the notify-email
// composite action. All real content decisions live in
// notificationEmail.mjs (tested); this file only wires arguments to it,
// matching this repo's "pure core, thin I/O shell" split used everywhere
// else (setPublished.mjs, headersCacheEntry.mjs, publishOnMerge.mjs).
//
// Usage:
//   node buildNotificationEmailCli.mjs --kind=article-pr --report=<path> --preview-url=<url> --pr-url=<url>
//   node buildNotificationEmailCli.mjs --kind=rejected-pr --report=<path> --pr-url=<url>
//   node buildNotificationEmailCli.mjs --kind=published --slug=<slug> --title=<title>
//   node buildNotificationEmailCli.mjs --kind=failure --reason=<text> [--detail=<text>] --run-url=<url>
//
// Never throws past its own top-level catch -- see main()'s wrapper below.
// This is a notification convenience feature; a bug here must cost a
// missing email, never a red pipeline (the calling workflow step also
// sets continue-on-error: true as an independent second layer of the same
// guarantee, same pattern as updatePrPreviewLink.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractFirstParagraphText,
  buildArticlePrEmail,
  buildRejectedPrEmail,
  buildPublishedEmail,
  buildFailureEmail,
  deriveFailureClassLabel,
  summarizeRejectionFindings,
} from './notificationEmail.mjs';
import { buildGateSummaryLine } from './gateSummaryLine.mjs';
import { evaluatePublishStatus } from './publishStatusReport.mjs';
import { hasCacheEntry } from './headersCacheEntry.mjs';
import { articlePath } from './setPublished.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const HEADERS_PATH = path.join(PROJECT_ROOT, 'public', '_headers');
const BLOG_DATA_PATH = path.join(PROJECT_ROOT, 'src', 'data', 'blog-articles.json');
const SITE = 'https://temeculavalleyhomes.us';

function argValue(flag) {
  const arg = process.argv.find((a) => a.startsWith(`--${flag}=`));
  return arg ? arg.slice(flag.length + 3) : undefined;
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function readBlogArticlesSlugs() {
  if (!fs.existsSync(BLOG_DATA_PATH)) return [];
  try {
    const parsed = readJson(BLOG_DATA_PATH);
    return Array.isArray(parsed) ? parsed.map((a) => a.slug).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function buildForKind(kind) {
  if (kind === 'article-pr') {
    const report = readJson(argValue('report'));
    const article = readJson(path.join(PROJECT_ROOT, report.outputPath));
    return buildArticlePrEmail({
      title: report.article?.title,
      firstParagraphText: extractFirstParagraphText(article.content_html),
      previewUrl: argValue('preview-url') || null,
      gateSummaryLine: buildGateSummaryLine(report),
      prUrl: argValue('pr-url'),
    });
  }

  if (kind === 'rejected-pr') {
    const report = readJson(argValue('report'));
    return buildRejectedPrEmail({
      topic: report.topic?.topic,
      failureClassLabel: deriveFailureClassLabel(report.outcome === 'skipped' ? 'gate_trip' : report.outcome),
      findingsSummaryLines: summarizeRejectionFindings(report),
      prUrl: argValue('pr-url'),
    });
  }

  if (kind === 'published') {
    const slug = argValue('slug');
    const article = readJson(articlePath(slug));
    // --title is an optional override; the article file's own title (the
    // real source of truth) is the default, so neither caller (the
    // silent-auto-publish path in generate-article.yml, nor
    // publish-on-merge.yml) needs to separately thread a title through
    // upstream step outputs just for this email.
    const title = argValue('title') || article.title || slug;
    const headersText = fs.existsSync(HEADERS_PATH) ? fs.readFileSync(HEADERS_PATH, 'utf8') : '';
    const status = evaluatePublishStatus({ slug, article, headersText, blogArticlesSlugs: readBlogArticlesSlugs() });
    const verdictLabel = status.complete
      ? 'COMPLETE (local) — все проверки пройдены'
      : `INCOMPLETE — ${status.checks.filter((c) => !c.ok).map((c) => c.label).join('; ')}`;
    return buildPublishedEmail({ title, liveUrl: `${SITE}/blog/${slug}/`, verdictLabel });
  }

  if (kind === 'failure') {
    return buildFailureEmail({
      reason: argValue('reason'),
      detailText: argValue('detail') || null,
      runUrl: argValue('run-url'),
    });
  }

  throw new Error(`unknown --kind="${kind}" (expected article-pr | rejected-pr | published | failure)`);
}

function writeOutputs({ subject, html }) {
  if (!process.env.GITHUB_OUTPUT) {
    console.log(JSON.stringify({ subject, html }, null, 2));
    return;
  }
  // subject is always a single line (a real title/topic could theoretically
  // contain a newline, so strip defensively rather than trust upstream data).
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `subject=${subject.replace(/\r?\n/g, ' ')}\n`);
  // html_body uses GitHub's multiline-output delimiter syntax with a
  // random delimiter (GitHub's own documented recommendation) so the body
  // itself can never accidentally collide with and truncate the block.
  const delim = `EMAIL_BODY_${Math.random().toString(36).slice(2)}`;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `html_body<<${delim}\n${html}\n${delim}\n`);
}

function main() {
  const kind = argValue('kind');
  if (!kind) {
    console.error('[buildNotificationEmailCli] usage: node buildNotificationEmailCli.mjs --kind=<article-pr|rejected-pr|published|failure> [...]');
    process.exitCode = 1;
    return;
  }
  try {
    const { subject, html } = buildForKind(kind);
    writeOutputs({ subject, html });
    console.log(`[buildNotificationEmailCli] built "${kind}" email: ${subject}`);
  } catch (err) {
    // Never fatal -- see this file's header comment. Writes no outputs on
    // failure, which the calling notify-email composite action treats
    // exactly like "no subject provided" (see that action's own guard).
    console.error(`[buildNotificationEmailCli] non-fatal error building "${kind}" email: ${err.message}`);
  }
}

main();
