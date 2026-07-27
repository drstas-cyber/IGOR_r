// Scans article title + content_html for compliance red flags. See
// tools/blog-compliance/README.md — this is a LAST LINE OF DEFENSE, not
// the fix (the fix is upstream, in BabyLoveGrowth's Special Instructions).
//
// Exclusion, never silent rewriting: a tripped article is left out of the
// build entirely, logged loudly with the matched sentence, never edited.

import {
  REFERENCE,
  MAX_TRIP_RATE,
  SUPERLATIVE_TRIGGER_PATTERN,
  EXCLUSIVITY_CONTEXT_WORDS,
  EXCLUSIVITY_WINDOW_WORDS,
  ONLY_EXCLUDE_PATTERNS,
  BEST_EXCLUDE_PATTERNS,
  TENURE_PATTERNS,
  REVIEW_PATTERNS,
  RATED_N_PATTERN,
  RATED_N_CONTEXT_WORDS,
  RATED_N_WINDOW_WORDS,
  URGENCY_STAT_PATTERNS,
  COMPETITOR_DOMAIN_PATTERN,
  DISPARAGEMENT_WORDS,
  COMPARISON_FRAMING_WORDS,
  DISPARAGEMENT_WINDOW_WORDS,
  DRE_PATTERN,
  BROKERAGE_MENTION_PATTERN,
  PHONE_PATTERN,
  EMAIL_PATTERN,
  UNCITED_CLAIM_CANDIDATE_PATTERNS,
  UNCITED_CLAIM_MARKER_WINDOW_CHARS,
} from './patterns.js';

// Strips tags to plain text so a phrase split across tags (e.g.
// "the <strong>only</strong> agent") still matches as "the only agent".
// Block-level tags become a space (not nothing) so words don't glue
// together across element boundaries ("</p><p>" shouldn't merge into one
// word), and HTML entities are decoded for the common cases that show up
// in generated content.
export function htmlToText(html) {
  if (!html) return '';
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function sentenceContaining(text, index, length) {
  // Best-effort sentence extraction around a match, for the "matched
  // sentence" the report/log must show — not linguistically perfect, just
  // enough for a human to see the actual context immediately.
  const start = Math.max(0, text.lastIndexOf('.', index) + 1);
  const endSearch = text.indexOf('.', index + length);
  const end = endSearch === -1 ? Math.min(text.length, index + length + 120) : endSearch + 1;
  return text.slice(start, end).trim();
}

function wordWindow(text, index, windowWords) {
  const before = text.slice(0, index).split(/\s+/).slice(-windowWords).join(' ');
  const after = text.slice(index).split(/\s+/).slice(0, windowWords).join(' ');
  return `${before} ${after}`;
}

// Block-level tags that mark a genuine content boundary for the windowed-
// proximity checks below (findExclusivityClaims, findDisparagement,
// findRatedN) -- a context word in one paragraph/list item must not make an
// unrelated trigger word in a SIBLING paragraph/list item look "nearby"
// just because htmlToText() flattens the whole document into one
// space-joined string with no sentence/list-item boundaries preserved.
// Deliberately NOT inline tags (<strong>, <em>, <sup>, <a>, ...) -- "the
// <strong>only</strong> agent" must still read as one continuous phrase,
// matching htmlToText()'s own documented contract (see its tests).
const BLOCK_TAG_SPLIT_PATTERN = /<\/?(?:p|li|ul|ol|div|h[1-6]|tr|td|th|table|thead|tbody|blockquote)\b[^>]*>/gi;

// Splits raw HTML into per-block-element plain-text segments, each run
// through the EXISTING htmlToText() unchanged -- one tag-stripping/entity-
// decoding implementation in this file, not two copies that can drift.
// Used ONLY by the windowed-proximity checks; everything else in this file
// (findRegexCategory, findWrongIdentity, findUncitedClaims) still scans the
// single flattened `combined` string exactly as before, untouched by this.
//
// Found 2026-07-27, article-3 bait-run draw 2: a <ul> had "agent" in one
// <li> and an unrelated "only" four bullets later in a different <li>;
// flattened into one blob they landed within EXCLUSIVITY_WINDOW_WORDS of
// each other and false-tripped exclusivity on a sentence that never
// mentioned George at all. Segmenting per block element means each
// windowed search only ever looks within the same paragraph/list item the
// trigger word actually appeared in.
function splitIntoWindowSegments(html) {
  if (!html) return [];
  return html
    .split(BLOCK_TAG_SPLIT_PATTERN)
    .map((chunk) => htmlToText(chunk))
    .filter((s) => s.length > 0);
}

function findExclusivityClaims(segments) {
  const findings = [];
  for (const text of segments) {
    SUPERLATIVE_TRIGGER_PATTERN.lastIndex = 0;
    let m;
    while ((m = SUPERLATIVE_TRIGGER_PATTERN.exec(text)) !== null) {
      const isOnly = /^only$/i.test(m[0]);
      const isBest = /^best$/i.test(m[0]);
      // Idiom exclusions are per-trigger-word: "not only"/"only way to" only
      // make sense to check when the trigger IS "only"; "best interest(s)"
      // only makes sense to check when the trigger IS "best". "top N" has no
      // known false-positive idiom (yet) so it gets no exclusion list.
      const excludePatterns = isOnly ? ONLY_EXCLUDE_PATTERNS : isBest ? BEST_EXCLUDE_PATTERNS : [];
      if (excludePatterns.length > 0) {
        const excluded = excludePatterns.some((p) => {
          p.lastIndex = 0;
          const localWindow = text.slice(Math.max(0, m.index - 20), m.index + 20);
          return p.test(localWindow);
        });
        if (excluded) continue;
      }
      const window = wordWindow(text, m.index, EXCLUSIVITY_WINDOW_WORDS).toLowerCase();
      const hasContext = EXCLUSIVITY_CONTEXT_WORDS.some((w) => window.includes(w));
      if (hasContext) {
        findings.push({
          category: 'exclusivity',
          subcategory: isOnly ? 'only' : 'superlative',
          matchedText: m[0],
          sentence: sentenceContaining(text, m.index, m[0].length),
        });
      }
      if (m[0].length === 0) SUPERLATIVE_TRIGGER_PATTERN.lastIndex++;
    }
  }
  return findings;
}

function findRegexCategory(text, patternList, category) {
  const findings = [];
  for (const { id, re } of patternList) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      findings.push({
        category,
        subcategory: id,
        matchedText: m[0],
        sentence: sentenceContaining(text, m.index, m[0].length),
      });
      if (m[0].length === 0) re.lastIndex++; // guard against zero-width infinite loop
    }
  }
  return findings;
}

