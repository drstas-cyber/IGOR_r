# Self-hosted blog generator (Phase 1)

Replaces BabyLoveGrowth as a content *source*, on our own terms, because
it's the only way to actually control the compliance problem at the root
instead of filtering after the fact. It does **not** fix the underlying
risk of scaled AI content on a domain that also hosts paid landing pages —
so this is deliberately built as a **low-volume, human-edited pipeline**,
not a content farm:

- `topics.json` seeds **40** topics (restocked from 20, 2026-08-03).
  Trivially extensible (just add another `{topic, target_keyword}`
  entry). It carries **no status field** — see "How topic availability is
  decided" below for why and how "already attempted" is derived instead.
- Every PR this pipeline opens is a **review-and-EDIT step, not a rubber
  stamp, always** — including a perfectly silent run. Generation is
  automatic; **publication is manual, by design** (owner ruling,
  2026-08-31, see "How this actually works today" below and "Automated
  publishing," now superseded). A perfectly-silent run's PR still needs a
  human to tap Merge before anything goes live; `allSilent` is a quality
  signal in the PR body and email, telling the reviewer this one needs
  less scrutiny than usual — it has never, in this project's history,
  meant "published without a human looking at it."
- Cadence: every other day, as of 2026-08-03 (`workflow_dispatch` stays
  available alongside the cron; supersedes the 2026-08-01 weekly-cron
  decision), **13:23 UTC as of 2026-08-31** (moved off the exact hour
  boundary — see "Automated publishing" §1 and generate-article.yml's own
  header comment for the three documented incidents this closes out).
  This controls **generation** cadence only — how often a PR gets opened —
  never publication, which is always a separate, manual step regardless of
  cadence.

## How this actually works today (2026-08-31, current and canonical)

Read this section first if you're orienting to the pipeline as it stands.
Sections elsewhere in this file marked "superseded" or "retired" are kept
for their decision history, not because they describe current behavior.

1. **Generation is automatic.** `generate-article.yml` fires every other
   day at 13:23 UTC (or on demand via `workflow_dispatch`), picks the next
   available topic, writes a draft, self-reviews it, and runs it through
   two independent compliance gates (Layer 1 regex scanner, Layer 2
   independent LLM claim review) plus schema/internal-link/identity
   validation. See "Why seven layers" and "The two-layer gate" below for
   what each check actually does.
2. **Three outcomes, each with exactly one path:**
   - **Clean or holds for review** — a `blog-generator/auto-*` PR opens
     with the full gate report as its body, `allSilent` shown as an
     informational line only. An email fires either way ("article PR
     opened, held for review") — every real article gets exactly this one
     notification, whether or not it was silent.
   - **A gate/schema/link/identity trip discards the draft** — no article
     is written; a `blog-generator/rejected-*` marker PR opens instead,
     recording the topic as permanently blocked if ever merged, released
     if closed unmerged. See "A gate trip is not silent" below.
   - **An early exit before generation started** (missing secret, missing
     `GITHUB_REPOSITORY`, an uncaught exception during topic selection, or
     a genuinely exhausted topic queue) — no PR of either kind; a red-run
     email fires instead, naming the real cause from a structured report
     when one exists, never a guess (see `checkGenerateFailureReason.mjs`
     and "First live firing" under "Publish-on-merge" below).
3. **Publication is ALWAYS a human tap.** There is no code path in this
   repo, as of 2026-08-31, that merges or publishes a generator PR without
   a human doing it. The reviewer reads the email, opens the PR, checks
   the Cloudflare Pages preview, and either taps **Merge** (today: from
   the GitHub mobile app) or **Close**s it unmerged (silent or rejected
   PRs release their topic on close; merging a rejected-marker PR
   permanently blocks it instead). This was a deliberate owner ruling
   (2026-08-31), not an oversight: an auto-merge/auto-publish path existed
   from 2026-08-03 to 2026-08-31 and was retired after a review found zero
   silent publishes in the project's entire history under it — every
   article that ever went live was human-merged, and `allSilent` was
   effectively unreachable in practice (self-review's phantom internal-
   link-stripping corrections, root-fixed the same day, meant a
   genuinely clean draft almost always still carried at least one
   "correction" — see "Self-review no longer validates internal links,"
   the entry superseding the two below it in the file's chronology).
4. **`publish-on-merge.yml` is the sole publish mechanism**, for every
   article, silent or not. A human Merge on a `blog-generator/auto-*` PR
   triggers it: `published:true` flip, `_headers` cache-pair insertion,
   `blog-articles.json` regeneration, one commit, push. See
   "Publish-on-merge" below for the full mechanism and its first-live-
   firing incident/fixes.
5. **The weekly retrospective audit** (see "Weekly retrospective, real"
   below) is the standing content-quality audit for every article this
   pipeline has published, full stop — not a compensating control for an
   auto-publish path, since none exists to compensate for anymore. Its
   job is unchanged: a full six-category read of everything published
   that week, report-only, same verdict scale; an article that fails
   retrospectively gets unpublished by a single documented commit.
6. **Planned successor for the human tap: the "George-gate."** The
   2026-08-31 ruling names Merge-from-phone as the mechanism "today" —
   explicitly not the permanent shape of the manual-publish step, just
   the first one. A designed-but-not-yet-built successor (working name:
   "George-gate") is intended to let George himself perform the human
   review/approval step directly, without a human intermediary reading
   the email and tapping Merge on his behalf. Nothing in this repo
   implements it yet as of 2026-08-31 — noted here so the manual-Merge
   step described above is read as "the current mechanism," not "the
   final design."

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

**This has actually happened twice** (PR #36, 2026-08-25, and PR #41,
2026-09-01 — both a marker PR tapped Merge instead of Close, the same
mistake the section above exists to make recoverable), which is why it
got hardened rather than left as a documented-but-unaddressed risk after
the second occurrence:

- **PR #41's topic** (How California's Preliminary Change of Ownership
  Report Works) was released back to the queue — the underlying rejection
  was Layer 2 flagging the Prop 19 / 2021 date as an "uncited statistic"
  even though it *was* cited (California Constitution, Article XIII A) and
  self-review had already verified and kept it; a regenerate may simply
  pass. The marker file was deleted via a normal `git rm` + push, per the
  procedure above.
- **PR #36's topic** (Understanding Mello-Roos Taxes in Temecula Valley
  Communities) is a separate, still-open decision — its marker remains on
  `main`, deliberately not touched by the #41 cleanup. Unblocking it (or
  not) is a decision for whoever reviews that topic next, following the
  exact same procedure.
- **Two hardening changes, both 2026-09-01, aimed at the merge itself
  rather than at the recovery procedure** (recovery was already fine; nothing
  was catching the mistake *as it happened*):
  1. The rejected-attempt PR's title changed from "[Blog draft] Rejected
     generation attempt — topic released if closed unmerged" (read as a
     status report, easy to skim past on a phone) to "⛔ DO NOT MERGE —
     close to release topic back to queue" (leads with the warning glyph
     and the imperative). See generate-article.yml's "Open PR for rejected
     attempt" step.
  2. publish-on-merge.yml gained a second job,
     `notify-marker-merged-by-mistake`, scoped to
     `blog-generator/rejected-*` branches specifically (the exact
     complement of the existing `publish` job's `blog-generator/auto-*`
     scoping) — until this, merging a marker PR triggered *nothing at
     all*: no publish (correctly — there's no article), but also no signal
     that the merge was a mistake and the topic was just permanently
     blocked. The new job sends a "вы смержили маркер — ничего не
     опубликовано" email naming the topic, the marker file path, and the
     `git rm` command to reverse it — see `tools/blog-generator/
     markerMerged.mjs` (identifies which marker file the merge commit
     added, mirroring `publishOnMerge.mjs`'s own `getMergedArticleSlug()`
     git-diff approach) and `notificationEmail.mjs`'s `buildMarkerMergedEmail`.

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
does **not** put the article live by itself — flipping `"published": false`
to `"published": true"` is a second, separate gate, done via
`setPublished.mjs` (extracted 2026-08-03). As of 2026-08-31 this flip
happens exactly one way, for every article regardless of `allSilent`:
`publish-on-merge.yml` runs it automatically the moment a human merges
the PR — see "How this actually works today" above and "Publish-on-merge"
below for the full mechanism. (2026-08-03 through 2026-08-31, a
perfectly-silent run could instead trigger this flip via a since-retired
auto-merge/auto-publish path inside `generate-article.yml` itself, before
a human ever saw the PR — see "Automated publishing," now superseded.)

`setPublished.mjs --slug=<slug> --value=false` is also the exact rollback
command for the weekly retrospective audit's compensating control (see
"Weekly retrospective, real" below) — the same script, opposite direction.

At build time, `tools/fetch-blog-data.js` merges eligible (`published:
true`) generated articles with whatever BabyLoveGrowth contributes, handling
slug collisions explicitly: if a generated article's slug collides with a
BabyLoveGrowth article, BabyLoveGrowth wins and the generated one is
dropped with a loud console warning (never silently). This should be rare —
slug uniqueness is checked against BabyLoveGrowth's known 28 articles at
generation time — but isn't impossible if a new BabyLoveGrowth article
appears later.

## The GitHub Actions workflow

`.github/workflows/generate-article.yml` — `workflow_dispatch` plus a
schedule as of 2026-08-03 (see "Automated publishing" above), with a
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
   "cannot verify without pushing" list). (2026-08-03 through 2026-08-31,
   this also applied to `github-actions[bot]` *merging* — the since-
   retired auto-merge step ran `gh pr merge` as that actor/token. As of
   2026-08-31 nothing in this repo merges a generator PR except a human,
   so branch protection on merging is no longer this workflow's concern at
   all — moot, not just historical.)

## On ever enabling cron

**Superseded 2026-08-03 — see "Automated publishing" below.** This section
is kept as the historical record of the original weekly-cron decision; the
cadence, topic count, and queue-exhausted status described below are all
stale as of the newer decision. Left in place rather than deleted, same
reasoning as every other decision record in this file: the reasoning stays
readable even after the decision it describes is superseded.

**Enabled 2026-08-01 (superseded 2026-08-03).** The three conditions this
section used to gate on, checked against the actual state at the time:

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

**Fixed 2026-08-03** (the day after this was written) — `generate.mjs`'s
"no available topics" branch now sets `process.exitCode = 1` and emits a
`::error::` GitHub Actions annotation (same mechanism `checkRejectedMarker.
mjs` already used via `::warning::`), so it surfaces as a distinct red run
with a visible annotation, not a silent green no-op. Verified empirically
against the same isolated fixture that exposed the gap: `process.exitCode`
went from `undefined` to `1` on an otherwise-identical run. Deliberately
does NOT write a rejected-attempt marker or open a PR — there's no
discarded draft to record, this is an operational signal (topics.json
needs more entries), not a content event. See `autoPublishGate.mjs`'s
sibling `checkAllSilent.mjs` for the same "read the structured report,
don't parse logs" discipline applied to this era's harder problem
(auto-publish eligibility). The queue-exhausted red run is now this
pipeline's backstop against silently running dry — not the plan for
managing the topic queue, which is restocking `topics.json` proactively
(see "Automated publishing" below for the current runway numbers).

