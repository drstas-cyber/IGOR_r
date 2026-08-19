#!/usr/bin/env node
/* eslint-disable no-console */
// Self-hosted blog article generator — PHASE 1. Picks the next available
// topic from topics.json (topics.json carries no status field — "already
// attempted" is derived fresh every run from ground truth: real articles
// and open rejected-attempt PRs, see topicAvailability.mjs), generates a
// draft, self-reviews it, runs it through TWO independent compliance gates,
// and on a clean pass writes it to src/data/generated-articles/<slug>.json.
// On ANY trip from either gate: no article file is written and the process
// exits non-zero — a tripped article is a prompt problem to fix, not noise.
// See README.md for the full design rationale (why two gates, why
// low-volume, why manual cadence, why topic status is derived not stored).
//
// Requires ANTHROPIC_API_KEY. Never commits/pushes anything itself — the
// GitHub Actions workflow (.github/workflows/generate-article.yml) wraps
// this script and opens a PR from its output; this script only writes local
// files.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createMessage, extractToolInput } from './anthropicClient.mjs';
import { verifyModel } from './modelVerify.mjs';
import { runLlmClaimGate } from './llmClaimGate.mjs';
import { validateArticleSchema } from './schema.js';
import { validateSelfReview } from './selfReviewSchema.mjs';
import { getKnownRoutes, formatKnownRoutesForPrompt } from './knownRoutes.mjs';
import { validateInternalLinks } from './internalLinkGate.mjs';
import { restoreStrippedInternalLinks } from './internalLinkRestore.mjs';
import { getKnownSlugs, uniqueSlug, slugify } from './slugs.js';
import { scanArticle, findUncitedClaims, GENERATOR_LOG_ONLY_FINDING_KEYS } from '../blog-compliance/scan.js';
import { getLocallyAttemptedTopics, getOpenPrAttemptedTopics, pickNextAvailableTopic } from './topicAvailability.mjs';
import { resolveAllCitations, evaluateCitationResolution } from './citationResolver.mjs';
import { appendHostLogEntries, buildHostLogEntries } from './citationHostLog.mjs';
import { computeAllSilent } from './autoPublishGate.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const TOPICS_PATH = path.join(__dirname, 'topics.json');
const PROMPT_PATH = path.join(__dirname, 'prompt.md');
const GENERATED_DIR = path.join(PROJECT_ROOT, 'src', 'data', 'generated-articles');
const REPORT_PATH = path.join(__dirname, '.last-run-report.json');
const CITATION_HOST_LOG_PATH = path.join(__dirname, 'citation-host-log.json');
const SITE = 'https://temeculavalleyhomes.us';

// Verified live against GET /v1/models — see modelVerify.mjs, which re-runs
// this check at the start of every invocation (not just once at build time),
// so a future deprecation fails loudly on the next run rather than silently.
// Not independently confirmed at the time this file was written: no
// ANTHROPIC_API_KEY was available in the build session (2026-07-25). The
// spec's third candidate, "claude-opus-5", is NOT used anywhere in this
// pipeline and was not verified either way — only the two constants below
// are load-bearing.
export const WRITER_MODEL = 'claude-sonnet-5';
export const REVIEWER_MODEL = 'claude-haiku-4-5-20251001';

const ARTICLE_TOOL_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    slug_suggestion: { type: 'string', description: 'kebab-case slug suggestion; the pipeline will normalize and de-duplicate it, this does not need to be perfect' },
    meta_description: { type: 'string', description: 'Between 70 and 160 characters.' },
    content_html: { type: 'string', description: 'Semantic HTML body: headings, paragraphs, lists. No inline styles, no script tags.' },
    keywords: { type: 'array', items: { type: 'string' }, minItems: 1 },
    citations: {
      type: 'array',
      description: 'One entry per <sup class="citation" data-cite="ID"> marker in content_html (prompt.md rules 4-6). Empty array if content_html has zero citable claims. Never invent an entry with no corresponding marker, and never a source that is not a primary source (statute, constitution, government code, county assessor, county tax collector, court opinion).',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Matches data-cite="ID" in content_html. Sequential: "1", "2", "3"...' },
          sourceName: { type: 'string', description: 'Human-readable source name, e.g. "California Constitution, Article XIII A, section 1" or "Riverside County Tax Collector".' },
          url: { type: 'string', description: 'Direct URL to the primary source. Never temeculavalleyhomes.com (prompt.md rule 7).' },
          sourceType: { type: 'string', enum: ['statute', 'constitution', 'government-code', 'county-assessor', 'county-tax-collector', 'court-opinion', 'other-primary'] },
        },
        required: ['id', 'sourceName', 'url', 'sourceType'],
      },
    },
    faq_items: {
      type: 'array',
      description: 'Question/answer pairs ONLY if the article naturally includes a Q&A section. Empty array if not.',
      items: {
        type: 'object',
        properties: { question: { type: 'string' }, answer: { type: 'string' } },
        required: ['question', 'answer'],
      },
    },
  },
  required: ['title', 'slug_suggestion', 'meta_description', 'content_html', 'keywords', 'citations', 'faq_items'],
};

