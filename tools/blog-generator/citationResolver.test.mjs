import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCitationUrl, resolveAllCitations, evaluateCitationResolution } from './citationResolver.mjs';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetchStatus(status) {
  globalThis.fetch = async () => ({ status });
}

function mockFetchThrows(message) {
  globalThis.fetch = async () => { throw new Error(message); };
}

// Simulates a server that never responds -- resolveCitationUrl's own
// AbortController must fire and reject, exactly like a real network stall.
function mockFetchNeverResolves() {
  globalThis.fetch = (url, { signal } = {}) => new Promise((resolve, reject) => {
    signal?.addEventListener('abort', () => reject(new Error('The operation was aborted')));
  });
}

describe('resolveCitationUrl — outcome classification', () => {
  test('200 -> RESOLVED', async () => {
    mockFetchStatus(200);
    const r = await resolveCitationUrl('https://leginfo.legislature.ca.gov/x');
    assert.equal(r.outcome, 'RESOLVED');
    assert.equal(r.status, 200);
    assert.equal(r.host, 'leginfo.legislature.ca.gov');
  });

  test('404 -> FAILED (a real dead link)', async () => {
    mockFetchStatus(404);
    const r = await resolveCitationUrl('https://example.gov/gone');
    assert.equal(r.outcome, 'FAILED');
    assert.equal(r.status, 404);
  });

  test('500 -> FAILED', async () => {
    mockFetchStatus(500);
    const r = await resolveCitationUrl('https://example.gov/broken');
    assert.equal(r.outcome, 'FAILED');
  });

  test('403 -> UNREACHABLE_LIKELY_BOT, not FAILED, not RESOLVED', async () => {
    mockFetchStatus(403);
    const r = await resolveCitationUrl('https://law.justia.com/x');
    assert.equal(r.outcome, 'UNREACHABLE_LIKELY_BOT');
    assert.equal(r.status, 403);
  });

  test('429 -> UNREACHABLE_LIKELY_BOT', async () => {
    mockFetchStatus(429);
    const r = await resolveCitationUrl('https://example.gov/ratelimited');
    assert.equal(r.outcome, 'UNREACHABLE_LIKELY_BOT');
    assert.equal(r.status, 429);
  });

  test('network failure -> FAILED (fail-closed, same bucket as a definitive non-200)', async () => {
    mockFetchThrows('getaddrinfo ENOTFOUND');
    const r = await resolveCitationUrl('https://this-does-not-resolve.invalid/x');
    assert.equal(r.outcome, 'FAILED');
    assert.equal(r.status, null);
    assert.match(r.error, /ENOTFOUND/);
  });

  test('timeout -> FAILED (fail-closed) -- real abort path, not a fake timer', async () => {
    mockFetchNeverResolves();
    const r = await resolveCitationUrl('https://slow.example.gov/x', { timeoutMs: 50 });
    assert.equal(r.outcome, 'FAILED');
  });

  test('an unparseable URL -> FAILED without ever calling fetch', async () => {
    let fetchCalled = false;
    globalThis.fetch = async () => { fetchCalled = true; return { status: 200 }; };
    const r = await resolveCitationUrl('not-a-url');
    assert.equal(r.outcome, 'FAILED');
    assert.equal(r.host, null);
    assert.equal(fetchCalled, false);
  });
});

describe('resolveAllCitations — per-entry results carry id/sourceName', () => {
  test('resolves multiple citations in order, each tagged with its id and sourceName', async () => {
    let call = 0;
    globalThis.fetch = async () => {
      call += 1;
      return { status: call === 1 ? 200 : 403 };
    };
    const citations = [
      { id: '1', sourceName: 'Source A', url: 'https://a.gov/x' },
      { id: '2', sourceName: 'Source B', url: 'https://b.gov/x' },
    ];
    const results = await resolveAllCitations(citations);
    assert.equal(results.length, 2);
    assert.equal(results[0].id, '1');
    assert.equal(results[0].sourceName, 'Source A');
    assert.equal(results[0].outcome, 'RESOLVED');
    assert.equal(results[1].id, '2');
    assert.equal(results[1].outcome, 'UNREACHABLE_LIKELY_BOT');
  });

  test('an empty citations array resolves to an empty results array, no fetch calls', async () => {
    let fetchCalled = false;
    globalThis.fetch = async () => { fetchCalled = true; return { status: 200 }; };
    const results = await resolveAllCitations([]);
    assert.deepEqual(results, []);
    assert.equal(fetchCalled, false);
  });
});

describe('evaluateCitationResolution — trip decision', () => {
  test('any FAILED trips it', () => {
    const results = [{ outcome: 'RESOLVED' }, { outcome: 'FAILED' }];
    const evaluated = evaluateCitationResolution(results);
    assert.equal(evaluated.tripped, true);
    assert.equal(evaluated.failed.length, 1);
  });

  test('UNREACHABLE_LIKELY_BOT alone does NOT trip -- inconclusive is not a failure', () => {
    const results = [{ outcome: 'RESOLVED' }, { outcome: 'UNREACHABLE_LIKELY_BOT' }];
    const evaluated = evaluateCitationResolution(results);
    assert.equal(evaluated.tripped, false, 'a bot-block must never masquerade as a trip any more than as a pass');
    assert.equal(evaluated.inconclusive.length, 1);
  });

  test('all RESOLVED does not trip', () => {
    const evaluated = evaluateCitationResolution([{ outcome: 'RESOLVED' }, { outcome: 'RESOLVED' }]);
    assert.equal(evaluated.tripped, false);
  });

  test('empty results (no citations) does not trip', () => {
    const evaluated = evaluateCitationResolution([]);
    assert.equal(evaluated.tripped, false);
    assert.equal(evaluated.total, 0);
  });
});