## Automated publishing (owner decision, 2026-08-03) — SUPERSEDED 2026-08-31

**The auto-merge/auto-publish MECHANISM described in §2/§3 below is
RETIRED, not disabled behind a flag — deleted from generate-article.yml
entirely (owner ruling, 2026-08-31, manual-publish formalization). See
"How this actually works today" at the top of this file for current
behavior.** Kept below for its decision history and because §1 (cadence)
and §5/§6 (topic and `_headers` runway) remain accurate independent of the
retired mechanism. The finding that forced the retirement: a review found
**zero silent publishes in this project's entire history** under this
path — every article that ever went live was human-merged, and
`allSilent` was effectively unreachable in practice (self-review's
phantom internal-link-stripping corrections, root-fixed the same day,
meant a genuinely clean draft almost always still carried at least one
"correction" before it ever reached this section's §2 conditions — see
"Self-review no longer validates internal links" below). `checkAllSilent
.mjs`, referenced in §3 below, no longer exists (deleted — its only
caller was the retired workflow step); `report.allSilent` is still
computed exactly as §3 describes, now feeding an informational PR-body
line instead of a workflow decision.

**Supersedes the 2026-08-01 weekly-cron decision above.** Owner (Stan)
instruction, explicit, this date. Nothing here weakens the gates
themselves — every check that existed before this decision still runs,
still means the same thing, and still holds a PR for a human on any
finding. What changed, 2026-08-03 through 2026-08-31: a run with **zero**
findings of any kind merged and published itself, with a standing weekly
retrospective audit as the compensating control for removing the pre-
merge human read on that one path. As of 2026-08-31, every run — silent
or not — holds for a human Merge; the retrospective audit's job continues
unchanged as the standing content-quality audit for everything published,
just no longer described as compensating for a gap that no longer exists.

### 1. Cadence

Every other day (`workflow_dispatch` kept alongside). `*/2` in the
day-of-month field means "every odd day of the month" — accepted, known
quirk: a 31-day month fires on day 31 and day 1 of the next month on
consecutive calendar days, since cron has no month-boundary-surviving
"every N days" concept. Considered and rejected `0 14 * * 1,3,5`
(Mon/Wed/Fri): cleaner and drift-free, but it changes the cadence to 3
fixed weekdays with an irregular 3-day Fri→Mon gap, which reads as a
different schedule shape rather than "every other day." `*/2` stays truer
to what was actually asked for; the quirk's worst case (one extra
generation attempt around 31-day month boundaries, ~7×/year, costing at
most one topic) is immaterial at this pipeline's volume.

**Time-of-day moved off :00, 2026-08-31 (owner instruction).** Originally
`0 14 */2 * *` (14:00 UTC exactly). Three documented incidents on this
exact cron, all at the hour boundary: Aug 27 (run 33126258071, fired
23:26 UTC, 9h26m late), Aug 29 (run 33265677614, fired 17:27 UTC, 3h27m
late), and Aug 31 (no run at all that day — confirmed against every run
created that day via the Actions API; workflow was `active`, no GitHub
status incident; manually dispatched instead, run 33428265910). GitHub
Actions' own documentation names "the start of every hour" as the
highest-risk window for a scheduled workflow to be delayed or dropped
under load — this cron sat exactly there. Now `23 13 */2 * *` — 13:23
UTC / ~6:23 AM Pacific (PDT), same odd-day cadence, same accepted
month-boundary quirk above, ~37 minutes earlier than the old nominal time
(not a deliberate schedule-shape change — just where minute 23 lands).
This does not fix a bug in this pipeline's own code; it avoids a
documented GitHub Actions platform risk this workflow had already been
hit by three times.

### 2. The auto-publish path — exact conditions (RETIRED — historical)

A cron-generated PR (real article, `outcome: 'generated'`) used to
auto-merge and auto-publish **only** when every one of these held — see
`autoPublishGate.mjs`'s `computeAllSilent()` for the actual implementation,
covered by `autoPublishGate.test.mjs`:

- **Layer 1:** zero findings of any kind, **including log-only demoted
  ones** (`exclusivity:only` / `exclusivity:superlative`, demoted for
  generator articles — see "Layer 1's real-world hit rate" above). A
  demoted finding still means the scanner saw something.
- **Layer 1's separate uncited-claim-candidate signal**
  (`findUncitedClaims()`) also zero — a distinct log-only mechanism from
  the demoted findings above, still a signal, not silence.
- **Layer 2:** every boolean in the independent LLM checklist false
  (`layer2.tripped === false` — already exactly that, reused directly).
- **Layer 3:** every citation `RESOLVED`. `failed`/`unsupported` already
  trip Layer 3's own gate; `inconclusive` (`UNREACHABLE_LIKELY_BOT`) does
  **not** trip Layer 3 on its own (a bot-block is inconclusive, not proof
  of a bad citation) but **does** disqualify auto-silent — inconclusive is
  not the same thing as verified. Zero citations is silent (nothing to
  verify is not the same as something unverified).
- **Schema:** clean — guaranteed by construction; a schema-invalid draft
  never reaches `outcome: 'generated'` in the first place.
- **Self-review:** zero violations found, full stop — **narrower than "no
  real corrections beyond formatting" reads on its face, a deliberate,
  disclosed decision, not a silent gap.** `violations_found` is a
  free-text description array with no structured formatting-vs-substantive
  classification. Guessing that distinction with a keyword match would be
  exactly the kind of fragile text-parsing this whole design instruction
  said not to do ("implement the auto-merge as a machine-readable flag...
  don't parse logs" applies just as much to parsing a model's own
  free-text self-description as to parsing a job log). Until the
  self-review tool schema grows an actual structured classification, any
  correction — formatting or not — holds the PR for a human read.

**ANY finding anywhere — even log-only — holds the PR for a supervised
read, exactly as before this decision.** Silence publishes; signal waits
for a human. This is the standing rule, unchanged: *a PR that fails its
read does not merge, cron or no cron* — extended to *a PR with any finding
at all, however minor, does not auto-merge*.

### 3. Mechanism (RETIRED — historical; `checkAllSilent.mjs` no longer exists)

`report.allSilent` is computed once, in `generate.mjs`, on the same report
object the PR body reads (`computeAllSilent()` never re-derived a second
way that could disagree with itself) — this part is UNCHANGED and still
true today, just no longer feeding a workflow decision. What's retired:
`checkAllSilent.mjs` (matching `checkRejectedMarker.mjs`'s exact extracted,
fail-closed, three-state-aware pattern) used to read that report and emit
`all_silent`/`article_slug` to `$GITHUB_OUTPUT` — the workflow's auto-merge
step gated on that flag, never on log text. Deleted 2026-08-31 along with
the auto-merge step, its only caller.

On `all_silent == 'true'`: the workflow first runs `gh pr checks --watch`
on the just-opened PR and only merges if the PR's own required checks
(build-check, Cloudflare Pages preview) pass — a silent article whose
build genuinely breaks does not get merged just because the content gates
were clean. After a successful merge, a separate step fetches main fresh,
runs `setPublished.mjs --slug=<slug> --value=true` and
`headersCacheEntry.mjs --slug=<slug>`, and commits both changes together
as **one** atomic commit (`blog: auto-publish "<slug>" (perfectly silent
run)`) — unlike the human-read path's two separate commits (read, then a
distinct publish-flag flip), there's no separate human judgment call to
represent as two edits here; the auto-merge itself *is* the combined
decision, so recording it as one commit is more honest than manufacturing
a fake split.

**Failure mode, by design:** if `setPublished.mjs` or `headersCacheEntry.
mjs` throws (e.g. the `_headers` 100-rule cap, see §5 below) after the PR
has already merged, the step aborts (GitHub Actions' default `-e` for
`run:` blocks) before the commit/push ever happens. The article lands on
`main`, merged, but `published: false` — a safe, visibly-incomplete state
(nothing goes live wrong), not silent: the job is red, requiring a human
to notice and finish the publish step by hand using the same two scripts.

### 4. Compensating control — retrospective audit (role changed 2026-08-31, mechanism unchanged)

2026-08-03 through 2026-08-31, this section's own reasoning: pre-merge
human reads no longer happened on silent runs, so the floor moved from
*before* publish to *after* — a **standing weekly audit** as the
compensating control for that removed step. As of 2026-08-31 every run
holds for a human Merge again, so there's no longer a removed step to
compensate for — but the audit itself didn't stop being valuable, so it
didn't stop: it's now the standing content-quality audit for everything
this pipeline has published, full stop, same mechanism, same standing
commitment, just described accurately instead of as a compensating
control for a gap that no longer exists. See "Weekly retrospective, real"
below for the actual implementation. The full six-category read
(fabricated speech, misattributed quotes, prohibited claims, stats-vs-
citations, identity block, quality/rendering) of everything published
that week, report-only, same verdict scale (CLEAR / NEEDS-FIX / REJECT)
used for every prior audit in this project. Stan can run it manually (his
own stated fallback, Mondays) or it can be delegated the same "owner-
delegated read" way individual article reads already have been (see
"Owner-delegated reads" above) — either way, it is a standing commitment,
not optional follow-up.

**Checklist line item added 2026-08-03** (see "Site-wide fabricated-claims
sweep" below): the weekly retrospective audit also re-checks the
homepage's Google-reviews badge (`src/lib/reviews.js` — `GOOGLE_RATING`,
`GOOGLE_REVIEW_COUNT`) against George's live Google Business listing.
These are real, hardcoded values, not fetched live — accurate the day
they're set, silently stale the day they're not. A hardcoded "5.0 · 17
reviews" badge is exactly the kind of claim this project has spent this
entire sweep removing when it's *not* backed by a real, checkable source;
the difference here is it genuinely is checkable, so the audit is "does
this still match," not "is this real."

**Checklist line item added 2026-08-13:** the same 5.0/17 figure lives in
**two** places now, not one — the site badge above, and the live Google
Ads account callout asset "5.0★ · 17 Google Reviews." Both are hardcoded,
both drift independently, and a mismatch between them (or between either
one and the live listing) is invisible unless both are checked in the
same pass. The weekly retrospective audit must verify **both** the site
badge and the Ads callout against George's live Google Business listing —
checking only `src/lib/reviews.js` and assuming the Ads account matches is
not sufficient.

**Rollback — the one-commit unpublish line**, for an article that fails
retrospectively:

```
node tools/blog-generator/setPublished.mjs --slug=<slug> --value=false
git add src/data/generated-articles/<slug>.json
git commit -m "blog: unpublish <slug> -- failed retrospective audit (<one-line reason>)"
git push origin main
```

Deliberately does **not** touch `public/_headers` — the cache-entry rule
stays (a 404/removed page is a separate, later decision if the article is
permanently retired, not an automatic side effect of unpublishing) and
does **not** delete the `generated-articles/<slug>.json` file — the
content and its full gate/audit history stay in git history either way,
matching this pipeline's existing "never delete, always record" pattern
for rejected-attempt markers.

