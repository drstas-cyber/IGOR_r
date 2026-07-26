// Read/write helpers for tools/blog-compliance/.articles-cache.json — the
// raw, full-content snapshot from a real BABYLOVE_API_KEY fetch. Gitignored
// (verified with `git check-ignore` before this file was ever written — see
// the 2026-07-26 session that introduced it). Never commit this file's
// contents; it contains full article bodies including named-agent claims.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const FIXTURE_PATH = path.join(__dirname, '.articles-cache.json');

// Shape: { fetchedAt: ISO string, articles: [...] } — articles includes
// ALL fetched articles regardless of published status (published + skipped),
// full content_html and every other field, exactly as the API returned it.
export function writeFixture(articles, fetchedAt = new Date().toISOString()) {
  const payload = { fetchedAt, articles };
  const json = JSON.stringify(payload, null, 2) + '\n';
  fs.writeFileSync(FIXTURE_PATH, json, 'utf8');
  return { path: FIXTURE_PATH, sha256: sha256OfFile(FIXTURE_PATH), fetchedAt };
}

export function readFixture() {
  if (!fs.existsSync(FIXTURE_PATH)) {
    throw new Error(
      `[blog-compliance] BLOG_COMPLIANCE_FIXTURE=true but no fixture found at ${FIXTURE_PATH}. ` +
      `Run tools/blog-compliance/write-fixture.mjs with a real BABYLOVE_API_KEY first.`
    );
  }
  const raw = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  if (!Array.isArray(raw.articles)) {
    throw new Error(`[blog-compliance] Fixture at ${FIXTURE_PATH} is malformed — no "articles" array.`);
  }
  return raw;
}

export function sha256OfFile(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// Max updated_at across a batch — tells you which moment of a still-running
// content pipeline a fixture captured. Returns null if no article has a
// parseable updated_at.
export function maxUpdatedAt(articles) {
  let max = null;
  for (const a of articles) {
    if (!a.updated_at) continue;
    const t = new Date(a.updated_at).getTime();
    if (Number.isNaN(t)) continue;
    if (max === null || t > max) max = t;
  }
  return max === null ? null : new Date(max).toISOString();
}
