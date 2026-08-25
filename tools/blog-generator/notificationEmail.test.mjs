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
} from './notificationEmail.mjs';

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
});
