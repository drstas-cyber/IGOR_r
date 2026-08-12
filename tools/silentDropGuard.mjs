// assertNoGeneratedArticleSilentlyDropped (2026-08-12) — makes the class of
// bug that shipped "seller-closing-costs-explained" impossible to
// reintroduce silently. Extracted into its own file matching
// checkRejectedMarker.mjs / checkAllSilent.mjs / internalLinkGate.mjs's
// pattern: single-purpose, pure, unit-tested in isolation -- not inline
// logic a future reader has to untangle from fetch-blog-data.js's
// buildAndWrite(), which also can't easily be unit-tested directly (that
// module runs main() as a side effect on import; see fetch-blog-data.test.mjs's
// own header comment on why that file spawns the real script instead).
//
// Real incident this exists to fix: "seller-closing-costs-explained" had
// published:true and a merged PR, but runComplianceFilter() in
// fetch-blog-data.js used to scan every article with NO demotion regardless
// of source, so a finding the generator's own Layer 1 had already demoted
// to log-only (exclusivity:superlative, "best" + "agent" in "this is best
// done with input from your agent") full-enforce-tripped there and
// silently excluded the article from blog-articles.json, every build, with
// nothing louder than a console.log buried among ordinary per-article log
// lines -- exactly the "reads as covered everything when it didn't" gap
// this project's own discipline (README.md) exists to refuse.
//
// Compares `combined` (post-mergeArticleSources) against the final written
// array, NOT the raw loadGeneratedArticles() list, so a legitimate,
// already-loudly-logged slug-collision drop (mergeArticleSources' own
// console.warn) is not double-reported here as a second, confusing
// failure -- this checks specifically for a SILENT drop downstream of that
// point (the compliance filter, or any future step between merge and
// write), not every possible reason an article could be absent.
import { isGeneratedArticle } from './blog-generator/loadGenerated.js';

export function assertNoGeneratedArticleSilentlyDropped(combined, finalArticles, complianceReportPath) {
  const finalSlugs = new Set(finalArticles.map((a) => a.slug));
  const missing = combined.filter((a) => isGeneratedArticle(a) && !finalSlugs.has(a.slug));
  if (missing.length === 0) return;
  const fatal = new Error(
    `[fetch-blog-data] FATAL: ${missing.length} published:true generated article(s) did not make it into ` +
    `blog-articles.json: ${missing.map((a) => `"${a.title}" (${a.slug})`).join(', ')}. A generated article with ` +
    `published:true must always end up in the final build output -- if the compliance filter excluded it, that's ` +
    `either a real finding (unpublish the article via setPublished.mjs, don't ignore this) or a filter false ` +
    `positive (fix the filter or reword the article, same as the seller-closing-costs-explained "best done" fix, ` +
    `2026-08-12) -- never ship published:true with the article silently missing.` +
    (complianceReportPath ? ` See ${complianceReportPath} for why it was excluded.` : '')
  );
  fatal.blogComplianceFatal = true; // must actually fail the build -- see fetch-blog-data.js's main().catch()
  throw fatal;
}
