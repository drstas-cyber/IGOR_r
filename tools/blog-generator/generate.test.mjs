import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  handleTrippedGate,
  main,
  WRITER_MODEL,
  REVIEWER_MODEL,
  buildJsonLd,
} from './generate.mjs';

function isolatedDir(prefix = 'generate-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// ---------------------------------------------------------------------------
// buildJsonLd — Article schema completion (Batch A, AI SEO audit item 4,
// 2026-08-07). Root-cause note: the 2026-08-07 audit report initially
// claimed live output only had headline/author/datePublished, missing
// description/url too -- that was wrong, a gap in the audit's own
// verification script (it simply didn't print those two fields), not a
// real bug in this function, which already emitted them. Corrected here:
// these tests cover the fields that genuinely WERE missing before this
// batch -- dateModified, publisher, mainEntityOfPage -- plus the
// image-omitted-when-null rule.
describe('buildJsonLd — Article schema (2026-08-07)', () => {
  function baseArgs(overrides = {}) {
    return {
      title: 'Understanding HOA Fees',
      metaDescription: 'A clear explanation of HOA fees for California homebuyers.',
      canonicalUrl: 'https://temeculavalleyhomes.us/blog/understanding-hoa-fees/',
      createdAt: '2026-08-07T12:00:00.000Z',
      ...overrides,
    };
  }

  test('always includes the previously-existing fields: headline, description, url, datePublished, author', () => {
    const ld = buildJsonLd(baseArgs());
    assert.equal(ld.headline, 'Understanding HOA Fees');
    assert.equal(ld.description, 'A clear explanation of HOA fees for California homebuyers.');
    assert.equal(ld.url, 'https://temeculavalleyhomes.us/blog/understanding-hoa-fees/');
    assert.equal(ld.datePublished, '2026-08-07T12:00:00.000Z');
    assert.deepEqual(ld.author, { '@type': 'Person', name: 'George Khazanovskiy' });
  });

  test('dateModified defaults to createdAt (datePublished) when not passed', () => {
    const ld = buildJsonLd(baseArgs());
    assert.equal(ld.dateModified, ld.datePublished);
  });

  test('dateModified uses an explicitly passed value when given (future content-edit path)', () => {
    const ld = buildJsonLd(baseArgs({ dateModified: '2026-09-01T00:00:00.000Z' }));
    assert.equal(ld.dateModified, '2026-09-01T00:00:00.000Z');
    assert.notEqual(ld.dateModified, ld.datePublished);
  });

  test('publisher references the sitewide #agent entity by @id', () => {
    const ld = buildJsonLd(baseArgs());
    assert.deepEqual(ld.publisher, { '@id': 'https://temeculavalleyhomes.us/#agent' });
  });

  test('mainEntityOfPage references this article\'s own WebPage entity (canonicalUrl + #webpage)', () => {
    const ld = buildJsonLd(baseArgs());
    assert.deepEqual(ld.mainEntityOfPage, { '@id': 'https://temeculavalleyhomes.us/blog/understanding-hoa-fees/#webpage' });
  });

  test('image is OMITTED when heroImageUrl is null/undefined -- never fabricated', () => {
    const ld = buildJsonLd(baseArgs({ heroImageUrl: null }));
    assert.equal('image' in ld, false);
    const ld2 = buildJsonLd(baseArgs());
    assert.equal('image' in ld2, false);
  });

  test('image IS included when heroImageUrl is truthy', () => {
    const ld = buildJsonLd(baseArgs({ heroImageUrl: 'https://temeculavalleyhomes.us/images/hoa-hero.jpg' }));
    assert.equal(ld.image, 'https://temeculavalleyhomes.us/images/hoa-hero.jpg');
  });

  test('parses cleanly through JSON.stringify/parse', () => {
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(buildJsonLd(baseArgs()))));
  });
});

// ---------------------------------------------------------------------------
// handleTrippedGate — the rejected-attempt marker writer.
//
// Requirement being tested (restated, updated 2026-07-27 for the
// silent-discard-gap fix): the marker file must contain EXACTLY
// {sourceTopic, rejectedAt, failureClass, layer1, layer2, layer3,
// schemaErrors} — never the discarded draft's title, slug, or
// content_html, regardless of which discard reason (gate trip OR
// schema-validation failure) produced it. sampleReport() below now sets
// layer3 explicitly (previously omitted, which meant marker.layer3
// silently vanished from the written JSON via JSON.stringify's
// undefined-value-drop — this fixture predates layer3's existence in the
// pipeline and was never updated after it was added; fixed here as part
// of getting this test to actually reflect the real marker shape every
// live run has written all session). Originally proven RED at commit
// fbc8a38 (handleTrippedGate didn't exist yet); the failureClass/
// schemaErrors fields were proven RED again on 2026-07-27 against the
// pre-fix schema-invalid discard path (see the new describe block below).
// ---------------------------------------------------------------------------

describe('handleTrippedGate — rejected-attempt marker (2026-07-26)', () => {
  function sampleReport(overrides = {}) {
    return {
      generatedAt: '2026-07-26T00:00:00.000Z',
      topic: { topic: 'What First-Time Buyers Should Know About Home Inspections', target_keyword: 'home inspection' },
      layer1: { tripped: true, findings: [{ category: 'tenure', matchedText: 'over a decade', sentence: 'George has over a decade of experience.' }] },
      layer2: { tripped: false, checklist: { tenure_claim: false } },
      layer3: { tripped: false, results: [], resolved: [], failed: [], unsupported: [], inconclusive: [] },
      outcome: 'skipped',
      ...overrides,
    };
  }

  test('writes the marker under <generatedDir>/.rejected/<slugified-topic>.json', () => {
    const dir = isolatedDir();
    const { markerPath } = handleTrippedGate(sampleReport(), { generatedDir: dir });
    assert.equal(markerPath, path.join(dir, '.rejected', 'what-first-time-buyers-should-know-about-home-inspections.json'));
    assert.ok(fs.existsSync(markerPath));
  });

  test('marker contains EXACTLY sourceTopic, rejectedAt, failureClass, layer1, layer2, layer3, schemaErrors, internalLinkErrors, identityErrors — no title/slug/content_html', () => {
    const dir = isolatedDir();
    const { markerPath } = handleTrippedGate(sampleReport(), { generatedDir: dir });
    const written = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    assert.deepEqual(
      new Set(Object.keys(written)),
      new Set(['sourceTopic', 'rejectedAt', 'failureClass', 'layer1', 'layer2', 'layer3', 'schemaErrors', 'internalLinkErrors', 'identityErrors'])
    );
    assert.equal('title' in written, false);
    assert.equal('slug' in written, false);
    assert.equal('content_html' in written, false);
  });

  test('failureClass is "gate_trip" for outcome "skipped", "schema_invalid" for outcome "schema_invalid", "internal_link_invalid" for outcome "internal_link_invalid", "identity_incomplete" for outcome "identity_incomplete"', () => {
    const dir = isolatedDir();
    const gateTrip = handleTrippedGate(sampleReport({ outcome: 'skipped' }), { generatedDir: dir });
    assert.equal(gateTrip.marker.failureClass, 'gate_trip');
    const schemaInvalid = handleTrippedGate(
      sampleReport({ outcome: 'schema_invalid', schemaErrors: ['citations[]: host "x" is not an approved citation host'] }),
      { generatedDir: dir }
    );
    assert.equal(schemaInvalid.marker.failureClass, 'schema_invalid');
    assert.deepEqual(schemaInvalid.marker.schemaErrors, ['citations[]: host "x" is not an approved citation host']);
    const linkInvalid = handleTrippedGate(
      sampleReport({ outcome: 'internal_link_invalid', internalLinkErrors: ['https://temeculavalleyhomes.us/blog/invented-slug/'] }),
      { generatedDir: dir }
    );
    assert.equal(linkInvalid.marker.failureClass, 'internal_link_invalid');
    assert.deepEqual(linkInvalid.marker.internalLinkErrors, ['https://temeculavalleyhomes.us/blog/invented-slug/']);
    const identityIncomplete = handleTrippedGate(
      sampleReport({ outcome: 'identity_incomplete', identityErrors: ['identity block: DRE number (02034120) not found anywhere in content_html'] }),
      { generatedDir: dir }
    );
    assert.equal(identityIncomplete.marker.failureClass, 'identity_incomplete');
    assert.deepEqual(identityIncomplete.marker.identityErrors, ['identity block: DRE number (02034120) not found anywhere in content_html']);
  });

  test('schemaErrors defaults to an empty array when not on the report (the normal gate-trip case)', () => {
    const dir = isolatedDir();
    const { marker } = handleTrippedGate(sampleReport(), { generatedDir: dir });
    assert.deepEqual(marker.schemaErrors, []);
  });

  test('sourceTopic matches report.topic.topic exactly', () => {
    const dir = isolatedDir();
    const report = sampleReport({ topic: { topic: 'Understanding HOA Fees', target_keyword: 'hoa fees' } });
    const { marker } = handleTrippedGate(report, { generatedDir: dir });
    assert.equal(marker.sourceTopic, 'Understanding HOA Fees');
  });

  test('rejectedAt is a valid, parseable ISO date string', () => {
    const dir = isolatedDir();
    const { marker } = handleTrippedGate(sampleReport(), { generatedDir: dir });
    assert.ok(!Number.isNaN(new Date(marker.rejectedAt).getTime()));
  });

  test('layer1/layer2 findings snippets ARE carried through (accepted level of quoting — evidence, not the draft)', () => {
    const dir = isolatedDir();
    const { marker } = handleTrippedGate(sampleReport(), { generatedDir: dir });
    assert.equal(marker.layer1.findings[0].matchedText, 'over a decade');
  });

  test('writes nothing directly under generatedDir — only under .rejected/', () => {
    const dir = isolatedDir();
    handleTrippedGate(sampleReport(), { generatedDir: dir });
    const topLevelFiles = fs.readdirSync(dir).filter((f) => f !== '.rejected');
    assert.deepEqual(topLevelFiles, []);
  });

  test('two different topics produce two distinct marker files (no collision)', () => {
    const dir = isolatedDir();
    const a = handleTrippedGate(sampleReport({ topic: { topic: 'Topic A', target_keyword: 'a' } }), { generatedDir: dir });
    const b = handleTrippedGate(sampleReport({ topic: { topic: 'Topic B', target_keyword: 'b' } }), { generatedDir: dir });
    assert.notEqual(a.markerPath, b.markerPath);
    assert.ok(fs.existsSync(a.markerPath));
    assert.ok(fs.existsSync(b.markerPath));
  });
});

