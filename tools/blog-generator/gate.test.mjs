import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { scanArticle } from '../blog-compliance/scan.js';
import { runLlmClaimGate } from './llmClaimGate.mjs';
import { verifyModel } from './modelVerify.mjs';
import { runGates } from './generate.mjs';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetchOnce(status, jsonBody) {
  globalThis.fetch = async () => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => jsonBody,
    text: async () => JSON.stringify(jsonBody),
  });
}

function toolUseResponse(toolName, input) {
  return { content: [{ type: 'tool_use', name: toolName, input }], stop_reason: 'tool_use' };
}

const CLEAN_CHECKLIST = {
  tenure_claim: false, tenure_evidence: null,
  uniqueness_claim: false, uniqueness_evidence: null,
  review_rating_claim: false, review_evidence: null,
  uncited_statistic: false, statistic_evidence: null,
  competitor_mention: false, competitor_evidence: null,
  contact_mismatch: false, contact_evidence: null,
};

describe('layer 1 (regex scanner) — via real scanArticle, no mocking needed', () => {
  test('a synthetic non-compliant draft trips the scanner', () => {
    const article = {
      slug: 'synthetic-bad',
      title: 'Why Choose George',
      content_html: '<p>George brings over a decade of experience and is the only trilingual agent in the valley.</p>',
    };
    const result = scanArticle(article);
    assert.equal(result.tripped, true);
    assert.ok(result.findings.length >= 1);
  });

  test('a clean article does not trip the scanner', () => {
    const article = {
      slug: 'synthetic-clean',
      title: 'Understanding Escrow',
      content_html: '<p>Escrow is a neutral process where a third party holds funds until conditions are met.</p>',
    };
    const result = scanArticle(article);
    assert.equal(result.tripped, false);
  });
});

describe('layer 2 (independent LLM claim review) — mocked API', () => {
  test('a clean checklist does not trip', async () => {
    mockFetchOnce(200, toolUseResponse('report_compliance_check', CLEAN_CHECKLIST));
    const result = await runLlmClaimGate({ apiKey: 'test-key', model: 'claude-haiku-4-5-20251001', title: 't', contentHtml: '<p>x</p>' });
    assert.equal(result.tripped, false);
  });

  test('any single true flag trips it, regardless of the model\'s own framing', async () => {
    mockFetchOnce(200, toolUseResponse('report_compliance_check', {
      ...CLEAN_CHECKLIST,
      tenure_claim: true,
      tenure_evidence: 'George has spent significant time helping buyers.',
    }));
    const result = await runLlmClaimGate({ apiKey: 'test-key', model: 'claude-haiku-4-5-20251001', title: 't', contentHtml: '<p>x</p>' });
    assert.equal(result.tripped, true);
    assert.equal(result.checklist.tenure_claim, true);
  });

  test('throws a clear error if the model does not return the expected tool call', async () => {
    mockFetchOnce(200, { content: [{ type: 'text', text: 'I refuse to use tools.' }], stop_reason: 'end_turn' });
    await assert.rejects(
      () => runLlmClaimGate({ apiKey: 'test-key', model: 'claude-haiku-4-5-20251001', title: 't', contentHtml: '<p>x</p>' }),
      /expected a "report_compliance_check" tool_use block/
    );
  });
});

describe('verifyModel — fails loudly rather than guessing', () => {
  test('passes when the model ID is in the live list', async () => {
    mockFetchOnce(200, { data: [{ id: 'claude-sonnet-5' }, { id: 'claude-haiku-4-5-20251001' }] });
    await assert.doesNotReject(() => verifyModel('test-key', 'claude-sonnet-5'));
  });

  test('throws a clear error when the model ID is absent from the live list', async () => {
    mockFetchOnce(200, { data: [{ id: 'claude-haiku-4-5-20251001' }] });
    await assert.rejects(
      () => verifyModel('test-key', 'claude-sonnet-5'),
      /was not found in the live \/v1\/models list/
    );
  });

  test('throws a clear error on an API failure rather than assuming the model is fine', async () => {
    mockFetchOnce(401, { error: { message: 'invalid api key' } });
    await assert.rejects(() => verifyModel('bad-key', 'claude-sonnet-5'), /could not verify model/);
  });
});

describe('runGates — EACH layer discards independently', () => {
  const NON_COMPLIANT_TITLE_ARTICLE = {
    slug: 'trips-layer-1-only',
    title: 'George: Only Trilingual Agent',
    content_html: '<p>George is the only trilingual agent in the valley.</p>',
  };
  const CLEAN_ARTICLE = {
    slug: 'trips-layer-2-only',
    title: 'Understanding HOA Fees',
    content_html: '<p>HOA fees fund shared community amenities and maintenance.</p>',
  };

  test('layer 1 alone tripping is enough to mark the whole gate tripped, even if layer 2 would pass', async () => {
    mockFetchOnce(200, toolUseResponse('report_compliance_check', CLEAN_CHECKLIST)); // layer 2 clean
    const result = await runGates({ apiKey: 'test-key', article: NON_COMPLIANT_TITLE_ARTICLE });
    assert.equal(result.layer1.tripped, true);
    assert.equal(result.layer2.tripped, false);
    assert.equal(result.tripped, true, 'overall gate must trip if EITHER layer trips');
  });

  test('layer 2 alone tripping is enough to mark the whole gate tripped, even though layer 1 is clean', async () => {
    mockFetchOnce(200, toolUseResponse('report_compliance_check', {
      ...CLEAN_CHECKLIST,
      uncited_statistic: true,
      statistic_evidence: 'fabricated stat',
    }));
    const result = await runGates({ apiKey: 'test-key', article: CLEAN_ARTICLE });
    assert.equal(result.layer1.tripped, false);
    assert.equal(result.layer2.tripped, true);
    assert.equal(result.tripped, true, 'overall gate must trip if EITHER layer trips');
  });

  test('both layers clean passes', async () => {
    mockFetchOnce(200, toolUseResponse('report_compliance_check', CLEAN_CHECKLIST));
    const result = await runGates({ apiKey: 'test-key', article: CLEAN_ARTICLE });
    assert.equal(result.tripped, false);
  });
});