// The reference identity's own contact-block email domain ("gmail.com" in
// askgeorgek@gmail.com) is not a competitor domain — it's George's own real
// contact info, present in nearly every article's contact block per
// prompt.md's fixed-identity rule. Scoped narrowly to the EXACT reference
// email as it appears verbatim, not every bare "gmail.com" mention: a
// competitor could plausibly use a gmail.com address too, and disparaging
// language near THEIR mention should still trip. Found 2026-07-26 when a
// real generated article's standard contact block sat within
// DISPARAGEMENT_WINDOW_WORDS of an unrelated "renting vs buying" phrase and
// false-tripped comparison-framing on "gmail.com ... vs".
const REFERENCE_EMAIL_DOMAIN = REFERENCE.email.slice(REFERENCE.email.lastIndexOf('@') + 1);
const REFERENCE_EMAIL_PREFIX_LEN = REFERENCE.email.length - REFERENCE_EMAIL_DOMAIN.length;

function isReferenceContactBlockDomain(text, matchIndex, matchedDomain) {
  if (matchedDomain.toLowerCase() !== REFERENCE_EMAIL_DOMAIN.toLowerCase()) return false;
  const candidate = text.slice(matchIndex - REFERENCE_EMAIL_PREFIX_LEN, matchIndex + matchedDomain.length);
  return candidate.toLowerCase() === REFERENCE.email.toLowerCase();
}

// George's own domain is NOT currently reachable by COMPETITOR_DOMAIN_PATTERN
// (com|net|org|io -- .us isn't in that TLD list, see patterns.js) so this is
// not fixing a live bug today; findDisparagement()'s regex already filters
// out any ".us" match before this would run. It's forward-looking insurance:
// if the TLD list is ever broadened, George's own domain must not start
// tripping. Exact match only, same scoped-exclusion class as
// isReferenceContactBlockDomain() above -- "temeculavalleyhomes.us.evil.com"
// or "nottemeculavalleyhomes.us" still trip. Exported for direct unit
// testing since it's unreachable via scanArticle() today (see scan.test.mjs).
export function isReferenceDomain(matchedDomain) {
  return matchedDomain.toLowerCase() === REFERENCE.domain.toLowerCase();
}