const DRAFT_TOOL = {
  name: 'submit_article_draft',
  description: 'Submit the generated article draft.',
  input_schema: ARTICLE_TOOL_SCHEMA,
};

// Two-field self-review report (owner decision, 2026-08-07 -- "Self-review
// reporting fix"). Previously violations_found alone, with only a
// free-text instruction asking for an empty array on a clean draft -- see
// selfReviewSchema.mjs's header comment for the exact PR #27 case that
// showed the model doesn't always follow that instruction (a clean draft
// narrated as a 1-item list instead of returning []). draft_was_clean is a
// second, independent signal specifically so the two fields can be checked
// against each other in code (validateSelfReview) rather than trusted on
// their own -- structural, not another prompt instruction to hope holds.
const REVIEW_TOOL = {
  name: 'submit_reviewed_article',
  description: 'Submit the self-reviewed, corrected article.',
  input_schema: {
    type: 'object',
    properties: {
      draft_was_clean: {
        type: 'boolean',
        description: 'true if the draft required zero corrections against the six hard rules; false if at least one real correction was made. Must agree with violations_found: true requires violations_found to be exactly []. A mismatch (true with a non-empty array) is treated as an inconsistent report and holds the PR for a human read regardless of what else is true.',
      },
      violations_found: {
        type: 'array',
        items: { type: 'string' },
        description: 'One entry per ACTUAL CHANGE MADE to the draft -- never narration, never a confirmation that the draft was already clean. If draft_was_clean is true, this array MUST be empty ([]) -- do not describe "no violations found" as an entry here.',
      },
      ...ARTICLE_TOOL_SCHEMA.properties,
    },
    required: ['draft_was_clean', 'violations_found', ...ARTICLE_TOOL_SCHEMA.required],
  },
};

function loadTopics(topicsPath = TOPICS_PATH) {
  return JSON.parse(fs.readFileSync(topicsPath, 'utf8'));
}

function loadSystemPrompt() {
  return fs.readFileSync(PROMPT_PATH, 'utf8');
}

// knownRoutesText (Batch B, Part 3, 2026-08-08): appended to the per-run
// user message, not baked into the static system prompt (prompt.md) --
// the live route/article list changes every time a new article publishes,
// so it has to be injected fresh each run, the same reason `topic` already
// is. See prompt.md's "Internal linking" section for the rules governing
// how the model is told to use this list.
async function generateDraft({ apiKey, topic, systemPrompt, knownRoutesText }) {
  const response = await createMessage({
    apiKey,
    model: WRITER_MODEL,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Write an article for this topic: "${topic.topic}"\nTarget keyword: "${topic.target_keyword}"\n\nKnown live routes (choose internal link URLs ONLY from this list, per the "Internal linking" section of your system prompt -- never invent a URL):\n${knownRoutesText}`,
      },
    ],
    tools: [DRAFT_TOOL],
    toolChoice: { type: 'tool', name: DRAFT_TOOL.name },
  });
  return extractToolInput(response, DRAFT_TOOL.name);
}

// knownRoutesText is now passed into the self-review call too (fixed
// 2026-08-12) -- previously only the draft pass received it, so the
// self-review model had no list to validate the draft's internal links
// against and defensively stripped every one it found, on both real runs
// since internal linking shipped (PRs #28, #29, 2026-08-09/11). See
// prompt.md's "Validate internal links against the list" paragraph for the
// instructions this list is now checked against.
async function selfReview({ apiKey, draft, systemPrompt, knownRoutesText }) {
  const response = await createMessage({
    apiKey,
    model: WRITER_MODEL,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Review this draft against the ten hard rules and the self-review pass instructions, then submit the corrected version:\n\n${JSON.stringify(draft, null, 2)}\n\nKnown live routes (validate every internal link already in the draft above against this list -- keep a link only if its URL is an exact match, strip any that aren't, per the self-review pass instructions' internal-linking paragraph):\n${knownRoutesText}`,
      },
    ],
    tools: [REVIEW_TOOL],
    toolChoice: { type: 'tool', name: REVIEW_TOOL.name },
  });
  return extractToolInput(response, REVIEW_TOOL.name);
}