**Routine-proofing (2026-08-13):** the Aug-13 half-sequence incident (a
scheduled routine merged an article PR at `09a80ca` but skipped the
flip/`_headers`/rebuild remainder, left silently incomplete until a human
noticed by hand) is exactly the failure mode "merge ≠ publish" above warns
about. `tools/blog-generator/publishStatusReport.mjs --slug=<slug>` is the
one-command check for it — given a slug, reports whether all four steps of
the publish sequence actually landed: `published:true`, the `_headers`
cache pair, presence in the built `blog-articles.json`, and (best-effort,
network) that the article serves live. Exits non-zero on anything
incomplete. Read-only — never writes, safe to run repeatedly or from a
routine as a post-merge sanity check. `--skip-live` skips the network
check (CI/sandboxed runs without outbound access) and reports local-only
completeness.

### 5. Topic runway

Restocked `topics.json` from 20 to **40** entries, 2026-08-03, same rules
as the original 20 (no competitor topics, no exclusivity/tenure bait),
biased toward citable statute/county-fact subjects over market-practice
ones per instruction (new topics: PCOR, documentary transfer tax, natural
hazard disclosure, agency relationship disclosure, Prop 19 base-year
transfers, the homeowners' property tax exemption, title insurance,
TDS exemptions, property tax appeals, Fair Housing Act, recorded closing
documents, grant vs. quitclaim deeds, the Real Estate Recovery Fund,
Davis-Stirling HOA board elections, HOA reserve studies, seller disclosure
timelines, 1031 exchanges, the supplemental property tax bill, and the
Right to Repair Act).

6 topics attempted (5 published articles + escrow guide), **34 available**.
At this cadence (~15 successful generations/month, extrapolating from 6/6
clean so far), that's roughly **68 days (~2.3 months)** of runway. The
queue-exhausted red run (fixed 2026-08-03, above) is the backstop if this
estimate is wrong, not the plan — restock before it fires.

### 6. `_headers` automation — and the runway that actually binds first

`headersCacheEntry.mjs` generates and inserts the per-route Cloudflare
Pages cache-entry pair from a slug automatically (see Mechanism above) —
the manual step that produced the exact "guaranteed future miss" this
instruction named. `insertCacheEntry()` is idempotent (a slug that already
has an entry is a no-op, not a duplicate) and fails closed at Cloudflare
Pages' **100-rule limit**, refusing to write a file that would break at
deploy time rather than shipping it and finding out later.

**Verified against the real file, 2026-08-03: 72 of 100 rules used.**
Each new article costs 2 rules, so **14 more articles fit** before the
cap. At this cadence's ~15 successful generations/month, that's roughly
**28 days (~1 month) of runway — the constraint that actually binds
first**, well before the 68-day topic runway above. **Flagging this
plainly rather than letting the topic-runway number read as the whole
picture:** within about a month, `insertCacheEntry()` will start throwing
on every silent run, which (per the failure mode in §3) leaves each
article merged-but-unpublished until a human intervenes — not a broken
build, but a real, foreseeable interruption to the auto-publish path if
nothing changes first.

**Available headroom, not exercised here:** 50 of the current 72 rules
(69%) are the "Dead BabyLoveGrowth blog articles" `noindex` block (25
retired slugs × 2 forms), added 2026-07-24 for pages that were already
fully deindex-verified live at the time. Whether enough time has now
passed to safely prune some or all of that block is a real SEO-timing
judgment call outside this task's scope — noted here as the lever that
exists, not pulled.

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

## Layer 2 `competitor_mention` scope fix — decided, 2026-08-03

**Trigger:** run #19 (`generate-article` workflow, database ID
`30831867535`) — the 2026-08-03 scheduled cron firing, delayed to 16:22
UTC from its nominal 14:00 slot. Layer 2 flagged `competitor_mention:
true` on: *"Buyers in this market compare homes against new construction
in growing communities like Sommers Bend and Heirloom Farms, as well as
established neighborhoods throughout Temecula, Murrieta, and Menifee."*
The model read "communities" as competing businesses. The run was
correctly discarded (PR #23, rejected-attempt marker, topic released on
close) — the gate did its job, tripping fail-closed on a false positive
rather than shipping something unreviewed. The finding itself was the
bug: `competitor_mention`'s description was unscoped enough to sweep in a
neighborhood/master-planned-community name, which this site's own content
uses constantly (Wolf Creek, Redhawk, Harveston, Sommers Bend, Heirloom
Farms, and every other neighborhood-guide topic in `topics.json`).

**Fix:** `llmClaimGate.mjs`'s `CHECKLIST_TOOL.competitor_mention`
description and `REVIEWER_SYSTEM_PROMPT` both rescoped explicitly to
competing real estate **agents, brokerages, teams, and their
websites/domains** (e.g. "the DeBonis Team", "meekerrealtygroup.com"),
explicitly **excluding** neighborhood names, master-planned communities,
housing developments, and builders' community names — with the exact
Sommers Bend / Heirloom Farms example named in the prompt itself, plus an
explicit note that the general "when unsure, flag true" instruction does
not override this one category's scoping.

**What proves this, and what doesn't — stated plainly:** no live
`ANTHROPIC_API_KEY` was available to re-run the actual model against the
fixed prompt and confirm its real judgment changed. `gate.test.mjs` has
three new tests: a textual regression guard on the description/prompt
content (would have failed against the pre-fix text, which contained
none of "neighborhood," "master-planned," "Sommers Bend," or "Heirloom
Farms"), and two plumbing tests (the code correctly acts on a
`competitor_mention: false` response for text shaped like the real
misfire, and correctly still trips on an actual competing agent/team/
domain). These prove the code's handling and the prompt's stated intent —
**not** the model's real behavior on a live call. Same limit this file's
own "Why seven layers" section already states about layer 2 generally:
"a mocked layer-2 test proves plumbing, not judgment... only proven by
... real runs against a live model."

**Acceptance check (standing rule invoked): the next article this
pipeline generates gets a full human read regardless of what `allSilent`
says**, specifically because this changes Layer 2 behavior — same
discipline as "any prompt.md change requires re-running the acceptance
discipline" below, applied here to a `llmClaimGate.mjs` change instead.
Auto-publish stays correct by construction either way (a genuinely silent
run still requires zero findings to auto-merge), but this one is getting
a deliberate human look regardless, specifically to confirm the rescoped
prompt behaves as intended on real model output before trusting it to
gate unattended publishing again.

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

## Site-wide fabricated-claims sweep — closed, 2026-08-03

This file is nominally the blog-generator's own README, but this entry
covers the **whole site**, not just generated articles — recorded here
because this is the only decision log this repo has, and everything else
in this multi-day sweep already lives here.

**2026-08-03 full-site fabricated-claims sweep: clean in both languages
across bundle + all static shells.** Covered, across this and the
preceding sessions: the homepage FAQ (replaced the sitewide hardcoded
FAQPage block that had no matching visible content, dropped its
"five-star reviewed" and uncited "~80% buyer-side" claims), the same two
claims cleaned from 6 more locations found while verifying (meta/OG/
Twitter descriptions, three JSON-LD schema descriptions, the `<noscript>`
fallback, `AboutGeorgePage.jsx`, a visible stat on `ContactPage.jsx`), a
named-competitor line (`ListingAlertsSection.jsx`), and the last
fabricated content on the domain — the Russian-language page's "Топ
Риэлтор" superlative badge and fabricated "5.0★ … dozens of satisfied
families" review claim, plus a stale contact email, none of which had an
English-side equivalent left to clean by the time they were found. Zero
known fabricated claims remain, verified by direct grep of the live
bundle and every static route shell, not by re-reading source and
assuming the build reflects it.

**The 5.0/17 Google-reviews badge is not part of that cleanup — it's the
inverse case, verified real, not removed.** `src/lib/reviews.js`'s
`GOOGLE_RATING`/`GOOGLE_REVIEW_COUNT` (5.0 stars, 17 reviews) and the
attributed review text in `GoogleReviews.jsx` were confirmed by the owner
against George's live Google Business listing — legitimate, source-linked,
not invented. The distinction from everything else in this sweep: those
were unsourced text with nothing behind them; this is a real number with
a real source, just not fetched live.

**Caveat, stated plainly:** hardcoded values go stale. A rating or review
count that was accurate on verification day silently drifts if the real
listing changes and nobody re-checks. This is now a standing line item in
the weekly retrospective audit (see "Automated publishing" §4, above) —
check the badge against the live listing, don't assume a 2026-07-26 (or
2026-08-03) verification date stays true forever.

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

## CLOSING ENTRY — 2026-08-03

Everything above this line documents how the system got here. This entry
is the state it was left in — after it, the system runs itself; nothing
new was built to produce this entry, only recorded, committed, and
verified.

### Final inventory

| | |
|---|---|
| Articles live | **8** |
| Topics available | **39** of 47 (~78 days runway at current cadence) |
| `_headers` rules used | **76** / 100 (~12 more articles fit, ~24 days runway — binds before the topic runway does) |
| Open PRs | **0** |
| Test count | **342** / 342 passing |
| Cron schedule | `0 14 */2 * *` — every other day, 14:00 UTC / 7:00 AM Pacific (PDT) |
| Next scheduled run | **Wednesday, 2026-08-05, 14:00 UTC / 7:00 AM PDT** |

Deploy state at close: commit `68cde16` on both `temeculavalleyhomes.us`
and `igor-r.pages.dev` (`version.json` identical on both hosts, `dirty:
false`, `buildEnv: cf-pages`). Local `main`, `origin/main`, and the
deployed commit are the same commit. Bundle: `index-3a825d3d.js` /
`index-e4f8b727.css`.

**Left deliberately untracked, not part of this session's work:** five
paths were untracked in git status before this session's first message
and remain so — `.github/workflows/conversion-monitor.yml`,
`tools/blog-compliance/run-acceptance-scan.mjs`,
`tools/blog-compliance/write-acceptance-fixture.mjs`,
`tools/blog-generator/dry-run-topic-selection.mjs` (used read-only,
extensively, throughout this session's queue checks — genuinely useful,
not touched), and `tools/monitor/`. No context on their completeness or
intended scope; committing someone else's in-progress work without that
context risks shipping something premature or broken. Not mine to decide
finished.

### Standing operations

**SUPERSEDED 2026-08-31 — this subsection is a snapshot of 2026-08-03,
kept for history.** "Auto-publishes vs. holds" below describes a
mechanism retired 2026-08-31; see "How this actually works today" at the
top of this file for current, canonical behavior. The prediction in that
paragraph ("zero have been silent so far") turned out to hold for the
mechanism's entire lifetime, not just at this snapshot — see "Automated
publishing"'s new superseded-banner for the finding that closed it out:
zero silent publishes ever happened, project-wide.

**Every other day, 14:00 UTC:** `generate-article.yml` fires (workflow_dispatch
also stays available any time). One topic is generated, self-reviewed, and
run through three gates (regex scanner, independent LLM claim review,
citation URL resolution).

