import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractFirstParagraphText,
  buildArticlePrEmail,
  buildRejectedPrEmail,
  buildPublishedEmail,
  buildFailureEmail,
  deriveFailureClassLabel,
  summarizeRejectionFindings,
  buildFailureDetail,
  MAX_FAILURE_DETAIL_LENGTH,
} from './notificationEmail.mjs';
import { HEADERS_CAP_EXCEEDED_CODE } from './headersCacheEntry.mjs';

describe('extractFirstParagraphText', () => {
  test('strips tags and returns the first <p> as plain text', () => {
    const html = '<h2>Heading</h2>\n<p>This is the <strong>first</strong> paragraph.</p>\n<p>Second paragraph.</p>';
    assert.equal(extractFirstParagraphText(html), 'This is the first paragraph.');
  });

  test('truncates a long first paragraph with an ellipsis, at a word boundary', () => {
    const long = 'word '.repeat(100).trim();
    const result = extractFirstParagraphText(`<p>${long}</p>`, 50);
    assert.ok(result.length <= 53, `expected <= 53 chars, got ${result.length}`);
    assert.match(result, /…$/);
    assert.doesNotMatch(result, /\swor…$/, 'must not cut mid-word');
  });

  test('no <p> tag at all -> empty string, not a crash', () => {
    assert.equal(extractFirstParagraphText('<h2>Only a heading</h2>'), '');
    assert.equal(extractFirstParagraphText(''), '');
    assert.equal(extractFirstParagraphText(null), '');
  });

  test('decodes common HTML entities', () => {
    assert.equal(extractFirstParagraphText('<p>Allison James Estates &amp; Homes</p>'), 'Allison James Estates & Homes');
  });
});

describe('buildArticlePrEmail', () => {
  const base = {
    title: 'Living in Vail Ranch: A Neighborhood Guide for Homebuyers',
    firstParagraphText: 'Vail Ranch is one of the more established master-planned communities in southern Temecula.',
    previewUrl: 'https://blog-generator-auto-1.igor-r.pages.dev',
    gateSummaryLine: '**Not silent** — Layer 1: clean · Layer 2: clean · Layer 3: clean · Self-review: 2 correction(s) — holds for a supervised human read.',
    prUrl: 'https://github.com/drstas-cyber/IGOR_r/pull/35',
  };

  test('subject is the exact Russian format with the real title', () => {
    const { subject } = buildArticlePrEmail(base);
    assert.equal(subject, '📝 Новая статья ждёт проверки: Living in Vail Ranch: A Neighborhood Guide for Homebuyers');
  });

  test('body includes the first paragraph, preview link, gate summary, and PR link', () => {
    const { html } = buildArticlePrEmail(base);
    assert.match(html, /Vail Ranch is one of the more established/);
    assert.match(html, /https:\/\/blog-generator-auto-1\.igor-r\.pages\.dev/);
    assert.match(html, /Layer 1: clean/);
    assert.match(html, /https:\/\/github\.com\/drstas-cyber\/IGOR_r\/pull\/35/);
  });

  test('a missing preview URL renders an explicit unavailable note, never a broken/empty link', () => {
    const { html } = buildArticlePrEmail({ ...base, previewUrl: null });
    assert.match(html, /недоступ/i);
  });
});

describe('buildRejectedPrEmail', () => {
  test('subject is the exact Russian format with the topic', () => {
    const { subject } = buildRejectedPrEmail({
      topic: 'How Property Taxes Work for Temecula Valley Homebuyers',
      failureClassLabel: 'gate_trip',
      findingsSummaryLines: ['[tenure] "over a decade" — George has over a decade of experience.'],
      prUrl: 'https://github.com/drstas-cyber/IGOR_r/pull/23',
    });
    assert.equal(subject, '⛔ Статья отклонена воротами: How Property Taxes Work for Temecula Valley Homebuyers');
  });

  test('body includes the failure class, findings, and PR link', () => {
    const { html } = buildRejectedPrEmail({
      topic: 'x',
      failureClassLabel: 'identity_incomplete',
      findingsSummaryLines: ['identity block: DRE number (02034120) not found anywhere in content_html'],
      prUrl: 'https://github.com/drstas-cyber/IGOR_r/pull/36',
    });
    assert.match(html, /identity_incomplete/);
    assert.match(html, /DRE number \(02034120\) not found/);
    assert.match(html, /pull\/36/);
  });

  test('zero findings lines still renders a clean body, not a broken list', () => {
    const { html } = buildRejectedPrEmail({ topic: 'x', failureClassLabel: 'gate_trip', findingsSummaryLines: [], prUrl: 'https://x/pull/1' });
    assert.doesNotMatch(html, /undefined|null/);
  });
});

