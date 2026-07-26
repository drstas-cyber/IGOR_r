// Scans article title + content_html for compliance red flags. See
// tools/blog-compliance/README.md — this is a LAST LINE OF DEFENSE, not
// the fix (the fix is upstream, in BabyLoveGrowth's Special Instructions).
//
// Exclusion, never silent rewriting: a tripped article is left out of the
// build entirely, logged loudly with the matched sentence, never edited.

import {
  REFERENCE,
  EXCLUSIVITY_CONTEXT_WORDS,
  EXCLUSIVITY_WINDOW_WORDS,
  EXCLUSIVITY_EXCLUDE_PATTERNS,
  TENURE_PATTERNS,
  REVIEW_PATTERNS,
  URGENCY_STAT_PATTERNS,
  COMPETITOR_DOMAIN_PATTERN,
  DISPARAGEMENT_WORDS,
  DISPARAGEMENT_WINDOW_WORDS,
  DRE_PATTERN,
  BROKERAGE_MENTION_PATTERN,
  PHONE_PATTERN,
  EMAIL_PATTERN,
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

function findExclusivityClaims(text) {
  const findings = [];
  const onlyRe = /\bonly\b/gi;
  let m;
  while ((m = onlyRe.exec(text)) !== null) {
    const excluded = EXCLUSIVITY_EXCLUDE_PATTERNS.some((p) => {
      p.lastIndex = 0;
      const localWindow = text.slice(Math.max(0, m.index - 20), m.index + 20);
      return p.test(localWindow);
    });
    if (excluded) continue;
    const window = wordWindow(text, m.index, EXCLUSIVITY_WINDOW_WORDS).toLowerCase();
    const hasContext = EXCLUSIVITY_CONTEXT_WORDS.some((w) => window.includes(w));
    if (hasContext) {
      findings.push({
        category: 'exclusivity',
        matchedText: 'only',
        sentence: sentenceContaining(text, m.index, 4),
      });
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

function findDisparagement(text) {
  const findings = [];
  COMPETITOR_DOMAIN_PATTERN.lastIndex = 0;
  let m;
  while ((m = COMPETITOR_DOMAIN_PATTERN.exec(text)) !== null) {
    const window = wordWindow(text, m.index, DISPARAGEMENT_WINDOW_WORDS).toLowerCase();
    const hit = DISPARAGEMENT_WORDS.find((w) => window.includes(w));
    if (hit) {
      findings.push({
        category: 'disparagement',
        matchedText: `${m[0]} ... "${hit}"`,
        sentence: sentenceContaining(text, m.index, m[0].length),
      });
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

// Returns { tripped: boolean, findings: [...] }. Never mutates or rewrites
// the article — the caller decides what to do with a tripped result
// (report-only: log; build mode: exclude).
export function scanArticle(article) {
  const titleText = htmlToText(article.title || '');
  const bodyText = htmlToText(article.content_html || '');
  const combined = `${titleText}\n${bodyText}`;

  const findings = [
    ...findExclusivityClaims(combined),
    ...findRegexCategory(combined, TENURE_PATTERNS, 'tenure'),
    ...findRegexCategory(combined, REVIEW_PATTERNS, 'reviews-ratings'),
    ...findRegexCategory(combined, URGENCY_STAT_PATTERNS, 'urgency-stat'),
    ...findDisparagement(combined),
    ...findWrongIdentity(combined),
  ];

  return {
    slug: article.slug || '(no slug)',
    title: article.title || '(no title)',
    tripped: findings.length > 0,
    findings,
  };
}

export function scanAllArticles(articles) {
  return articles.map(scanArticle);
}