// ---------------------------------------------------------------------------
// main() — full trip path, end to end.
//
// Requirement being tested (restated): a gate trip still exits non-zero
// AND writes no real article file — adding the rejected-marker path must
// not regress either guarantee. Proven RED first the same way as above:
// at commit fbc8a38, main() doesn't accept generatedDir/topicsPath/
// reportPath/exec overrides, so this test (which relies on all four to
// stay isolated from the real repo) fails outright against that commit.
// All API calls are mocked via the global-fetch stub pattern already
// established in gate.test.mjs; the gh/git calls inside
// getOpenPrAttemptedTopics are mocked via the injectable `exec` param
// established in topicAvailability.test.mjs.
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, statusText: 'mocked', json: async () => body, text: async () => JSON.stringify(body) };
}

function toolUseBody(toolName, input) {
  return { content: [{ type: 'tool_use', name: toolName, input }], stop_reason: 'tool_use' };
}

// Routes by request shape rather than call order — robust to the exact
// sequence of verifyModel/generateDraft/selfReview/runLlmClaimGate calls.
// citationFetchStatuses maps a citation URL -> HTTP status for the Layer 3
// resolver's own GET request, which shares the same globalThis.fetch mock
// (routed here by NOT being an api.anthropic.com URL).
// Shared fixture text for the identity-completeness gate (hardening batch,
// 2026-08-25) -- appended to every mocked draft/self-review content_html
// below so tests exercising unrelated pipeline behavior (internal links,
// citations, self-review) don't spuriously trip the new gate. Tests that
// specifically exercise identity-completeness build their own content_html
// without this constant -- see identityCompletenessGate.test.mjs and
// generate.test.mjs's own "identity-incomplete discard" describe block.
const IDENTITY_BLOCK_HTML = '<h2>About George Khazanovskiy</h2><p>George Khazanovskiy is a Temecula Valley real estate agent (DRE #02034120) with Allison James Estates &amp; Homes. Reach George at 619-277-2766 or askgeorgek@gmail.com.</p>';

function mockAnthropicRouter({ checklist, citations = [], citationFetchStatuses = {}, citationFetchBodies = {}, extraContentHtml = '', includeIdentityBlock = true }) {
  globalThis.fetch = async (url, init = {}) => {
    const urlStr = String(url);
    if (urlStr.includes('/v1/models')) {
      return jsonResponse(200, { data: [{ id: WRITER_MODEL }, { id: REVIEWER_MODEL }] });
    }
    if (!urlStr.includes('api.anthropic.com')) {
      // Layer 3's citation-resolution GET, not an Anthropic API call.
      const status = citationFetchStatuses[urlStr];
      if (status === undefined) throw new Error(`test router: no citationFetchStatuses entry for "${urlStr}"`);
      return { status, text: async () => citationFetchBodies[urlStr] ?? '' };
    }
    const body = JSON.parse(init.body);
    const toolName = body.tool_choice?.name;
    // A data-cite marker per citation, matching its id -- required by
    // schema.js's marker<->array cross-check (added the commit before this
    // one). Without it, any test passing citations would fail schema
    // validation on an orphaned citation, not on whatever the test is
    // actually trying to exercise.
    const markers = citations.map((c) => `<sup class="citation" data-cite="${c.id}">[${c.id}]</sup>`).join('');
    const contentHtml = `<p>HOA fees fund shared community amenities and routine maintenance for planned developments.${markers}${extraContentHtml}</p>${includeIdentityBlock ? IDENTITY_BLOCK_HTML : ''}`;
    if (toolName === 'submit_article_draft') {
      return jsonResponse(200, toolUseBody('submit_article_draft', {
        title: 'Understanding HOA Fees',
        slug_suggestion: 'understanding-hoa-fees',
        meta_description: 'A clear, practical explanation of how HOA fees work for California homebuyers considering a planned community.',
        content_html: contentHtml,
        keywords: ['hoa fees'],
        citations,
        faq_items: [],
      }));
    }
    if (toolName === 'submit_reviewed_article') {
      return jsonResponse(200, toolUseBody('submit_reviewed_article', {
        draft_was_clean: true,
        violations_found: [],
        title: 'Understanding HOA Fees',
        slug_suggestion: 'understanding-hoa-fees',
        meta_description: 'A clear, practical explanation of how HOA fees work for California homebuyers considering a planned community.',
        content_html: contentHtml,
        keywords: ['hoa fees'],
        citations,
        faq_items: [],
      }));
    }
    if (toolName === 'report_compliance_check') {
      return jsonResponse(200, toolUseBody('report_compliance_check', checklist));
    }
    throw new Error(`test router: unexpected tool_choice "${toolName}"`);
  };
}

const CLEAN_CHECKLIST = {
  tenure_claim: false, tenure_evidence: null,
  uniqueness_claim: false, uniqueness_evidence: null,
  review_rating_claim: false, review_evidence: null,
  uncited_statistic: false, statistic_evidence: null,
  competitor_mention: false, competitor_evidence: null,
  contact_mismatch: false, contact_evidence: null,
  legal_duty_overstated: false, legal_duty_evidence: null,
};

const TRIPPING_CHECKLIST = {
  ...CLEAN_CHECKLIST,
  tenure_claim: true,
  tenure_evidence: 'a seasoned veteran of the local market',
};

function noOpenPrsExec(cmd) {
  if (cmd.startsWith('gh pr list')) return '[]';
  throw new Error(`test exec: unexpected command "${cmd}"`);
}

function writeIsolatedRepoFixture() {
  const root = isolatedDir('generate-main-test-');
  const generatedDir = path.join(root, 'generated-articles');
  const topicsPath = path.join(root, 'topics.json');
  const reportPath = path.join(root, '.last-run-report.json');
  const citationHostLogPath = path.join(root, 'citation-host-log.json');
  fs.writeFileSync(topicsPath, JSON.stringify([{ topic: 'Understanding HOA Fees', target_keyword: 'hoa fees' }]), 'utf8');
  return { root, generatedDir, topicsPath, reportPath, citationHostLogPath };
}