describe('buildPublishedEmail', () => {
  test('subject is the exact Russian format with the title', () => {
    const { subject } = buildPublishedEmail({ title: 'Living in Old Town Temecula', liveUrl: 'https://temeculavalleyhomes.us/blog/old-town-temecula-neighborhood-guide/', verdictLabel: 'COMPLETE (local)' });
    assert.equal(subject, '✅ Опубликовано: Living in Old Town Temecula');
  });

  test('body includes the live URL and the publishStatusReport verdict', () => {
    const { html } = buildPublishedEmail({ title: 'x', liveUrl: 'https://temeculavalleyhomes.us/blog/x/', verdictLabel: 'COMPLETE (local)' });
    assert.match(html, /https:\/\/temeculavalleyhomes\.us\/blog\/x\//);
    assert.match(html, /COMPLETE \(local\)/);
  });
});

describe('deriveFailureClassLabel', () => {
  test('maps every real failureClass to a Russian label', () => {
    assert.match(deriveFailureClassLabel('schema_invalid'), /schema_invalid/);
    assert.match(deriveFailureClassLabel('internal_link_invalid'), /internal_link_invalid/);
    assert.match(deriveFailureClassLabel('identity_incomplete'), /identity_incomplete/);
    assert.match(deriveFailureClassLabel('gate_trip'), /gate_trip/);
  });

  test('an unknown outcome falls back to the raw string, never blank', () => {
    assert.equal(deriveFailureClassLabel('something_new'), 'something_new');
  });

  test('a missing outcome falls back to a placeholder, never blank/undefined', () => {
    assert.equal(deriveFailureClassLabel(undefined), '(неизвестно)');
  });
});

describe('summarizeRejectionFindings', () => {
  test('a Layer 1 trip lists its non-demoted findings, never demoted (logOnly) ones', () => {
    const report = {
      layer1: { findings: [
        { category: 'tenure', matchedText: 'over a decade', logOnly: false },
        { category: 'exclusivity', subcategory: 'only', matchedText: 'the only agent', logOnly: true },
      ] },
    };
    const lines = summarizeRejectionFindings(report);
    assert.equal(lines.length, 1);
    assert.match(lines[0], /tenure/);
    assert.match(lines[0], /over a decade/);
  });

  test('a Layer 2 trip lists each true checklist flag with its evidence', () => {
    const report = {
      layer2: { tripped: true, checklist: { tenure_claim: true, tenure_evidence: 'over a decade', uniqueness_claim: false, uniqueness_evidence: null } },
    };
    const lines = summarizeRejectionFindings(report);
    assert.ok(lines.some((l) => l.includes('tenure_claim') && l.includes('over a decade')));
    assert.ok(!lines.some((l) => l.includes('uniqueness_claim')));
  });

  test('layer 3 failed/unsupported citations are listed by URL', () => {
    const report = { layer3: { failed: [{ url: 'https://dead.example.com' }], unsupported: [{ url: 'https://rivcoacr.org/x' }] } };
    const lines = summarizeRejectionFindings(report);
    assert.ok(lines.some((l) => l.includes('FAILED') && l.includes('dead.example.com')));
    assert.ok(lines.some((l) => l.includes('RESOLVED_UNSUPPORTED') && l.includes('rivcoacr.org/x')));
  });

  test('schema/internal-link/identity errors are all included', () => {
    const report = {
      schemaErrors: ['citations[]: missing url'],
      internalLinkErrors: ['https://temeculavalleyhomes.us/blog/invented/'],
      identityErrors: ['identity block: DRE number (02034120) not found anywhere in content_html'],
    };
    const lines = summarizeRejectionFindings(report);
    assert.equal(lines.length, 3);
  });

  test('respects the maxLines cap', () => {
    const report = { schemaErrors: Array.from({ length: 20 }, (_, i) => `error ${i}`) };
    assert.equal(summarizeRejectionFindings(report, 5).length, 5);
  });

  test('a report with no findings anywhere returns an empty array', () => {
    assert.deepEqual(summarizeRejectionFindings({}), []);
  });
});

describe('buildFailureEmail', () => {
  test('subject is the exact Russian format with the reason', () => {
    const { subject } = buildFailureEmail({ reason: 'topics.json exhausted', detailText: 'every topic already attempted', runUrl: 'https://github.com/drstas-cyber/IGOR_r/actions/runs/1' });
    assert.equal(subject, '🔴 Сбой генерации: topics.json exhausted');
  });

  test('body includes the detail text and the run link', () => {
    const { html } = buildFailureEmail({ reason: 'x', detailText: 'ANTHROPIC_API_KEY not set', runUrl: 'https://github.com/drstas-cyber/IGOR_r/actions/runs/42' });
    assert.match(html, /ANTHROPIC_API_KEY not set/);
    assert.match(html, /actions\/runs\/42/);
  });

  test('a missing detailText falls back to a generic explanation rather than rendering blank/undefined', () => {
    const { html } = buildFailureEmail({ reason: 'x', detailText: null, runUrl: 'https://x/runs/1' });
    assert.doesNotMatch(html, /undefined|null/);
  });

  // FIX 3 (2026-08-31, publish-on-merge) -- a stranded article's slug must
  // be nameable in the failure email so a human doesn't have to reverse-
  // engineer it from the run log during a backfill with several failures.
  // `slug` is optional and undefined by default so existing callers
  // (generate-article.yml's generic failure path, which has no slug
  // concept at all) are completely unaffected -- see the three-way
  // distinction below.
  test('slug omitted entirely (undefined) -- no article line at all, unaffected generate-article.yml behavior', () => {
    const { html } = buildFailureEmail({ reason: 'x', detailText: 'y', runUrl: 'https://x/runs/1' });
    assert.doesNotMatch(html, /Статья/);
  });

  test('slug is a real string -- names it', () => {
    const { html } = buildFailureEmail({ reason: 'x', detailText: 'y', runUrl: 'https://x/runs/1', slug: 'new-construction-vs-resale-homes-temecula' });
    assert.match(html, /new-construction-vs-resale-homes-temecula/);
  });

  test('slug is explicitly null (known to be inapplicable -- failure occurred before the article was identified) -- says so, not a blank field', () => {
    const { html } = buildFailureEmail({ reason: 'x', detailText: 'y', runUrl: 'https://x/runs/1', slug: null });
    assert.match(html, /could not be determined/i);
    assert.match(html, /before the article was identified/i);
  });

  // FIX 4 (2026-08-31, notification-hardening pass) -- the subject must
  // distinguish "no article was produced" from "an article exists but
  // didn't go live." failureClass is optional; every pre-existing caller
  // that passes none keeps the exact current subject prefix, unchanged.
  test('no failureClass -- unchanged default subject prefix (every pre-existing caller)', () => {
    const { subject } = buildFailureEmail({ reason: 'x', detailText: 'y', runUrl: 'https://x/runs/1' });
    assert.equal(subject, '🔴 Сбой генерации: x');
  });

  test('failureClass: "no_article" -- same default prefix (explicit, not just the fallback)', () => {
    const { subject } = buildFailureEmail({ reason: 'x', detailText: 'y', runUrl: 'https://x/runs/1', failureClass: 'no_article' });
    assert.equal(subject, '🔴 Сбой генерации: x');
  });

  test('failureClass: "article_stranded" -- a visibly different subject, not the generic "generation failure" wording', () => {
    const { subject } = buildFailureEmail({ reason: 'x', detailText: 'y', runUrl: 'https://x/runs/1', failureClass: 'article_stranded' });
    assert.notEqual(subject, '🔴 Сбой генерации: x');
    assert.match(subject, /x$/); // reason still appears
    assert.doesNotMatch(subject, /Сбой генерации/);
  });
});

// buildFailureDetail (moved here 2026-08-31, Task 0 of the notification-
// hardening pass -- was previously in publishOnMerge.mjs, imported from
// there by buildNotificationEmailCli.mjs. That made the email builder
// depend on the publish script for something that has nothing to do with
// publishing; tolerable with one caller, a real inversion the moment
// generate-article's own failure path needed the same "turn a captured
// log into detail text, name the _headers cap specifically when it's
// really there" capability. Lives here instead, beside buildFailureEmail,
// which is its only real consumer.
//
// Task 1 of the same pass: the cap-guard branch used to be
// `/rule limit/.test(trimmed)` -- a substring match on English prose that
// would silently stop matching if insertCacheEntry's message was ever
// reworded, with no test failure to catch it. It now matches
// HEADERS_CAP_EXCEEDED_CODE, a stable token exported by
// headersCacheEntry.mjs and printed into the captured log verbatim by
// publishOnMerge.mjs's catch block (`error_code=${err.code}`) --
// independent of whatever the error's own message says. The
// reword-insensitivity test below is the actual proof of that.
describe('buildFailureDetail — reports what happened, never asserts a cause it does not have', () => {
  test('a captured log containing the _headers cap-guard error CODE -- names the real, identifiable cause', () => {
    const log = `[publishOnMerge] FATAL: insertCacheEntry: adding "x" would bring the total to 102 rules, over Cloudflare Pages' 100-rule limit -- refusing to write.\n[publishOnMerge] error_code=${HEADERS_CAP_EXCEEDED_CODE}`;
    const detail = buildFailureDetail(log);
    assert.match(detail, /100-rule limit/);
    assert.match(detail, /_headers/);
  });

  test('REWORD-INSENSITIVITY (the actual point of Task 1): the cap-guard prose text alone, with NO error_code token, is NOT detected as the cap-guard', () => {
    // Same human-readable wording insertCacheEntry actually throws today --
    // deliberately WITHOUT the stable token, simulating exactly the
    // scenario that broke the old /rule limit/ prose-matching approach: a
    // message that says the right words but isn't accompanied by the
    // typed signal. If this test ever fails, detection has regressed back
    // to matching wording instead of the mechanism.
    const log = '[publishOnMerge] FATAL: insertCacheEntry: adding "x" would bring the total to 102 rules, over Cloudflare Pages\' 100-rule limit -- refusing to write.';
    const detail = buildFailureDetail(log);
    assert.doesNotMatch(detail, /_headers cache-pair insertion hit/);
    // Falls through to the generic "report the captured text" branch instead.
    assert.match(detail, /100-rule limit/); // the real captured text is still shown -- just not specially labeled
  });

  test('a captured log with any other error -- reports the captured text, invents no cause', () => {
    const log = 'fatal: bad revision \'abc~1\'\n[publishOnMerge] FATAL: [publishOnMerge] git diff failed: Command failed: git diff --name-only --diff-filter=A abc~1 abc -- src/data/generated-articles/\n. Refusing to guess which article this PR added.';
    const detail = buildFailureDetail(log);
    assert.match(detail, /bad revision/);
    assert.doesNotMatch(detail, /100-rule limit/);
    assert.doesNotMatch(detail, /_headers/i);
  });

  test('empty/unreadable log -- the neutral message, no cause named', () => {
    for (const empty of ['', '   \n', null, undefined]) {
      const detail = buildFailureDetail(empty);
      assert.equal(detail, 'publish sequence failed after merge; the article is merged on main but published:false -- see the run log.');
    }
  });

  // Task 2 -- the old test (`detail.length < 5000` against a 2000-char cap)
  // passed at 4999 too; it never actually pinned the cap. This asserts the
  // EXACT resulting length, so a future change to MAX_FAILURE_DETAIL_LENGTH
  // (in either direction) fails this test instead of sliding silently.
  test('a very long captured log is truncated to EXACTLY the configured cap plus the truncation prefix -- not merely "shorter than some big number"', () => {
    const log = 'x'.repeat(5000);
    const detail = buildFailureDetail(log);
    const expectedPrefix = '[truncated -- earlier output omitted]\n...\n';
    assert.equal(detail.length, expectedPrefix.length + MAX_FAILURE_DETAIL_LENGTH, 'length must be pinned to the prefix + the configured cap, exactly');
    assert.ok(detail.startsWith(expectedPrefix));
    assert.ok(detail.endsWith('x'.repeat(50)), 'the TAIL of the log must be kept, not the head');
  });

  test('a log at or under the cap is returned whole, no truncation prefix', () => {
    const log = 'y'.repeat(MAX_FAILURE_DETAIL_LENGTH);
    const detail = buildFailureDetail(log);
    assert.equal(detail, log);
  });
});
