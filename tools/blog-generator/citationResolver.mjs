// URL-resolution gate for the citations array (2026-07-26). The one place
// in this whole pipeline where the model is newly PRESSURED to invent
// something: every other gate is defensive (catching a claim that
// shouldn't exist), but requiring a citation for every specific claim
// creates a real incentive for a model without a real source to produce a
// plausible-looking URL instead of omitting the claim. A fabricated
// citation on a licensed agent's site is worse than the hedged vagueness
// it replaces -- it looks authoritative, a reader may click it, and it's a
// false statement about what a source says. This module is the guard on
// that specific new risk.
//
// WHAT THIS PROVES, AND WHAT IT DOES NOT: a 200 response means the URL
// resolves -- the page exists and returned content. It does NOT mean the
// page supports the claim it's cited for. That gap is covered only by the
// supervised human read (README.md's acceptance discipline), never by this
// gate. Do not mistake a green Layer 3 for verified sourcing.
//
// Real GET, not HEAD -- some sites (including likely candidates here, like
// leginfo.legislature.ca.gov) respond differently or block HEAD requests
// even when GET succeeds; GET is what a human clicking the link would
// actually do, so it's what gets tested.
//
// Uses the global `fetch`, matching anthropicClient.mjs's convention --
// tests stub it via globalThis.fetch, no separate DI parameter needed for
// the network call itself (timeoutMs IS injectable, since a real 10s
// timeout is impractical to exercise in a fast test suite).

const DEFAULT_TIMEOUT_MS = 10000;

// Never a pass. 403/429 specifically -- sites that ARE there but block
// automated traffic (bot defense), which is exactly what a GET from a
// GitHub Actions runner IP looks like to many government/legal hosts. A
// bot-block must never masquerade as verification either direction: it is
// not RESOLVED (we didn't confirm the page), and it must not silently trip
// the gate as FAILED either (the URL may be completely correct -- punishing
// the citation for the host's bot defense would push the writer toward
// omitting real, good sources, the opposite of what this gate exists for).
const INCONCLUSIVE_STATUSES = new Set([403, 429]);

// Body-content verification (added 2026-07-27). A 200 status alone proved
// insufficient on article 1's very first citation set: leginfo returns a
// real 200 page shell ("Code Section Group" / "Code Text", no statute
// text) for an invalid query-parameter combination -- confirmed directly
// (WebFetch) before this was written, not assumed. leginfo.legislature.ca.gov
// is a Set, not a hardcoded branch, so another host can opt in later
// without touching this function's logic -- deliberately not solving
// "every host's quirk," just the one already reproduced.
export const BODY_VERIFICATION_HOSTS = new Set(['leginfo.legislature.ca.gov']);

// Extracts a section-number token from a citation's sourceName, e.g.
// "California Civil Code ... (§ 5600 et seq., assessments)" -> "5600".
// Returns null if no such token is found -- callers must treat that as
// "can't verify body content for this citation," not as license to
// invent a weaker check. Deliberately narrow: statute/constitution/
// government-code/court-opinion citations reliably carry a section
// number in sourceName by construction (prompt.md rule 6's examples all
// do); a citation with no extractable number (e.g. a bare office-name
// county-assessor citation) is NOT body-verified by this mechanism --
// known, accepted gap, not silently pretended away.
const SECTION_NUMBER_PATTERN = /§\s*(\d+)/;
export function extractVerificationToken(sourceName) {
  const match = SECTION_NUMBER_PATTERN.exec(sourceName || '');
  return match ? match[1] : null;
}

// Resolves a single citation URL. Returns one of four outcomes, never
// throws -- a network failure is data (FAILED), not an exceptional
// condition the caller has to catch. `sourceName` is optional: pass it to
// enable body verification for opted-in hosts; omit it (or cite a host
// not in BODY_VERIFICATION_HOSTS, or a sourceName with no extractable
// token) and this behaves exactly as before -- 200 is RESOLVED, no body
// read.
export async function resolveCitationUrl(url, { timeoutMs = DEFAULT_TIMEOUT_MS, sourceName } = {}) {
  let host = null;
  try {
    host = new URL(url).hostname;
  } catch {
    return { url, host: null, outcome: 'FAILED', status: null, error: 'unparseable URL' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
    if (res.status === 200) {
      if (BODY_VERIFICATION_HOSTS.has(host)) {
        const token = extractVerificationToken(sourceName);
        if (token) {
          const body = await res.text();
          if (!body.includes(token)) {
            // Fail CLOSED on absence, own outcome distinct from RESOLVED --
            // so a green Layer 3 is never again mistaken for verified
            // sourcing. Counts toward tripped (see evaluateCitationResolution),
            // same treatment as FAILED, reported separately for diagnosis.
            return { url, host, outcome: 'RESOLVED_UNSUPPORTED', status: res.status, token };
          }
        }
      }
      return { url, host, outcome: 'RESOLVED', status: res.status };
    }
    if (INCONCLUSIVE_STATUSES.has(res.status)) {
      return { url, host, outcome: 'UNREACHABLE_LIKELY_BOT', status: res.status };
    }
    return { url, host, outcome: 'FAILED', status: res.status };
  } catch (err) {
    // Network failure or timeout (AbortError) -- fail CLOSED, same bucket
    // as any other non-200/non-bot-block failure. A URL that can't even be
    // reached to determine a status code is worse than a definitively-bad
    // one; the safest assumption is that it doesn't check out, not that
    // it's fine because we couldn't tell.
    return { url, host, outcome: 'FAILED', status: null, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

// Resolves every citation in order (sequential, not parallel -- typically
// 2-5 citations per article, and sequential is kinder to whatever host
// gets hit repeatedly across citations on the same domain). Each result
// carries the citation's id/sourceName alongside the resolution outcome so
// the report can show which claim a bad citation belongs to.
export async function resolveAllCitations(citations, opts = {}) {
  const results = [];
  for (const c of citations || []) {
    const r = await resolveCitationUrl(c.url, { ...opts, sourceName: c.sourceName });
    results.push({ id: c.id, sourceName: c.sourceName, ...r });
  }
  return results;
}

// Pure, no I/O -- the trip decision. UNREACHABLE_LIKELY_BOT is deliberately
// EXCLUDED from tripped: it's inconclusive, not a failure, and must never
// auto-discard an article over a host's bot defense. FAILED (a definitive
// non-200, unparseable URL, or network failure/timeout) and
// RESOLVED_UNSUPPORTED (resolves, but the cited content isn't actually
// there) both trip -- a citation that doesn't back its claim is a failure
// of exactly the kind this gate exists to catch, not a lesser one.
export function evaluateCitationResolution(results) {
  const failed = results.filter((r) => r.outcome === 'FAILED');
  const unsupported = results.filter((r) => r.outcome === 'RESOLVED_UNSUPPORTED');
  const inconclusive = results.filter((r) => r.outcome === 'UNREACHABLE_LIKELY_BOT');
  const resolved = results.filter((r) => r.outcome === 'RESOLVED');
  return {
    tripped: failed.length > 0 || unsupported.length > 0,
    failed, unsupported, inconclusive, resolved,
    total: results.length,
  };
}
