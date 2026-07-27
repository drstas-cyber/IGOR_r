import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCitationUrl, resolveAllCitations, evaluateCitationResolution, extractVerificationToken } from './citationResolver.mjs';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetchStatus(status) {
  globalThis.fetch = async () => ({ status });
}

function mockFetchStatusWithBody(status, body) {
  globalThis.fetch = async () => ({ status, text: async () => body });
}

// The ACTUAL page content from both URLs in article 1's real citation 1,
// confirmed directly via WebFetch before this test was written -- not
// invented. Broken: a spurious title=6. query param makes leginfo return
// a real 200 page shell with zero statute text. Fixed: dropping that one
// param renders the genuine Davis-Stirling assessments text.
const REAL_LEGINFO_SHELL_BODY = '<html><head><title>Code Section Group</title></head><body><div id="codeText"></div></body></html>'; // no section numbers anywhere -- confirmed via WebFetch 2026-07-27
const REAL_LEGINFO_CONTENT_BODY = '<html><body><h6>5600.</h6><p>Except as otherwise provided...</p><h6>5605.</h6><p>Annual increases in regular assessments...</p></body></html>'; // confirmed real Davis-Stirling assessments text via WebFetch 2026-07-27

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

describe('extractVerificationToken — pure', () => {
  test('extracts a section number from a § pattern', () => {
    assert.equal(extractVerificationToken('California Civil Code, Davis-Stirling Common Interest Development Act (§ 5600 et seq., assessments)'), '5600');
  });

  test('extracts a section number with no space after §', () => {
    assert.equal(extractVerificationToken('Civil Code §1102.6b'), '1102');
  });

  test('returns null when sourceName has no section-number pattern', () => {
    assert.equal(extractVerificationToken('Riverside County Assessor-County Clerk-Recorder'), null);
  });

  test('returns null for undefined/empty sourceName, does not throw', () => {
    assert.equal(extractVerificationToken(undefined), null);
    assert.equal(extractVerificationToken(''), null);
  });
});

describe('resolveCitationUrl — body-content verification (2026-07-27)', () => {
  test('a host NOT in BODY_VERIFICATION_HOSTS: 200 is RESOLVED regardless of body content (no read at all)', async () => {
    let textCalled = false;
    globalThis.fetch = async () => ({ status: 200, text: async () => { textCalled = true; return 'anything'; } });
    const r = await resolveCitationUrl('https://rivcoacr.org/x', { sourceName: 'Something § 9999' });
    assert.equal(r.outcome, 'RESOLVED');
    assert.equal(textCalled, false, 'body verification must not run for a host that has not opted in');
  });

  test('an opted-in host with NO sourceName: 200 is RESOLVED, no body read (nothing to verify against)', async () => {
    let textCalled = false;
    globalThis.fetch = async () => ({ status: 200, text: async () => { textCalled = true; return REAL_LEGINFO_CONTENT_BODY; } });
    const r = await resolveCitationUrl('https://leginfo.legislature.ca.gov/x');
    assert.equal(r.outcome, 'RESOLVED');
    assert.equal(textCalled, false);
  });

  test('an opted-in host with a sourceName carrying no extractable token: 200 is RESOLVED, no body read', async () => {
    let textCalled = false;
    globalThis.fetch = async () => ({ status: 200, text: async () => { textCalled = true; return REAL_LEGINFO_CONTENT_BODY; } });
    const r = await resolveCitationUrl('https://leginfo.legislature.ca.gov/x', { sourceName: 'No section number here' });
    assert.equal(r.outcome, 'RESOLVED');
    assert.equal(textCalled, false);
  });

  // THE positive control: the EXACT broken URL from article 1's real
  // citation 1 must go RED (RESOLVED_UNSUPPORTED), and the corrected URL
  // must go GREEN (RESOLVED). Bodies are the real, verified page content
  // (WebFetch, 2026-07-27), not invented fixtures.
  test('POSITIVE CONTROL (RED): the exact broken article-1 URL (title=6. param) -> RESOLVED_UNSUPPORTED', async () => {
    mockFetchStatusWithBody(200, REAL_LEGINFO_SHELL_BODY);
    const r = await resolveCitationUrl(
      'https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?lawCode=CIV&division=4.&title=6.&part=5.&chapter=8.&article=1',
      { sourceName: 'California Civil Code, Davis-Stirling Common Interest Development Act (§ 5600 et seq., assessments)' }
    );
    assert.equal(r.outcome, 'RESOLVED_UNSUPPORTED');
    assert.equal(r.token, '5600');
  });

  test('POSITIVE CONTROL (GREEN): the corrected article-1 URL (title=6. removed) -> RESOLVED', async () => {
    mockFetchStatusWithBody(200, REAL_LEGINFO_CONTENT_BODY);
    const r = await resolveCitationUrl(
      'https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?lawCode=CIV&division=4.&part=5.&chapter=8.&article=1',
      { sourceName: 'California Civil Code, Davis-Stirling Common Interest Development Act (§ 5600 et seq., assessments)' }
    );
    assert.equal(r.outcome, 'RESOLVED');
  });
});

describe('evaluateCitationResolution — RESOLVED_UNSUPPORTED trips, reported separately from FAILED', () => {
  test('a RESOLVED_UNSUPPORTED result trips the gate', () => {
    const evaluated = evaluateCitationResolution([{ outcome: 'RESOLVED' }, { outcome: 'RESOLVED_UNSUPPORTED' }]);
    assert.equal(evaluated.tripped, true);
    assert.equal(evaluated.unsupported.length, 1);
    assert.equal(evaluated.failed.length, 0, 'RESOLVED_UNSUPPORTED must be reported in its own bucket, not folded into failed');
  });

  test('resolveAllCitations passes sourceName through to enable body verification', async () => {
    mockFetchStatusWithBody(200, REAL_LEGINFO_SHELL_BODY);
    const citations = [{ id: '1', sourceName: 'Davis-Stirling (§ 5600 et seq.)', url: 'https://leginfo.legislature.ca.gov/x' }];
    const results = await resolveAllCitations(citations);
    assert.equal(results[0].outcome, 'RESOLVED_UNSUPPORTED');
  });
});