// Completed 2026-08-07 (Batch A, AI SEO audit item 4) — added
// dateModified, publisher, and mainEntityOfPage; image is included only
// when heroImageUrl is truthy (every article today has hero_image_url:
// null, per assembleArticle() below, so image is correctly omitted on all
// current output — never fabricated).
//
// dateModified defaults to createdAt (datePublished) when not passed,
// matching the rule that a freshly-generated article's dateModified starts
// equal to its datePublished; a future content-edit workflow that actually
// changes an article after publish would need to pass a real, later
// dateModified explicitly — nothing here does that yet.
//
// publisher references the sitewide #agent entity by @id (the same
// RealEstateAgent/LocalBusiness block in index.html) rather than
// duplicating name/logo/etc. here a second time.
//
// mainEntityOfPage links to this article's own WebPage entity
// (`${canonicalUrl}#webpage`) — the per-route WebPage tools/seo-
// prerender.js now builds for every route (see buildWebPageJsonLd() and
// item 1 of this same batch), not an invented, disconnected reference.
export function buildJsonLd({ title, metaDescription, canonicalUrl, createdAt, dateModified, heroImageUrl }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: metaDescription,
    url: canonicalUrl,
    datePublished: createdAt,
    dateModified: dateModified || createdAt,
    author: { '@type': 'Person', name: 'George Khazanovskiy' },
    publisher: { '@id': `${SITE}/#agent` },
    mainEntityOfPage: { '@id': `${canonicalUrl}#webpage` },
  };
  if (heroImageUrl) jsonLd.image = heroImageUrl;
  return jsonLd;
}

