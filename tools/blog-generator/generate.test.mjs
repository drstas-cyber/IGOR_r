import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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

  test('marker contains EXACTLY sourceTopic, rejectedAt, failureClass, layer1, layer2, layer3, schemaErrors, internalLinkErrors — no title/slug/content_html', () => {
    const dir = isolatedDir();
    const { markerPath } = handleTrippedGate(sampleReport(), { generatedDir: dir });
    const written = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    assert.deepEqual(
      new Set(Object.keys(written)),
      new Set(['sourceTopic', 'rejectedAt', 'failureClass', 'layer1', 'layer2', 'layer3', 'schemaErrors', 'internalLinkErrors'])
    );
    assert.equal('title' in written, false);
    assert.equal('slug' in written, false);
    assert.equal('content_html' in written, false);
  });

  test('failureClass is "gate_trip" for outcome "skipped", "schema_invalid" for outcome "schema_invalid", "internal_link_invalid" for outcome "internal_link_invalid"', () => {
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
function mockAnthropicRouter({ checklist, citations = [], citationFetchStatuses = {}, citationFetchBodies = {}, extraContentHtml = '' }) {
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
    const contentHtml = `<p>HOA fees fund shared community amenities and routine maintenance for planned developments.${markers}${extraContentHtml}</p>`;
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