function findDisparagement(segments) {
  const findings = [];
  for (const text of segments) {
    COMPETITOR_DOMAIN_PATTERN.lastIndex = 0;
    let m;
    while ((m = COMPETITOR_DOMAIN_PATTERN.exec(text)) !== null) {
      if (isReferenceContactBlockDomain(text, m.index, m[0])) continue;
      if (isReferenceDomain(m[0])) continue;
      const window = wordWindow(text, m.index, DISPARAGEMENT_WINDOW_WORDS).toLowerCase();
      const sentimentHit = DISPARAGEMENT_WORDS.find((w) => window.includes(w));
      const comparisonHit = COMPARISON_FRAMING_WORDS.find((w) => window.includes(w));
      // Report both independently if both are present rather than picking one —
      // a domain matched on both is a stronger signal, and collapsing to a
      // single finding would hide that from the report.
      if (sentimentHit) {
        findings.push({
          category: 'disparagement',
          subcategory: 'sentiment',
          matchedText: `${m[0]} ... "${sentimentHit}"`,
          sentence: sentenceContaining(text, m.index, m[0].length),
        });
      }
      if (comparisonHit) {
        findings.push({
          category: 'disparagement',
          subcategory: 'comparison-framing',
          matchedText: `${m[0]} ... "${comparisonHit}"`,
          sentence: sentenceContaining(text, m.index, m[0].length),
        });
      }
    }
  }
  return findings;
}

// "rated N" only counts as a review/rating claim if a review/star/client/
// testimonial word is nearby — otherwise it's just as likely to be an
// unrelated numeric scoring scale ("neighborhood rated 7 for walkability").
function findRatedN(segments) {
  const findings = [];
  for (const text of segments) {
    RATED_N_PATTERN.lastIndex = 0;
    let m;
    while ((m = RATED_N_PATTERN.exec(text)) !== null) {
      const window = wordWindow(text, m.index, RATED_N_WINDOW_WORDS).toLowerCase();
      const hasContext = RATED_N_CONTEXT_WORDS.some((w) => window.includes(w));
      if (hasContext) {
        findings.push({
          category: 'reviews-ratings',
          subcategory: 'rated-n',
          matchedText: m[0],
          sentence: sentenceContaining(text, m.index, m[0].length),
        });
      }
    }
  }
  return findings;
}

function findWrongIdentity(text) {
  const findings = [];

  DRE_PATTERN.lastIndex = 0;
  let m;
  while ((m = DRE_PATTERN.exec(text)) !== null) {
    if (m[1] !== REFERENCE.dre) {
      findings.push({
        category: 'wrong-dre',
        matchedText: m[0],
        sentence: sentenceContaining(text, m.index, m[0].length),
      });
    }
  }

  BROKERAGE_MENTION_PATTERN.lastIndex = 0;
  while ((m = BROKERAGE_MENTION_PATTERN.exec(text)) !== null) {
    const captured = m[2] || '';
    if (!captured.toLowerCase().includes(REFERENCE.brokerage.toLowerCase())) {
      findings.push({
        category: 'wrong-brokerage',
        matchedText: m[0],
        sentence: sentenceContaining(text, m.index, m[0].length),
      });
    }
  }

  PHONE_PATTERN.lastIndex = 0;
  while ((m = PHONE_PATTERN.exec(text)) !== null) {
    const digits = m[0].replace(/\D/g, '');
    if (digits.length === 10 && digits !== REFERENCE.phoneDigits) {
      findings.push({
        category: 'wrong-phone',
        matchedText: m[0],
        sentence: sentenceContaining(text, m.index, m[0].length),
      });
    }
  }

  EMAIL_PATTERN.lastIndex = 0;
  while ((m = EMAIL_PATTERN.exec(text)) !== null) {
    // Trim a trailing sentence-ending period the regex's TLD class can't
    // distinguish from a real domain character ("...gmail.com." at the end
    // of a sentence) — caught by the "genuinely clean article" unit test,
    // which had a correct email immediately followed by a period.
    const matched = m[0].replace(/\.+$/, '');
    if (matched.toLowerCase() !== REFERENCE.email.toLowerCase()) {
      findings.push({
        category: 'wrong-email',
        matchedText: matched,
        sentence: sentenceContaining(text, m.index, matched.length),
      });
    }
  }

  return findings;
}

