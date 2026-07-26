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
import { getKnownSlugs, uniqueSlug, slugify } from './slugs.js';
import { scanArticle } from '../blog-compliance/scan.js';
import { getLocallyAttemptedTopics, getOpenPrAttemptedTopics, pickNextAvailableTopic } from './topicAvailability.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const TOPICS_PATH = path.join(__dirname, 'topics.json');
const PROMPT_PATH = path.join(__dirname, 'prompt.md');
const GENERATED_DIR = path.join(PROJECT_ROOT, 'src', 'data', 'generated-articles');
const REPORT_PATH = path.join(__dirname, '.last-run-report.json');
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
  required: ['title', 'slug_suggestion', 'meta_description', 'content_html', 'keywords', 'faq_items'],
};

const DRAFT_TOOL = {
  name: 'submit_article_draft',
  description: 'Submit the generated article draft.',
  input_schema: ARTICLE_TOOL_SCHEMA,
};

const REVIEW_TOOL = {
  name: 'submit_reviewed_article',
  description: 'Submit the self-reviewed, corrected article.',
  input_schema: {
    type: 'object',
    properties: {
      violations_found: { type: 'array', items: { type: 'string' }, description: 'Plain-language description of each violation found and fixed. Empty array if the draft was already clean.' },
      ...ARTICLE_TOOL_SCHEMA.properties,
    },
    required: ['violations_found', ...ARTICLE_TOOL_SCHEMA.required],
  },
};

function loadTopics() {
  return JSON.parse(fs.readFileSync(TOPICS_PATH, 'utf8'));
}

function loadSystemPrompt() {
  return fs.readFileSync(PROMPT_PATH, 'utf8');
}

async function generateDraft({ apiKey, topic, systemPrompt }) {
  const response = await createMessage({
    apiKey,
    model: WRITER_MODEL,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Write an article for this topic: "${topic.topic}"\nTarget keyword: "${topic.target_keyword}"`,
      },
    ],
    tools: [DRAFT_TOOL],
    toolChoice: { type: 'tool', name: DRAFT_TOOL.name },
  });
  return extractToolInput(response, DRAFT_TOOL.name);
}

async function selfReview({ apiKey, draft, systemPrompt }) {
  const response = await createMessage({
    apiKey,
    model: WRITER_MODEL,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Review this draft against the six hard rules and the self-review pass instructions, then submit the corrected version:\n\n${JSON.stringify(draft, null, 2)}`,
      },
    ],
    tools: [REVIEW_TOOL],
    toolChoice: { type: 'tool', name: REVIEW_TOOL.name },
  });
  return extractToolInput(response, REVIEW_TOOL.name);
}

function buildJsonLd({ title, metaDescription, canonicalUrl, createdAt }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: metaDescription,
    url: canonicalUrl,
    datePublished: createdAt,
    author: { '@type': 'Person', name: 'George Khazanovskiy' },
  };
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
    jsonLd: buildJsonLd({ title: reviewed.title, metaDescription: reviewed.meta_description, canonicalUrl, createdAt }),
    faqJsonLd: buildFaqJsonLd(reviewed.faq_items),
    created_at: createdAt,
    keywords: reviewed.keywords,
    published: false,
    sourceTopic,
  };
}

// Runs both compliance gates. Returns { tripped, layer1, layer2 } — never
// throws on a trip (a trip is an expected, handled outcome, not an error);
// only throws on an actual API/infra failure.
export async function runGates({ apiKey, article }) {
  const layer1Result = scanArticle(article);
  const layer1 = { tripped: layer1Result.tripped, findings: layer1Result.findings };

  // Layer 2 always runs even if layer 1 already tripped, so a single report
  // shows the full picture from both gates rather than stopping early.
  const layer2Result = await runLlmClaimGate({
    apiKey,
    model: REVIEWER_MODEL,
    title: article.title,
    contentHtml: article.content_html,
  });
  const layer2 = { tripped: layer2Result.tripped, checklist: layer2Result.checklist };

  return { tripped: layer1.tripped || layer2.tripped, layer1, layer2 };
}

