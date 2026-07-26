// Durable UNREACHABLE_LIKELY_BOT host log (2026-07-26). The per-run report
// (.last-run-report.json) is gitignored/ephemeral and CI checks out fresh
// every run, so neither survives across articles -- and the whole point of
// this log is to accumulate a real per-host hit rate across articles 1-3
// (and beyond) instead of reacting to a single impression. This file MUST
// be committed, not gitignored, or it can't accumulate at all.
//
// Deliberately NOT a pinned-host allowlist -- that's backlog, designed only
// after real data shows which hosts actually block automated GETs. This is
// just the data collection: append-only, human-scannable, one entry per
// inconclusive resolution.

import fs from 'node:fs';
import path from 'node:path';

export function appendHostLogEntries(logPath, entries) {
  if (entries.length === 0) return readHostLog(logPath);
  const existing = readHostLog(logPath);
  const updated = [...existing, ...entries];
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(logPath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');
  return updated;
}

export function readHostLog(logPath) {
  if (!fs.existsSync(logPath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // A corrupted log is a data-quality problem, not a reason to block a
    // run over a durability aid -- start fresh rather than throw. Contrast
    // with getKnownSlugs()/getOpenPrAttemptedTopics(), which fail-closed
    // because a wrong answer there produces a real collision; a lost
    // entry in this log only means one data point is missing from a
    // human's later eyeball review, not a correctness failure.
    return [];
  }
}

// Pure, no I/O -- builds the entries to append from one run's citation
// resolution results. Only UNREACHABLE_LIKELY_BOT outcomes are logged;
// RESOLVED/FAILED don't need durable tracking the same way (a FAILED
// citation already trips the gate and is visible in that run's own PR).
export function buildHostLogEntries({ runId, sourceTopic, citationResults }) {
  return citationResults
    .filter((r) => r.outcome === 'UNREACHABLE_LIKELY_BOT')
    .map((r) => ({
      runId,
      sourceTopic,
      host: r.host,
      status: r.status,
      url: r.url,
      loggedAt: new Date().toISOString(),
    }));
}