// Generator-article-specific demotion (2026-07-27): the article-3 bait run
// tripped Layer 1 on four consecutive draws, five distinct false-positive
// idiom shapes ("far more useful... than one who can only handle small
// talk", "relying only on a referral", "best interest", "only half the
// equation", "only a minute"), zero true catches of the exclusivity/tenure
// claim the run exists to test for -- every real finding on this
// generator's own output came from Layer 2, Layer 3, or self-review (see
// README's "Layer 1's real-world hit rate on this generator's output").
// exclusivity:only and exclusivity:superlative demoted to log-only for
// THIS pipeline's own writer specifically -- opt-in via
// `options.logOnlyFindingKeys`, so every other caller (the BabyLoveGrowth
// batch path in particular) is unaffected by construction, not just by
// measurement: omit the option (the default) and behavior is byte-
// identical to before this change. All other Layer 1 categories
// (tenure, wrong-dre/brokerage/phone/email, disparagement, reviews-
// ratings, urgency-stat) stay enforce for generator articles too --
// this is a narrow, evidenced demotion of exactly two subcategories that
// have shown poor precision on this writer's style, not a general Layer 1
// relaxation.
export const GENERATOR_LOG_ONLY_FINDING_KEYS = new Set([
  'exclusivity:only',
  'exclusivity:superlative',
]);

// Returns { tripped: boolean, findings: [...] }. `findings` always contains
// EVERY finding, including ones demoted to log-only via
// `options.logOnlyFindingKeys` -- demotion changes what counts toward
// `tripped`, never what gets reported. Never mutates or rewrites the
// article — the caller decides what to do with a tripped result
// (report-only: log; build mode: exclude).
export function scanArticle(article, options = {}) {
  const { logOnlyFindingKeys = new Set() } = options;
  const titleText = htmlToText(article.title || '');
  const bodyText = htmlToText(article.content_html || '');
  // Widens WHAT gets scanned, not the frozen patterns themselves (2026-07-26)
  // -- a citations[].url is text the existing patterns never used to see at
  // all, so a competitor domain sitting in a citation could enter through a
  // source lookup and never trip the scanner. Load-bearing now that
  // citations exist: a competitor URL can ONLY ever enter an article
  // through a citation (prompt.md forbids naming one directly, same as
  // before). Backward-compatible: BabyLoveGrowth articles never have
  // `.citations`, so this is a no-op string for the entire existing corpus
  // -- their scan behavior is byte-identical to before this change.
  //
  // sourceName + url, space-joined -- NOT JSON.stringify(). Compact JSON has
  // zero whitespace ({"id":"1","sourceName":"x"...}), which collapses the
  // entire array into one unsplittable token as far as wordWindow()'s
  // /\s+/-based windowing is concerned, silently defeating the
  // DISPARAGEMENT_WINDOW_WORDS/EXCLUSIVITY_WINDOW_WORDS proximity checks
  // entirely (found before this ever shipped, not after). Only sourceName
  // and url are searched -- id/sourceType are controlled values that can
  // never carry a domain or disparagement word.
  const citationsText = (article.citations || [])
    .map((c) => `${c?.sourceName || ''} ${c?.url || ''}`)
    .join('. ');
  const combined = `${titleText}\n${bodyText}\n${citationsText}`;

  // Windowed-proximity checks (exclusivity, disparagement, rated-N) scan
  // per-block-element segments instead of the single flattened `combined`
  // blob -- see splitIntoWindowSegments()'s comment for why. Title and the
  // synthetic citations string have no block tags to split on, so each is
  // just its own single segment, unchanged from before.
  const windowSegments = [
    titleText,
    ...splitIntoWindowSegments(article.content_html || ''),
    citationsText,
  ].filter((s) => s.length > 0);

  const findings = [
    ...findExclusivityClaims(windowSegments),
    ...findRegexCategory(combined, TENURE_PATTERNS, 'tenure'),
    ...findRegexCategory(combined, REVIEW_PATTERNS, 'reviews-ratings'),
    ...findRatedN(windowSegments),
    ...findRegexCategory(combined, URGENCY_STAT_PATTERNS, 'urgency-stat'),
    ...findDisparagement(windowSegments),
    ...findWrongIdentity(combined),
  ];

  const trippingFindings = findings.filter(
    (f) => !logOnlyFindingKeys.has(`${f.category}:${f.subcategory || ''}`)
  );

  return {
    slug: article.slug || '(no slug)',
    title: article.title || '(no title)',
    tripped: trippingFindings.length > 0,
    findings,
  };
}

