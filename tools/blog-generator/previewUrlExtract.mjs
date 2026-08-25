// Extracts the Cloudflare Pages "Branch Preview URL" from a GitHub check-run's
// HTML `output.summary` (hardening batch item 3, 2026-08-25 — "PR body
// carries preview link ... at top", so a human merging from the GitHub
// mobile app doesn't have to open the Cloudflare dashboard first).
//
// Cloudflare's own GitHub App integration posts two different URLs once a
// preview build completes: a "Preview URL" keyed to the exact commit hash
// (changes every push to the branch) and a "Branch Preview URL" keyed to
// the branch name (stable across every push to the same branch, e.g. every
// review-and-edit commit on a held generator PR). The branch one is the
// right link to put in a PR body that may get edited/re-pushed before
// merge — the hash one would go stale on the next commit.
//
// No GitHub Deployments API entry exists for this integration (checked
// directly, 2026-08-25 — repos/{owner}/{repo}/deployments returns []), so
// this URL is only ever reachable by reading the check-run's own HTML
// output, not a structured API field. The regex below was built against a
// REAL captured summary (see previewUrlExtract.test.mjs's REAL_SUMMARY
// fixture, pulled live from PR #35's Cloudflare Pages check-run via the
// GitHub API), not guessed from Cloudflare's docs.
const BRANCH_PREVIEW_PATTERN = /Branch Preview URL:<\/strong><\/td><td>\s*<a href='([^']+)'/;

export function extractBranchPreviewUrl(summaryHtml) {
  const match = BRANCH_PREVIEW_PATTERN.exec(String(summaryHtml || ''));
  return match ? match[1] : null;
}