describe('main() — gate trip, full path (2026-07-26)', () => {
  test('a Layer 2 trip exits non-zero, writes no real article file, and DOES write a rejected marker', async () => {
    const { generatedDir, topicsPath, reportPath } = writeIsolatedRepoFixture();
    mockAnthropicRouter({ checklist: TRIPPING_CHECKLIST });
    process.exitCode = undefined;

    await main({
      apiKey: 'test-key',
      repo: 'owner/repo',
      generatedDir,
      topicsPath,
      reportPath,
      exec: noOpenPrsExec,
    });

    assert.equal(process.exitCode, 1, 'a tripped run must exit non-zero');
    process.exitCode = undefined; // don't leak into the test runner's own exit code

    const topLevelFiles = fs.existsSync(generatedDir)
      ? fs.readdirSync(generatedDir).filter((f) => f !== '.rejected')
      : [];
    assert.deepEqual(topLevelFiles, [], 'no real article file should be written directly under generatedDir');

    const rejectedDir = path.join(generatedDir, '.rejected');
    assert.ok(fs.existsSync(rejectedDir), 'a rejected-attempt marker directory must be written');
    const markerFiles = fs.readdirSync(rejectedDir);
    assert.equal(markerFiles.length, 1);
    const marker = JSON.parse(fs.readFileSync(path.join(rejectedDir, markerFiles[0]), 'utf8'));
    assert.equal(marker.sourceTopic, 'Understanding HOA Fees');
    assert.equal('title' in marker, false);

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.equal(report.outcome, 'skipped');
    assert.equal('article' in report, false, 'the persisted report must not carry the discarded article\'s identity either');
  });

  test('a clean run (both gates pass) exits zero and writes a real article, no rejected marker', async () => {
    const { generatedDir, topicsPath, reportPath } = writeIsolatedRepoFixture();
    mockAnthropicRouter({ checklist: CLEAN_CHECKLIST });
    process.exitCode = undefined;

    await main({
      apiKey: 'test-key',
      repo: 'owner/repo',
      generatedDir,
      topicsPath,
      reportPath,
      exec: noOpenPrsExec,
    });

    assert.equal(process.exitCode, undefined, 'a clean run must not set a non-zero exit code');

    const topLevelFiles = fs.readdirSync(generatedDir).filter((f) => f !== '.rejected');
    assert.equal(topLevelFiles.length, 1, 'exactly one real article file should be written');
    assert.equal(fs.existsSync(path.join(generatedDir, '.rejected')), false, 'no rejected marker on a clean run');

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.equal(report.outcome, 'generated');
  });
});

// ---------------------------------------------------------------------------
// main() — schema-invalid discard, full path (2026-07-27, the
// "silent-discard gap" fix). Real incident: draw 5 of the article-3
// bait-run produced an article that passed BOTH compliance gates cleanly
// but failed schema validation (a disallowed citation host) -- and exited
// 1 with NO marker file and NO PR, leaving zero ground truth anywhere.
// Proven RED against the pre-fix code (git-stashed generate.mjs, same
// working tree, same test) before applying the fix in this same session:
// the old schema-invalid branch never called handleTrippedGate, so this
// exact test's marker-existence assertion failed outright. GREEN below is
// against the current working tree.
// ---------------------------------------------------------------------------

describe('main() — schema-invalid discard, full path (2026-07-27)', () => {
  test('both gates pass but schema validation fails: exits non-zero, writes no real article, DOES write a rejected marker, marker carries failureClass + schemaErrors, report withholds article identity', async () => {
    const { generatedDir, topicsPath, reportPath } = writeIsolatedRepoFixture();
    // A citation host not on CITATION_HOST_POLICY's allowlist -- resolves
    // fine (so Layer 3 doesn't trip and the run actually reaches schema
    // validation), but schema.js's getCitationHostPolicyErrors rejects it.
    mockAnthropicRouter({
      checklist: CLEAN_CHECKLIST,
      citations: [{ id: '1', sourceName: 'Some Blog', url: 'https://not-on-the-list.example.com/page', sourceType: 'other-primary' }],
      citationFetchStatuses: { 'https://not-on-the-list.example.com/page': 200 },
      citationFetchBodies: { 'https://not-on-the-list.example.com/page': 'irrelevant body content' },
    });
    process.exitCode = undefined;

    await main({
      apiKey: 'test-key',
      repo: 'owner/repo',
      generatedDir,
      topicsPath,
      reportPath,
      exec: noOpenPrsExec,
    });

    assert.equal(process.exitCode, 1, 'a schema-invalid run must exit non-zero, same as a gate trip');
    process.exitCode = undefined;

    const topLevelFiles = fs.existsSync(generatedDir)
      ? fs.readdirSync(generatedDir).filter((f) => f !== '.rejected')
      : [];
    assert.deepEqual(topLevelFiles, [], 'no real article file should be written directly under generatedDir');

    const rejectedDir = path.join(generatedDir, '.rejected');
    assert.ok(fs.existsSync(rejectedDir), 'a rejected-attempt marker directory must be written on a schema-invalid discard, same as a gate trip');
    const markerFiles = fs.readdirSync(rejectedDir);
    assert.equal(markerFiles.length, 1);
    const marker = JSON.parse(fs.readFileSync(path.join(rejectedDir, markerFiles[0]), 'utf8'));
    assert.equal(marker.sourceTopic, 'Understanding HOA Fees');
    assert.equal(marker.failureClass, 'schema_invalid');
    assert.ok(marker.schemaErrors.length > 0, 'the marker must carry the actual schema errors, not just a boolean');
    assert.match(marker.schemaErrors.join(), /not an approved citation host/);
    assert.equal('title' in marker, false, 'never the discarded draft\'s identity, same rule as a gate trip');

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.equal(report.outcome, 'schema_invalid');
    assert.equal('article' in report, false, 'the persisted report must not carry the discarded article\'s identity either');
    assert.ok(report.schemaErrors.length > 0);
  });
});

// ---------------------------------------------------------------------------
// Internal-link gate — full path (Batch B, Part 3, 2026-08-08). Mirrors the
// schema-invalid discard test immediately above exactly: both gates pass,
// schema validation passes, but the draft contains a link to a URL that is
// not in knownRoutes -- must discard via the same handleTrippedGate path,
// never write a real article, never lose the topic silently.
// ---------------------------------------------------------------------------

describe('main() — internal-link-invalid discard, full path (2026-08-08)', () => {
  test('an invented internal link discards the run: exits non-zero, writes no real article, DOES write a rejected marker with failureClass internal_link_invalid', async () => {
    const { generatedDir, topicsPath, reportPath } = writeIsolatedRepoFixture();
    mockAnthropicRouter({
      checklist: CLEAN_CHECKLIST,
      citations: [],
      extraContentHtml: ' <a href="/blog/best-temecula-neighborhoods-guide-that-does-not-exist/">a guide</a>',
    });
    process.exitCode = undefined;

    await main({
      apiKey: 'test-key',
      repo: 'owner/repo',
      generatedDir,
      topicsPath,
      reportPath,
      exec: noOpenPrsExec,
    });

    assert.equal(process.exitCode, 1, 'an internal-link-invalid run must exit non-zero, same as a schema-invalid discard');
    process.exitCode = undefined;

    const topLevelFiles = fs.existsSync(generatedDir)
      ? fs.readdirSync(generatedDir).filter((f) => f !== '.rejected')
      : [];
    assert.deepEqual(topLevelFiles, [], 'no real article file should be written');

    const rejectedDir = path.join(generatedDir, '.rejected');
    assert.ok(fs.existsSync(rejectedDir), 'a rejected-attempt marker must be written');
    const markerFiles = fs.readdirSync(rejectedDir);
    assert.equal(markerFiles.length, 1);
    const marker = JSON.parse(fs.readFileSync(path.join(rejectedDir, markerFiles[0]), 'utf8'));
    assert.equal(marker.failureClass, 'internal_link_invalid');
    assert.ok(marker.internalLinkErrors.length > 0, 'the marker must carry the actual invalid link(s), not just a boolean');
    assert.match(marker.internalLinkErrors.join(), /best-temecula-neighborhoods-guide-that-does-not-exist/);
    assert.equal('title' in marker, false, 'never the discarded draft\'s identity');

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.equal(report.outcome, 'internal_link_invalid');
    assert.equal('article' in report, false);
  });

  test('a link to a real known route (the homepage) passes the gate and the run completes normally', async () => {
    const { generatedDir, topicsPath, reportPath } = writeIsolatedRepoFixture();
    mockAnthropicRouter({
      checklist: CLEAN_CHECKLIST,
      citations: [],
      extraContentHtml: ' <a href="https://temeculavalleyhomes.us/">the homepage</a>',
    });
    process.exitCode = undefined;

    await main({
      apiKey: 'test-key',
      repo: 'owner/repo',
      generatedDir,
      topicsPath,
      reportPath,
      exec: noOpenPrsExec,
    });

    assert.equal(process.exitCode, undefined, 'a valid internal link must not discard the run');
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.equal(report.outcome, 'generated');
  });
});