function writeReport(report) {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[generate] report written to ${path.relative(PROJECT_ROOT, REPORT_PATH)}`);
}

export async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[generate] ANTHROPIC_API_KEY not set. Refusing to run.');
    process.exitCode = 1;
    return;
  }

  console.log(`[generate] verifying models against live API: writer=${WRITER_MODEL}, reviewer=${REVIEWER_MODEL}...`);
  await verifyModel(apiKey, WRITER_MODEL);
  await verifyModel(apiKey, REVIEWER_MODEL);
  console.log('[generate] both models verified.');

  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) {
    console.error('[generate] GITHUB_REPOSITORY not set. Topic selection requires it to check open PR branches — refusing to guess. Run this inside GitHub Actions, or set GITHUB_REPOSITORY=owner/repo explicitly.');
    process.exitCode = 1;
    return;
  }

  const topics = loadTopics();
  console.log('[generate] checking ground truth for already-attempted topics (local generated-articles/ + open generator PR branches)...');
  const locallyAttempted = getLocallyAttemptedTopics(GENERATED_DIR);
  const prAttempted = getOpenPrAttemptedTopics({ repo }); // throws (fail-closed) on any failure — never falls back to topics.json state
  const attempted = new Set([...locallyAttempted, ...prAttempted]);
  console.log(`[generate] ${attempted.size} topic(s) already attempted (local: ${locallyAttempted.size}, open PRs: ${prAttempted.size}).`);

  const topic = pickNextAvailableTopic(topics, attempted);
  if (!topic) {
    console.log('[generate] no available topics — every topic in topics.json has already been attempted (real article or open rejected-attempt PR). Nothing to do.');
    return;
  }
  console.log(`[generate] topic: "${topic.topic}" (keyword: "${topic.target_keyword}")`);

  const systemPrompt = loadSystemPrompt();

  console.log('[generate] pass 1/2: draft...');
  const draft = await generateDraft({ apiKey, topic, systemPrompt });

  console.log('[generate] pass 2/2: self-review...');
  const reviewed = await selfReview({ apiKey, draft, systemPrompt });
  if (reviewed.violations_found?.length) {
    console.log(`[generate] self-review found and fixed ${reviewed.violations_found.length} violation(s):`);
    reviewed.violations_found.forEach((v) => console.log(`    - ${v}`));
  } else {
    console.log('[generate] self-review: draft was already clean per the model.');
  }

  const knownSlugs = getKnownSlugs();
  const article = assembleArticle(reviewed, knownSlugs, topic.topic);

  console.log('[generate] running compliance gates (layer 1: regex scanner, layer 2: independent LLM review)...');
  const gateResult = await runGates({ apiKey, article });

  const report = {
    generatedAt: new Date().toISOString(),
    topic,
    article: { title: article.title, slug: article.slug },
    layer1: gateResult.layer1,
    layer2: gateResult.layer2,
    outcome: null,
  };

  if (gateResult.tripped) {
    report.outcome = 'skipped';
    console.error(`[generate] TRIPPED — discarding. layer1=${gateResult.layer1.tripped} layer2=${gateResult.layer2.tripped}`);
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
        if (key.endsWith('_claim') || key.endsWith('_mismatch') || key === 'uncited_statistic') {
          if (value === true) console.error(`    [${key}] true — evidence: ${c[`${key.replace(/_claim$|_mismatch$/, '')}_evidence`] || c[key.replace('uncited_statistic', 'statistic_evidence')] || '(see checklist)'}`);
        }
      }
      console.error(`    full checklist: ${JSON.stringify(c)}`);
    }
    writeReport(report);
    process.exitCode = 1;
    return;
  }

  const schemaCheck = validateArticleSchema(article);
  if (!schemaCheck.valid) {
    report.outcome = 'schema_invalid';
    report.schemaErrors = schemaCheck.errors;
    console.error('[generate] article passed both compliance gates but FAILED schema validation:');
    schemaCheck.errors.forEach((e) => console.error(`    - ${e}`));
    writeReport(report);
    process.exitCode = 1;
    return;
  }

  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  const outPath = path.join(GENERATED_DIR, `${article.slug}.json`);
  fs.writeFileSync(outPath, `${JSON.stringify(article, null, 2)}\n`, 'utf8');

  report.outcome = 'generated';
  report.outputPath = path.relative(PROJECT_ROOT, outPath);
  writeReport(report);

  console.log(`[generate] SUCCESS — wrote ${path.relative(PROJECT_ROOT, outPath)}`);
  console.log(`[generate] title: ${article.title}`);
  console.log(`[generate] published: ${article.published} (deliberately false — flipping to true is a separate, explicit PR-review edit)`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((err) => {
    console.error(`[generate] FATAL: ${err.message}`);
    process.exitCode = 1;
  });
}
