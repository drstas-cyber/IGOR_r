# Self-hosted blog generator (Phase 1)

Replaces BabyLoveGrowth as a content *source*, on our own terms, because
it's the only way to actually control the compliance problem at the root
instead of filtering after the fact. It does **not** fix the underlying
risk of scaled AI content on a domain that also hosts paid landing pages —
so this is deliberately built as a **low-volume, human-edited pipeline**,
not a content farm:

- `topics.json` seeds **20** topics, not 100. It's trivially extensible
  (just add another `{topic, target_keyword}` entry), but 20 is the
  deliberate starting scope. It carries **no status field** — see "How
  topic availability is decided" below for why and how "already attempted"
  is derived instead.
- Every PR this pipeline opens is a **review-and-EDIT step, not a rubber
  stamp.** Read the article. Both gates passing means "no known automated
  red flag," not "ready to publish as-is."
- Cadence is scheduled — weekly, Mondays 14:00 UTC / 7am Pacific — as of
  2026-08-01 (`workflow_dispatch` stays available alongside the cron; see
  "On ever enabling cron" below for the decision record). **The schedule
  only controls how often a PR gets opened.** Publishing is a separate,
  still-fully-manual gate: every PR the cron opens gets the exact same
  full supervised read as a manually-triggered one, and nothing merges
  without it. Cron widens the top of the funnel, not the gate at the
  bottom.

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