// ---------------------------------------------------------------------------
// Identity-completeness gate — full path (hardening batch, 2026-08-25).
// Mirrors the schema-invalid and internal-link-invalid discard tests above
// exactly: both compliance gates pass, schema validation passes, the
// internal-link gate passes, but content_html is missing the fixed identity
// block -- must discard via the same handleTrippedGate path, exactly the
// real gap PR #35 ("Vail Ranch," 2026-08-23) fell through, now closed.
// ---------------------------------------------------------------------------

describe('main() — identity-incomplete discard, full path (2026-08-25)', () => {
  test('a draft missing the identity block discards the run: exits non-zero, writes no real article, DOES write a rejected marker with failureClass identity_incomplete', async () => {
    const { generatedDir, topicsPath, reportPath } = writeIsolatedRepoFixture();
    mockAnthropicRouter({ checklist: CLEAN_CHECKLIST, citations: [], includeIdentityBlock: false });
    process.exitCode = undefined;

    await main({
      apiKey: 'test-key',
      repo: 'owner/repo',
      generatedDir,
      topicsPath,
      reportPath,
      exec: noOpenPrsExec,
    });

    assert.equal(process.exitCode, 1, 'an identity-incomplete run must exit non-zero, same as any other structural discard');
    process.exitCode = undefined;

    const topLevelFiles = fs.existsSync(generatedDir)
      ? fs.readdirSync(generatedDir).filter((f) => f !== '.rejected')
      : [];
    assert.deepEqual(topLevelFiles, [], 'no real article file should be written');

    const rejectedDir = path.join(generatedDir, '.rejected');
    assert.ok(fs.existsSync(rejectedDir), 'a rejected-attempt marker must be written');
    const markerFiles = fs.readdirSync(rejectedDir);
    assert.equal(markerFiles.length, 1);
    const marker = JSON.parse(fs.readFileSync(path.join(rejectedDir, markerFiles[0]), 'utf8'));
    assert.equal(marker.failureClass, 'identity_incomplete');
    assert.equal(marker.identityErrors.length, 4, `expected all four identity elements flagged, got: ${JSON.stringify(marker.identityErrors)}`);
    assert.equal('title' in marker, false, 'never the discarded draft\'s identity');

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.equal(report.outcome, 'identity_incomplete');
    assert.equal('article' in report, false);
  });

  test('a draft carrying the full identity block passes the gate and the run completes normally', async () => {
    const { generatedDir, topicsPath, reportPath } = writeIsolatedRepoFixture();
    mockAnthropicRouter({ checklist: CLEAN_CHECKLIST, citations: [], includeIdentityBlock: true });
    process.exitCode = undefined;

    await main({
      apiKey: 'test-key',
      repo: 'owner/repo',
      generatedDir,
      topicsPath,
      reportPath,
      exec: noOpenPrsExec,
    });

    assert.equal(process.exitCode, undefined, 'a complete identity block must not discard the run');
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.equal(report.outcome, 'generated');
  });
});

// ---------------------------------------------------------------------------
// runGenerationPipeline() / main() try-catch boundary (2026-08-31,
// tactical item 3c of the manual-publish formalization review). main()'s
// try/catch around the call to runGenerationPipeline() exists to catch a
// genuine uncaught exception (missing GITHUB_REPOSITORY's sibling case:
// any fail-closed throw during topic selection, see "early-exit reports"
// below) and write a minimal {outcome: 'uncaught_exception', errorMessage}
// report. handleTrippedGate()'s gate-trip path (Layer 1/2/3 trip, schema-
// invalid, internal-link-invalid, identity-incomplete) already writes its
// OWN structured report and returns NORMALLY (a plain `return;`, never a
// throw) -- by construction, that return can never reach the catch block.
// This describe block proves that construction actually holds: a gate
// trip's report on disk must be the ORIGINAL structured outcome (e.g.
// 'identity_incomplete'), never silently overwritten by a second write
// from the catch block. `errorMessage` is a field ONLY the
// uncaught_exception branch ever sets -- its presence on a gate-trip
// report would be direct proof the catch fired too, i.e. exactly the
// "two conflicting structured signals" failure mode this test rules out.
// ---------------------------------------------------------------------------
describe('runGenerationPipeline try-catch boundary — a gate trip never also triggers the uncaught_exception catch (2026-08-31, tactical item 3c)', () => {
  test('an identity-gate trip: exactly one structured report on disk, outcome stays identity_incomplete, no errorMessage field', async () => {
    const { generatedDir, topicsPath, reportPath } = writeIsolatedRepoFixture();
    mockAnthropicRouter({ checklist: CLEAN_CHECKLIST, citations: [], includeIdentityBlock: false });
    process.exitCode = undefined;

    await main({ apiKey: 'test-key', repo: 'owner/repo', generatedDir, topicsPath, reportPath, exec: noOpenPrsExec });

    assert.equal(process.exitCode, 1);
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.equal(report.outcome, 'identity_incomplete', 'the ORIGINAL structured gate-trip outcome must survive on disk -- never overwritten by a second, catch-block write');
    assert.equal('errorMessage' in report, false, 'errorMessage is set ONLY by the uncaught_exception catch -- its presence would prove the catch fired too and clobbered the real report');
  });

  test('a Layer 2 compliance-gate trip (outcome: skipped): same guarantee holds for a different trip type', async () => {
    const { generatedDir, topicsPath, reportPath } = writeIsolatedRepoFixture();
    mockAnthropicRouter({ checklist: TRIPPING_CHECKLIST });
    process.exitCode = undefined;

    await main({ apiKey: 'test-key', repo: 'owner/repo', generatedDir, topicsPath, reportPath, exec: noOpenPrsExec });

    assert.equal(process.exitCode, 1);
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.equal(report.outcome, 'skipped');
    assert.equal('errorMessage' in report, false);
  });

  test('a genuinely uncaught exception (topicAvailability throws): DOES reach the catch and write outcome: uncaught_exception -- the boundary works in the direction it is supposed to, not just refusing to fire when it should not', async () => {
    const { generatedDir, topicsPath, reportPath } = writeIsolatedRepoFixture();
    mockAnthropicRouter({ checklist: CLEAN_CHECKLIST });
    process.exitCode = undefined;
    const throwingExec = () => { throw new Error('[topicAvailability] gh pr list failed: simulated outage for the boundary test.'); };

    await main({ apiKey: 'test-key', repo: 'owner/repo', generatedDir, topicsPath, reportPath, exec: throwingExec });

    assert.equal(process.exitCode, 1);
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.equal(report.outcome, 'uncaught_exception');
    assert.match(report.errorMessage, /simulated outage for the boundary test/);
  });
});