function buildFaqJsonLd(faqItems) {
  if (!Array.isArray(faqItems) || faqItems.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

// Assembles the final article object from the reviewed model output — pure,
// no I/O, exported for tests. Slug resolution is done HERE by code, not
// trusted from the model, because uniqueness is something the pipeline can
// just check deterministically rather than ask the model to guess.
//
// sourceTopic (added 2026-07-26): the exact topics.json "topic" string this
// article was generated from. This is the join key topicAvailability.mjs
// uses to derive "already attempted" from ground truth — see that file's
// header comment. Exact-string, deliberately: editing a topic's wording in
// topics.json makes it newly-eligible for regeneration (README.md).
export function assembleArticle(reviewed, knownSlugs, sourceTopic) {
  const slug = uniqueSlug(reviewed.slug_suggestion, knownSlugs);
  const createdAt = new Date().toISOString();
  const canonicalUrl = `${SITE}/blog/${slug}/`;
  return {
    id: `local-${crypto.randomUUID()}`,
    title: reviewed.title,
    slug,
    content_html: reviewed.content_html,
    meta_description: reviewed.meta_description,
    hero_image_url: null,
    jsonLd: buildJsonLd({ title: reviewed.title, metaDescription: reviewed.meta_description, canonicalUrl, createdAt, heroImageUrl: null }),
    faqJsonLd: buildFaqJsonLd(reviewed.faq_items),
    created_at: createdAt,
    keywords: reviewed.keywords,
    citations: reviewed.citations,
    published: false,
    sourceTopic,
  };
}

// Runs all three compliance gates. Returns { tripped, layer1, layer2,
// layer3 } — never throws on a trip (a trip is an expected, handled
// outcome, not an error); only throws on an actual API/infra failure.
export async function runGates({ apiKey, article }) {
  // logOnlyFindingKeys (2026-07-27): exclusivity:only/superlative demoted
  // for this generator's own articles specifically -- see
  // GENERATOR_LOG_ONLY_FINDING_KEYS's header comment in scan.js. The
  // BabyLoveGrowth batch path (tools/fetch-blog-data.js) calls scanArticle
  // with no options and is unaffected by construction.
  const layer1Result = scanArticle(article, { logOnlyFindingKeys: GENERATOR_LOG_ONLY_FINDING_KEYS });
  // uncitedClaimCandidates (2026-07-26): LOG-ONLY, deliberately NOT added to
  // layer1Result.tripped or folded into `tripped` below -- see
  // findUncitedClaims()'s own header comment in scan.js. Visible in the
  // report for measurement, has zero effect on gate/discard behavior.
  const layer1 = {
    tripped: layer1Result.tripped,
    // Tag each finding with whether it was demoted, so the report is
    // unambiguous about why `tripped` can be false even with findings
    // listed -- every finding still renders (see render-report-md.mjs),
    // the supervised read adjudicates the demoted ones.
    findings: layer1Result.findings.map((f) => ({
      ...f,
      logOnly: GENERATOR_LOG_ONLY_FINDING_KEYS.has(`${f.category}:${f.subcategory || ''}`),
    })),
    uncitedClaimCandidates: findUncitedClaims(article),
  };

  // Layer 2 always runs even if layer 1 already tripped, so a single report
  // shows the full picture from both gates rather than stopping early.
  const layer2Result = await runLlmClaimGate({
    apiKey,
    model: REVIEWER_MODEL,
    title: article.title,
    contentHtml: article.content_html,
    citations: article.citations,
  });
  const layer2 = { tripped: layer2Result.tripped, checklist: layer2Result.checklist };

  // Layer 3 (2026-07-26): real URL resolution for every citation, before
  // the PR opens -- see citationResolver.mjs's header for what this proves
  // and does not prove. Runs independently of layer1/layer2's outcomes,
  // same "always runs, full picture in one report" reasoning.
  const citationResults = await resolveAllCitations(article.citations);
  const citationEval = evaluateCitationResolution(citationResults);
  const layer3 = {
    tripped: citationEval.tripped,
    results: citationResults,
    resolved: citationEval.resolved,
    failed: citationEval.failed,
    unsupported: citationEval.unsupported,
    inconclusive: citationEval.inconclusive,
  };

  return { tripped: layer1.tripped || layer2.tripped || layer3.tripped, layer1, layer2, layer3 };
}

function writeReport(report, reportPath = REPORT_PATH) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[generate] report written to ${path.relative(PROJECT_ROOT, reportPath)}`);
}

// Called on ANY post-generation discard — a gate trip OR a schema-
// validation failure (2026-07-27: previously only gate trips went through
// here; a schema-invalid draft exited 1 with no marker and no PR, leaving
// zero ground truth — see the "silent-discard gap" incident this fixed).
// Writes a rejected-attempt MARKER only — never the discarded article's
// title, slug, or content_html, regardless of which discard reason fired
// — to <generatedDir>/.rejected/<slugified-topic>.json. Fields:
// sourceTopic, rejectedAt, failureClass ('gate_trip' | 'schema_invalid' |
// 'internal_link_invalid' — the last added 2026-08-08, Batch B Part 3),
// layer1, layer2, layer3 (findings snippets only — the same class of
// quoting already used in the PR report all session, never the draft
// itself), schemaErrors (empty array unless failureClass is
// 'schema_invalid'), internalLinkErrors (empty array unless failureClass
// is 'internal_link_invalid').
//
// This file (and the PR opened from it — see generate-article.yml) is what
// makes getOpenPrAttemptedTopics() see the topic as "spoken for" while that
// PR stays open, and what makes getLocallyAttemptedTopics() permanently
// block the topic if that PR is ever merged to main. Both are deliberate
// decisions (README.md), not emergent behavior: an open generator PR means
// the topic is spoken for; closing it unmerged releases it; merging it
// (rejection or real article) leaves a permanent record ground-truth
// checking will always see. That guarantee now holds for a schema-invalid
// discard exactly as it always has for a gate trip.
export function handleTrippedGate(report, { generatedDir = GENERATED_DIR } = {}) {
  const FAILURE_CLASSES = new Set(['schema_invalid', 'internal_link_invalid']);
  const marker = {
    sourceTopic: report.topic.topic,
    rejectedAt: new Date().toISOString(),
    failureClass: FAILURE_CLASSES.has(report.outcome) ? report.outcome : 'gate_trip',
    layer1: report.layer1,
    layer2: report.layer2,
    layer3: report.layer3,
    schemaErrors: report.schemaErrors || [],
    internalLinkErrors: report.internalLinkErrors || [],
  };
  const rejectedDir = path.join(generatedDir, '.rejected');
  fs.mkdirSync(rejectedDir, { recursive: true });
  const markerPath = path.join(rejectedDir, `${slugify(marker.sourceTopic)}.json`);
  fs.writeFileSync(markerPath, `${JSON.stringify(marker, null, 2)}\n`, 'utf8');
  return { markerPath, marker };
}

export async function main({
  apiKey = process.env.ANTHROPIC_API_KEY,
  repo = process.env.GITHUB_REPOSITORY,
  generatedDir = GENERATED_DIR,
  topicsPath = TOPICS_PATH,
  reportPath = REPORT_PATH,
  citationHostLogPath = CITATION_HOST_LOG_PATH,
  blogArticlesPath, // passed through to getKnownRoutes; undefined = its own real blog-articles.json default
  exec, // passed through to getOpenPrAttemptedTopics; undefined = its own real execSync default
} = {}) {
  if (!apiKey) {
    console.error('[generate] ANTHROPIC_API_KEY not set. Refusing to run.');
    process.exitCode = 1;
    return;
  }

  console.log(`[generate] verifying models against live API: writer=${WRITER_MODEL}, reviewer=${REVIEWER_MODEL}...`);
  await verifyModel(apiKey, WRITER_MODEL);
  await verifyModel(apiKey, REVIEWER_MODEL);
  console.log('[generate] both models verified.');

  if (!repo) {
    console.error('[generate] GITHUB_REPOSITORY not set. Topic selection requires it to check open PR branches — refusing to guess. Run this inside GitHub Actions, or set GITHUB_REPOSITORY=owner/repo explicitly.');
    process.exitCode = 1;
    return;
  }

  const topics = loadTopics(topicsPath);
  console.log('[generate] checking ground truth for already-attempted topics (local generated-articles/ + open generator PR branches)...');
  const locallyAttempted = getLocallyAttemptedTopics(generatedDir);
  const prAttempted = getOpenPrAttemptedTopics({ repo, exec }); // throws (fail-closed) on any failure — never falls back to topics.json state
  const attempted = new Set([...locallyAttempted, ...prAttempted]);
  console.log(`[generate] ${attempted.size} topic(s) already attempted (local: ${locallyAttempted.size}, open PRs: ${prAttempted.size}).`);

  const topic = pickNextAvailableTopic(topics, attempted);
  if (!topic) {
    // Deliberately loud and non-zero (2026-08-03) — this used to be a plain
    // console.log with no exit code, the one early-return in this function
    // that didn't fail the run, unlike every guard clause above and below
    // it. On a schedule that's a silent, permanently-green no-op once
    // topics.json runs dry: no PR, no marker, nothing ground-truth-visible,
    // discovered only by a human happening to notice the queue never
    // refills. `::error::` is the same GitHub Actions annotation mechanism
    // checkRejectedMarker.mjs already uses (there via ::warning::) — it
    // surfaces in the run's Annotations list, not just buried in the log.
    // NOT a gate trip and NOT a bug: no rejected-attempt marker gets
    // written (there is no discarded draft to record — generation never
    // started) and no PR of either kind opens. The fix is operational
    // (add topics to topics.json), not a prompt or gate problem, so it
    // must never look like either of those in the Actions list.
    console.error('::error::[generate] QUEUE EXHAUSTED — every topic in topics.json has already been attempted (real article or open rejected-attempt PR). This is not a gate trip and not a bug: add more topics to topics.json. See tools/blog-generator/README.md, "What happens when the queue runs dry."');
    process.exitCode = 1;
    return;
  }
  console.log(`[generate] topic: "${topic.topic}" (keyword: "${topic.target_keyword}")`);

  const systemPrompt = loadSystemPrompt();

  // knownRoutes (Batch B, Part 3, 2026-08-08): built once per run, used
  // twice -- injected into the draft prompt (so the model can only choose
  // real URLs) and read again after generation by the internal-link gate
  // (so a hallucinated URL can never reach the site even if the prompt
  // instruction isn't followed). Same list both times, by construction --
  // never re-derived a second way that could disagree with itself.
  const knownRoutes = getKnownRoutes({ blogArticlesPath });
  const knownRoutesText = formatKnownRoutesForPrompt(knownRoutes);

  console.log('[generate] pass 1/2: draft...');
  const draft = await generateDraft({ apiKey, topic, systemPrompt, knownRoutesText });

  console.log('[generate] pass 2/2: self-review...');
  const reviewed = await selfReview({ apiKey, draft, systemPrompt, knownRoutesText });
  const selfReviewCheck = validateSelfReview(reviewed);
  if (!selfReviewCheck.valid) {
    // Does NOT discard the run -- an inconsistent self-review report is not
    // the same class of problem as a gate trip or a schema-invalid article;
    // the draft itself may well be fine (PR #27, 2026-08-07, was). This
    // only ever prevents report.allSilent from being wrongly true; the
    // article still gets written and opens a normal PR for a human read,
    // same as any other non-silent run. See selfReviewSchema.mjs.
    console.error('[generate] self-review report is INTERNALLY INCONSISTENT (draft_was_clean/violations_found mismatch) -- holding for a human read regardless of gate results:');
    selfReviewCheck.errors.forEach((e) => console.error(`    - ${e}`));
  } else if (reviewed.violations_found?.length) {
    console.log(`[generate] self-review found and fixed ${reviewed.violations_found.length} violation(s):`);
    reviewed.violations_found.forEach((v) => console.log(`    - ${v}`));
  } else {
    console.log('[generate] self-review: draft was already clean per the model (draft_was_clean=true, zero violations).');
  }

  // Deterministic link-restore backstop (2026-08-19) — self-review's own
  // link-validation judgment (prompt.md, fixed 2026-08-12) still
  // occasionally mis-judges an exact-match URL as non-matching and strips
  // a genuinely valid link to plain text (observed live, PR #32,
  // 2026-08-17 — see internalLinkRestore.mjs's header comment for the
  // full incident). Runs here, between self-review and assembleArticle,
  // so the restored content_html is what schema validation, the
  // internal-link gate, and the written article all see — never a
  // separate, second copy of the truth.
  const linkRestore = restoreStrippedInternalLinks(draft.content_html, reviewed.content_html, knownRoutes);
  reviewed.content_html = linkRestore.html;
  if (linkRestore.restored.length > 0) {
    console.log(`[generate] link-restore: self-review wrongly stripped ${linkRestore.restored.length} valid link(s) -- restored:`);
    linkRestore.restored.forEach((r) => console.log(`    - ${r.href} ("${r.text}")`));
  }
  if (linkRestore.skipped.length > 0) {
    console.log(`[generate] link-restore: ${linkRestore.skipped.length} stripped known-route link(s) could not be safely restored (left as plain text):`);
    linkRestore.skipped.forEach((s) => console.log(`    - ${s.href} ("${s.text}") — ${s.reason}`));
  }

  const knownSlugs = getKnownSlugs({ generatedDir });
  const article = assembleArticle(reviewed, knownSlugs, topic.topic);

  console.log('[generate] running compliance gates (layer 1: regex scanner, layer 2: independent LLM review, layer 3: citation URL resolution)...');
  const gateResult = await runGates({ apiKey, article });

  // Durable per-host UNREACHABLE_LIKELY_BOT log, written regardless of
  // trip/success outcome -- a bot-blocked host is worth recording even on
  // an otherwise-clean run, and this is the only way the log accumulates a
  // real per-host hit rate across articles instead of reacting to one
  // impression (see citationHostLog.mjs). Committed, not gitignored, so it
  // survives CI's fresh checkout every run.
  const hostLogEntries = buildHostLogEntries({ runId: process.env.GITHUB_RUN_ID || 'local', sourceTopic: topic.topic, citationResults: gateResult.layer3.results });
  if (hostLogEntries.length > 0) {
    appendHostLogEntries(citationHostLogPath, hostLogEntries);
    console.log(`[generate] logged ${hostLogEntries.length} UNREACHABLE_LIKELY_BOT citation host(s) to ${path.relative(PROJECT_ROOT, citationHostLogPath)} (not a gate trip -- inconclusive, human decides)`);
  }
  // Surfaced unconditionally (trip or not) -- a bot-blocked citation on an
  // otherwise-clean, successfully-generated article is still worth a
  // human's attention in the PR, not just on a discarded run.
  if (gateResult.layer3.inconclusive.length > 0) {
    console.log('[generate] layer 3: UNREACHABLE_LIKELY_BOT citations (inconclusive, NOT a trip on their own, human decides):');
    gateResult.layer3.inconclusive.forEach((r) => {
      console.log(`    [${r.host}] status=${r.status} id=${r.id} "${r.sourceName}" — ${r.url}`);
    });
  }
  // LOG-ONLY, unconditional -- see findUncitedClaims()'s header comment.
  // Never affects trip/discard behavior; visible here purely so a false-
  // positive rate can eventually be measured across real runs.
  if (gateResult.layer1.uncitedClaimCandidates.length > 0) {
    console.log(`[generate] layer 1 (log-only): ${gateResult.layer1.uncitedClaimCandidates.length} uncited-claim candidate(s), not gate-trip-worthy yet:`);
    gateResult.layer1.uncitedClaimCandidates.forEach((f) => {
      console.log(`    [${f.subcategory}] "${f.matchedText}" — ${f.sentence}`);
    });
  }

  // report.article (title/slug of the discarded draft) is deliberately NOT
  // included here — only added in the success path below. A tripped run's
  // report becomes the rejected-attempt PR's body (render-report-md.mjs);
  // it must never carry the discarded article's identity, only the gate
  // findings that justified discarding it.
  const report = {
    generatedAt: new Date().toISOString(),
    topic,
    layer1: gateResult.layer1,
    layer2: gateResult.layer2,
    layer3: gateResult.layer3,
    // violationsFound (2026-08-03): previously computed but never carried
    // into the report — added so it's visible in the PR body/audit trail
    // and so computeAllSilent() (the auto-publish gate) has it without a
    // second parameter thread. Present on every outcome, not just
    // 'generated' — a tripped run's self-review pass still ran.
    // draftWasClean/valid/errors (2026-08-07): the self-review reporting
    // fix — see selfReviewSchema.mjs and autoPublishGate.mjs. valid=false
    // means draft_was_clean and violations_found disagreed; render-report-
    // md.mjs surfaces that explicitly rather than rendering the mismatch
    // as an ordinary-looking correction list.
    selfReview: {
      draftWasClean: reviewed.draft_was_clean,
      violationsFound: reviewed.violations_found || [],
      valid: selfReviewCheck.valid,
      errors: selfReviewCheck.errors,
    },
    outcome: null,
  };

  if (gateResult.tripped) {
    report.outcome = 'skipped';
    console.error(`[generate] TRIPPED — discarding. layer1=${gateResult.layer1.tripped} layer2=${gateResult.layer2.tripped} layer3=${gateResult.layer3.tripped}`);
    if (gateResult.layer1.tripped) {
      console.error('[generate] layer 1 (regex scanner) findings:');
      gateResult.layer1.findings.forEach((f) => {
        console.error(`    [${f.category}${f.subcategory ? ':' + f.subcategory : ''}] "${f.matchedText}" — ${f.sentence}`);
      });
    }
    if (gateResult.layer2.tripped) {
      console.error('[generate] layer 2 (LLM claim review) findings:');
      const c = gateResult.layer2.checklist;
      for (const [key, value] of Object.entries(c)) {
        if (key.endsWith('_claim') || key.endsWith('_mismatch') || key === 'uncited_statistic' || key === 'legal_duty_overstated') {
          if (value === true) console.error(`    [${key}] true — evidence: ${c[`${key.replace(/_claim$|_mismatch$|_overstated$/, '')}_evidence`] || c[key.replace('uncited_statistic', 'statistic_evidence')] || '(see checklist)'}`);
        }
      }
      console.error(`    full checklist: ${JSON.stringify(c)}`);
    }
    if (gateResult.layer3.tripped) {
      if (gateResult.layer3.failed.length > 0) {
        console.error('[generate] layer 3 (citation URL resolution) FAILED citations (dead link, not a bot-block):');
        gateResult.layer3.failed.forEach((r) => {
          console.error(`    [${r.host || '(unparseable)'}] status=${r.status ?? '(no response)'} id=${r.id} "${r.sourceName}" — ${r.url}${r.error ? ` — ${r.error}` : ''}`);
        });
      }
      if (gateResult.layer3.unsupported.length > 0) {
        console.error('[generate] layer 3 (citation URL resolution) RESOLVED_UNSUPPORTED citations (URL resolves, but the cited content is not actually there):');
        gateResult.layer3.unsupported.forEach((r) => {
          console.error(`    [${r.host}] status=${r.status} id=${r.id} "${r.sourceName}" — expected token "${r.token}" not found — ${r.url}`);
        });
      }
    }
    const { markerPath } = handleTrippedGate(report, { generatedDir });
    console.log(`[generate] rejected-attempt marker written to ${path.relative(PROJECT_ROOT, markerPath)} — topic stays "spoken for" until this run's PR is closed (releases it) or merged (permanently blocks it)`);
    writeReport(report, reportPath);
    process.exitCode = 1;
    return;
  }

  const schemaCheck = validateArticleSchema(article);
  if (!schemaCheck.valid) {
    // Deliberately NOT setting report.article here (title/slug) — same
    // identity-withholding rule as a gate trip above; this report becomes
    // a rejected-attempt PR's body via handleTrippedGate below, exactly
    // like a gate trip, and must never carry the discarded draft's
    // identity, only the findings (here: schema errors) that justified
    // discarding it.
    report.outcome = 'schema_invalid';
    report.schemaErrors = schemaCheck.errors;
    console.error('[generate] article passed both compliance gates but FAILED schema validation:');
    schemaCheck.errors.forEach((e) => console.error(`    - ${e}`));
    const { markerPath } = handleTrippedGate(report, { generatedDir });
    console.log(`[generate] rejected-attempt marker written to ${path.relative(PROJECT_ROOT, markerPath)} — topic stays "spoken for" until this run's PR is closed (releases it) or merged (permanently blocks it)`);
    writeReport(report, reportPath);
    process.exitCode = 1;
    return;
  }

  // Internal-link gate (Batch B, Part 3, 2026-08-08) — every internal href
  // in content_html must match the same knownRoutes list injected into the
  // draft prompt above. Runs after schema validation, same discard path as
  // a schema-invalid draft (handleTrippedGate below) -- a hallucinated
  // internal URL is exactly the same class of problem as a malformed
  // article: never written, never published, always leaves a rejected-
  // attempt marker so the topic isn't silently lost.
  const linkCheck = validateInternalLinks(article.content_html, knownRoutes);
  if (!linkCheck.valid) {
    report.outcome = 'internal_link_invalid';
    report.internalLinkErrors = linkCheck.invalidLinks;
    console.error('[generate] article passed schema validation but contains invented/unknown internal link(s):');
    linkCheck.invalidLinks.forEach((l) => console.error(`    - ${l}`));
    const { markerPath } = handleTrippedGate(report, { generatedDir });
    console.log(`[generate] rejected-attempt marker written to ${path.relative(PROJECT_ROOT, markerPath)} — topic stays "spoken for" until this run's PR is closed (releases it) or merged (permanently blocks it)`);
    writeReport(report, reportPath);
    process.exitCode = 1;
    return;
  }
  if (linkCheck.checkedCount > 0) {
    console.log(`[generate] internal-link gate: ${linkCheck.checkedCount} internal link(s), all valid.`);
  }

  fs.mkdirSync(generatedDir, { recursive: true });
  const outPath = path.join(generatedDir, `${article.slug}.json`);
  fs.writeFileSync(outPath, `${JSON.stringify(article, null, 2)}\n`, 'utf8');

  report.article = { title: article.title, slug: article.slug };
  report.outcome = 'generated';
  report.outputPath = path.relative(PROJECT_ROOT, outPath);
  // allSilent (2026-08-03, owner decision — see README.md "Automated
  // publishing"): computed here, once, on the same report object the PR
  // body and checkAllSilent.mjs both read — never re-derived separately
  // by the workflow (which would mean two places could disagree about
  // what "silent" means). See autoPublishGate.mjs for exactly what this
  // requires.
  report.allSilent = computeAllSilent(report);
  writeReport(report, reportPath);

  console.log(`[generate] SUCCESS — wrote ${path.relative(PROJECT_ROOT, outPath)}`);
  console.log(`[generate] title: ${article.title}`);
  console.log(`[generate] published: ${article.published} (deliberately false — flipping to true is a separate, explicit edit, whether done by the auto-publish path or a human PR review)`);
  console.log(`[generate] allSilent: ${report.allSilent} (${report.allSilent ? 'eligible for auto-merge/auto-publish' : 'holds for a supervised human read'})`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((err) => {
    console.error(`[generate] FATAL: ${err.message}`);
    process.exitCode = 1;
  });
}
