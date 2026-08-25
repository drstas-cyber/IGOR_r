import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { runRetroClaimGate, RETRO_CHECKLIST_TOOL } from './retroClaimGate.mjs';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetchOnce(jsonBody) {
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => jsonBody,
    text: async () => JSON.stringify(jsonBody),
  });
}

function toolUseResponse(toolName, input) {
  return { content: [{ type: 'tool_use', name: toolName, input }], stop_reason: 'tool_use' };
}

const CLEAN = {
  fabricated_speech: false, fabricated_speech_evidence: null,
  misattributed_quote: false, misattributed_quote_evidence: null,
};

// Mocked-API tests prove plumbing (the code correctly acts on whatever the
// checklist says), not real model judgment on live content -- same
// disclosed limit README.md already states for llmClaimGate.mjs's own
// mocked tests.
describe('runRetroClaimGate — plumbing (mocked API)', () => {
  test('a clean checklist -> tripped: false', async () => {
    mockFetchOnce(toolUseResponse(RETRO_CHECKLIST_TOOL.name, CLEAN));
    const result = await runRetroClaimGate({ apiKey: 'test', model: 'test-model', title: 'x', contentHtml: '<p>x</p>' });
    assert.equal(result.tripped, false);
    assert.deepEqual(result.checklist, CLEAN);
  });

  test('fabricated_speech: true alone trips the gate', async () => {
    mockFetchOnce(toolUseResponse(RETRO_CHECKLIST_TOOL.name, {
      ...CLEAN, fabricated_speech: true, fabricated_speech_evidence: '"I always tell my clients," George says, "buy in spring."',
    }));
    const result = await runRetroClaimGate({ apiKey: 'test', model: 'test-model', title: 'x', contentHtml: '<p>x</p>' });
    assert.equal(result.tripped, true);
  });

  test('misattributed_quote: true alone trips the gate', async () => {
    mockFetchOnce(toolUseResponse(RETRO_CHECKLIST_TOOL.name, {
      ...CLEAN, misattributed_quote: true, misattributed_quote_evidence: 'cited statute does not say this',
    }));
    const result = await runRetroClaimGate({ apiKey: 'test', model: 'test-model', title: 'x', contentHtml: '<p>x</p>' });
    assert.equal(result.tripped, true);
  });

  test('sends the tool-forced request shape (tool_choice pins report_retro_check)', async () => {
    let capturedBody = null;
    globalThis.fetch = async (url, init) => {
      capturedBody = JSON.parse(init.body);
      return { ok: true, status: 200, json: async () => toolUseResponse(RETRO_CHECKLIST_TOOL.name, CLEAN), text: async () => '' };
    };
    await runRetroClaimGate({ apiKey: 'test', model: 'test-model', title: 'Test Title', contentHtml: '<p>body</p>' });
    assert.equal(capturedBody.tool_choice.name, 'report_retro_check');
    assert.match(capturedBody.messages[0].content, /Test Title/);
    assert.match(capturedBody.messages[0].content, /<p>body<\/p>/);
  });
});
