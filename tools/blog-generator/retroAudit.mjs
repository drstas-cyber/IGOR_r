// Weekly retrospective audit (hardening batch, 2026-08-25) — the real
// implementation of the compensating control README.md's "Automated
// publishing" section has promised since 2026-08-03 and, per git history,
// never actually run even once in the ~3 weeks since. Six categories, same
// scale as every prior article read this project has done: fabricated
// speech, misattributed quotes, prohibited claims, stats-vs-citations,
// identity block, quality/rendering.
//
// Four of six are fully deterministic and reuse existing, already-tested
// infrastructure rather than re-implementing judgment calls this pipeline
// already made once:
//   - identity block        -> findIdentityCompletenessErrors() +
//                               scanArticle()'s wrong-* findings
//   - prohibited claims      -> scanArticle(), same generator demotion
//                               options generate.mjs's own Layer 1 uses
//   - stats-vs-citations     -> findUncitedClaims() (log-only candidates)
//                               + a LIVE re-resolution of every citation
//                               URL (citationResolver.mjs) — this is a
//                               genuine re-check, not a replay: a citation
//                               that resolved at generation time can rot
//                               (page moved, statute renumbered) by the
//                               time the retro runs
//   - quality/rendering      -> evaluatePublishStatus() (publishStatusReport.mjs)
//                               plus its own live serve check
// The remaining two — fabricated speech, misattributed quotes — need
// judgment a regex cannot supply; see retroClaimGate.mjs for that call,
// same "independent LLM, structured tool-use" discipline as Layer 2.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanArticle, findIdentityCompletenessErrors, findUncitedClaims, GENERATOR_LOG_ONLY_FINDING_KEYS } from '../blog-compliance/scan.js';
import { resolveAllCitations, evaluateCitationResolution } from './citationResolver.mjs';
import { runRetroClaimGate } from './retroClaimGate.mjs';
import { getRecentlyPublishedSlugs } from './retroPublishLog.mjs';
import { evaluatePublishStatus } from './publishStatusReport.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const GENERATED_DIR = path.join(PROJECT_ROOT, 'src', 'data', 'generated-articles');
const HEADERS_PATH = path.join(PROJECT_ROOT, 'public', '_headers');
const BLOG_DATA_PATH = path.join(PROJECT_ROOT, 'src', 'data', 'blog-articles.json');
const SITE = 'https://temeculavalleyhomes.us';

const WRONG_IDENTITY_CATEGORIES = new Set(['wrong-dre', 'wrong-brokerage', 'wrong-phone', 'wrong-email']);