export function scanAllArticles(articles, options = {}) {
  return articles.map((a) => scanArticle(a, options));
}

// LOG-ONLY (2026-07-26) -- deliberately NOT wired into scanArticle()'s
// tripped decision, and never will be until a measured false-positive rate
// against real generated articles justifies it (same bar the frozen 30d8154
// set had to clear before it was trusted). Only runs when
// article.citations !== undefined -- inert for the entire BabyLoveGrowth
// corpus, which has no citations concept at all.
//
// Operates on RAW content_html, not htmlToText()'s stripped output --
// htmlToText() would strip the <sup data-cite="..."> marker tags entirely,
// which is exactly the thing this function needs to see. A different
// traversal from every other function in this file, on purpose.
// "sentence" here is a self-contained windowed snippet (stripped of tags
// AFTER windowing, not before) -- deliberately NOT sentenceContaining()'s
// approach of mapping a raw-HTML match index into htmlToText()'s
// separately-stripped output. Two different strings with two different
// lengths (HTML stripping isn't length-preserving); computing one string's
// offset from the other's prefix length is exactly the kind of subtle
// position-math bug this session has caught more than once tonight. A
// self-contained window sidesteps the whole problem: strip only the
// snippet itself, never cross between the two strings.
function windowedSnippet(html, matchIndex, matchLength, windowChars = 60) {
  const start = Math.max(0, matchIndex - windowChars);
  const end = Math.min(html.length, matchIndex + matchLength + windowChars);
  return htmlToText(html.slice(start, end));
}

export function findUncitedClaims(article) {
  if (article.citations === undefined) return [];
  const html = article.content_html || '';
  const findings = [];
  for (const { id, re } of UNCITED_CLAIM_CANDIDATE_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(html)) !== null) {
      const after = html.slice(m.index + m[0].length, m.index + m[0].length + UNCITED_CLAIM_MARKER_WINDOW_CHARS);
      if (!after.includes('data-cite="')) {
        findings.push({
          category: 'uncited-claim',
          subcategory: id,
          matchedText: m[0],
          sentence: windowedSnippet(html, m.index, m[0].length),
        });
      }
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  return findings;
}

// Pure, no I/O — the batch-level fail/pass decision, factored out
// specifically so it's unit-testable without dragging in fetch-blog-data.js
// (which fetches over the network and self-executes on import). Called from
// runComplianceFilter() in that file; do not duplicate this logic there.
export function evaluateBatch(results, maxTripRate = MAX_TRIP_RATE) {
  const total = results.length;
  const trippedCount = results.filter((r) => r.tripped).length;
  const tripRate = total === 0 ? 0 : trippedCount / total;
  // Strictly "above" the threshold, matching the constant's own definition —
  // exactly maxTripRate does not fail.
  const shouldFailBuild = total > 0 && tripRate > maxTripRate;
  return { total, trippedCount, tripRate, shouldFailBuild };
}

// Fail-closed as of 2026-07-26: a missing/unset BLOG_COMPLIANCE_ENFORCE means
// enforce, not report-only. Before this, the only thing preventing a
// non-compliant batch from shipping indexable was a deleted API key and
// memory of why it's deleted — not something a build config should rely on.
// Pass process.env.BLOG_COMPLIANCE_ENFORCE (or any string) in; only the
// literal string 'false' opts back into report-only. Pure, no I/O —
// unit-testable directly, same reasoning as evaluateBatch above.
export function resolveEnforceMode(envValue) {
  return envValue !== 'false';
}