// ---------------------------------------------------------------------------
// Early-exit reports (2026-08-31, Task 3 of the notification-hardening
// pass). Before this, all three of these paths -- missing
// ANTHROPIC_API_KEY, missing GITHUB_REPOSITORY, and any fail-closed throw
// during topic selection (topicAvailability.mjs) -- wrote NO report at
// all, indistinguishable from a genuinely exhausted topic queue from a
// workflow step's point of view (checkGenerateFailureReason.mjs, tested
// separately, needs a real report to tell them apart). Console output and
// exit codes must stay exactly what they were before this pass -- these
// tests check both, not just the new report.
// ---------------------------------------------------------------------------
describe('main() — early-exit reports (2026-08-31)', () => {
  test('missing ANTHROPIC_API_KEY: exits 1, writes NO real article, writes a minimal report with outcome missing_api_key', async () => {
    const { generatedDir, topicsPath, reportPath } = writeIsolatedRepoFixture();
    process.exitCode = undefined;

    await main({ apiKey: '', repo: 'owner/repo', generatedDir, topicsPath, reportPath });

    assert.equal(process.exitCode, 1);
    process.exitCode = undefined;
    assert.equal(fs.existsSync(path.join(generatedDir)), false, 'nothing should be written under generatedDir at all -- generation never started');
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.equal(report.outcome, 'missing_api_key');
  });

  test('missing GITHUB_REPOSITORY: exits 1 after model verification succeeds, writes a minimal report with outcome missing_repository', async () => {
    const { generatedDir, topicsPath, reportPath } = writeIsolatedRepoFixture();
    mockAnthropicRouter({ checklist: CLEAN_CHECKLIST });
    process.exitCode = undefined;

    await main({ apiKey: 'test-key', repo: '', generatedDir, topicsPath, reportPath });

    assert.equal(process.exitCode, 1);
    process.exitCode = undefined;
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.equal(report.outcome, 'missing_repository');
  });

  test('a fail-closed throw during topic selection (topicAvailability\'s own gh/git state gathering): exits 1, writes a report with outcome uncaught_exception and the real captured error message', async () => {
    const { generatedDir, topicsPath, reportPath } = writeIsolatedRepoFixture();
    mockAnthropicRouter({ checklist: CLEAN_CHECKLIST });
    process.exitCode = undefined;
    const throwingExec = () => { throw new Error('[topicAvailability] gh pr list failed: simulated CI outage. Refusing to guess which topics are already attempted.'); };

    await main({ apiKey: 'test-key', repo: 'owner/repo', generatedDir, topicsPath, reportPath, exec: throwingExec });

    assert.equal(process.exitCode, 1);
    process.exitCode = undefined;
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.equal(report.outcome, 'uncaught_exception');
    assert.match(report.errorMessage, /\[topicAvailability\]/);
    assert.match(report.errorMessage, /simulated CI outage/);
  });

  test('the queue-exhausted path is UNCHANGED by this pass -- still no report written (detected via captured log text instead, see checkGenerateFailureReason.mjs)', async () => {
    const { generatedDir, topicsPath, reportPath } = writeIsolatedRepoFixture();
    // Exhaust the one topic writeIsolatedRepoFixture() seeds by pre-writing
    // a generated article for it, matching getLocallyAttemptedTopics()'s
    // own ground-truth check.
    fs.mkdirSync(generatedDir, { recursive: true });
    fs.writeFileSync(path.join(generatedDir, 'understanding-hoa-fees.json'), JSON.stringify({ slug: 'understanding-hoa-fees', sourceTopic: 'Understanding HOA Fees' }), 'utf8');
    mockAnthropicRouter({ checklist: CLEAN_CHECKLIST });
    process.exitCode = undefined;

    await main({ apiKey: 'test-key', repo: 'owner/repo', generatedDir, topicsPath, reportPath, exec: noOpenPrsExec });

    assert.equal(process.exitCode, 1);
    process.exitCode = undefined;
    assert.equal(fs.existsSync(reportPath), false, 'queue-exhausted must still write no report -- this path is deliberately left as log-only, not structured, per this pass\'s explicit scope');
  });
});

// ---------------------------------------------------------------------------
// Self-review internal-link validation -- SUPERSEDED 2026-08-31.
//
// History: two real runs (PRs #28, #29, 2026-08-09/11) stripped every
// internal link during self-review because selfReview() never received
// knownRoutesText at all (fixed 2026-08-12: give it the list). That
// mitigated the symptom but not the cause -- PR #32 (2026-08-17) and PR #38
// (2026-08-27) both still stripped valid links WITH the list in hand,
// citing mismatches that didn't exist. The 2026-08-31 root fix (owner
// ruling item 2) removed self-review's link-validation responsibility
// entirely instead -- see the "self-review no longer re-validates internal
// links" describe block above for that fix's own tests. The first test
// below is kept, INVERTED, as the regression guard for the root fix (the
// list must never come back); the second test below still holds --
// self-review correctly leaving already-valid links untouched remains the
// desired behavior, now guaranteed by instruction rather than judgment.
// ---------------------------------------------------------------------------