**Auto-publishes vs. holds:** a run merges and publishes itself **only**
when every gate came back perfectly silent — zero findings anywhere,
including log-only ones, zero self-review corrections, every citation
resolved. Any finding at all, however minor, opens a PR and holds for a
supervised human read, exactly as it always has. Six real generation
attempts since automated publishing was enabled; zero have been silent so
far (self-review has caught a real issue — an uncited number, a broken
citation URL — on every one) — the hold path is proven live, the
auto-merge execution path is proven by unit test and by manual exercise
of the identical commands, not yet by a live silent trigger.

**Weekly retrospective audit** (compensating control for the one thing
pre-merge review no longer covers on a silent run): full six-category
read of everything auto-published that week, report-only, same verdict
scale as every article read this project has ever done. Now explicitly
includes: re-checking the Google-reviews badge (`src/lib/reviews.js`)
against George's live listing. Stan's manual fallback (Mondays) or
delegatable the same way individual reads have been.

**Queue-exhausted signal:** if `topics.json` ever runs dry, the run fails
loud — `process.exitCode = 1` plus a `::error::` GitHub Actions annotation
— never a silent green no-op. Distinguishable from a gate trip (which
opens a rejected-attempt PR) and from a real failure (generic `FATAL`
error, no annotation) by the Monday-morning signal table in the
"Automated publishing" section above.

**Three thresholds that need future action, none urgent, none silent:**

1. **`_headers` cap — closest, ~24 days out.** 76/100 rules, 2 rules per
   article, ~12 articles of headroom left. Will start throwing (safely —
   merged-but-unpublished, not a broken build) on `insertCacheEntry()`
   once it's exhausted. Headroom exists if needed sooner: 50 of the 76
   rules are the prunable dead-BabyLoveGrowth `noindex` block, an SEO-
   timing judgment call outside any task so far, not pulled.
2. **Topic runway — ~78 days out.** 39 of 47 topics available. Restock
   `topics.json` before it closes; the queue-exhausted signal above is the
   backstop if this estimate is wrong, not the plan.
3. **Node.js 20 deprecation warning** on every GitHub Actions run
   (`actions/checkout@v4`, `actions/setup-node@v4` — currently forced onto
   Node 24 by GitHub, still working, but flagged in every run's
   annotations). No functional impact yet; a `node-version: '20'` bump in
   both workflow files is the eventual fix, not urgent, not silent —
   it's been sitting in the annotations of every single run this whole
   project.

## Pipeline stall diagnosis + self-review reporting fix — 2026-08-07

