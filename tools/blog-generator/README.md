# Self-hosted blog generator (Phase 1)

Replaces BabyLoveGrowth as a content *source*, on our own terms, because
it's the only way to actually control the compliance problem at the root
instead of filtering after the fact. It does **not** fix the underlying
risk of scaled AI content on a domain that also hosts paid landing pages —
so this is deliberately built as a **low-volume, human-edited pipeline**,
not a content farm:

- `topics.json` seeds **20** topics, not 100. It's trivially extensible
  (just add another `{topic, target_keyword, status: "pending"}` entry), but
  20 is the deliberate starting scope.
- Every PR this pipeline opens is a **review-and-EDIT step, not a rubber
  stamp.** Read the article. Both gates passing means "no known automated
  red flag," not "ready to publish as-is."
- Cadence is **manual only** (`workflow_dispatch`), indefinitely. The cron
  line in `.github/workflows/generate-article.yml` is commented out on
  purpose — see "On ever enabling cron" below.

## How this fits with the existing pipeline

Nothing about `/blog/`, the placeholder, routing, or the sitemap changed as
part of this build. `BlogIndexPage.jsx`, `BlogPostPage.jsx`, and
`tools/seo-prerender.js` already exist and already read
`src/data/blog-articles.json` — this pipeline produces articles in the exact
same schema so they work unchanged whenever the blog is relaunched. Until
then, generated articles sit in the repo (as JSON files, and later merged
into `blog-articles.json` at build time) but nothing renders them, because
`/blog/` still routes to the static placeholder.

## Running locally

```
export ANTHROPIC_API_KEY=sk-ant-...
node tools/blog-generator/generate.mjs
```

This picks the next `status: "pending"` topic from `topics.json`, generates
a draft, self-reviews it, runs both compliance gates, and either:

- writes `src/data/generated-articles/<slug>.json` and marks the topic
  `"generated"` (exit 0), or
- writes nothing, marks the topic `"skipped"`, prints every finding from
  whichever gate(s) tripped, and **exits non-zero** (a tripped article is a
  prompt problem to fix, not noise — never retried silently).

A full report of the run (topic, gate results, findings) is written to
`tools/blog-generator/.last-run-report.json` (gitignored, ephemeral).

To pull a generated article into the normal build output for local preview:

```
node tools/fetch-blog-data.js   # or BLOG_COMPLIANCE_FIXTURE=true node tools/fetch-blog-data.js
```

Generated articles are only merged in if `published: true` — the generator
always writes `published: false` by default, so simply running the pipeline
never makes anything appear in a build. See "Publishing" below.

## The two-layer gate

**Layer 1** — the existing regex compliance scanner
(`tools/blog-compliance/`, frozen pattern set at commit `30d8154`), same
enforce semantics as the BabyLoveGrowth path.

**Layer 2** — an independent LLM claim review, using a **different model**
from the writer (writer: `claude-sonnet-5`; reviewer:
`claude-haiku-4-5-20251001`) with its own separate prompt, asking a
structured checklist over the finished article: any tenure claim in any
phrasing, any uniqueness/superlative claim, any invented review/rating/
client-count, any uncited statistic, any competitor mention, any contact
detail that doesn't match the fixed reference (DRE 02034120, Allison James
Estates & Homes, 619-277-2766, askgeorgek@gmail.com). Structured output via
forced tool-use, not prose parsing.

**Why both:** the regex scanner is tuned on BabyLoveGrowth's specific
output, and during the 2026-07-26 audit it missed the single dominant claim
across an entire 25-article corpus ("over a decade of local market
knowledge" — no digit, no "of experience" suffix) until the patterns were
manually widened after a human read caught it. If a pattern-only gate were
the only check on a *new* generator, it would drift into whatever the
patterns don't happen to cover. A model reviewing for *meaning*, that didn't
write the article and doesn't share its blind spots, is a real
second check rather than a self-assessment.

On a trip from **either** layer: the article is discarded, not retried, not
rewritten automatically. Every finding (matched sentence for layer 1,
evidence field for layer 2) is logged. The topic goes back to `"skipped"` so
a human can look at *why* — usually a prompt problem — before trying again.

## Publishing (merge ≠ publish)

Generated articles default to `published: false`. Merging the PR to `main`
does **not** put the article live — a human has to make a **separate,
deliberate edit**: open the generated article's JSON file and flip
`"published": false` to `"published": true"`. This is a second safety gate
independent of the PR review itself, matching the "review-and-EDIT, not
rubber-stamp" framing above.

At build time, `tools/fetch-blog-data.js` merges eligible (`published:
true`) generated articles with whatever BabyLoveGrowth contributes, handling
slug collisions explicitly: if a generated article's slug collides with a
BabyLoveGrowth article, BabyLoveGrowth wins and the generated one is
dropped with a loud console warning (never silently). This should be rare —
slug uniqueness is checked against BabyLoveGrowth's known 28 articles at
generation time — but isn't impossible if a new BabyLoveGrowth article
appears later.

## The GitHub Actions workflow

`.github/workflows/generate-article.yml` — `workflow_dispatch` only. On a
run: generate → both gates → if an article was actually produced, open a PR
via `peter-evans/create-pull-request` with the full gate report (both
layers, every finding) in the PR body. A tripped/failed run opens **no PR**
and the job itself fails (red), which is the visible signal — there is no
silent partial-success state.

Required repo setup before the first run:

1. `ANTHROPIC_API_KEY` secret (see the exact command in the build report).
2. The workflow's `permissions:` block already requests `contents: write`
   and `pull-requests: write` — the default `GITHUB_TOKEN` cannot open PRs
   without this declared explicitly.
3. The workflow references two PR labels, `blog-draft` and
   `needs-human-review`. If they don't already exist in the repo, either
   create them first or remove the `labels:` block from the workflow — an
   unknown label can fail the PR-creation step on some action versions.
4. If branch protection on `main` requires status checks or blocks the
   `github-actions[bot]` actor from opening PRs, that will need to change —
   this cannot be verified without a real run (see the build report's
   "cannot verify without pushing" list).

## On ever enabling cron

Don't, without first re-reading the acceptance discipline below and
confirming: (a) topics.json has meaningfully more than 20 entries so it
doesn't dry up in weeks, (b) enough manual runs have gone through without a
gate trip that the false-negative rate feels genuinely low, and (c) Stan/the
site owner has explicitly signed off — this is a business risk decision
about a domain that also serves paid landing pages, not just an engineering
one.

## Any prompt.md change requires re-running the acceptance discipline

If `tools/blog-generator/prompt.md` changes for any reason, the next article
it produces must go through the same one-supervised-article, full-manual-read
discipline as a brand new rollout, before any further unattended runs. A
prompt change is exactly the kind of thing that can silently reintroduce a
violation class the gates don't happen to catch.

## Acceptance discipline for the rollout itself

**The first THREE articles this pipeline ever produces get a full manual
read, end to end, by a human — regardless of what both gates say.**
Gate-clean is not the same as compliant; the 2026-07-26 audit proved that
directly (a real claim survived in 25/25 of a corpus until a human read
caught the pattern the scanner missed). Both gates existing does not retire
this requirement — it's a floor under the rollout, not a step that gets
skipped once the gates look reliable.

## Cost

Roughly **$0.15–$0.25 per article** for the writer (`claude-sonnet-5`, two
passes: draft + self-review, ~1,800–2,200 words), plus a small additional
cost for the `claude-haiku-4-5-20251001` layer-2 review call — a fraction of
the writer cost given the model tier and that it's a single structured-
checklist call over already-generated text, not another full generation
pass.