This picks the next available topic from `topics.json` (see "How topic
availability is decided" below), generates a draft, self-reviews it, runs
both compliance gates, and either:

- writes `src/data/generated-articles/<slug>.json` (exit 0), or
- writes nothing to that path, writes a rejected-attempt marker instead
  (see "A gate trip is not silent" below), prints every finding from
  whichever gate(s) tripped, and **exits non-zero** (a tripped article is a
  prompt problem to fix, not noise — never retried silently).

Requires `GITHUB_REPOSITORY=owner/repo` in the environment (already set
automatically inside GitHub Actions) — topic selection needs it to check
open generator PR branches; the script refuses to guess rather than skip
that check.

A full report of the run (topic, gate results, findings) is written to
`tools/blog-generator/.last-run-report.json` (gitignored, ephemeral).

## How topic availability is decided

`topics.json` carries no status field. Earlier it did (`status: "pending"`
/ `"generated"`), and that was the root cause of a real collision: the
status flip only ever happened on the generator's own PR branch, so `main`
never learned a topic had been consumed. The generator would regenerate
the same topic indefinitely until that PR merged, and every unmerged run
wrote to the same output path — a guaranteed collision, not a fluke (this
is exactly what happened to articles 1 and 2 of this pipeline's real
rollout).

Instead, `tools/blog-generator/topicAvailability.mjs` derives "already
attempted" fresh, every run, from ground truth:

1. **Real article files** already on `main`, under
   `src/data/generated-articles/` (read via `sourceTopic`, see below).
2. **Rejected-attempt marker files** under
   `src/data/generated-articles/.rejected/`, on `main` *and* on any
   **open** generator PR branch (`gh pr list` + targeted `git fetch`/
   `ls-tree`/`show` per branch — never a full clone).
3. **Real article files** on any open generator PR branch, same mechanism.

This check is **fail-closed**: any failure gathering that state — the `gh`
CLI, `git fetch`, `git ls-tree`, `git show`, a JSON parse — throws
immediately, before any model call happens, rather than silently treating
"couldn't check" as "nothing attempted."

**The join key is `sourceTopic`, not slug.** Every generated article and
rejected marker carries the *exact* `topics.json` "topic" string it came
from. This is deliberately **exact-string, case-sensitive matching** — if
you edit a topic's wording in `topics.json`, it becomes newly-eligible for
regeneration. That's intentional, not a bug: it gives you a cheap way to
retry a topic that keeps producing bad drafts (rewrite the prompt angle in
`topics.json`) without needing a special "force retry" flag. But it also
means a trivial whitespace/punctuation edit silently un-blocks a topic —
if that's not what you meant, don't touch the wording of a topic you want
to stay attempted.

**2026-07-27:** PR #10 ("How Property Taxes Work for Temecula Valley Homebuyers," the pipeline's earliest draft) closed unmerged and retired rather than retrofitted — it predates citations, the citation-padding rule, and every scanner/host-policy fix from the article-3 bait run, and regenerating from scratch under the current prompt is cheaper than editing it up to current standards; topic confirmed available again via dry run.

## A gate trip is not silent — the rejected-attempt PR

A discarded run used to leave **no trace anywhere ground-truth-visible**.
That meant a topic that fails the gates every single time became a silent,
permanent head-of-line block, with nothing anywhere recording why. This
pipeline lived through exactly that during its own rollout.

On a trip, `generate.mjs` writes a marker file to
`src/data/generated-articles/.rejected/<slugified-topic>.json` containing
**exactly four fields**: `sourceTopic`, `rejectedAt`, `layer1`, `layer2`
(the gate findings — quoted evidence snippets, the same level of quoting
already used in every PR report). **Never** the discarded draft's title,
slug, or `content_html` — a rejected-attempt PR carries evidence for why
the draft was discarded, never the draft itself.

The workflow opens a PR for that marker the same way it opens a PR for a
real article, on a distinctly-named branch
(`blog-generator/rejected-<run id>`, so a human closing this PR and
rerunning always gets a fresh branch name — no collision even on repeated
rejections of the same topic).

**The unified rule**, stated explicitly rather than left as emergent
behavior:

- An **open** generator PR (real-article or rejected-attempt) means the
  topic is spoken for — `getOpenPrAttemptedTopics()` sees it, no new run
  will pick it.
- **Closing that PR unmerged releases the topic** — the next run is free
  to try it again.
- **Merging it — rejection or real article — permanently blocks the
  topic**, because `getLocallyAttemptedTopics()` reads
  `src/data/generated-articles/.rejected/` on `main` too, same as it reads
  real article files there. If a rejected-attempt PR is ever accidentally
  merged, the topic is blocked going forward, not silently released. This
  is a **stated decision**: a merged rejection is treated as a permanent
  record that the topic was tried and discarded — a merged rejection is
  still a rejection, and ground truth should say so, exactly like a merged
  real article is a permanent record it was written.

**Unblocking a topic after an accidentally-merged rejection is a normal,
reviewed PR — never automatic.** A permanent block with no documented way
out is a trap, so: delete the specific marker file (`git rm
src/data/generated-articles/.rejected/<slugified-topic>.json`), open a
normal PR, get it reviewed and merged like any other change. Once that
marker is gone from `main`, `getLocallyAttemptedTopics()` no longer sees
it and the topic is available to the next run again. There is
deliberately no automated or one-command "unblock" path — the same human
review that would have caught the accidental merge in the first place is
the right gate on reversing it too.

To pull a generated article into the normal build output for local preview:

```
node tools/fetch-blog-data.js   # or BLOG_COMPLIANCE_FIXTURE=true node tools/fetch-blog-data.js
```

Generated articles are only merged in if `published: true` — the generator
always writes `published: false` by default, so simply running the pipeline
never makes anything appear in a build. See "Publishing" below.

## Why seven layers — the incident behind each

This is now a seven-layer pipeline: prompt rules → self-review pass →
Layer 1 regex → Layer 2 independent LLM checklist → Layer 3 citation URL
resolution → schema validation → human PR read. A future reader looking at
that list has every right to ask whether it's over-engineered. It isn't —
every layer below exists because something real got past the layer before
it, this weekend, not as a hypothetical. Recorded here while the reasons
are still known, not left to live only in a chat transcript.

1. **Prompt rules (`prompt.md`)** — the reason this pipeline exists at
   all: BabyLoveGrowth's upstream content generation produced fabricated
   tenure and exclusivity claims, confirmed false even after BabyLoveGrowth
   shipped its own fix (a post-fix article still carried both "has spent
   over a decade" and "the only Russian and Ukrainian-speaking agent").
   The rules are stated explicitly rather than assumed, because leaving
   the compliance bar implicit was exactly BabyLoveGrowth's failure mode.

2. **Self-review pass** — a second call to the *same* writer model,
   reviewing its own draft. Catches real, ordinary mistakes (articles 1
   and 2 each found and fixed one violation in this pass). **Proven not
   sufficient alone**, not just assumed insufficient: workflow run
   `30200350767` (2026-07-26) logged `[generate] self-review: draft was
   already clean per the model` — the writer was confident there was
   nothing wrong — and Layer 2 tripped it anyway, on an uncited statistic
   self-review had no reason to flag as *its own* mistake: "buyers have a
   defined inspection contingency period — often around 17 days, though
   the exact number can be negotiated." That exact hedge shape (a number
   gestured at, never sourced) is what prompt.md rule 4's omit-or-cite
   rewrite exists to close. A model reviewing its own work will not
   reliably catch its own blind spots; that's what "independent" in Layer
   2 is for.

   **This is a pattern, not a one-off** — worth stating explicitly, because
   the pattern is the actual finding here, not the single instance. Article
   2's independently-verified vague language ("most homeowners in Riverside
   County pay somewhat more than a flat 1%") is the *same shape* as run
   `30200350767`'s "often around 17 days, though the exact number can be
   negotiated": a specific number gestured at, then hedged into vagueness
   instead of either cited or omitted. That shape was already visible in
   the run record before either article surfaced it independently. Rule 4
   is aimed at something real and recurring in how this model hedges when
   it has no source, not at a single incident that happened to get noticed.

3. **Layer 1 — regex scanner** (`tools/blog-compliance/`, frozen pattern
   set at commit `30d8154`, citations JSON widened in as of 2026-07-26).
   Justified twice over: originally, the 2026-07-26 BabyLoveGrowth audit
   found "over a decade of local market knowledge" was the single
   dominant fabricated claim across an entire 25-article corpus, and the
   pattern set *missed it* (no digit, no "of experience" suffix) until
   manually widened after a human read caught it — proof that lexical
   matching alone drifts into whatever the patterns don't happen to
   cover. Widened again to scan the citations array because a competitor
   URL could otherwise enter through a citation with no disparagement
   language nearby and never reach the scanner at all — and the first
   implementation of that widening (`JSON.stringify()`) would have
   silently defeated it entirely (zero-whitespace JSON collapses into one
   unsplittable token for the proximity checks), caught before it shipped
   by inspecting the actual output, not assumed correct.

4. **Layer 2 — independent LLM claim review** (different model from the
   writer: `claude-haiku-4-5-20251001` vs. `claude-sonnet-5`). Justified
   by run `30200350767` above — it is the layer that actually caught what
   self-review missed. The `legal_duty_overstated` check specifically:
   article 2's independently-verified claim ("California law requires
   sellers to disclose known Mello-Roos assessments") was confirmed
   stronger than what the actual cited statute (Civil Code §1102.6b) says
   ("must make a good-faith effort to obtain and deliver") — a real,
   human-caught overstatement no regex could ever adjudicate, which is
   why it's its own checklist category rather than a tightening of
   `uncited_statistic`.

5. **Layer 3 — citation URL resolution, tiered host policy** (added
   2026-07-26). The citation requirement itself creates a risk none of
   the earlier layers had to guard against: a model with no real source
   for a claim can produce a plausible-looking URL instead of omitting
   the claim, and a fabricated citation is worse than the hedged
   vagueness it replaces. The host-policy tiering specifically is
   justified by a real demonstrated gap, not a hypothetical one: this
   file's own sample citation fixture cited `law.justia.com` — a
   republisher, an aggregator by rule 6's own definition — labeled
   `sourceType: "statute"`, with nothing checking that pairing. That
   mislabeled-mirror fixture is what `CITATION_HOST_POLICY`'s paired
   host↔sourceType check exists to catch.

6. **Schema validation** — per-entry citation shape, the paired
   host↔sourceType check (same mislabeled-mirror justification as Layer
   3), and a marker↔array consistency cross-check between `content_html`'s
   `data-cite` markers and the `citations` array. The consistency check
   runs at **two** checkpoints (generation time and again at build time)
   because a human hand-editing `content_html` during PR review — the
   pipeline's own stated "review-and-EDIT, not rubber-stamp" workflow —
   can delete a marker after generation-time validation already passed.
   Not theoretical: the first implementation of the build-time checkpoint
   (`renderArticleFootnotes()`) had exactly this hole — it early-returned
   on an empty `citations` array *before* checking for an orphaned marker
   in `content_html`, which is precisely the inconsistency that checkpoint
   exists to catch — caught by its own test suite before it ever shipped.

7. **Human PR read** — the floor under all six layers above, not a step
   retired once the gates look reliable. The single most decisive finding
   of this whole project: the 2026-07-26 BabyLoveGrowth audit found a real
   fabricated claim survived in 25 of 25 articles in a corpus until a
   human read caught the pattern the automated scanner had missed
   entirely. No combination of automated gates has been proven sufficient
   on its own — see "Acceptance discipline for the rollout itself" below.

**Two more incidents worth recording here even though they're not one of
the seven content-compliance layers above** — pipeline-*reliability* bugs
from the same 2026-07-26 session, same discipline, different failure
class:

- **The implicit `success()` bug.** The rejected-attempt PR step's `if:`
  condition had no `success()`/`always()`/`failure()`/`cancelled()` in it.
  GitHub Actions applies an implicit `success()` to any custom `if:`
  lacking one of those functions — and `has_rejected_marker` only ever
  becomes true when the *previous* step already failed, so without
  `always()` this step would have been silently skipped on every real
  gate trip, in real CI, forever. The rejected-attempt PR mechanism —
  the reason a discarded run leaves ground-truth evidence instead of
  silently blocking a topic forever — would never have actually fired.
  Found by re-deriving GitHub Actions' own `if:` semantics from first
  principles while answering an unrelated question ("what if this step
  fails"), not by a failing test.
- **The `getKnownSlugs()` key bug.** Read `baseline.articles` when the
  file's real key is `results` — silently returned 3 of 28 known slugs in
  any clean environment, including every real GitHub Actions run this
  pipeline had ever made, for as long as the file existed. Masked for
  hours on the dev machine by a separate, gitignored local fixture whose
  own fallback path happened to use the correct key. The exact shape of
  bug this whole session's testing discipline (isolated temp
  directories, never real/gitignored local state) exists to prevent from
  hiding again.

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
evidence field for layer 2) is logged into a rejected-attempt marker (see
"A gate trip is not silent" above) so a human can look at *why* — usually a
prompt problem — before trying again.