The two scheduled runs after the 2026-08-03 closing entry above (Aug 5,
Aug 7 — both fired, delayed by GitHub's own scheduler jitter, not skipped)
each generated a genuinely clean article and correctly held for a human
read. Diagnosis, verdict, and delegated-read authorization all happened in
one session; recorded here rather than editing the 2026-08-03 entry above,
which stays as the snapshot it was at the time.

**Verdict: working as designed, not a bug.** Every merged article PR back
to #8 was merged by `drstas-cyber` (human), zero by `github-actions[bot]`
— the auto-merge path has never executed in production, not once since it
shipped. Root cause traced to source, not assumed: `computeAllSilent()`
requires `selfReview.violationsFound.length === 0`, and the self-review
model doesn't reliably return `[]` on a clean draft — PR #27 (2026-08-07)
shows a genuinely clean draft reported back as a 1-item
`violations_found` array whose text was narration ("draft was already
clean, returned unchanged"), not a real correction. Indistinguishable
from a real 1-item correction by length alone, so `computeAllSilent`
correctly-by-construction still held the PR — for the wrong apparent
reason, forcing a human to read the actual content to tell the two cases
apart.

**Both held PRs read and merged.** PR #26 ("Preparing Your Temecula Home
for Sale," `how-to-prepare-a-home-for-sale-temecula`) — self-review's 5
claimed corrections independently re-verified as actually landed in
`content_html`, not just trusted; citations independently re-checked
against the correct Civil Code sections (1102.6 for the TDS form itself,
not the bare scope-only 1102 that tripped article 8). PR #27 ("Timing the
Sale of Your Home," `best-time-to-sell-a-home-temecula`) — the "clean"
narration confirmed true by reading the actual content, not by trusting
the mislabeled count. Both PASS, no content edits needed. Merged, published
(`setPublished.mjs` + `headersCacheEntry.mjs`), live-swept via the actual
deployed bundle and `_headers` response, not just source review. Now
**10** articles live, **80**/100 `_headers` rules used.

### The fix — structural, not another prompt instruction

`REVIEW_TOOL`'s schema (`generate.mjs`) now has two required fields
instead of one:

- `draft_was_clean` (boolean) — the model's explicit clean/not-clean
  verdict.
- `violations_found` (array) — unchanged in shape, but its description now
  demands "one entry per ACTUAL CHANGE MADE... never narration, never
  confirmations of cleanliness."

`selfReviewSchema.mjs`'s `validateSelfReview()` enforces the one rule this
whole fix exists for, in code, not in a prompt instruction hoped to hold:
`draft_was_clean: true` REQUIRES `violations_found` to be exactly `[]`.
Any mismatch is flagged as an explicit inconsistency (`report.selfReview.valid
=== false`) — this does **not** discard the run the way a gate trip or a
schema-invalid article does; the article still gets written and opens a
normal PR (a self-review reporting glitch says nothing about whether the
draft itself is fine — PR #27's wasn't). It only ever keeps
`computeAllSilent()` (`autoPublishGate.mjs`, updated to read
`draftWasClean === true` AND an empty array, both — "never guess which
field to believe") from misreading an inconsistent report as silent.
`render-report-md.mjs` renders the mismatch as its own distinct,
impossible-to-miss state in the PR body, instead of looking identical to
an ordinary correction list the way it did for PR #27.

**Proved red first, per the discipline this fix itself asked for:**
`selfReviewSchema.test.mjs` (new, 9 tests) and the "self-review:
draftWasClean + violationsFound" block added to `autoPublishGate.test.mjs`
cover exactly the three cases from the diagnosis — clean (`true` + `[]`) →
silent-eligible; narrated-clean (`true` + 1 item, the PR #27 shape) →
flagged mismatch, held; real correction (`false` + 1 item, the PR #26
shape) → held, same as always. Each file also keeps its "prove it red"
regression block: a naive `violations_found.length`-only check cannot
tell the narrated-clean case apart from a real correction — both just
look like "1 item" — demonstrating why `draft_was_clean` is a necessary
second field, not a redundant one. Full repo test suite (same scope as
the 2026-08-03 closing entry's "342/342" figure): **362/362** passing,
verified by actually running `node --test` against every `*.test.mjs` in
the repo, not assumed from the individual files run in isolation.
`npm run build` verified clean locally too.

**Acceptance check (standing rule invoked): the next article this
pipeline generates gets a full human read regardless of what `allSilent`
says** — same discipline as the `competitor_mention` scope fix above,
applied here because this changes self-review/generation behavior. The
auto-merge control-flow code was already correct by construction before
this fix (a genuinely silent run still required zero findings); what
changes is the self-review model's ability to accidentally report a
false negative on "was this clean," so the next run's silence (if any)
needs a deliberate human look before it's trusted to gate unattended
publishing again.

## Internal linking + validated link gate — 2026-08-08 (Batch B, Part 3)

From the 2026-08-07 AI SEO audit's RISK #3 (zero contextual internal
links sitewide). `prompt.md` gained a new "Internal linking" section:
articles SHOULD (not MUST) include 1–3 contextual internal links, chosen
only from a "Known live routes" list injected into the per-run user
message (`tools/blog-generator/knownRoutes.mjs` — built from
`seo-prerender.js`'s `ROUTES` plus every published article in
`blog-articles.json`, deliberately NOT from `slugs.js`'s
`getKnownSlugs()`, which includes 28 retired BabyLoveGrowth slugs that
aren't live under this pipeline). `internalLinkGate.mjs`'s
`validateInternalLinks()` enforces this in code after generation, same
"never trust the prompt instruction alone" discipline as the self-review
fix immediately above — a hallucinated internal URL discards the run
with the same `handleTrippedGate` mechanism a schema-invalid draft
already used, new `failureClass: 'internal_link_invalid'`.

**Acceptance check (standing rule invoked): the next article this
pipeline generates gets a full human read regardless of what `allSilent`
says** — both the prompt and generation/validation behavior changed.
Confirm on that read: any internal links present are genuinely relevant
(not forced in), every internal URL actually resolves live, no invented
URL survived, and no unsupported claim was introduced in the sentence
around a link.

## Self-review never validated internal links — fixed 2026-08-12

**Superseded 2026-08-31 — see "Self-review no longer validates internal
links — root-fixed 2026-08-31" below, past the next entry.** This fix and
the 2026-08-19 one after it both mitigated symptoms of the same root
cause; kept for decision history.

Real incident, both real runs since internal linking shipped: PR #28
(2026-08-09) and PR #29 (2026-08-11) each stripped every internal link the
draft pass had added, self-review reporting things like *"no known live
routes were provided for this run to validate against"* — which was true
from the self-review call's own point of view, but not because the list
didn't exist. Root cause traced to source: `selfReview()` in `generate.mjs`
never received `knownRoutesText` at all — only the draft pass
(`generateDraft()`) did. The self-review model had no list to check the
draft's links against, so the safe, defensible thing it could do was strip
all of them. The internal-link gate (`internalLinkGate.mjs`) never
malfunctioned — it's a fail-closed backstop for a hallucinated URL, not
meant to be the only thing standing between a draft and zero links ever
surviving, and until this fix it was carrying that job by accident.

**Fix:** `selfReview()` now takes `knownRoutesText` (already computed once
per run, same value injected into the draft pass) and appends the same
"Known live routes" list to its own user message. `prompt.md`'s self-review
pass instructions gained a new paragraph: keep a link verbatim only if its
URL is an exact match for an entry on the list; strip any that aren't
(replacing the link markup with its plain anchor text, never deleting the
surrounding sentence); report each stripped link as a `violations_found`
entry. Explicitly told not to strip out of caution or "clean up" a link
that already matches. (Also fixed in the same edit: the self-review call's
hardcoded instruction referenced "the six hard rules" — stale, prompt.md
has had ten since rule 8 and rule 9 were added; corrected to "ten" while
already touching that line.)

**What proves this, and what doesn't.** No live `ANTHROPIC_API_KEY` was
available to re-run the actual model against the fixed prompt and confirm
its real link-keeping judgment — same limit this file already states for
every other prompt/self-review change (see "Why seven layers," Layer 2,
and the `competitor_mention` fix above). What's proven instead: the
self-review API call now genuinely includes the list (a plumbing test
asserting the request body contains `Known live routes` and a real route
URL, which would have failed against the pre-fix code — it didn't exist to
send), and that when self-review's output already contains links matching
known routes, they survive intact into the written article
(`generate.test.mjs`, "self-review — internal-link validation"). The
internal-link gate's own existing tests (immediately above this in the
test file) already covered the fail-closed backstop for an invented link
making it through regardless of what self-review does with it — unchanged
by this fix.

**Acceptance check (standing rule invoked): the next article this pipeline
generates gets a full human read regardless of what `allSilent` says** —
self-review's actual behavior on internal links changed. Confirm on that
read: any links self-review kept are genuine exact matches to real known
routes (not something that merely looks close), and no link that should
have survived was stripped anyway.

## The 2026-08-12 fix above wasn't enough — self-review still over-strips, fixed deterministically 2026-08-19

**Real incident, live production:** PR #32 (Paloma Del Sol, 2026-08-17) —
the first real run after the 2026-08-12 fix above shipped — still stripped
six internal links, including two to real, live articles (`redhawk-...`
and `wolf-creek-...`), each citing "did not exactly match a Known live
route (extra trailing slash / mismatch)" as the reason. Verified directly
against the actual `Known live routes` text that run received: both the
draft's link and the corresponding list entry were byte-identical, trailing
slash and all. The 2026-08-12 fix correctly closed "the model had no list"
— but link-URL matching was, and still is, an LLM judgment call under that
fix, not a deterministic one, and the model can misjudge an exact match
even with the list sitting right in front of it. Caught during a
supervised read (this run wasn't perfectly silent — 10 self-review
corrections — so it held for one regardless); the article itself was fine
and got published as-is with the links manually understood to be lost, not
restored at the time.

**Fix:** link-URL validation no longer depends on the self-review model
getting a string-comparison right. `internalLinkRestore.mjs` (new,
pure, matching this directory's existing gate/helper pattern) runs
deterministically in `generate.mjs`, between `selfReview()` and
`assembleArticle()`: for every anchor in the *draft* whose href is an
exact match (via `internalLinkGate.mjs`'s own `normalize()`, now exported
so both files share one definition) to a known route, if that anchor is
missing from self-review's output, restore it — but only when unambiguous
(the anchor's exact text survives as a single, not-already-anchored
occurrence in the reviewed HTML). Anything ambiguous — text reworded away,
text appearing more than once, an already-different anchor sitting where
the old one was — is left alone and logged, never guessed at.
`internalLinkGate.mjs`'s fail-closed gate is unchanged and still runs
after this: this fix only ever adds back a link the draft already had and
the known-routes list already vouches for, never keeps something invalid.

**Deliberately narrow, by design:** this does NOT change what happens when
self-review correctly strips a genuinely invalid link (an invented slug,
a wrong domain) — those still get stripped and stay stripped. It only
recovers the "good link, wrongly removed" case the 2026-08-17 incident
actually was.

**What proves this:** 12 unit tests (`internalLinkRestore.test.mjs`)
covering the restore case (including the real redhawk/wolf-creek shape),
the correct-strip-stays-stripped case, the already-intact no-op case, root-
relative hrefs, and three distinct "don't guess" cases (ambiguous duplicate
text, reworded-away text, text already re-anchored to something else) —
each proven red first (module didn't exist) before the implementation
existed to make them pass. Plus one full-pipeline test in `generate.test.mjs`
("link-restore backstop — the real PR #32 bug, reproduced end-to-end")
using a real router with genuinely different draft/self-review mock
responses (unlike `mockAnthropicRouter`, which shares one `contentHtml`
between both passes) — proves the wiring actually fires inside `main()`,
not just the module in isolation. 31/31 `generate.test.mjs` tests passing
(up from 30), full blog-generator suite green, full build verified.

**Acceptance check:** same standing rule as 2026-08-12 — the next article
this pipeline generates gets a full human read regardless of `allSilent`,
specifically checking that any restored link is genuinely correct (points
at the right, relevant route) and that the restore log (printed by
`generate.mjs`, not currently surfaced in the PR body) doesn't show any
`skipped` entries that should have been restorable.

**SUPERSEDED 2026-08-31 — see the entry immediately below.** Both this
fix and the 2026-08-12 one above mitigated symptoms, not the cause. PR
#38 (2026-08-27) proved the pattern hadn't actually stopped: 9 links
stripped, 8 restored by this mechanism, the one miss traced to self-review
REWORDING the surrounding sentence rather than a URL judgment at all.
`internalLinkRestore.mjs` itself is NOT removed as of 2026-08-31 — it
stays wired in as defense-in-depth pending proof of the root fix below —
but self-review no longer has any reason to invoke the failure mode this
entry documents.

## Self-review no longer validates internal links — root-fixed 2026-08-31 (owner ruling item 2, manual-publish formalization)

**Supersedes both entries immediately above.** Two prior fixes (2026-08-12:
give self-review the Known live routes list; 2026-08-19:
`internalLinkRestore.mjs`, a deterministic backstop) each mitigated a
symptom without fixing the actual cause. The pattern repeated a third
time: PR #38 (2026-08-27) stripped 9 links, the backstop restored 8, and
the one miss wasn't even a URL-matching failure — self-review had
reworded the surrounding sentence, leaving no exact anchor text for the
backstop's deliberately-conservative restore logic to find. Three real
incidents (2026-08-09/11, 2026-08-17, 2026-08-27), two prior fixes, the
same failure class every time: **asking an LLM to re-judge exact URL
string equality is unreliable, even with the list in hand, even after
being told twice how to do it more carefully.**

**Root fix:** stop asking. `selfReview()` (`generate.mjs`) no longer
receives the `Known live routes` list at all, and its user-message
instruction changed from "validate every internal link... strip any that
aren't" to "leave every internal link EXACTLY as it appears — do not
re-validate, strip, or re-wrap any of them." `prompt.md`'s self-review
pass instructions carry the matching change: the old "Validate internal
links against the list" paragraph is replaced with "Do not touch internal
links during self-review," explicitly citing both prior incidents as the
reason self-review's own judgment is not trusted for this anymore (the
old paragraph is kept in a collapsed `<details>` block for history, marked
"no longer in effect"). The draft pass is UNCHANGED — it still receives
the list and is still instructed to choose only from it; only self-review
lost the (redundant, unreliable) re-validation responsibility.
`internalLinkGate.mjs` (deterministic, not a second LLM judgment call)
remains the real backstop for a genuinely wrong URL from the draft pass
itself.

**`internalLinkRestore.mjs` is explicitly NOT removed in this pass** —
marked "pending removal" in its own header comment and at its call site in
`generate.mjs`, kept wired in as defense-in-depth until the root fix
proves out against real runs. Removing a safety net in the same commit
that introduces the thing it's supposed to backstop would mean a single
bad live run has nothing left to catch it.

**Tests:** two new in `generate.test.mjs`'s "self-review no longer
re-validates internal links" block, confirmed failing before the prompt
change (the self-review request still offered the list) — one proving the
self-review request carries no `Known live routes` list while the draft
pass still does, one a real multi-link fixture (a static-page link and a
blog-article link) proving zero `violations_found` entries and zero
restore actions when self-review correctly leaves links untouched. The
pre-existing 2026-08-12 regression test (asserting self-review DID
receive the list) is inverted and kept as the guard that the list must
never come back.

**PROOF, unlike everything else in the 2026-08-31 manual-publish
formalization pass: this cannot be proven by test alone.** Self-review is
a live model call; no test can prove what the real model will do on a
real draft. Success = the next real cron run's `violations_found`
containing zero link-related entries — checked run over run, not assumed
from the code change alone. If it recurs even once, the deterministic
backstop is still there to catch it, but the root fix would need
revisiting, not just re-trusting.

## Batch-build compliance filter didn't know about the generator's own demotion — fixed 2026-08-12

Real incident, discovered mid-publish while clearing the 2026-08-09/11
generator queue: "seller-closing-costs-explained" (PR #28) had a clean
Layer 1 report at generation time (`tripped: false`) because
`exclusivity:superlative` is demoted to log-only for this generator's own
articles (see "Layer 1's real-world hit rate," above) — the sentence *"this
is best done with input from your agent and escrow officer"* matched
`SUPERLATIVE_TRIGGER_PATTERN` ("best" within the context window of
"agent"), same idiom-shape gap as the already-documented "best interest"
false positive, just a sentence the narrow idiom exclusion didn't cover.
The article was merged and `published: true` on the strength of that clean
report. But `tools/fetch-blog-data.js`'s `runComplianceFilter()` — the
separate batch-build filter that actually decides what ends up in
`blog-articles.json` — called `scanArticle(a)` with **no options** for
every article regardless of source, so the same finding full-enforce-
tripped there and silently excluded the article from every build. The only
visible trace was one `console.log` line ("EXCLUDED: ...") indistinguishable
from every other routine finding log line in the same run — `published:
true`, a merged PR, and the article never actually live, with nothing
anywhere loud enough to say so.

**Fix, two parts, both required — a filter fix alone would have left the
same class of bug possible under a different disguise:**

1. **Demotion parity.** `runComplianceFilter()` now scopes
   `GENERATOR_LOG_ONLY_FINDING_KEYS` per article via a new
   `isGeneratedArticle()` predicate (`loadGenerated.js` — an article "is
   generated" if it carries a non-empty `sourceTopic`, the same field
   `schema.js` already requires on every article `generate.mjs` produces
   and BabyLoveGrowth articles never have). A generated article gets
   `scanArticle(a, { logOnlyFindingKeys: GENERATOR_LOG_ONLY_FINDING_KEYS })`
   — the exact same call generate.mjs's own `runGates()` already makes at
   generation time; a BabyLoveGrowth article always gets `scanArticle(a)`
   with no options, byte-identical to every build before this change —
   "unaffected by construction, not just by measurement," same discipline
   `GENERATOR_LOG_ONLY_FINDING_KEYS`'s own header comment already states
   for the demotion generally. **Proven, not assumed:** re-run against the
   real, gitignored 28-article frozen BabyLoveGrowth fixture
   (`.articles-cache.json`, the same one this file's prior
   "reverifications" entries used) — all 28 confirmed true BLG shape (no
   `sourceTopic`), 27/28 tripped both before and after this change, zero
   delta. Not committed as an automated test (the fixture itself is
   deliberately gitignored — see `fixture.js`'s header comment — so a
   permanent test depending on it would throw for anyone, including CI,
   without that exact local file); recorded here per this project's
   existing "reverifications" convention instead. Portable, permanent
   regression coverage for the same guarantee lives in
   `fetch-blog-data.test.mjs`'s "demotion parity" describe block, using
   the real seller-closing-costs-explained sentence directly.

2. **The invariant that makes this class of bug impossible to reintroduce
   silently**, because a filter fix only closes the one gap found today —
   `assertNoGeneratedArticleSilentlyDropped()` (new file,
   `tools/silentDropGuard.mjs`, matching `checkRejectedMarker.mjs` /
   `checkAllSilent.mjs` / `internalLinkGate.mjs`'s pattern: single-purpose,
   pure, unit-tested in isolation). Called from `buildAndWrite()` right
   before `writeArticles()`: every generated article that survived
   `mergeArticleSources()` (i.e., wasn't already dropped by a legitimate,
   already-loudly-logged slug collision) must be present in the final
   written array, by slug — if not, **the build fails loudly**
   (`blogComplianceFatal`, same mechanism the trip-rate-exceeded guard
   already uses), naming every missing article by title and slug, before
   `writeArticles()` is ever called (so the previous good
   `blog-articles.json` is left on disk untouched, not overwritten with a
   silently-incomplete one). **Proven RED first**, per this project's own
   discipline: the exact new integration test
   (`fetch-blog-data.test.mjs`, "silent-drop guard, full pipeline") was run
   against the code with the guard's call site commented out — it failed
   (`exit 0`, no FATAL, the drop genuinely silent), confirming the test
   actually catches the bug rather than trivially passing; re-enabled, the
   same test is green. That integration test spawns the real script
   against the real repo with one synthetic published-but-tripping article
   temporarily written into the real `generated-articles/` directory
   (cleaned up in a `finally`, verified gone by a following test) — the
   same "never mocked, prove the actual default path in this actual repo"
   discipline this file's existing tests already use.

Both fixes shipped together, same commit discipline as the
`competitor_mention` fix and the internal-linking fix above: a filter
change and a control-flow invariant are two different classes of risk, and
landing them separately would have left a window where the invariant
didn't exist yet to catch a *different* silent-drop cause.

**Acceptance check:** no prompt or generation-time behavior changed here —
this is entirely inside the build-time batch filter, downstream of
`generate.mjs`. The existing "next article gets a full human read" standing
rule from the two entries above already covers the next real run; this fix
doesn't independently trigger a new one. `seller-closing-costs-explained`
itself was already fixed and re-verified live the same day (reworded "best
done" → "most accurately done," no claim changed) — see the live-sweep
record for 2026-08-12 for the deploy details.

## Identity completeness gate — 2026-08-25 (hardening batch, after PR #35)

**Second real identity-block incident, this one an omission rather than a
wrong value.** PR #35 ("Living in Vail Ranch," 2026-08-23) shipped a closing
paragraph that named George and linked to `/contact/` but dropped
DRE#/brokerage/phone/email entirely — every other published article closes
with the full block. Both compliance gates came back clean (`tripped:
false`); neither was ever designed to catch this, because
`findWrongIdentity()` (`tools/blog-compliance/scan.js`) only ever compares a
*present* DRE/brokerage/phone/email against the reference and flags a
mismatch — it was never asked "is the block there at all." Caught only by
the supervised human PR read (see the Aug 21/23 held-PR read record), fixed
on the PR branch before merge, not waved through. Two real occurrences of
an identity-block gap now (the first being wrong-not-missing, the
motivating case for `findWrongIdentity()` itself) is a pattern, not a
one-off — made structural rather than relying on a third human catch.

**What shipped:**

- `findIdentityCompletenessErrors(article)` (`tools/blog-compliance/scan.js`,
  colocated with `REFERENCE` and `findWrongIdentity()` so there is exactly
  one source of truth for what "correct identity" means) — checks
  `content_html` for all four reference elements independently and returns
  one error string per missing one. Checked against **raw** `content_html`,
  not `htmlToText()`'s stripped output, so a phone/email present only inside
  an `href` (`tel:`/`mailto:`) still counts; phone matching strips every
  digit out of the whole document and checks for the reference number as a
  contiguous substring, tolerant of any formatting without a second phone
  pattern list to keep in sync with `PHONE_PATTERN`.
- Deliberately **not** folded into `scanArticle()`'s own findings/tripped —
  "a genuinely clean article" (`scan.test.mjs`) has zero identity mentions
  at all and must keep passing unchanged; a BabyLoveGrowth-shaped article is
  never contractually required to carry this exact block. Opt-in only, by
  construction, same discipline `GENERATOR_LOG_ONLY_FINDING_KEYS` already
  established for the exclusivity demotion.
- `tools/blog-generator/identityCompletenessGate.mjs` — the generator-
  specific caller, mirroring `internalLinkGate.mjs`'s exact shape
  (`{valid, errors}`) and placement in the pipeline. Wired into
  `generate.mjs` immediately after the internal-link gate, before the
  article is ever written to disk, with its own `failureClass`
  (`identity_incomplete`) alongside `schema_invalid` and
  `internal_link_invalid` in `handleTrippedGate()`'s `FAILURE_CLASSES` set —
  same fail-closed discard/hold path as every other structural gate: a
  draft missing any of the four elements never reaches `outcome:
  'generated'`, writes a rejected-attempt marker (now carrying
  `identityErrors` alongside `schemaErrors`/`internalLinkErrors`), and opens
  the standard rejected-attempt PR.
- **Not** folded into `validateArticleSchema()` (`schema.js`) directly —
  considered and rejected: `schema.test.mjs`'s `validArticle()` fixture and
  roughly twenty per-test `content_html` overrides exist to test citation
  shape/host-policy/marker-consistency, none of them about identity: folding
  the check in there would have forced every one of those tests to start
  carrying identity-block filler text with zero connection to what they
  actually verify. A standalone gate module keeps that blast radius at
  zero — the same reason `internalLinkGate.mjs` isn't inside `schema.js`
  either.
- **Red-first, verified:** `scan.test.mjs` and
  `identityCompletenessGate.test.mjs` were written and confirmed failing
  (the function didn't exist yet) before implementation; both include a
  regression fixture reproducing PR #35's exact real omission verbatim in
  shape (names George, links to `/contact/`, carries none of the four
  elements) and assert it flags all four. `generate.test.mjs` gained a full
  `main()`-level "identity-incomplete discard" describe block mirroring the
  existing schema-invalid/internal-link-invalid ones exactly (both a
  discard case and a passes-cleanly case). Full repo suite green after:
  **451/451** (`node --test` across every `*.test.mjs` under `tools/`).

**Acceptance check:** no prompt or generation behavior changed beyond adding
this fourth structural gate — the standing "next article gets a full human
read" discipline from earlier entries isn't independently re-triggered by
this change alone, since it doesn't touch the writer prompt or either
compliance gate's judgment. Not yet exercised against a live model call
(no `ANTHROPIC_API_KEY` in this session) — proven by test, same disclosed
limit this file's own "Why seven layers" section already states about any
gate before its first real run.

## Weekly retrospective, real — 2026-08-25 (hardening batch, item 2/3)

The compensating control §4 of "Automated publishing" above had committed
to since 2026-08-03 — a standing weekly six-category read of everything
auto-published that week — had, per git history, **never actually run
once** in the ~3 weeks since the decision. This entry closes that gap:
real implementation, plus a one-time catch-up backfill covering everything
currently live.

**Re-based 2026-08-31:** with the auto-publish path this audit originally
compensated for now retired (see "Automated publishing," above), this job
continues unchanged — same schedule, same six categories, same scope,
same rollback line — as the standing content-quality audit for
**everything this pipeline has published, full stop**, not specifically a
control for a gap that no longer exists. Nothing below needed to change
except the reason it exists.

### The ongoing job

`.github/workflows/weekly-retro.yml` — Monday, 15:00 UTC / 8am Pacific
(`workflow_dispatch` also available). Scope is **everything published in
the prior 7 days**, determined from git ground truth
(`tools/blog-generator/retroPublishLog.mjs`, parsing `blog: publish`/
`blog: auto-publish` commit subjects on `main`) — deliberately **not**
`jsonLd.datePublished`, which is generation time and can sit days before
the actual publish flip on a held PR (exactly PR #34/#35's own shape:
generated 2026-08-21/23, published 2026-08-25).

Four of the six categories are fully deterministic, reusing existing,
already-tested infrastructure rather than re-implementing a judgment call
this pipeline already made once (`tools/blog-generator/retroAudit.mjs`):

- **identity block** — `findIdentityCompletenessErrors()` (item 1, above)
  plus `scanArticle()`'s wrong-dre/wrong-brokerage/wrong-phone/wrong-email
  findings — catches both a missing block and a wrong one.
- **prohibited claims** — `scanArticle()`, same generator demotion options
  `generate.mjs`'s own Layer 1 already uses.
- **stats-vs-citations** — `findUncitedClaims()` (log-only candidates) plus
  a **live re-resolution of every citation URL**
  (`citationResolver.mjs`) — a genuine re-check, not a replay: a citation
  that resolved at generation time can rot (page moved, statute
  renumbered) by the time the retro runs weeks later.
- **quality/rendering** — `evaluatePublishStatus()`
  (`publishStatusReport.mjs`, already built for exactly this) plus its own
  live serve check.

The remaining two need judgment a regex cannot supply:
**fabricated speech** and **misattributed quotes** — a fresh, independent
LLM call (`retroClaimGate.mjs`), same "different model, structured
tool-use" discipline as Layer 2, asking a narrower pair of questions than
Layer 2 ever did (Layer 2 runs pre-publish and never asked about fabricated
speech at all). If `ANTHROPIC_API_KEY` is ever unset, this is **never**
silently treated as clean — every article in scope gets an explicit
`NEEDS-FIX` reason saying the check was skipped, so a missing secret shows
up loud in the report, exactly the same "don't parse logs, don't guess"
discipline this pipeline already applies everywhere else.

Per-article verdict is `CLEAR` / `NEEDS-FIX` / `REJECT`
(`computeArticleVerdict()`, pure, unit-tested independently of the I/O
around it): `REJECT` is reserved for a genuine defect on a page real
visitors are reading right now (missing/wrong identity, a real Layer-1
trip, a dead/unsupported citation, fabricated speech, a misattributed
quote, an incomplete publish sequence, or a failed live check);
`NEEDS-FIX` is real signal at lower severity (a demoted finding, an
uncited-claim candidate, an inconclusive/bot-blocked citation, or a check
this environment couldn't run). The report — rendered by
`renderRetroReport.mjs` — is **committed to `docs/retros/` regardless of
outcome**, same "a gate trip is not silent" rule as the rejected-attempt
marker mechanism: evidence must never disappear just because the run found
something. The job itself goes red ("loud if it finds anything," per
instruction) whenever any article has any finding at all, `NEEDS-FIX`
included, not just on `REJECT`.

### The backfill — 2026-08-03 → 2026-08-25

`docs/retros/2026-08-03-to-2026-08-25-backfill.md` — the one-time catch-up
for everything owed since the 2026-08-03 decision, covering all 17 live
articles (not a 7-day window; the ongoing job is what's scoped that way
going forward). Run for real against this repo, not a dry run:

- **Found and fixed a real live defect**: `seller-closing-costs-explained`
  (PR #28, published 2026-08-13) carried **zero** of DRE/brokerage/phone/
  email anywhere in `content_html`, despite naming George twice — a
  **third** real occurrence of the identity-omission gap item 1 above made
  structural, this one already live before that gate existed. Fixed in the
  same session: standard identity paragraph added, `dateModified` bumped,
  rebuilt, re-verified, deployed.
- **Found and fixed a false positive in item 1's own new gate**: two
  already-published articles write the DRE number as `DRE: 02034120` (a
  colon), a real live form the identity regex didn't yet tolerate (`#` or
  nothing, not `:`) — caught by running the backfill against real content
  instead of only synthetic fixtures, fixed with a widened regex and a
  regression test using the real colon-separated shape.
- **fabricated speech / misattributed quotes**: no `ANTHROPIC_API_KEY` in
  this session, so the automated LLM check couldn't run across all 17 —
  disclosed as its own finding per article, not silently skipped as clean.
  3 of 17 spot-checked by hand instead (chosen for risk diversity: the
  highest-citation-count article, a citation-free neighborhood guide, and
  the article the automated pass had just flagged for a real defect) — all
  three clear. The other 14 are not re-read blind; the backfill report
  documents each one's original supervised or owner-delegated read record
  (commit references) instead, per this project's own "owner-delegated
  reads" precedent — re-reading 14 articles with no new signal to act on
  would be busywork, not diligence, when the actual open gap (identity
  completeness) was already checked directly against all 17.
- **Final state**: 0 unresolved REJECTs, 1 disclosed standing gap (the
  LLM check pending a live run with the real secret, which the ongoing
  Monday job now provides automatically going forward).

### Not yet exercised

Same disclosed limit as item 1's own closing note: neither `retroClaimGate.mjs`
nor the ongoing workflow has run yet against a live model call in
production — proven by test and by the backfill's real (non-mocked)
citation-resolution and live-serve checks, not yet by a real Monday
firing. The first real scheduled (or manually dispatched) run is that
proof, same as every other gate in this pipeline before its own first
live run.

## Publish-on-merge — 2026-08-25 (hardening batch, item 3/3)

Before this, merging a held (non-silent) generator PR only did half the
job — the article landed on `main`, still `published: false`, and a human
had to remember to run the rest of the sequence by hand afterward in a
separate terminal session (`setPublished.mjs`, `headersCacheEntry.mjs`,
`fetch-blog-data.js`, commit, push — exactly what happened for PR #34/#35
earlier the same day this item was built). `.github/workflows/
publish-on-merge.yml` closes that gap: **the merge itself** now triggers
the full sequence automatically, whoever merges it and from wherever
(explicitly including the GitHub mobile app, which can't run a terminal).

### Scope and trigger

`pull_request: types: [closed]`, gated `if: github.event.pull_request.merged
== true && startsWith(github.event.pull_request.head.ref,
'blog-generator/auto-')` — real-article PRs only, never a
`blog-generator/rejected-*` marker PR (nothing to publish there). Fires for
a perfectly-silent PR too (the event doesn't distinguish who/what merged
it), which is exactly what the idempotency guarantee below exists for.

### The sequence — `tools/blog-generator/publishOnMerge.mjs`

1. **Determine the slug** from the merge commit itself
   (`getMergedArticleSlug()` — `git diff --name-only --diff-filter=A
   <sha>~1 <sha> -- src/data/generated-articles/`, excluding `.rejected/`)
   rather than trusting the PR title/body — ground truth from the actual
   diff, same "derive, don't trust a stored label" discipline as
   `topicAvailability.mjs`. Fail-closed on 0 or >1 added article files;
   never guesses. (`~1`, not `^`, for the parent ref — `^` is a cmd.exe
   escape character and gets mangled by `execSync`'s default shell on
   Windows even though the real runtime is `ubuntu-latest`; found by
   actually running this against real merge commits during development,
   not assumed.)
2. **IDEMPOTENT by construction, not a special-cased flag**:
   `evaluatePublishStatus()` (`publishStatusReport.mjs`, already built for
   exactly this) checks real repo state first. Already fully published
   (this workflow re-firing for the same PR; historically also possible if
   the since-retired auto-publish path had already handled it, see
   "Automated publishing" above) → clean no-op, nothing written, nothing
   committed. Every write this
   script can make already goes through a function that's itself a no-op
   at the target state (`setPublishedInJson`'s `changed` flag,
   `insertCacheEntry`'s `inserted` flag) — re-running this workflow twice
   for the same PR is always safe.
3. **`published: true`** — `setPublishedInJson()` (reused directly,
   unmodified, from `setPublished.mjs`).
4. **`_headers` cache pair** — `insertCacheEntry()` (reused directly from
   `headersCacheEntry.mjs`). **CAP-GUARD**: already throws, unmodified, at
   the 100-rule limit — this script does NOT catch that. It propagates to
   a non-zero exit, which fails the workflow step before any commit/push
   (bash's default `-e`), leaving the article merged on `main` but
   `published: false` — a safe, visibly-incomplete state requiring a human
   to notice the red run and finish by hand.
5. **Regenerate `blog-articles.json`** — `node tools/fetch-blog-data.js`,
   a separate workflow step gated on `already_complete == 'false'`. Not
   strictly required for the live site, since Cloudflare Pages' own build
   re-runs `fetch-blog-data.js` fresh on every deploy anyway, but it's the
   established human-publish-sequence convention this workflow is
   explicitly automating, per instruction: "flip + _headers + regenerate +
   push."
6. **One atomic commit, push** — the merge itself is the human decision,
   there's no separate judgment call to represent as two commits.

### GITHUB_TOKEN cascade note

This push uses the default `GITHUB_TOKEN`. GitHub does not trigger OTHER
workflows' `push:` triggers from a `GITHUB_TOKEN`-authored push
(loop-prevention, by design) — so this commit does **not** automatically
re-run `build-check.yml` the way a normal human push would. The site still
updates correctly (Cloudflare Pages' GitHub App integration is a separate
mechanism, not a `GITHUB_TOKEN`-triggered workflow, and deploys regardless)
— what's missing is the automatic post-publish build confirmation a human
push gets for free. Residual risk is low (`blog-articles.json`'s
regeneration is deterministic, already covered by
`fetch-blog-data.test.mjs`, and the cap-guard above is the one way this
write path is known to fail) but not zero. If this ever needs closing, the
fix is a PAT-backed push instead of `GITHUB_TOKEN` — not something to
silently assume is already covered.

### First live firing (2026-08-30/31): 0-for-1, three fixes

This workflow fired for real for the first time on PR #38 (2026-08-30,
run 33363712388) and failed. It had never once completed a publish before
that night, and because it only ever runs post-merge (`on: pull_request:
types: [closed]`), ordinary CI on a branch/PR never exercises it — exactly
why the bug below went undetected through the workflow's entire existence
until it actually mattered.

**Root cause.** The checkout step declared `ref: main` with no
`fetch-depth`, so `actions/checkout@v4` cloned at its default depth of 1 —
the merge commit only, no parent. `getMergedArticleSlug()` then ran
`git diff --name-only --diff-filter=A <merge-sha>~1 <merge-sha> --
src/data/generated-articles/` to find what the PR added (see the sequence
above, step 1) — but `<merge-sha>~1` doesn't exist in a depth-1 clone. Git
returned `fatal: bad revision '<sha>~1'`, `getMergedArticleSlug()` threw,
and the step exited 1 **before any write**, exactly as CAP-GUARD's
documented failure mode above promises: the article stayed merged on
`main` but `published: false` — safe, visibly incomplete, not silently
wrong. A human (this repo's recovery pass) noticed the red run and
finished the sequence by hand.

**Fix 1 — `fetch-depth: 2`.** The merge commit checked out here IS `main`'s
tip (this workflow only ever runs post-merge), so its first parent is
exactly the second commit a depth-2 clone includes — nothing this workflow
diffs is ever more than one commit back. `fetch-depth: 0` (full history)
would also fix it and is more robust against some future change to what
this workflow diffs, but costs a full clone for a need depth 2 already
covers completely — not chosen. A textual regression guard now asserts the
checkout step declares `fetch-depth: 0` or `>= 2`
(`publishOnMergeWorkflow.test.mjs`) — since ordinary CI can't exercise this
workflow's actual run, at minimum its static shape gets checked on every
PR.

**Fix 2 — the red-run email was asserting a cause it had no evidence
for.** The original notification's `--detail` was a hardcoded Russian
string written when this workflow was built (2026-08-25), guessing the
most plausible failure mode in advance: *"вероятно, превышен лимит
_headers (100 правил Cloudflare Pages)"* ("probably the _headers 100-rule
limit"). That guess was frozen into the workflow file itself, to be sent
on **every** future red run regardless of what actually happened. On this
workflow's first real failure, it was wrong — the cause was the
shallow-checkout bug above, and `_headers` was sitting at 44/100, nowhere
near the cap. **This is the finding most worth writing down**: a
monitoring path that guesses is worse than one that reports nothing,
because it spends the reader's attention in the wrong direction — a human
reading "probably the _headers cap" goes and checks `_headers` first,
finds nothing wrong, and has learned nothing about the real problem.
Replaced with `buildFailureDetail()` (`publishOnMerge.mjs`, tested in
`publishOnMerge.test.mjs`): the publish step now runs with `set -o
pipefail` and pipes its output through `tee /tmp/publish-on-merge.log` (
`pipefail` is what makes the step still fail on `node`'s exit code through
the pipe — verified directly: `false | tee x` alone exits 0, `set -o
pipefail; false | tee x` exits 1 — without it a real failure would report
green), and the failure-email step reads that log
(`--detail-log=/tmp/publish-on-merge.log`) instead of asserting a fixed
string. `buildFailureDetail()` reports the real captured error verbatim
(capped at 2000 chars, keeping the tail — the actual thrown error is
almost always the last thing in the log, not the `npm ci` noise at the
top), with exactly one named exception: `insertCacheEntry`'s own 100-rule
cap-guard error (identifiable by its `"rule limit"` text) really is
diagnostic and gets called out specifically. An empty or unreadable log
gets the neutral *"publish sequence failed after merge; the article is
merged on main but published:false — see the run log"* — no cause named,
because none is known.

**Fix 3 — the alert couldn't name the stranded article.** Because last
night's failure happened inside `getMergedArticleSlug()` itself, `steps.
publish.outputs.slug` was never set, and the email could only point at a
PR number. Traceable by hand for one stranded article; not for several
during a backfill. `runPublishOnMerge()` now takes an `onSlugKnown`
callback, fired the moment the slug resolves — before any read/write work
— and the CLI wires it straight to `$GITHUB_OUTPUT` (`slug=<slug>`), so a
LATER failure (the cap-guard throw, or anything else past that point)
still leaves the slug behind for the failure email. The workflow always
passes `--slug="${{ steps.publish.outputs.slug }}"` (possibly empty)
rather than omitting the flag, so `buildNotificationEmailCli.mjs` can tell
"resolved to nothing" apart from "this caller has no slug concept at all"
(`generate-article.yml`'s unrelated generic-failure path, which never
passes `--slug` and is completely unaffected — see `buildFailureEmail`'s
three-way `slug` contract: `undefined` omits the line, `null`/empty says
*"slug could not be determined; the failure occurred before the article
was identified,"* a real string names it). That sentence is itself
diagnostic: it tells the reader the failure was early, in slug resolution,
not in the write phase.

**What's proven by test vs. not.** All three fixes are proven by unit/
regression test only — `publishOnMergeWorkflow.test.mjs` (the fetch-depth
guard, confirmed failing against the pre-fix file before this was
written), `publishOnMerge.test.mjs` (`onSlugKnown` fires before any write
and survives a later throw; `buildFailureDetail`'s three branches), and
`notificationEmail.test.mjs` (`buildFailureEmail`'s three-way `slug`
contract) — plus the idempotency path (`evaluatePublishStatus`) was
re-verified by hand to still no-op cleanly against the already-published
new-construction article. **Re-running the failed run
(33363712388) would prove nothing** — a `pull_request` re-run uses the
workflow file as it existed at the triggering ref, not this fix, so that
was deliberately not attempted. First real proof is the next generator PR
this workflow fires against for real — same disclosed limit this file
already applies to every gate before its first live firing (see this
workflow's own "0-for-1" opening line above, now closed by this entry, and
open again for whatever the next thing it hasn't yet seen turns out to
be).

### PR body: preview link + gate summary at top

A separate, small piece, wired into `generate-article.yml` itself (not
`publish-on-merge.yml`) — added specifically so a human deciding whether
to merge from the GitHub mobile app doesn't have to scroll a long report
first. Right after PR creation, a new step polls the commit's "Cloudflare
Pages" check-run (`updatePrPreviewLink.mjs`'s `pollForCheckRunSummary()`,
up to 5 minutes) and, once it completes, extracts the **Branch Preview
URL** from its HTML summary (`previewUrlExtract.mjs` —
`extractBranchPreviewUrl()`, built against a real captured summary from
PR #35's own check-run, not guessed from Cloudflare's docs; the branch URL
is stable across every push to the same branch, unlike the per-commit hash
URL, which would go stale on the next review-and-edit commit). Prepends
that link plus a one-line gate summary
(`gateSummaryLine.mjs` — "Perfectly silent" or "Layer 1: clean · Layer 2:
clean · Layer 3: TRIPPED · Self-review: 2 correction(s)") inside a marked
HTML-comment block (`buildUpdatedPrBody()`) — idempotent, replacing rather
than stacking a second block if the PR gets edited and this ever ran
twice.

No GitHub Deployments API entry exists for Cloudflare's integration on
this repo (checked directly: `repos/{owner}/{repo}/deployments` returns
`[]`), so the check-run's own HTML output is the only reachable source for
this URL — there's no structured API field to read instead.

**Deliberately never a gate**: `continue-on-error: true` on the calling
workflow step, and the script itself catches its own top-level errors and
exits 0 either way (see `updatePrPreviewLink.mjs`'s header comment). A
network hiccup or a future change to Cloudflare's summary HTML shape costs
a human the top-of-body convenience, never the underlying report — the
full detailed gate report is always still the rest of the body underneath.

### First live test

Not yet exercised against a real merge — the next held PR merged (from the
GitHub mobile app, per the instruction that specifically asked for this)
is the first real end-to-end proof, same disclosed-limit pattern as items
1 and 2 above. Proven so far: `getMergedArticleSlug()` and
`pollForCheckRunSummary()`/`extractBranchPreviewUrl()` were run for real
against this repo's actual merge commits and actual Cloudflare Pages
check-runs during development (not mocked), and the full orchestration
(`runPublishOnMerge()`) is unit-tested including the idempotent-no-op path
verified against this session's own already-published articles.

## Email notifications — 2026-08-25

Four triggers across `generate-article.yml` and `publish-on-merge.yml`,
each sending an HTML email via Gmail SMTP. **Non-gating everywhere**: every
notify step sets `continue-on-error: true`, and the composite action
itself (`.github/actions/notify-email/`) has its own internal guard as a
second, independent layer — a missing secret or an SMTP failure can never
fail or block the pipeline.

### Setup — two secrets, set by the repo owner

```
gh secret set NOTIFY_SMTP_USERNAME --repo drstas-cyber/IGOR_r
gh secret set NOTIFY_SMTP_PASSWORD --repo drstas-cyber/IGOR_r
```

Each prompts for the value interactively (safer than `--body "..."` on the
command line, which leaves the value in shell history) — paste and press
Enter/Ctrl-D. `NOTIFY_SMTP_USERNAME` is the sending Gmail address (also
used as the `from:`). `NOTIFY_SMTP_PASSWORD` is a **Gmail App Password**
(Google Account → Security → 2-Step Verification → App passwords) — not
the regular account password; Gmail's SMTP no longer accepts a bare
account password for third-party auth.

**STOP-note, stated exactly as instructed:** until both secrets exist,
every notify step no-ops cleanly — a log line
(`[notify-email] NOTIFY_SMTP_USERNAME/NOTIFY_SMTP_PASSWORD not set --
skipping...`), never a failure, never a red step. Nothing else in either
workflow is affected either way.

### Mechanism

[`dawidd6/action-send-mail`](https://github.com/dawidd6/action-send-mail)
— chosen because it's a maintained, widely-used thin SMTP wrapper
purpose-built for exactly this (Actions has no built-in mail primitive),
needs no extra runtime, and supports Gmail SMTP with an app password
directly. `smtp.gmail.com:465`, `secure: true`.

Wrapped in a local composite action, `.github/actions/notify-email/`,
rather than repeating the same ~15 lines at all 8 call sites (4 triggers ×
2 non-published-path workflows, plus the manual test workflow) — one
place owns the "check secrets, no-op cleanly, else send" logic.

### Recipient — one-line change to add George

Single recipient today: `drstas@gmail.com`, the composite action's own
`to:` input **default** (`.github/actions/notify-email/action.yml`). None
of the 8 call sites pass `to:` explicitly — they all fall through to that
one default — so adding George's address later really is a one-line
change: edit that one `default:` value (e.g. to
`drstas@gmail.com,george@...`), nowhere else.

### The four triggers

1. **Article PR opened** (`generate-article.yml`) — `📝 Новая статья ждёт
   проверки: <title>`. Body: first paragraph of the article
   (`extractFirstParagraphText()`, plain text, truncated at a word
   boundary), the Cloudflare Pages preview link (reused directly from the
   "Update PR body" step's own already-polled result — one poll, two
   consumers, not a second poll), the one-line gate summary
   (`gateSummaryLine.mjs`, reused from item 3), and the PR link (tap it to
   open the PR and merge from the phone).

   **UPDATED 2026-08-31:** this used to be gated on `all_silent !=
   'true'`, on the reasoning that a perfectly-silent run's PR opened and
   auto-merged/auto-published within the same job run, seconds apart, so
   "a new article awaits your review" would have been actively misleading
   by the time the email could be read. That auto-publish path is retired
   (see "Automated publishing," now superseded) — every real article PR
   now gets exactly this one notification regardless of `allSilent`,
   because it genuinely does await review; there's no longer a separate
   silent-publish trigger to avoid double-notifying about.

2. **Rejected-attempt PR opened** (`generate-article.yml`) — `⛔ Статья
   отклонена воротами: <topic>`. Body: the failure class
   (`deriveFailureClassLabel()` — schema_invalid / internal_link_invalid /
   identity_incomplete / gate_trip, mirroring `handleTrippedGate()`'s own
   classification), a condensed findings summary
   (`summarizeRejectionFindings()`, capped at 8 lines — non-demoted Layer 1
   findings, every true Layer 2 checklist flag with its evidence, Layer 3
   failed/unsupported citations, schema/internal-link/identity errors —
   demoted/log-only Layer 1 findings deliberately excluded, since they
   didn't cause the rejection), and the PR link.

3. **Publish completed** — `✅ Опубликовано: <title>`. **UPDATED
   2026-08-31:** fires from `publish-on-merge.yml`'s own publish step
   only, now the sole publish mechanism (only when `already_complete ==
   'false'` there — the idempotent no-op path sends nothing, correctly,
   since nothing was actually published that run); the silent
   auto-publish step in `generate-article.yml` this used to also fire from
   is retired. Body: the live URL and the `publishStatusReport` verdict
   (`evaluatePublishStatus()`, reused directly — `--skip-live`
   equivalent, i.e. the three LOCAL checks only, not a synchronous live
   fetch immediately after a push that may not have propagated yet; the
   live URL is included so Stan can tap through and check himself).

4. **Red runs** — subject prefix as of 2026-08-31 depends on
   `failureClass` (`buildFailureEmail`'s `no_article` → `🔴 Сбой
   генерации: <reason>`, unchanged; `article_stranded` → `🟠 Статья
   существует, но не опубликована: <reason>` — see the notification-
   hardening pass's decision record below for why the subject needed to
   distinguish "nothing was produced" from "an article exists but didn't
   go live"). Two independent call sites: `generate-article.yml` (gated on
   `failure()` AND neither PR type having opened — a gate trip/schema/
   link/identity discard already gets its own trigger-2 email; this
   specifically covers the failure modes that leave no PR at all, e.g.
   queue-exhausted, a missing `ANTHROPIC_API_KEY`, an uncaught exception,
   or generation succeeding but a LATER step failing) and
   `publish-on-merge.yml` (gated on `failure()` generally, always
   `failureClass=article_stranded` — that workflow only ever runs
   post-merge, so an article always already exists by the time it can
   fail). Body: as of 2026-08-31, a structured-first detail — see
   `checkGenerateFailureReason.mjs` (generate-article's side) and
   `buildFailureDetail` (publish-on-merge's side) in the notification-
   hardening pass's decision record below; both replaced an earlier
   hardcoded guess that turned out wrong on its actual first live firing.

### Content pipeline

`tools/blog-generator/notificationEmail.mjs` — four pure, unit-tested
builder functions (`buildArticlePrEmail`, `buildRejectedPrEmail`,
`buildPublishedEmail`, `buildFailureEmail`), plus the two extraction/
condensing helpers above. `buildNotificationEmailCli.mjs` is the thin,
untested-by-design glue (matching this repo's "pure core, thin I/O shell"
split everywhere else) — reads the relevant JSON/args per `--kind=`,
calls the right builder, writes `subject`/`html_body` to `$GITHUB_OUTPUT`
(the multiline body uses GitHub's own random-delimiter heredoc syntax, so
the body text itself can never collide with and truncate the block). Never
throws past its own top-level catch — a bug here costs a missing email,
never a red pipeline, same guarantee `updatePrPreviewLink.mjs` (item 3)
already established for the exact same class of convenience feature.

### Test path

`.github/workflows/test-email-notifications.yml` — `workflow_dispatch`
only, with a `kind` input (`all` or one specific template). Writes
synthetic report fixtures (one pointed at a real, already-published,
never-modified article file for the article-pr template's first-paragraph
extraction; a real already-published slug for the published template —
read-only throughout, safe to run any time) and runs the exact same
build-and-send path as production, with a `[ТЕСТ]` subject prefix so a
real test email is never mistaken for a real pipeline notification. Proves
two different things depending on whether the secrets exist yet: **before**
they exist, it proves the no-op behavior (a clean log line, no failure);
**after**, it proves the whole path end-to-end including real SMTP
delivery — the templates were all rendered and verified locally against
these exact fixtures during development (see the CLI's own stdout capture
in this session's record), and this workflow is the same path, running in
the real CI environment.

**The real end-to-end (a genuine cron-triggered or merge-triggered email)
waits for the two secrets plus the next real cron/merge event** — not yet
exercised in production, same disclosed-limit pattern as items 1-3 of the
prior hardening batch before their own first live runs.