export function readArticleFile(slug, generatedDir = GENERATED_DIR) {
  const filePath = path.join(generatedDir, `${slug}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// computeArticleVerdict (exported, pure) — folds every check's output into
// one CLEAR/NEEDS-FIX/REJECT verdict plus a flat list of human-readable
// reasons. REJECT: anything that would be a genuine defect on a page real
// visitors are reading right now (a wrong contact detail, a missing
// identity block, a dead/unsupported citation, a real Layer-1 trip,
// fabricated speech, a misattributed quote, or an incomplete/non-live
// publish sequence). NEEDS-FIX: real signal, lower severity, does not by
// itself mean the page is actively wrong (a demoted Layer-1 finding, an
// uncited-claim candidate, a bot-blocked/inconclusive citation, or a live
// check this environment simply couldn't run). CLEAR: none of the above.
export function computeArticleVerdict({
  identityErrors = [],
  wrongIdentityFindings = [],
  prohibitedClaimFindings = [],
  uncitedClaimCandidates = [],
  citationEval = { failed: [], unsupported: [], inconclusive: [] },
  retroClaimResult = null,
  publishStatus = { complete: true },
  liveStatus = null,
}) {
  const reasons = [];
  const nonLogOnlyClaims = prohibitedClaimFindings.filter((f) => !f.logOnly);
  const logOnlyClaims = prohibitedClaimFindings.filter((f) => f.logOnly);

  if (identityErrors.length > 0) reasons.push({ severity: 'REJECT', text: `identity block incomplete: ${identityErrors.join('; ')}` });
  if (wrongIdentityFindings.length > 0) reasons.push({ severity: 'REJECT', text: `wrong identity detail live on the page: ${wrongIdentityFindings.map((f) => f.matchedText).join('; ')}` });
  if (nonLogOnlyClaims.length > 0) reasons.push({ severity: 'REJECT', text: `prohibited claim(s) found: ${nonLogOnlyClaims.map((f) => `[${f.category}${f.subcategory ? ':' + f.subcategory : ''}] "${f.matchedText}"`).join('; ')}` });
  if ((citationEval.failed || []).length > 0) reasons.push({ severity: 'REJECT', text: `citation(s) no longer resolve: ${citationEval.failed.map((r) => r.url).join('; ')}` });
  if ((citationEval.unsupported || []).length > 0) reasons.push({ severity: 'REJECT', text: `citation(s) resolve but no longer support the cited claim: ${citationEval.unsupported.map((r) => r.url).join('; ')}` });
  if (retroClaimResult?.tripped) {
    if (retroClaimResult.checklist?.fabricated_speech) reasons.push({ severity: 'REJECT', text: `fabricated speech: ${retroClaimResult.checklist.fabricated_speech_evidence}` });
    if (retroClaimResult.checklist?.misattributed_quote) reasons.push({ severity: 'REJECT', text: `misattributed quote: ${retroClaimResult.checklist.misattributed_quote_evidence}` });
  }
  if (publishStatus && publishStatus.complete === false) {
    const failedChecks = (publishStatus.checks || []).filter((c) => !c.ok).map((c) => c.label);
    reasons.push({ severity: 'REJECT', text: `publish sequence incomplete: ${failedChecks.join('; ')}` });
  }
  if (liveStatus?.status === 'FAIL') reasons.push({ severity: 'REJECT', text: `live check failed: ${liveStatus.detail}` });

  if (logOnlyClaims.length > 0) reasons.push({ severity: 'NEEDS-FIX', text: `demoted (log-only) finding(s): ${logOnlyClaims.map((f) => `[${f.category}:${f.subcategory}] "${f.matchedText}"`).join('; ')}` });
  if (uncitedClaimCandidates.length > 0) reasons.push({ severity: 'NEEDS-FIX', text: `uncited-claim candidate(s): ${uncitedClaimCandidates.map((f) => `"${f.matchedText}"`).join('; ')}` });
  if ((citationEval.inconclusive || []).length > 0) reasons.push({ severity: 'NEEDS-FIX', text: `citation(s) inconclusive (likely bot-blocked, not proof of a bad citation): ${citationEval.inconclusive.map((r) => r.url).join('; ')}` });
  if (liveStatus?.status === 'UNVERIFIED-TOOLING') reasons.push({ severity: 'NEEDS-FIX', text: 'live check could not run in this environment (no outbound network) — local checks only' });

  const verdict = reasons.some((r) => r.severity === 'REJECT') ? 'REJECT' : reasons.length > 0 ? 'NEEDS-FIX' : 'CLEAR';
  return { verdict, reasons };
}

// auditArticle (exported) — runs every check for one article and folds the
// result through computeArticleVerdict(). `skipLive` mirrors
// publishStatusReport.mjs's own flag (network-less environments); `apiKey`
// missing means the fabricated-speech/misattributed-quote check is skipped
// entirely and reported as its own NEEDS-FIX reason (never silently
// treated as clean — the retro must never claim to have checked something
// it didn't have the credentials to check).
export async function auditArticle({ slug, article, apiKey, model = 'claude-haiku-4-5-20251001', skipLive = false, headersText, blogArticlesSlugs, fetchImpl = fetch }) {
  if (!article) {
    return { slug, verdict: 'REJECT', reasons: [{ severity: 'REJECT', text: 'article JSON not found in generated-articles/ — published commit exists but the file is gone' }] };
  }

  const identityErrors = findIdentityCompletenessErrors(article);
  const scanResult = scanArticle(article, { logOnlyFindingKeys: GENERATOR_LOG_ONLY_FINDING_KEYS });
  const wrongIdentityFindings = scanResult.findings.filter((f) => WRONG_IDENTITY_CATEGORIES.has(f.category));
  const prohibitedClaimFindings = scanResult.findings.filter((f) => !WRONG_IDENTITY_CATEGORIES.has(f.category));
  const uncitedClaimCandidates = findUncitedClaims(article);

  // resolveCitationUrl (citationResolver.mjs) uses the global fetch directly,
  // same as every other real-network check in this pipeline (Layer 3 at
  // generation time included) -- tests stub globalThis.fetch rather than
  // threading a fetchImpl through here.
  const citationResults = await resolveAllCitations(article.citations || []);
  const citationEval = evaluateCitationResolution(citationResults);

  let retroClaimResult = null;
  let retroClaimError = null;
  if (apiKey) {
    try {
      retroClaimResult = await runRetroClaimGate({ apiKey, model, title: article.title, contentHtml: article.content_html });
    } catch (err) {
      retroClaimError = err.message;
    }
  }

  const publishStatus = evaluatePublishStatus({
    slug,
    article,
    headersText: headersText ?? (fs.existsSync(HEADERS_PATH) ? fs.readFileSync(HEADERS_PATH, 'utf8') : ''),
    blogArticlesSlugs: blogArticlesSlugs ?? readBlogArticlesSlugsFromDisk(),
  });

  let liveStatus = null;
  if (!skipLive) {
    liveStatus = await checkLiveServe(slug, fetchImpl);
  }

  // apiKey-missing/retroClaimError are appended AFTER computeArticleVerdict
  // rather than passed into it, deliberately: computeArticleVerdict is pure
  // and takes check RESULTS, not environment state (whether a key was
  // configured). The re-derivation below is the same one-line rule
  // computeArticleVerdict itself uses, kept in sync by being the only two
  // places this rule is allowed to live.
  const { reasons } = computeArticleVerdict({
    identityErrors, wrongIdentityFindings, prohibitedClaimFindings, uncitedClaimCandidates,
    citationEval, retroClaimResult, publishStatus, liveStatus,
  });

  if (retroClaimError) reasons.push({ severity: 'NEEDS-FIX', text: `fabricated-speech/misattributed-quote check could not run: ${retroClaimError}` });
  else if (!apiKey) reasons.push({ severity: 'NEEDS-FIX', text: 'fabricated-speech/misattributed-quote check skipped — no ANTHROPIC_API_KEY in this environment' });

  const verdict = reasons.some((r) => r.severity === 'REJECT') ? 'REJECT' : reasons.length > 0 ? 'NEEDS-FIX' : 'CLEAR';

  return {
    slug, title: article.title, verdict, reasons,
    detail: { identityErrors, wrongIdentityFindings, prohibitedClaimFindings, uncitedClaimCandidates, citationEval, retroClaimResult, publishStatus, liveStatus },
  };
}

function readBlogArticlesSlugsFromDisk() {
  if (!fs.existsSync(BLOG_DATA_PATH)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(BLOG_DATA_PATH, 'utf8'));
    return Array.isArray(parsed) ? parsed.map((a) => a.slug).filter(Boolean) : [];
  } catch {
    return [];
  }
}

async function checkLiveServe(slug, fetchImpl = fetch) {
  const url = `${SITE}/blog/${slug}/`;
  try {
    const res = await fetchImpl(url, { redirect: 'follow' });
    if (!res.ok) return { status: 'FAIL', detail: `HTTP ${res.status}` };
    const html = await res.text();
    return /<title>[^<]+<\/title>/.test(html)
      ? { status: 'OK', detail: `HTTP ${res.status}, <title> present` }
      : { status: 'FAIL', detail: `HTTP ${res.status} but no <title> found` };
  } catch (err) {
    return { status: 'UNVERIFIED-TOOLING', detail: `network check unavailable: ${err.message}` };
  }
}

// runWeeklyRetro (exported) — the top-level entry point the workflow (and
// the CLI block below) call. Scopes to getRecentlyPublishedSlugs()'s 7-day
// rolling window by default; a wider/explicit slug list can be passed
// directly (the backfill path uses this, see retroBackfill.mjs) rather than
// re-deriving scope from git history a second way.
export async function runWeeklyRetro({
  sinceDays = 7,
  slugs, // explicit override — if provided, getRecentlyPublishedSlugs is never called
  apiKey = process.env.ANTHROPIC_API_KEY,
  model = 'claude-haiku-4-5-20251001',
  generatedDir = GENERATED_DIR,
  skipLive = false,
  exec,
  fetchImpl = fetch,
} = {}) {
  const scope = slugs
    ? slugs.map((slug) => ({ slug }))
    : getRecentlyPublishedSlugs({ sinceDays, ...(exec ? { exec } : {}) });

  const headersText = fs.existsSync(HEADERS_PATH) ? fs.readFileSync(HEADERS_PATH, 'utf8') : '';
  const blogArticlesSlugs = readBlogArticlesSlugsFromDisk();

  const articles = [];
  for (const { slug } of scope) {
    const article = readArticleFile(slug, generatedDir);
    const result = await auditArticle({ slug, article, apiKey, model, skipLive, headersText, blogArticlesSlugs, fetchImpl });
    articles.push(result);
  }

  const overall = articles.some((a) => a.verdict === 'REJECT') ? 'REJECT'
    : articles.some((a) => a.verdict === 'NEEDS-FIX') ? 'NEEDS-FIX'
    : 'CLEAR';

  return {
    generatedAt: new Date().toISOString(),
    windowDays: slugs ? null : sinceDays,
    scopeCount: scope.length,
    articles,
    overall,
    hasAnyFindings: articles.some((a) => a.reasons.length > 0),
  };
}