describe('self-review — internal-link validation (2026-08-12 fix, superseded 2026-08-31)', () => {
  test('the self-review API call does NOT include a Known live routes list (root fix, 2026-08-31) -- the draft pass still does', async () => {
    const { generatedDir, topicsPath, reportPath } = writeIsolatedRepoFixture();
    let selfReviewUserMessage = null;
    let draftUserMessage = null;
    globalThis.fetch = async (url, init = {}) => {
      const urlStr = String(url);
      if (urlStr.includes('/v1/models')) return jsonResponse(200, { data: [{ id: WRITER_MODEL }, { id: REVIEWER_MODEL }] });
      if (!urlStr.includes('api.anthropic.com')) return { status: 200, text: async () => '' };
      const body = JSON.parse(init.body);
      const toolName = body.tool_choice?.name;
      const baseArticle = {
        title: 'Understanding HOA Fees',
        slug_suggestion: 'understanding-hoa-fees',
        meta_description: 'A clear, practical explanation of how HOA fees work for California homebuyers considering a planned community.',
        content_html: `<p>HOA fees fund shared community amenities and routine maintenance.</p>${IDENTITY_BLOCK_HTML}`,
        keywords: ['hoa fees'],
        citations: [],
        faq_items: [],
      };
      if (toolName === 'submit_article_draft') {
        draftUserMessage = body.messages[0].content;
        return jsonResponse(200, toolUseBody('submit_article_draft', baseArticle));
      }
      if (toolName === 'submit_reviewed_article') {
        selfReviewUserMessage = body.messages[0].content;
        return jsonResponse(200, toolUseBody('submit_reviewed_article', { draft_was_clean: true, violations_found: [], ...baseArticle }));
      }
      if (toolName === 'report_compliance_check') return jsonResponse(200, toolUseBody('report_compliance_check', CLEAN_CHECKLIST));
      throw new Error(`test router: unexpected tool_choice "${toolName}"`);
    };
    process.exitCode = undefined;

    await main({ apiKey: 'test-key', repo: 'owner/repo', generatedDir, topicsPath, reportPath, exec: noOpenPrsExec });

    assert.equal(process.exitCode, undefined);
    assert.ok(draftUserMessage, 'the draft pass must have been called');
    assert.ok(selfReviewUserMessage, 'the self-review pass must have been called');
    assert.match(draftUserMessage, /Known live routes/, 'sanity check: the draft pass has always received this list, and still must');
    assert.doesNotMatch(selfReviewUserMessage, /Known live routes/, 'the self-review pass must NOT receive this list -- the 2026-08-31 root fix removed the re-validation it used to enable');
  });

  test('two internal links matching known routes survive self-review intact -- the run generates normally with both links in content_html', async () => {
    const { generatedDir, topicsPath, reportPath } = writeIsolatedRepoFixture();
    // Real, stable static routes from tools/seo-prerender.js's ROUTES.
    const LINK_1 = 'https://temeculavalleyhomes.us/homes-for-sale-temecula/';
    const LINK_2 = 'https://temeculavalleyhomes.us/sell-my-house/';

    mockAnthropicRouter({
      checklist: CLEAN_CHECKLIST,
      citations: [],
      // mockAnthropicRouter shares one contentHtml between the draft and
      // self-review mock responses (see its own header comment) -- for
      // this test that's the right shape anyway: it simulates self-review
      // correctly leaving two already-valid links untouched rather than
      // stripping them, which is exactly the behavior this fix restores.
      extraContentHtml: ` <a href="${LINK_1}">homes for sale in Temecula</a> <a href="${LINK_2}">how to sell your home</a>`,
    });
    process.exitCode = undefined;

    await main({ apiKey: 'test-key', repo: 'owner/repo', generatedDir, topicsPath, reportPath, exec: noOpenPrsExec });

    assert.equal(process.exitCode, undefined, 'two valid internal links must not discard the run');
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.equal(report.outcome, 'generated');

    const articleFiles = fs.readdirSync(generatedDir).filter((f) => f !== '.rejected');
    assert.equal(articleFiles.length, 1);
    const article = JSON.parse(fs.readFileSync(path.join(generatedDir, articleFiles[0]), 'utf8'));
    assert.match(article.content_html, new RegExp(LINK_1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'the first valid link must survive into the written article');
    assert.match(article.content_html, new RegExp(LINK_2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'the second valid link must survive into the written article');
  });
});

// ---------------------------------------------------------------------------
// Deterministic link-restore backstop (2026-08-19). The 2026-08-12 fix
// above (self-review receives the Known live routes list) closed most of
// the gap, but self-review's link-URL-matching is still an LLM judgment
// call, not a deterministic one -- observed live on PR #32 (Paloma Del
// Sol, 2026-08-17): it stripped six links whose URLs were verbatim
// matches to entries on the list it was given. This describe block proves
// the backstop (internalLinkRestore.mjs, wired into main() right after
// self-review) actually fires end-to-end through the real pipeline, not
// just in the module's own isolated unit tests.
// ---------------------------------------------------------------------------
describe('link-restore backstop — the real PR #32 bug, reproduced end-to-end (2026-08-19)', () => {
  test('self-review wrongly strips a valid known-route link (real router, draft and reviewed responses differ) -- main() restores it before writing the article', async () => {
    const { generatedDir, topicsPath, reportPath } = writeIsolatedRepoFixture();
    // Static route from seo-prerender.js's ROUTES -- always in knownRoutes
    // regardless of blog-articles.json's current content, same choice the
    // existing test above makes for the same reason.
    const LINK = 'https://temeculavalleyhomes.us/homes-for-sale-temecula/';
    const draftHtml = `<p>You can start by browsing <a href="${LINK}">homes for sale in Temecula</a> today.</p>${IDENTITY_BLOCK_HTML}`;
    // Self-review's real, observed failure mode on PR #32: strips the <a>,
    // keeps the anchor text verbatim as plain text.
    const reviewedHtml = `<p>You can start by browsing homes for sale in Temecula today.</p>${IDENTITY_BLOCK_HTML}`;

    globalThis.fetch = async (url, init = {}) => {
      const urlStr = String(url);
      if (urlStr.includes('/v1/models')) return jsonResponse(200, { data: [{ id: WRITER_MODEL }, { id: REVIEWER_MODEL }] });
      if (!urlStr.includes('api.anthropic.com')) return { status: 200, text: async () => '' };
      const body = JSON.parse(init.body);
      const toolName = body.tool_choice?.name;
      if (toolName === 'submit_article_draft') {
        return jsonResponse(200, toolUseBody('submit_article_draft', {
          title: 'Homes For Sale in Temecula: A Buyer’s Overview',
          slug_suggestion: 'temecula-buyer-overview',
          meta_description: 'An overview for buyers exploring homes for sale in Temecula Valley and nearby areas.',
          content_html: draftHtml,
          keywords: ['temecula homes'],
          citations: [],
          faq_items: [],
        }));
      }
      if (toolName === 'submit_reviewed_article') {
        return jsonResponse(200, toolUseBody('submit_reviewed_article', {
          draft_was_clean: true,
          violations_found: [],
          title: 'Homes For Sale in Temecula: A Buyer’s Overview',
          slug_suggestion: 'temecula-buyer-overview',
          meta_description: 'An overview for buyers exploring homes for sale in Temecula Valley and nearby areas.',
          content_html: reviewedHtml,
          keywords: ['temecula homes'],
          citations: [],
          faq_items: [],
        }));
      }
      if (toolName === 'report_compliance_check') return jsonResponse(200, toolUseBody('report_compliance_check', CLEAN_CHECKLIST));
      throw new Error(`test router: unexpected tool_choice "${toolName}"`);
    };
    process.exitCode = undefined;

    await main({ apiKey: 'test-key', repo: 'owner/repo', generatedDir, topicsPath, reportPath, exec: noOpenPrsExec });

    assert.equal(process.exitCode, undefined, 'a restored valid link must not discard the run');
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.equal(report.outcome, 'generated');

    const articleFiles = fs.readdirSync(generatedDir).filter((f) => f !== '.rejected');
    assert.equal(articleFiles.length, 1);
    const article = JSON.parse(fs.readFileSync(path.join(generatedDir, articleFiles[0]), 'utf8'));
    assert.match(
      article.content_html,
      new RegExp(`<a href="${LINK.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}">homes for sale in Temecula</a>`),
      'the link self-review stripped must be restored, verbatim, in the final written article'
    );
  });
});

// ---------------------------------------------------------------------------
// Root-fix: self-review no longer touches internal links at all (2026-08-31,
// owner ruling item 2, manual-publish formalization). The 2026-08-12 fix
// (self-review receives the Known live routes list) and the 2026-08-19
// backstop (internalLinkRestore.mjs, tested immediately above) both
// mitigated SYMPTOMS -- giving the model the list, then deterministically
// undoing its mistakes after the fact. Neither fixed the actual cause:
// asking an LLM to re-judge exact URL string equality is unreliable even
// with the list in hand. PR #32 (2026-08-17) stripped 6 valid links citing
// a mismatch that didn't exist; PR #38 (2026-08-27) stripped 9, restored
// 8, the one miss traced to self-review REWORDING the surrounding sentence,
// not a URL judgment call at all -- further evidence this pass has no
// business touching links.
//
// Root fix: remove the instruction (and the redundant list) that asks
// self-review to re-validate links entirely. The draft pass already
// receives and is instructed to use the same "Known live routes" list;
// self-review re-checking it is both redundant (nothing has changed the
// draft's links yet at that point) and the actual source of every phantom
// correction observed. internalLinkGate.mjs remains the real backstop --
// deterministic, not a second LLM judgment call -- for the case where the
// draft pass itself gets a URL wrong.
// ---------------------------------------------------------------------------
describe('self-review no longer re-validates internal links (2026-08-31, root fix)', () => {
  test('the self-review request never offers a "Known live routes" list -- nothing left for the model to (mis)judge against', async () => {
    const { generatedDir, topicsPath, reportPath } = writeIsolatedRepoFixture();
    const capturedMessages = [];
    globalThis.fetch = async (url, init = {}) => {
      const urlStr = String(url);
      if (urlStr.includes('/v1/models')) return jsonResponse(200, { data: [{ id: WRITER_MODEL }, { id: REVIEWER_MODEL }] });
      if (!urlStr.includes('api.anthropic.com')) return { status: 200, text: async () => '' };
      const body = JSON.parse(init.body);
      const toolName = body.tool_choice?.name;
      const userMessage = body.messages?.[0]?.content || '';
      if (toolName === 'submit_article_draft') {
        capturedMessages.push({ toolName, userMessage });
        return jsonResponse(200, toolUseBody('submit_article_draft', {
          title: 'Understanding HOA Fees',
          slug_suggestion: 'understanding-hoa-fees',
          meta_description: 'A clear, practical explanation of how HOA fees work for California homebuyers considering a planned community.',
          content_html: `<p>HOA fees fund shared amenities.</p>${IDENTITY_BLOCK_HTML}`,
          keywords: ['hoa fees'],
          citations: [],
          faq_items: [],
        }));
      }
      if (toolName === 'submit_reviewed_article') {
        capturedMessages.push({ toolName, userMessage });
        return jsonResponse(200, toolUseBody('submit_reviewed_article', {
          draft_was_clean: true,
          violations_found: [],
          title: 'Understanding HOA Fees',
          slug_suggestion: 'understanding-hoa-fees',
          meta_description: 'A clear, practical explanation of how HOA fees work for California homebuyers considering a planned community.',
          content_html: `<p>HOA fees fund shared amenities.</p>${IDENTITY_BLOCK_HTML}`,
          keywords: ['hoa fees'],
          citations: [],
          faq_items: [],
        }));
      }
      if (toolName === 'report_compliance_check') return jsonResponse(200, toolUseBody('report_compliance_check', CLEAN_CHECKLIST));
      throw new Error(`test router: unexpected tool_choice "${toolName}"`);
    };
    process.exitCode = undefined;

    await main({ apiKey: 'test-key', repo: 'owner/repo', generatedDir, topicsPath, reportPath, exec: noOpenPrsExec });

    assert.equal(process.exitCode, undefined);
    const draftCall = capturedMessages.find((m) => m.toolName === 'submit_article_draft');
    const reviewCall = capturedMessages.find((m) => m.toolName === 'submit_reviewed_article');
    assert.match(draftCall.userMessage, /Known live routes/, 'the DRAFT pass must still receive the list -- only self-review\'s re-validation is removed');
    assert.doesNotMatch(reviewCall.userMessage, /Known live routes/i, 'self-review must no longer be offered a link list to re-judge against');
    assert.doesNotMatch(reviewCall.userMessage, /exact match/i, 'self-review must no longer be asked to judge exact URL matches -- the actual source of every phantom correction observed');
  });

  // The real multi-link fixture the fix is proven against: several links
  // of different shapes (a static page, two blog articles), self-review
  // returning them byte-for-byte unchanged (the correct behavior now that
  // it has no instruction to re-touch them) -- asserts the actual, fully
  // observable success condition: zero link-related violations_found
  // entries AND zero restore actions (nothing needed restoring because
  // nothing was stripped).
  test('a real multi-link fixture: self-review leaves every internal link untouched -- zero phantom violations_found entries, zero restore actions needed', async () => {
    const { generatedDir, topicsPath, reportPath } = writeIsolatedRepoFixture();
    const LINK_A = 'https://temeculavalleyhomes.us/homes-for-sale-temecula/';
    const LINK_B = 'https://temeculavalleyhomes.us/contact/';
    const html = `<p>Start by browsing <a href="${LINK_A}">homes for sale in Temecula</a> today, or <a href="${LINK_B}">reach out with questions</a> any time.</p>${IDENTITY_BLOCK_HTML}`;

    globalThis.fetch = async (url, init = {}) => {
      const urlStr = String(url);
      if (urlStr.includes('/v1/models')) return jsonResponse(200, { data: [{ id: WRITER_MODEL }, { id: REVIEWER_MODEL }] });
      if (!urlStr.includes('api.anthropic.com')) return { status: 200, text: async () => '' };
      const body = JSON.parse(init.body);
      const toolName = body.tool_choice?.name;
      const common = {
        title: 'Homes For Sale in Temecula: A Buyer’s Overview',
        slug_suggestion: 'temecula-buyer-overview-2',
        meta_description: 'An overview for buyers exploring homes for sale in Temecula Valley and nearby areas.',
        content_html: html,
        keywords: ['temecula homes'],
        citations: [],
        faq_items: [],
      };
      if (toolName === 'submit_article_draft') return jsonResponse(200, toolUseBody('submit_article_draft', common));
      if (toolName === 'submit_reviewed_article') return jsonResponse(200, toolUseBody('submit_reviewed_article', { ...common, draft_was_clean: true, violations_found: [] }));
      if (toolName === 'report_compliance_check') return jsonResponse(200, toolUseBody('report_compliance_check', CLEAN_CHECKLIST));
      throw new Error(`test router: unexpected tool_choice "${toolName}"`);
    };
    process.exitCode = undefined;

    await main({ apiKey: 'test-key', repo: 'owner/repo', generatedDir, topicsPath, reportPath, exec: noOpenPrsExec });

    assert.equal(process.exitCode, undefined);
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.equal(report.outcome, 'generated');
    assert.deepEqual(report.selfReview.violationsFound, [], 'zero violations_found entries -- nothing was touched, nothing to report');

    const articleFiles = fs.readdirSync(generatedDir).filter((f) => f !== '.rejected');
    const article = JSON.parse(fs.readFileSync(path.join(generatedDir, articleFiles[0]), 'utf8'));
    assert.match(article.content_html, new RegExp(`<a href="${LINK_A.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}">homes for sale in Temecula</a>`));
    assert.match(article.content_html, new RegExp(`<a href="${LINK_B.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}">reach out with questions</a>`));
  });
});

// ---------------------------------------------------------------------------
// report.article.firstParagraphText (2026-08-31, live-run bug found via the
// manual-publish formalization's 14:00 UTC cron proof). Real incident: the
// "Build email content (article PR opened, held for review)" step reads
// report.outputPath and re-reads the article FILE from local disk to
// extract the first-paragraph preview text -- but by the time that step
// runs, "Open PR with the generated article" (peter-evans/create-pull-
// request@v6) has already committed the new article file to the PR branch
// and restored the runner's local working tree to its pre-action state for
// that path, so the file no longer exists locally. Observed live, PR #40
// (2026-08-31, run 33428265910): buildNotificationEmailCli.mjs logged
// "non-fatal error building 'article-pr' email: ENOENT ... purchase-
// agreement-contingencies-explained-california.json", the build step
// silently produced no subject, and the notify-email action's own "no
// subject provided -- skipping" branch correctly (by its own contract) sent
// nothing -- meaning the "your article awaits review" email has likely
// never actually reached the inbox for a real, non-silent generation run,
// since this exact path was added 2026-08-25 and this was its first real
// live exercise. Root fix: compute the first-paragraph text ONCE, in
// generate.mjs, while `article` is still an in-memory object (never
// touched by git) -- carried forward as report.article.firstParagraphText
// so buildNotificationEmailCli.mjs never needs to re-read a file that may
// no longer exist on disk by the time it runs.
// ---------------------------------------------------------------------------
describe('report.article.firstParagraphText — survives the article file vanishing from disk after PR creation (2026-08-31)', () => {
  test('a generated article\'s report carries firstParagraphText, extracted from the real content_html, computed once at write time', async () => {
    const { generatedDir, topicsPath, reportPath } = writeIsolatedRepoFixture();
    mockAnthropicRouter({ checklist: CLEAN_CHECKLIST, citations: [] });
    process.exitCode = undefined;

    await main({ apiKey: 'test-key', repo: 'owner/repo', generatedDir, topicsPath, reportPath, exec: noOpenPrsExec });

    assert.equal(process.exitCode, undefined);
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.equal(report.outcome, 'generated');
    assert.equal(typeof report.article.firstParagraphText, 'string');
    assert.ok(report.article.firstParagraphText.length > 0, 'must be real extracted text, not blank');
    assert.match(report.article.firstParagraphText, /HOA fees fund shared community amenities/, 'must actually be the article\'s real first-paragraph text, not a placeholder');
    assert.doesNotMatch(report.article.firstParagraphText, /<[a-z]/i, 'must be plain text (HTML tags stripped), matching extractFirstParagraphText\'s own contract');
  });

  test('buildNotificationEmailCli.mjs --kind=article-pr builds a real email using ONLY the report -- even after the article file is gone from disk (the real-world create-pull-request cleanup scenario)', async () => {
    const { generatedDir, topicsPath, reportPath } = writeIsolatedRepoFixture();
    mockAnthropicRouter({ checklist: CLEAN_CHECKLIST, citations: [] });
    process.exitCode = undefined;
    await main({ apiKey: 'test-key', repo: 'owner/repo', generatedDir, topicsPath, reportPath, exec: noOpenPrsExec });
    assert.equal(process.exitCode, undefined);

    // Simulates exactly the real-world failure: the article file is GONE
    // from disk (as it is after create-pull-request's cleanup) by the time
    // the email gets built -- this must still succeed. Invoked as a real
    // subprocess (this file's isMain CLI shell reads process.argv directly,
    // not injectable args -- matching this repo's existing pattern of
    // testing a thin, untested-by-unit-test CLI shell via the real
    // executable rather than refactoring it just to make it importable).
    const articleFiles = fs.readdirSync(generatedDir).filter((f) => f !== '.rejected');
    fs.rmSync(path.join(generatedDir, articleFiles[0]));

    const cliPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'buildNotificationEmailCli.mjs');
    const result = spawnSync(process.execPath, [
      cliPath,
      '--kind=article-pr',
      `--report=${reportPath}`,
      '--preview-url=https://example.igor-r.pages.dev',
      '--pr-url=https://github.com/drstas-cyber/IGOR_r/pull/40',
    ], { encoding: 'utf8' });

    assert.doesNotMatch(result.stderr || '', /ENOENT/, 'must not fail trying to re-read the vanished article file');
    // stdout is the pretty-printed {subject, html} JSON block followed by a
    // trailing "[buildNotificationEmailCli] built ..." log line (console.log
    // writeOutputs()'s own fallback, then main()'s own success line) -- not
    // itself valid single-document JSON, so match on content directly
    // rather than parsing the whole stream.
    assert.match(result.stdout, /Understanding HOA Fees/);
    assert.match(result.stdout, /HOA fees fund shared community amenities/);
  });
});

describe('main() — layer 3 citation URL resolution, full path (2026-07-26)', () => {
  // A real approved host (tier 1, statute-permitted) -- schema.js's host
  // policy (added 2026-07-26) now rejects any host not on its allowlist,
  // so a placeholder like example.gov would fail schema validation on the
  // success-path tests below regardless of what Layer 3 itself decides.
  const CITATION_URL_OK = 'https://leginfo.legislature.ca.gov/statute-a';
  const CITATION = { id: '1', sourceName: 'Example Statute', url: CITATION_URL_OK, sourceType: 'statute' };

  test('a citation that resolves 200 does not trip anything; article is generated', async () => {
    const { generatedDir, topicsPath, reportPath, citationHostLogPath } = writeIsolatedRepoFixture();
    mockAnthropicRouter({ checklist: CLEAN_CHECKLIST, citations: [CITATION], citationFetchStatuses: { [CITATION_URL_OK]: 200 } });
    process.exitCode = undefined;

    await main({ apiKey: 'test-key', repo: 'owner/repo', generatedDir, topicsPath, reportPath, citationHostLogPath, exec: noOpenPrsExec });

    assert.equal(process.exitCode, undefined);
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.equal(report.outcome, 'generated');
    assert.equal(report.layer3.tripped, false);
    assert.equal(report.layer3.results[0].outcome, 'RESOLVED');
    assert.equal(fs.existsSync(citationHostLogPath), false, 'a RESOLVED citation writes no host-log entry');
  });

  test('a citation that 404s trips the gate — exits non-zero, no article file, rejected marker carries layer3', async () => {
    const { generatedDir, topicsPath, reportPath, citationHostLogPath } = writeIsolatedRepoFixture();
    mockAnthropicRouter({ checklist: CLEAN_CHECKLIST, citations: [CITATION], citationFetchStatuses: { [CITATION_URL_OK]: 404 } });
    process.exitCode = undefined;

    await main({ apiKey: 'test-key', repo: 'owner/repo', generatedDir, topicsPath, reportPath, citationHostLogPath, exec: noOpenPrsExec });

    assert.equal(process.exitCode, 1, 'a dead citation link must trip the gate exactly like any other trip');
    process.exitCode = undefined;

    const topLevelFiles = fs.existsSync(generatedDir) ? fs.readdirSync(generatedDir).filter((f) => f !== '.rejected') : [];
    assert.deepEqual(topLevelFiles, [], 'no real article file on a layer 3 trip');

    const rejectedDir = path.join(generatedDir, '.rejected');
    const markerFiles = fs.readdirSync(rejectedDir);
    const marker = JSON.parse(fs.readFileSync(path.join(rejectedDir, markerFiles[0]), 'utf8'));
    assert.equal(marker.layer3.tripped, true);
    assert.equal(marker.layer3.failed[0].status, 404);

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.equal(report.outcome, 'skipped');
    assert.equal(report.layer1.tripped, false, 'layer 1 genuinely clean -- layer 3 alone is what tripped this run');
    assert.equal(report.layer2.tripped, false, 'layer 2 genuinely clean -- layer 3 alone is what tripped this run');
  });

  test('a citation that 403s does NOT trip -- article still generates, host log gets an entry', async () => {
    const { generatedDir, topicsPath, reportPath, citationHostLogPath } = writeIsolatedRepoFixture();
    mockAnthropicRouter({ checklist: CLEAN_CHECKLIST, citations: [CITATION], citationFetchStatuses: { [CITATION_URL_OK]: 403 } });
    process.exitCode = undefined;

    await main({ apiKey: 'test-key', repo: 'owner/repo', generatedDir, topicsPath, reportPath, citationHostLogPath, exec: noOpenPrsExec });

    assert.equal(process.exitCode, undefined, 'UNREACHABLE_LIKELY_BOT must never trip the gate on its own');
    const topLevelFiles = fs.readdirSync(generatedDir).filter((f) => f !== '.rejected');
    assert.equal(topLevelFiles.length, 1, 'the article is still written -- a bot-block is inconclusive, not a failure');

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.equal(report.outcome, 'generated');
    assert.equal(report.layer3.tripped, false);
    assert.equal(report.layer3.inconclusive.length, 1);

    assert.ok(fs.existsSync(citationHostLogPath), 'the durable host log must be written for an inconclusive citation');
    const hostLog = JSON.parse(fs.readFileSync(citationHostLogPath, 'utf8'));
    assert.equal(hostLog.length, 1);
    assert.equal(hostLog[0].host, 'leginfo.legislature.ca.gov');
    assert.equal(hostLog[0].status, 403);
    assert.equal(hostLog[0].sourceTopic, 'Understanding HOA Fees');
  });

  test('host log entries accumulate across multiple runs rather than overwriting', async () => {
    const { generatedDir, topicsPath, reportPath, citationHostLogPath } = writeIsolatedRepoFixture();
    mockAnthropicRouter({ checklist: CLEAN_CHECKLIST, citations: [CITATION], citationFetchStatuses: { [CITATION_URL_OK]: 429 } });

    await main({ apiKey: 'test-key', repo: 'owner/repo', generatedDir, topicsPath, reportPath, citationHostLogPath, exec: noOpenPrsExec });
    // second run needs a fresh topic since the first is now attempted -- reuse the same log path with a second topic
    fs.writeFileSync(topicsPath, JSON.stringify([
      { topic: 'Understanding HOA Fees', target_keyword: 'hoa fees' },
      { topic: 'A Second Topic', target_keyword: 'second' },
    ]), 'utf8');
    await main({ apiKey: 'test-key', repo: 'owner/repo', generatedDir, topicsPath, reportPath, citationHostLogPath, exec: noOpenPrsExec });

    const hostLog = JSON.parse(fs.readFileSync(citationHostLogPath, 'utf8'));
    assert.equal(hostLog.length, 2, 'both runs\' inconclusive citations must be present, not just the latest');
  });

  // 2026-07-27: a citation that resolves 200 but whose body doesn't
  // support the sourceName it claims -- article 1's real failure mode
  // (leginfo's soft-404 shell). Must trip exactly like a dead link, with
  // layer1/layer2 genuinely clean, isolating that RESOLVED_UNSUPPORTED
  // alone caused it.
  test('a citation that resolves 200 but fails body verification trips the gate as RESOLVED_UNSUPPORTED', async () => {
    const { generatedDir, topicsPath, reportPath, citationHostLogPath } = writeIsolatedRepoFixture();
    const unsupportedCitation = { id: '1', sourceName: 'Example Statute (§ 100 et seq.)', url: CITATION_URL_OK, sourceType: 'statute' };
    mockAnthropicRouter({
      checklist: CLEAN_CHECKLIST,
      citations: [unsupportedCitation],
      citationFetchStatuses: { [CITATION_URL_OK]: 200 },
      citationFetchBodies: { [CITATION_URL_OK]: '<html><body>no section numbers here at all</body></html>' },
    });
    process.exitCode = undefined;

    await main({ apiKey: 'test-key', repo: 'owner/repo', generatedDir, topicsPath, reportPath, citationHostLogPath, exec: noOpenPrsExec });

    assert.equal(process.exitCode, 1, 'a resolved-but-unsupported citation must trip the gate, same as a dead link');
    process.exitCode = undefined;

    const topLevelFiles = fs.existsSync(generatedDir) ? fs.readdirSync(generatedDir).filter((f) => f !== '.rejected') : [];
    assert.deepEqual(topLevelFiles, [], 'no real article file on a body-verification trip');

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.equal(report.outcome, 'skipped');
    assert.equal(report.layer1.tripped, false);
    assert.equal(report.layer2.tripped, false);
    assert.equal(report.layer3.tripped, true);
    assert.equal(report.layer3.unsupported.length, 1);
    assert.equal(report.layer3.unsupported[0].token, '100');
  });
});

describe('main() — findUncitedClaims wiring, LOG-ONLY end to end (2026-07-26)', () => {
  test('an uncited number appears in the report but does NOT trip the gate or block generation', async () => {
    const { generatedDir, topicsPath, reportPath, citationHostLogPath } = writeIsolatedRepoFixture();
    mockAnthropicRouter({ checklist: CLEAN_CHECKLIST, citations: [], extraContentHtml: ' Rates rose 12% last year.' });
    process.exitCode = undefined;

    await main({ apiKey: 'test-key', repo: 'owner/repo', generatedDir, topicsPath, reportPath, citationHostLogPath, exec: noOpenPrsExec });

    assert.equal(process.exitCode, undefined, 'an uncited-claim candidate must never trip the gate -- log-only');
    const topLevelFiles = fs.readdirSync(generatedDir).filter((f) => f !== '.rejected');
    assert.equal(topLevelFiles.length, 1, 'the article is still written despite the uncited-claim candidate');

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.equal(report.outcome, 'generated');
    assert.equal(report.layer1.tripped, false);
    assert.ok(report.layer1.uncitedClaimCandidates.some((f) => f.subcategory === 'percentage' && f.matchedText === '12%'), JSON.stringify(report.layer1.uncitedClaimCandidates));
  });
});