**A mocked layer-2 test proves plumbing, not judgment.** `gate.test.mjs`
confirms the wiring is correct — layer 2 can trip independently of layer 1,
the trip propagates to a non-zero exit, findings get logged with quoted
evidence — using a sentence ("a seasoned veteran of the local market who has
guided countless families through their first purchase") verified clean
against the *real* layer-1 scanner specifically so the test isolates layer
2. But the checklist response in that test is still a canned mock; it
proves the code correctly acts on whatever layer 2 says, not that layer 2's
actual judgment on a live call is any good at catching subtle claims. That's
only proven by the first three real runs against a live model — see
"Acceptance discipline for the rollout itself" below, which is the actual
check on layer 2's real value, not the unit test.

## Citation host policy

`prompt.md` rule 6 restricts citations to a closed, exact host list —
`schema.js`'s `CITATION_HOST_POLICY` enforces the same list at generation
time, paired with `sourceType` (a `county-assessor` citation must point at
`rivcoacr.org`/`rivco.gov`, not at a tier-2 host that doesn't publish
assessor records — the gate rejects that mismatch even though the host
itself is allowlisted).

- **Tier 1** (source of record, preferred): `leginfo.legislature.ca.gov`,
  `courts.ca.gov`, `rivcoacr.org`, `countytreasurer.org`, `rivco.gov`.
- **Tier 2** (permitted faithful republishers, used only when tier 1
  doesn't have the specific page): `law.justia.com`, `law.cornell.edu`.

**Prefer tier 1.** Tier-2 hosts are the ones observed 403-blocking
automated GET requests (see "Layer 3" and `citation-host-log.json`) —
citing tier 1 when it has the page reduces both the false-inconclusive
rate on Layer 3 and the amount of manual verification a reviewer has to
do clicking through a mirror instead of the source of record.

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

`.github/workflows/generate-article.yml` — `workflow_dispatch` only, with a
`concurrency` group (`generate-article`, `cancel-in-progress: false`) so a
second trigger queues behind an in-flight run instead of racing it — two
runs starting close together could otherwise both read the same
not-yet-attempted topic before either's PR exists to make it unavailable
to the other. On a run: generate → both gates → exactly one of two PRs
opens, mutually exclusive by construction:

- **A real article was produced** → PR via `peter-evans/create-pull-request`
  with the full gate report (both layers, every finding — outcome
  `generated`) in the body, branch `blog-generator/auto-<run id>`.
- **A gate tripped** → PR for the rejected-attempt marker only (see "A gate
  trip is not silent" above), branch `blog-generator/rejected-<run id>`.
  The report body omits the article's title/slug for any outcome other
  than `generated`.

Either way the job itself still fails (red) on a trip — the rejected-PR
path is additive ground-truth evidence, not a replacement for the visible
failure signal. There is no silent partial-success state.

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

**Enabled 2026-08-01.** The three conditions this section used to gate on,
checked against the actual state at the time:

(a) **topics.json has meaningfully more than 20 entries so it doesn't dry
up in weeks** — **not clearly met.** `topics.json` has 21 entries, not
"meaningfully more than 20." 6 are attempted (5 published articles +
article 6, escrow guide, merged and published 2026-08-01), leaving **15**
available. At one generation per week, that's roughly 15 weeks (~3.5
months) of runway before the queue is dry — comfortably past "weeks," but
not the wide margin the original condition envisioned. Recorded here as a
known, accepted gap, not a met condition — see "What happens when the
queue runs dry" below for why this matters more than it would on a pipeline
that fails loudly when it has nothing to do.

(b) **enough manual runs have gone through without a gate trip that the
false-negative rate feels genuinely low** — met. Six real articles
generated, zero gate trips across any of them (all six: Layer 1 clean,
Layer 2 clean, Layer 3 clean or no-citations-needed). The article-3 bait
run separately stress-tested the gates against deliberately-provoked
exclusivity/tenure language (see "Layer 1's real-world hit rate" above) —
Layer 2 caught what Layer 1 missed, 4-for-4.

(c) **Stan/the site owner has explicitly signed off** — met, 2026-08-01,
explicit instruction to enable the schedule.

**What did not change:** the publish gate. Cron changes generation cadence
only. Every PR the schedule opens — real article or rejected-attempt
marker — still requires the exact same full supervised read (or, for a
rejected attempt, a human decision on whether to close it and release the
topic) before anything merges. A PR that fails its read does not merge,
cron or no cron. See "Owner-delegated reads" below for who's authorized to
perform that read when it isn't Stan directly.

### What happens when the queue runs dry — verified, not assumed

`generate.mjs`'s "no available topics" path (the branch taken when
`pickNextAvailableTopic()` returns nothing) does **not** fail the run.
Verified by reading the code and by an isolated empirical run of the real
`main()` export against a fixture with zero available topics (2026-08-01):
it logs `[generate] no available topics ... Nothing to do.` and returns
with `process.exitCode` left `undefined` — a **green**, successful job.
No report file, no rejected marker, no PR of either kind. Contrast with
every other early-return in `main()` (missing API key, missing
`GITHUB_REPOSITORY`, a gate trip) — all of those explicitly set
`process.exitCode = 1`. The topics-exhausted path is the one early exit
that doesn't, and nothing in `.github/workflows/generate-article.yml`
checks for "job succeeded but opened no PR of either kind" as its own
signal either.

**Practical consequence:** once `topics.json` actually runs dry, the
weekly cron will run green, silently, indefinitely, doing nothing —
forever, or until someone happens to notice 15 (now fewer) weeks of
silence. This is the same failure class ("a discarded run left no
ground-truth trace") the rejected-attempt-marker mechanism was built to
close for gate trips — it was never extended to cover the empty-queue
case. **This is a known gap, not a fixed one** — flagged here rather than
silently patched, since it changes `generate.mjs`'s control flow and this
README's own "any prompt.md change requires re-running the acceptance
discipline" spirit argues for treating pipeline-behavior changes as
deliberate, reviewed decisions rather than incidental fixes. Until it's
addressed (e.g. matching the other guards' `process.exitCode = 1`, or an
explicit "queue exhausted" notification step), the practical mitigation is
the runway math in (a) above — restock `topics.json` before the ~15-week
runway closes, and don't assume silence means "on track."

## Any prompt.md change requires re-running the acceptance discipline

If `tools/blog-generator/prompt.md` changes for any reason, the next article
it produces must go through the same one-supervised-article, full-manual-read
discipline as a brand new rollout, before any further unattended runs. A
prompt change is exactly the kind of thing that can silently reintroduce a
violation class the gates don't happen to catch.

**Triggered 2026-07-27, deliberately batched with the same-day scanner fix:**
`prompt.md` rule 6 gained a citation-padding rule (cite only claims essential
to the topic; zero citations is the correct output when nothing needs
sourcing, not a gap) after the article-3 bait-run draws showed the writer
reaching for thematically-off legal/property-tax boilerplate to fill out the
citations array regardless of what the topic actually needed. That same
session also fixed two Layer 1 false positives in `tools/blog-compliance/`
(commit `13d0187`) that the same two draws surfaced. Both changes land in one
restart rather than two separate ones — the prompt change alone would have
required a fresh one-supervised-article cycle on its own; batching it with
the already-necessary re-verification of the scanner fix (see
`pre-regeneration-baseline.json`'s second `reverifications` entry) means the
next article produced under the new prompt is also the article that resumes
the acceptance-discipline count. This is a **stated decision**, not scope
creep: doing it separately later would have cost a second full restart for
no additional safety.

## Layer 1's real-world hit rate on this generator's output — decided, 2026-07-27

The article-3 bait run (four draws, 2026-07-27) tripped Layer 1 on every
single draw — **five distinct false-positive idiom/bug shapes across four
draws, zero true catches** of the exclusivity/tenure claim the run exists
to test for:

1. `wrong-brokerage`'s character-class bug (draw 2)
2. the exclusivity cross-block-boundary window bug (draw 2)
3. the "best interest" fiduciary-duty idiom (draw 3)
4. "only half the equation" (draw 4)
5. "only a minute" (draw 4)

The first three were bugs, fixed and re-verified against the frozen BLG
fixture (see `pre-regeneration-baseline.json`'s `reverifications` array).
Draw 4's pair arrived instead of a completed trio, not after one — every
genuine finding on this generator's own output across all four draws came
from Layer 2, Layer 3, or self-review, while **Layer 2 went 4-for-4 clean
on the actual bait claim** (the writer never once produced the exclusivity/
tenure language this whole exercise exists to provoke). Layer 1 earned its
keep on the BabyLoveGrowth corpus (25/25 tripped, the content it was tuned
on) but on THIS writer's output its precision was poor and its recall
unproven — the current prompt simply doesn't produce the blatant claim
shapes Layer 1's frozen patterns were built to catch.

**Decision (approved, pulled forward from the planned post-trio review
rather than waiting for a trio that kept failing to complete):**
`exclusivity:only` and `exclusivity:superlative` are demoted to **log-only**
for this generator's own articles — findings in these two subcategories are
still fully collected and rendered in every PR report (tagged `logOnly:
true`, see `render-report-md.mjs`), but no longer contribute to `tripped`
on the generator path. Every other Layer 1 category (tenure, wrong-dre/
brokerage/phone/email, disparagement, reviews-ratings, urgency-stat) stays
full enforce for generator articles. The BabyLoveGrowth batch path
(`tools/fetch-blog-data.js`) is **unaffected by construction, not just by
measurement** — it calls `scanArticle`/`scanAllArticles` with no options,
and the demotion is opt-in via `options.logOnlyFindingKeys`
(`GENERATOR_LOG_ONLY_FINDING_KEYS` in `scan.js`), so omitting it (every BLG
call site) is byte-identical to pre-demotion behavior. Proven, not assumed:
the frozen 25-article BLG fixture re-run 25/25 identical, zero deltas, under
the demotion commit — see `pre-regeneration-baseline.json`'s newest
`reverifications` entry.

This is **not** a decision to weaken or remove Layer 1 generally — it's
still cheap, deterministic, and the right tool for BLG-shaped content,
where it demonstrably works. It's a narrow, evidenced demotion of exactly
two subcategories that have shown poor precision on this specific writer's
style, landed as a recorded decision rather than a silent config change.

## Acceptance discipline for the rollout itself

**The first THREE articles this pipeline ever produces get a full manual
read, end to end, by a human — regardless of what both gates say.**
Gate-clean is not the same as compliant; the 2026-07-26 audit proved that
directly (a real claim survived in 25/25 of a corpus until a human read
caught the pattern the scanner missed). Both gates existing does not retire
this requirement — it's a floor under the rollout, not a step that gets
skipped once the gates look reliable.

**Owner override, on the record (2026-07-27):** the blog relaunched with
only 1 of these 3 supervised reads complete, not 3. Stan reviewed article
1 (HOA fees) directly on a real Cloudflare preview deployment
(fc6ed1fd.igor-r.pages.dev — routes, footnotes, citations, JSON-LD, all
verified against the actual build, not a mockup) and made the call to
publish rather than wait for articles 2 and 3. This is a **stated
decision, not an oversight or a quietly-dropped requirement**: the gate
existed, was known, and was deliberately overridden by the person with
the authority to accept that risk. Articles 2 and 3 still each need their
own full manual read before merging — that part of the discipline
continues, just as PRs onto an already-live blog instead of as a
pre-launch condition.

**Owner-delegated reads, on the record (2026-07-27):** the supervised reads
for article 2 (PR #12) and article 3 (PR #17) — the two still outstanding
after the owner-override above — were delegated to the assistant rather
than performed by Stan directly. Same class of decision as the override
itself: **a stated decision by the person with the authority to make it,
not a dropped requirement.** The read still had to be real, not a rubber
stamp — full checklist, findings reported before merging, a STOP instead
of a merge if either article failed it.

**Owner-delegated read, article 6 (2026-08-01):** the first article
generated after the cron decision above — "What to Expect During Escrow
When Buying a Home" (PR #22) — was also delegated. Same standing rule:
real read (see commit `5a657be`), not a rubber stamp, gated on passing
before merge. This is the precedent the cron decision explicitly relies
on continuing for every future scheduled run, not a one-time exception.

## Cost

Roughly **$0.15–$0.25 per article** for the writer (`claude-sonnet-5`, two
passes: draft + self-review, ~1,800–2,200 words), plus a small additional
cost for the `claude-haiku-4-5-20251001` layer-2 review call — a fraction of
the writer cost given the model tier and that it's a single structured-
checklist call over already-generated text, not another full generation
pass.

## BLG retired as fetch-blog-data.js's active source -- 2026-07-27

**Incident:** deployment `eac8380` kept shipping a stale 2-article
`blog-articles.json` build after build. Root cause turned out to be two
separate things stacked on top of each other, not the "no API key"
hypothesis first suspected:

1. package.json's `build` script was `A && B || true && C && D && E`,
   which -- `&&`/`||` share left-to-right precedence -- parses as
   `((A && B) || true) && C && D && E`. Any failure of `A`
   (`tools/fetch-blog-data.js`) was silently swallowed by the `|| true`,
   so `vite build` ran anyway, on whatever `blog-articles.json` was
   already committed. Fixed by scoping `|| true` to only
   `generate-llms.js`, via explicit subshell grouping. See
   `tools/build-chain.test.mjs`.
2. That failure was, on this particular build, the compliance gate
   *correctly* refusing to ship a batch where 27 of 31 combined
   articles (87%) tripped the filter -- almost entirely the
   BabyLoveGrowth-sourced portion; 0 of the 4 generated articles
   tripped. That refusal was the gate doing its job; the bug was that
   its FATAL exit never surfaced (see #1).

**Decision (owner-approved):** rather than keep tuning BabyLoveGrowth's
upstream prompt against `tools/blog-compliance/`'s filter indefinitely,
BLG is retired as an active content source. `fetch-blog-data.js`'s
`main()` now takes the generated-articles-only path
(`buildAndWrite([])`) by default, regardless of whether
`BABYLOVE_API_KEY` is set or a `tools/blog-compliance/.articles-cache.json`
fixture exists on disk. The BLG fetch/fixture paths run ONLY when
`BLOG_INCLUDE_BLG` is the literal string `true`, set deliberately for a
specific build. This is a deliberate design choice, not an oversight:
retirement must not be one leftover env var away from re-entering
production -- this incident's own log was the proof it otherwise would
be. See `tools/fetch-blog-data.test.mjs` for the regression coverage.

