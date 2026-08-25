// Ground truth for "what published in the last N days" -- the weekly
// retrospective audit's own required scope (hardening batch, 2026-08-25).
// No stored publish-timestamp field exists on article JSON: jsonLd.
// datePublished is GENERATION time, which for a held PR can sit days
// before the actual publish flip -- PR #34/#35 both generated 2026-08-21/
// 23 but not published until 2026-08-25 -- so it cannot answer "published
// in the last 7 days" correctly. The real ground truth is the publish
// commit itself: every publish, human or auto, lands as exactly one commit
// whose subject matches a fixed, load-bearing shape (see setPublished.mjs's
// own commit-message convention in every prior publish commit, and
// generate-article.yml's auto-publish step's commit message).
import { execSync } from 'node:child_process';

const PUBLISH_SUBJECT_PATTERN = /^blog: (?:auto-)?publish "([a-z0-9-]+)"/;

// getRecentlyPublishedSlugs (exported) — { slug, commitSha, committedAt }[],
// newest-first (git log's own default order). `exec` is injectable so tests
// never touch real git history (same convention as
// topicAvailability.mjs's getOpenPrAttemptedTopics). Uses committer date
// (`--since`, `%cI`), not author date -- a rebase or backfill commit is
// scoped by when it actually landed on the branch being audited, not when
// it was originally authored. \x1f (unit separator) as the field delimiter
// rather than a space or comma -- a commit subject can contain either.
export function getRecentlyPublishedSlugs({ sinceDays = 7, exec = execSync, cwd } = {}) {
  let raw;
  try {
    raw = exec(
      `git log --since="${sinceDays} days ago" --date=iso-strict --pretty=format:"%H%x1f%cI%x1f%s"`,
      { encoding: 'utf8', ...(cwd ? { cwd } : {}) }
    );
  } catch (err) {
    throw new Error(`[retroPublishLog] git log failed: ${err.message}. Refusing to guess what published recently.`);
  }

  const results = [];
  for (const line of String(raw).split('\n')) {
    if (!line.trim()) continue;
    const [commitSha, committedAt, ...subjectParts] = line.split('\x1f');
    const subject = subjectParts.join('\x1f');
    const match = subject && subject.match(PUBLISH_SUBJECT_PATTERN);
    if (match) results.push({ slug: match[1], commitSha, committedAt });
  }
  return results;
}
