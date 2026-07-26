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
  legal_duty_overstated: false, legal_duty_evidence: null,
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

  // New category, not a tightening of an existing one (2026-07-26) -- the
  // Mello-Roos disclosure-duty gap found in article 2's independent
  // verification: a citation exists, but the article's phrasing ("the law
  // requires X") is stronger than what the cited source actually says
  // ("must make a good-faith effort to" do X). No regex will ever
  // adjudicate this; it requires reading the cited source's own language.
  test('legal_duty_overstated trips the gate on its own, even with everything else clean', async () => {
    mockFetchOnce(200, toolUseResponse('report_compliance_check', {
      ...CLEAN_CHECKLIST,
      legal_duty_overstated: true,
      legal_duty_evidence: 'Article says "California law requires sellers to disclose"; cited Civil Code section 1102.6b actually says "must make a good faith effort to obtain and deliver."',
    }));
    const result = await runLlmClaimGate({ apiKey: 'test-key', model: 'claude-haiku-4-5-20251001', title: 't', contentHtml: '<p>x</p>', citations: [] });
    assert.equal(result.tripped, true);
    assert.equal(result.checklist.legal_duty_overstated, true);
  });

  test('the citations array is serialized into the request body for the model to cross-reference', async () => {
    let capturedBody = null;
    globalThis.fetch = async (url, init) => {
      capturedBody = JSON.parse(init.body);
      return {
        ok: true, status: 200, statusText: 'OK',
        json: async () => toolUseResponse('report_compliance_check', CLEAN_CHECKLIST),
        text: async () => '',
      };
    };
    const citations = [{ id: '1', sourceName: 'Test Source', url: 'https://example.gov/x', sourceType: 'statute' }];
    await runLlmClaimGate({ apiKey: 'test-key', model: 'claude-haiku-4-5-20251001', title: 't', contentHtml: '<p>x</p>', citations });
    const userMessage = capturedBody.messages[0].content;
    assert.match(userMessage, /CITATIONS ARRAY/);
    assert.match(userMessage, /Test Source/);
  });

  test('an undefined citations param does not throw -- serializes as an empty array', async () => {
    mockFetchOnce(200, toolUseResponse('report_compliance_check', CLEAN_CHECKLIST));
    await assert.doesNotReject(() => runLlmClaimGate({ apiKey: 'test-key', model: 'claude-haiku-4-5-20251001', title: 't', contentHtml: '<p>x</p>' }));
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
    slug: 'trips-layer-2-only-generic',
    title: 'Understanding HOA Fees',
    content_html: '<p>HOA fees fund shared community amenities and maintenance.</p>',
  };

  // THE test that matters for "each layer proven independently" — see
  // 2026-07-25 Phase 2 review. A draft with "only trilingual" or "over a
  // decade" trips layer 1 first, so layer 2 never gets meaningfully
  // exercised; that's not proof layer 2 works, it's layer 1 doing all the
  // work. This sentence has NO digit, NO "decade", NO "only"/"best"/"top" —
  // nothing patterns.js covers — and IS verified clean against the REAL
  // scanner (not mocked) below, so this test actually isolates layer 2.
  const SUBTLE_TENURE_ARTICLE = {
    slug: 'trips-layer-2-only-subtle-tenure',
    title: 'What to Expect During Escrow',
    content_html: '<p>George is a seasoned veteran of the local market who has guided countless families through their first purchase, and he brings that same steady hand to every escrow timeline.</p>',
  };

  test('the subtle-tenure sentence is CONFIRMED clean against the real (unmocked) layer-1 scanner', () => {
    const result = scanArticle(SUBTLE_TENURE_ARTICLE);
    assert.equal(result.tripped, false, 'if this assertion ever fails, the sentence needs to be made subtler — it must stay a true layer-1 blind spot for this test to prove anything about layer 2');
    assert.deepEqual(result.findings, []);
  });

  test('layer 2 alone catches the subtle claim layer 1 cannot see, non-zero-worthy trip, findings logged', async () => {
    mockFetchOnce(200, toolUseResponse('report_compliance_check', {
      ...CLEAN_CHECKLIST,
      tenure_claim: true,
      tenure_evidence: 'a seasoned veteran of the local market who has guided countless families through their first purchase',
    }));
    const result = await runGates({ apiKey: 'test-key', article: SUBTLE_TENURE_ARTICLE });
    assert.equal(result.layer1.tripped, false, 'layer 1 must genuinely pass this — it is the whole point of the test');
    assert.equal(result.layer2.tripped, true);
    assert.equal(result.layer2.checklist.tenure_claim, true);
    assert.ok(result.layer2.checklist.tenure_evidence.length > 0, 'a trip must carry quoted evidence, not just a boolean');
    assert.equal(result.tripped, true, 'overall gate must trip on layer 2 alone, with layer 1 genuinely clean');
  });

  test('layer 1 alone tripping is enough to mark the whole gate tripped, even if layer 2 would pass', async () => {
    mockFetchOnce(200, toolUseResponse('report_compliance_check', CLEAN_CHECKLIST)); // layer 2 clean
    const result = await runGates({ apiKey: 'test-key', article: NON_COMPLIANT_TITLE_ARTICLE });
    assert.equal(result.layer1.tripped, true);
    assert.equal(result.layer2.tripped, false);
    assert.equal(result.tripped, true, 'overall gate must trip if EITHER layer trips');
  });

  test('layer 2 alone tripping (generic case) is enough to mark the whole gate tripped, even though layer 1 is clean', async () => {
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
