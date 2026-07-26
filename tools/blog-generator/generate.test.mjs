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
} from './generate.mjs';

function isolatedDir(prefix = 'generate-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// ---------------------------------------------------------------------------
// handleTrippedGate — the rejected-attempt marker writer.
//
// Requirement being tested (restated): the marker file must contain ONLY
// {sourceTopic, rejectedAt, layer1, layer2} — never the discarded draft's
// title, slug, or content_html. Proven RED first: at commit fbc8a38 (the
// commit immediately before this one), handleTrippedGate does not exist —
// `node --test` on this file against that commit fails with an import
// error (confirmed via a throwaway `git worktree add` checkout before this
// file was written). GREEN below is against the current working tree.
// ---------------------------------------------------------------------------

describe('handleTrippedGate — rejected-attempt marker (2026-07-26)', () => {
  function sampleReport(overrides = {}) {
    return {
      generatedAt: '2026-07-26T00:00:00.000Z',
      topic: { topic: 'What First-Time Buyers Should Know About Home Inspections', target_keyword: 'home inspection' },
      layer1: { tripped: true, findings: [{ category: 'tenure', matchedText: 'over a decade', sentence: 'George has over a decade of experience.' }] },
      layer2: { tripped: false, checklist: { tenure_claim: false } },
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

  test('marker contains EXACTLY sourceTopic, rejectedAt, layer1, layer2 — no title/slug/content_html', () => {
    const dir = isolatedDir();
    const { markerPath } = handleTrippedGate(sampleReport(), { generatedDir: dir });
    const written = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    assert.deepEqual(new Set(Object.keys(written)), new Set(['sourceTopic', 'rejectedAt', 'layer1', 'layer2']));
    assert.equal('title' in written, false);
    assert.equal('slug' in written, false);
    assert.equal('content_html' in written, false);
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
function mockAnthropicRouter({ checklist }) {
  globalThis.fetch = async (url, init = {}) => {
    const urlStr = String(url);
    if (urlStr.includes('/v1/models')) {
      return jsonResponse(200, { data: [{ id: WRITER_MODEL }, { id: REVIEWER_MODEL }] });
    }
    const body = JSON.parse(init.body);
    const toolName = body.tool_choice?.name;
    if (toolName === 'submit_article_draft') {
      return jsonResponse(200, toolUseBody('submit_article_draft', {
        title: 'Understanding HOA Fees',
        slug_suggestion: 'understanding-hoa-fees',
        meta_description: 'A clear, practical explanation of how HOA fees work for California homebuyers considering a planned community.',
        content_html: '<p>HOA fees fund shared community amenities and routine maintenance for planned developments.</p>',
        keywords: ['hoa fees'],
        faq_items: [],
      }));
    }
    if (toolName === 'submit_reviewed_article') {
      return jsonResponse(200, toolUseBody('submit_reviewed_article', {
        violations_found: [],
        title: 'Understanding HOA Fees',
        slug_suggestion: 'understanding-hoa-fees',
        meta_description: 'A clear, practical explanation of how HOA fees work for California homebuyers considering a planned community.',
        content_html: '<p>HOA fees fund shared community amenities and routine maintenance for planned developments.</p>',
        keywords: ['hoa fees'],
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
  fs.writeFileSync(topicsPath, JSON.stringify([{ topic: 'Understanding HOA Fees', target_keyword: 'hoa fees' }]), 'utf8');
  return { root, generatedDir, topicsPath, reportPath };
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
