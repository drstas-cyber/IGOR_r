// THE PATH TABLE — every branch through the blog-generator pipeline, with
// the thing that forces it and the date it was last observed working.
// Created 2026-09-03 under the "no unfired paths" hardening order, which
// replaced incident-driven patching: the standard is no longer "we fixed
// the bug that bit us," it is "every path has something that executes it,
// and anything that cannot be executed has a watchdog that detects its
// failure."
//
// WHY THIS IS DATA AND NOT A MARKDOWN TABLE. A hand-maintained table in
// README.md rots silently: someone adds an outcome to generate.mjs, the
// table doesn't grow a row, and the pipeline is back to having unfired
// paths that nobody knows about. pipelinePaths.test.mjs reads THIS file
// and cross-checks it against the real source -- every `report.outcome =`
// literal in generate.mjs, every `kind === '...'` branch in
// buildNotificationEmailCli.mjs, every failureClass in handleTrippedGate()
// -- and fails if the code grows a branch this table doesn't enumerate.
// It also verifies that every `forcing.test` string actually resolves to
// a real test title in a real test file, so a renamed or deleted test
// cannot leave a row silently claiming coverage it no longer has.
//
// The README table is GENERATED from this file's contents, never
// hand-typed alongside it.
//
// HONESTY RULES, applied to every row without exception:
//   - `forcing.kind` says what KIND of proof exists, and the kinds are
//     not interchangeable. `e2e` (runs main() for real against a mocked
//     API) is stronger than `unit` (pure function), which is stronger
//     than `static` (asserts workflow YAML text without executing it),
//     which is NOT proof of execution at all. `drill` means a real
//     workflow run against fixtures. `observed` means it ran in
//     production on a real date and cannot be re-run on demand.
//   - `lastObserved` is the date the proof last actually ran green. For
//     unit/e2e rows that is the date the suite last ran; for `observed`
//     rows it is the real production run date, and it does not advance
//     on its own.
//   - A row with `watchdog` instead of `forcing` is an admission: this
//     path CANNOT be forced. The watchdog field names what detects its
//     failure instead. Never dress one of these up as covered.

// KINDS, in descending order of strength. Exported so the test can assert
// no row invents a kind outside this set.
export const FORCING_KINDS = new Set(['e2e', 'unit', 'drill', 'static', 'observed']);

export const CATEGORIES = new Set([
  'generation',
  'topic-selection',
  'pr-opening',
  'human-action',
  'publish-on-merge',
  'email',
  'cron',
  'retro',
]);

// SUITE_DATE — the date the unit/e2e suite last ran green in full. Bumped
// deliberately when the suite is run and observed green, never
// automatically from a clock: an auto-advancing date would make every row
// look freshly verified whether or not anything ran.
export const SUITE_DATE = '2026-09-03';

export const PIPELINE_PATHS = [
  // ---------------------------------------------------------------- generation
  {
    id: 'GEN-01',
    category: 'generation',
    name: 'Clean run — both gates pass, article written, outcome "generated"',
    outcome: 'generated',
    forcing: { kind: 'e2e', file: 'generate.test.mjs', test: 'a clean run (both gates pass) exits zero and writes a real article, no rejected marker' },
    lastObserved: SUITE_DATE,
    alsoObservedLive: '2026-08-31 (run 33428265910, PR #40)',
  },
  {
    id: 'GEN-02',
    category: 'generation',
    name: 'Layer 1 regex scanner trips (enforce category) — draft discarded',
    outcome: 'skipped',
    forcing: { kind: 'e2e', file: 'generate.test.mjs', test: 'a Layer 1 tenure finding trips the gate end-to-end' },
    lastObserved: SUITE_DATE,
    note: 'GAP CLOSED 2026-09-03. Previously believed-only: Layer 1 trips were exercised solely by feeding handleTrippedGate() a synthetic report with layer1.tripped preset. Layers 2 and 3 both already had real end-to-end trips.',
  },
  {
    id: 'GEN-03',
    category: 'generation',
    name: 'Layer 2 independent LLM claim review trips — draft discarded',
    outcome: 'skipped',
    forcing: { kind: 'e2e', file: 'generate.test.mjs', test: 'a Layer 2 trip exits non-zero, writes no real article file, and DOES write a rejected marker' },
    lastObserved: SUITE_DATE,
    alsoObservedLive: '2026-09-01 (run 33537219946, PR #41 — a false positive, see the Layer 2 FP tally)',
  },
  {
    id: 'GEN-04',
    category: 'generation',
    name: 'Layer 3 citation resolution — FAILED (dead link) trips',
    outcome: 'skipped',
    forcing: { kind: 'e2e', file: 'generate.test.mjs', test: 'a citation that 404s trips the gate' },
    lastObserved: SUITE_DATE,
  },
  {
    id: 'GEN-05',
    category: 'generation',
    name: 'Layer 3 — RESOLVED_UNSUPPORTED (URL resolves, cited content absent) trips',
    outcome: 'skipped',
    forcing: { kind: 'e2e', file: 'generate.test.mjs', test: 'a citation that resolves 200 but fails body verification trips the gate as RESOLVED_UNSUPPORTED' },
    lastObserved: SUITE_DATE,
  },
  {
    id: 'GEN-06',
    category: 'generation',
    name: 'Layer 3 — inconclusive (403 bot-block) does NOT trip, host logged',
    outcome: 'generated',
    forcing: { kind: 'e2e', file: 'generate.test.mjs', test: 'a citation that 403s does NOT trip' },
    lastObserved: SUITE_DATE,
  },
  {
    id: 'GEN-07',
    category: 'generation',
    name: 'Schema validation fails — draft discarded',
    outcome: 'schema_invalid',
    forcing: { kind: 'e2e', file: 'generate.test.mjs', test: 'both gates pass but schema validation fails' },
    lastObserved: SUITE_DATE,
  },
  {
    id: 'GEN-08',
    category: 'generation',
    name: 'Internal-link gate fails (hallucinated URL) — draft discarded',
    outcome: 'internal_link_invalid',
    forcing: { kind: 'e2e', file: 'generate.test.mjs', test: 'an invented internal link discards the run' },
    lastObserved: SUITE_DATE,
  },
  {
    id: 'GEN-09',
    category: 'generation',
    name: 'Identity-completeness gate fails — draft discarded',
    outcome: 'identity_incomplete',
    forcing: { kind: 'e2e', file: 'generate.test.mjs', test: 'a draft missing the identity block discards the run' },
    lastObserved: SUITE_DATE,
    alsoObservedLive: '2026-09-03 (run 33782401146, PR #42) and 2026-08-29 (run 33265677614, PR #39)',
  },
  {
    id: 'GEN-10',
    category: 'generation',
    name: 'Topic queue exhausted — no report written, ::error:: sentinel in the log',
    outcome: '(none — deliberately writes no report)',
    forcing: { kind: 'e2e', file: 'generate.test.mjs', test: 'the queue-exhausted path is UNCHANGED by this pass' },
    lastObserved: SUITE_DATE,
  },
  {
    id: 'GEN-11',
    category: 'generation',
    name: 'Early exit — ANTHROPIC_API_KEY missing',
    outcome: 'missing_api_key',
    forcing: { kind: 'e2e', file: 'generate.test.mjs', test: 'missing ANTHROPIC_API_KEY: exits 1' },
    lastObserved: SUITE_DATE,
  },
  {
    id: 'GEN-12',
    category: 'generation',
    name: 'Early exit — GITHUB_REPOSITORY missing',
    outcome: 'missing_repository',
    forcing: { kind: 'e2e', file: 'generate.test.mjs', test: 'missing GITHUB_REPOSITORY: exits 1' },
    lastObserved: SUITE_DATE,
  },
  {
    id: 'GEN-13',
    category: 'generation',
    name: 'Uncaught exception during topic selection — try/catch boundary writes a report',
    outcome: 'uncaught_exception',
    forcing: { kind: 'e2e', file: 'generate.test.mjs', test: 'a fail-closed throw during topic selection' },
    lastObserved: SUITE_DATE,
  },
  {
    id: 'GEN-14',
    category: 'generation',
    name: 'Self-review over-strips a valid internal link — deterministic restore backstop fires',
    forcing: { kind: 'e2e', file: 'generate.test.mjs', test: 'self-review wrongly strips a valid known-route link' },
    lastObserved: SUITE_DATE,
  },
  {
    id: 'GEN-15',
    category: 'generation',
    name: 'Layer 1 log-only demotion — an uncited-claim candidate is reported but does NOT trip',
    forcing: { kind: 'e2e', file: 'generate.test.mjs', test: 'an uncited number appears in the report but does NOT trip the gate' },
    lastObserved: SUITE_DATE,
  },
  {
    id: 'GEN-16',
    category: 'generation',
    name: 'Self-review receives no Known-live-routes list (2026-08-31 root fix holds)',
    forcing: { kind: 'e2e', file: 'generate.test.mjs', test: 'the self-review request never offers a "Known live routes" list' },
    lastObserved: SUITE_DATE,
  },

  // ----------------------------------------------------------- topic selection
  {
    id: 'TOP-01',
    category: 'topic-selection',
    name: 'A real article file on main marks its topic attempted',
    forcing: { kind: 'unit', file: 'topicAvailability.test.mjs', test: 'a real generated-article file with sourceTopic is included' },
    lastObserved: SUITE_DATE,
  },
  {
    id: 'TOP-02',
    category: 'topic-selection',
    name: 'A rejected marker on main blocks its topic permanently',
    forcing: { kind: 'unit', file: 'topicAvailability.test.mjs', test: 'a rejected-attempt marker under .rejected/ is included too' },
    lastObserved: SUITE_DATE,
  },
  {
    id: 'TOP-03',
    category: 'topic-selection',
    name: 'gh pr list failure is fail-closed — throws rather than guessing the queue is empty',
    forcing: { kind: 'unit', file: 'topicAvailability.test.mjs', test: 'gh pr list failure THROWS, does not silently return empty' },
    lastObserved: SUITE_DATE,
  },

  // --------------------------------------------------------------- PR opening
  {
    id: 'PR-01',
    category: 'pr-opening',
    name: 'Article PR opens (has_new_article=true path in generate-article.yml)',
    forcing: { kind: 'observed', file: '.github/workflows/generate-article.yml', test: 'Open PR with the generated article' },
    lastObserved: '2026-08-31',
    note: 'Real production run 33428265910 -> PR #40. Also exercised by the weekly drill (DRILL-01).',
  },
  {
    id: 'PR-02',
    category: 'pr-opening',
    name: 'Rejected-marker PR opens (has_rejected_marker=true path)',
    forcing: { kind: 'observed', file: '.github/workflows/generate-article.yml', test: 'Open PR for rejected attempt' },
    lastObserved: '2026-09-03',
    note: 'Real production run 33782401146 -> PR #42.',
  },
  {
    id: 'PR-03',
    category: 'pr-opening',
    name: 'checkRejectedMarker three-state: marker present -> "true"',
    forcing: { kind: 'unit', file: 'checkRejectedMarker.test.mjs', test: 'directory exists with a new untracked marker file -> "true"' },
    lastObserved: SUITE_DATE,
  },
  {
    id: 'PR-04',
    category: 'pr-opening',
    name: 'checkRejectedMarker three-state: no marker -> "false"',
    forcing: { kind: 'unit', file: 'checkRejectedMarker.test.mjs', test: 'directory exists but genuinely has no new untracked files -> "false"' },
    lastObserved: SUITE_DATE,
  },
  {
    id: 'PR-05',
    category: 'pr-opening',
    name: 'checkRejectedMarker three-state: directory absent -> "unknown", never a confident false',
    forcing: { kind: 'unit', file: 'checkRejectedMarker.test.mjs', test: 'directory does not exist at all -> "unknown"' },
    lastObserved: SUITE_DATE,
  },

  // ------------------------------------------------------------ human actions
  {
    id: 'HUM-01',
    category: 'human-action',
    name: 'Human MERGES an article PR -> publish-on-merge publish job runs',
    forcing: { kind: 'observed', file: '.github/workflows/publish-on-merge.yml', test: 'Publish the merged article' },
    lastObserved: '2026-08-31',
    note: 'Run 33429714215, PR #40 -> commit 182b732. Also drilled weekly (DRILL-02).',
  },
  {
    id: 'HUM-02',
    category: 'human-action',
    name: 'Human CLOSES an article PR unmerged -> topic released, no workflow body runs',
    forcing: { kind: 'unit', file: 'topicAvailability.test.mjs', test: 'gh pr list failure THROWS, does not silently return empty' },
    lastObserved: SUITE_DATE,
    note: 'The release itself is the absence of the closed PR from `gh pr list --state open`; the workflow inertness is shared with HUM-04, observed live 2026-09-03.',
  },
  {
    id: 'HUM-03',
    category: 'human-action',
    name: 'Human MERGES a rejection marker PR by mistake -> notify-marker-merged-by-mistake fires',
    forcing: { kind: 'drill', file: '.github/workflows/pipeline-drill.yml', test: 'marker-merged' },
    lastObserved: 'never (see note)',
    note: 'UNFIRED IN PRODUCTION. The job was added 2026-09-01 in commit 05ec104, AFTER the only real mistaken merge (PR #41, the same day) — so its body has never executed, only its skip condition. This is the exact class of the 2026-08-31 fetch-depth bug. Now drilled.',
  },
  {
    id: 'HUM-04',
    category: 'human-action',
    name: 'Human CLOSES a rejection marker PR -> both publish-on-merge jobs skip, topic released',
    forcing: { kind: 'observed', file: '.github/workflows/publish-on-merge.yml', test: 'Notify — a rejection marker PR was merged instead of closed' },
    lastObserved: '2026-09-03',
    note: 'Run 33810731565 (my close of PR #42): both jobs skipped, confirming the close path is inert by construction.',
  },
  {
    id: 'HUM-05',
    category: 'human-action',
    name: 'Human IGNORES a PR — it goes stale and silently holds its topic hostage',
    watchdog: { workflow: 'cron-watchdog', schedule: 'daily 18:07 UTC (same job as the cron checks)', detects: 'any open blog-generator/* PR older than 3 days, reported with the topic it is holding out of the queue' },
    lastObserved: 'n/a — this is a non-event, it cannot be forced',
    note: 'REAL, CURRENT INSTANCE: PR #39 sat open from 2026-08-29 holding its topic out of the queue with zero signal. Nothing in the pipeline noticed for five days.',
  },

  // -------------------------------------------------------- publish-on-merge
  {
    id: 'PUB-01',
    category: 'publish-on-merge',
    name: 'Publish success — flips published:true, inserts the _headers cache pair',
    forcing: { kind: 'unit', file: 'publishOnMerge.test.mjs', test: 'a not-yet-published article: flips published:true and inserts the _headers pair' },
    lastObserved: SUITE_DATE,
    alsoObservedLive: '2026-08-31 (run 33429714215)',
  },
  {
    id: 'PUB-02',
    category: 'publish-on-merge',
    name: 'Idempotent re-run — already fully published, clean no-op, writes nothing',
    forcing: { kind: 'unit', file: 'publishOnMerge.test.mjs', test: 'an ALREADY fully-published article' },
    lastObserved: SUITE_DATE,
  },
  {
    id: 'PUB-03',
    category: 'publish-on-merge',
    name: 'Slug ambiguity (zero or two added article files) — throws, refuses to guess',
    forcing: { kind: 'unit', file: 'publishOnMerge.test.mjs', test: 'two added article files -> throws, refuses to guess which one' },
    lastObserved: SUITE_DATE,
  },
  {
    id: 'PUB-04',
    category: 'publish-on-merge',
    name: 'git diff itself fails — throws, no slug, failure email says so instead of naming one',
    forcing: { kind: 'unit', file: 'publishOnMerge.test.mjs', test: 'onSlugKnown never fires when slug resolution itself fails' },
    lastObserved: SUITE_DATE,
    alsoObservedLive: '2026-08-31 (run 33363712388 — the shallow-checkout incident)',
  },
  {
    id: 'PUB-05',
    category: 'publish-on-merge',
    name: '_headers 100-rule cap-guard trips — propagates, article stranded merged-but-unpublished',
    forcing: { kind: 'unit', file: 'publishOnMerge.test.mjs', test: 'the _headers 100-rule cap-guard failure propagates as a real thrown error' },
    lastObserved: SUITE_DATE,
  },
  {
    id: 'PUB-06',
    category: 'publish-on-merge',
    name: 'Checkout is not shallow — the 2026-08-31 fetch-depth regression cannot return',
    forcing: { kind: 'static', file: 'publishOnMergeWorkflow.test.mjs', test: 'the checkout step declares an explicit fetch-depth of 0 or >= 2' },
    lastObserved: SUITE_DATE,
    note: 'STATIC ONLY — asserts YAML text, does not execute the checkout. The executing proof is HUM-01 (observed) and DRILL-02.',
  },

  // ------------------------------------------------------------------ emails
  {
    id: 'EM-01',
    category: 'email',
    name: 'article-pr email',
    emailKind: 'article-pr',
    forcing: { kind: 'drill', file: '.github/workflows/test-email-notifications.yml', test: 'article-pr' },
    lastObserved: '2026-08-31',
  },
  {
    id: 'EM-02',
    category: 'email',
    name: 'rejected-pr email',
    emailKind: 'rejected-pr',
    forcing: { kind: 'drill', file: '.github/workflows/test-email-notifications.yml', test: 'rejected-pr' },
    lastObserved: '2026-08-31',
  },
  {
    id: 'EM-03',
    category: 'email',
    name: 'published email',
    emailKind: 'published',
    forcing: { kind: 'drill', file: '.github/workflows/test-email-notifications.yml', test: 'published' },
    lastObserved: '2026-08-31',
  },
  {
    id: 'EM-04',
    category: 'email',
    name: 'failure email — precedence 1, structured report',
    emailKind: 'failure',
    forcing: { kind: 'drill', file: '.github/workflows/test-email-notifications.yml', test: 'checkgen-structured' },
    lastObserved: '2026-08-31',
  },
  {
    id: 'EM-05',
    category: 'email',
    name: 'failure email — precedence 2, captured log with the queue-exhausted sentinel',
    emailKind: 'failure',
    forcing: { kind: 'drill', file: '.github/workflows/test-email-notifications.yml', test: 'checkgen-log' },
    lastObserved: '2026-08-31',
  },
  {
    id: 'EM-06',
    category: 'email',
    name: 'failure email — precedence 2, log with no recognized signal (cause not pinned down)',
    emailKind: 'failure',
    forcing: { kind: 'drill', file: '.github/workflows/test-email-notifications.yml', test: 'checkgen-log-ambiguous' },
    lastObserved: '2026-08-31',
  },
  {
    id: 'EM-07',
    category: 'email',
    name: 'failure email — precedence 3, neutral (no report, no log)',
    emailKind: 'failure',
    forcing: { kind: 'drill', file: '.github/workflows/test-email-notifications.yml', test: 'checkgen-neutral' },
    lastObserved: '2026-08-31',
  },
  {
    id: 'EM-08',
    category: 'email',
    name: 'marker-merged email — "you merged a marker, nothing was published"',
    emailKind: 'marker-merged',
    forcing: { kind: 'drill', file: '.github/workflows/test-email-notifications.yml', test: 'marker-merged' },
    lastObserved: SUITE_DATE,
    note: 'GAP CLOSED 2026-09-03. This was the one email template with no drill kind at all — the only proof it rendered was its unit test. Its calling job (HUM-03) has also never fired in production.',
  },
  {
    id: 'EM-09',
    category: 'email',
    name: 'publish-on-merge red-run email — reads the real captured log, never a hardcoded guess',
    emailKind: 'failure',
    forcing: { kind: 'unit', file: 'notificationEmail.test.mjs', test: 'buildFailureDetail' },
    lastObserved: SUITE_DATE,
    alsoObservedLive: '2026-08-31 (run 33363712388)',
  },
  {
    id: 'EM-10',
    category: 'email',
    name: 'No SMTP secrets configured — clean no-op with a log line, never a failure',
    forcing: { kind: 'static', file: '.github/actions/notify-email/action.yml', test: 'skipping email notification (clean no-op, not a failure)' },
    lastObserved: SUITE_DATE,
    note: 'STATIC ONLY — the secrets are present in this repo, so the no-op branch cannot be forced without removing them. Detection story: its absence would show as a failing notify step, which every call site already wraps in continue-on-error.',
  },

  // -------------------------------------------------------------------- cron
  {
    id: 'CRON-01',
    category: 'cron',
    name: 'generate-article cron fires on schedule (odd days, 13:23 UTC)',
    forcing: { kind: 'observed', file: '.github/workflows/generate-article.yml', test: "cron: '23 13 */2 * *'" },
    lastObserved: '2026-09-03',
    note: '16 of the last 30 runs were schedule-triggered; typical delay 14-25 min.',
  },
  {
    id: 'CRON-02',
    category: 'cron',
    name: 'generate-article cron fires LATE (GitHub scheduler backlog)',
    watchdog: { workflow: 'cron-watchdog', schedule: 'daily 18:07 UTC', detects: 'an odd-day run that has not appeared by 18:07 UTC (4h44m after nominal)' },
    lastObserved: '2026-08-03 (2h22m late — the worst observed)',
    note: 'Not forceable: GitHub decides. Tolerated up to the watchdog window, alerted past it.',
  },
  {
    id: 'CRON-03',
    category: 'cron',
    name: 'generate-article cron is DROPPED entirely (GitHub silently skips the firing)',
    watchdog: { workflow: 'cron-watchdog', schedule: 'daily 18:07 UTC', detects: 'no generate-article run created today when today is an odd day of month' },
    lastObserved: 'n/a — cannot be forced, GitHub owns the scheduler',
    note: 'The whole reason the watchdog exists. Before it, a dropped cron produced no run, no PR, no email, and no signal of any kind.',
  },
  {
    id: 'CRON-04',
    category: 'cron',
    name: 'weekly-retro cron fires on schedule (Mondays)',
    forcing: { kind: 'observed', file: '.github/workflows/weekly-retro.yml', test: 'schedule' },
    lastObserved: '2026-08-31',
    note: 'Fired exactly once by schedule since creation (run 33437191369), 5h39m late against a :00 cron — the same hour-boundary contention generate-article was moved off on 2026-08-31. Minute moved off :00 in this pass for the same reason.',
  },
  {
    id: 'CRON-05',
    category: 'cron',
    name: 'weekly-retro cron is DROPPED (no Monday audit, no signal)',
    watchdog: { workflow: 'cron-watchdog', schedule: 'daily 18:07 UTC', detects: 'no weekly-retro run created on a Monday by 18:07 UTC' },
    lastObserved: 'n/a — cannot be forced',
  },

  // ------------------------------------------------------------------- retro
  {
    id: 'RETRO-01',
    category: 'retro',
    name: 'Retro verdict CLEAR — nothing found',
    forcing: { kind: 'unit', file: 'retroAudit.test.mjs', test: 'nothing found -> CLEAR, zero reasons' },
    lastObserved: SUITE_DATE,
  },
  {
    id: 'RETRO-02',
    category: 'retro',
    name: 'Retro verdict NEEDS-FIX — a demoted/inconclusive finding only',
    forcing: { kind: 'unit', file: 'retroAudit.test.mjs', test: 'only a log-only (demoted) prohibited claim -> NEEDS-FIX, not REJECT' },
    lastObserved: SUITE_DATE,
  },
  {
    id: 'RETRO-03',
    category: 'retro',
    name: 'Retro verdict REJECT — a hard finding (missing identity, dead citation, incomplete publish)',
    forcing: { kind: 'unit', file: 'retroAudit.test.mjs', test: 'a missing identity element -> REJECT' },
    lastObserved: SUITE_DATE,
  },
  {
    id: 'RETRO-04',
    category: 'retro',
    name: 'Retro worst-of aggregation — REJECT beats NEEDS-FIX beats CLEAR across articles',
    forcing: { kind: 'unit', file: 'retroAudit.test.mjs', test: 'overall verdict is the worst of any single article' },
    lastObserved: SUITE_DATE,
  },
];

// coveredOutcomes / coveredEmailKinds — what the table CLAIMS to cover.
// The test compares these against what the source actually branches on.
export function coveredOutcomes() {
  return new Set(PIPELINE_PATHS.map((p) => p.outcome).filter(Boolean));
}

export function coveredEmailKinds() {
  return new Set(PIPELINE_PATHS.map((p) => p.emailKind).filter(Boolean));
}

// unforcedPaths — every row that admits it cannot be forced. Exported so
// the report and the README table are generated from the same source the
// test checks, never re-counted by hand.
export function unforcedPaths() {
  return PIPELINE_PATHS.filter((p) => !p.forcing);
}

// weakestProofPaths — rows whose only proof is `static` (asserts text,
// does not execute). Named separately because "has a test" and "is
// executed" are different claims and this file refuses to blur them.
export function weakestProofPaths() {
  return PIPELINE_PATHS.filter((p) => p.forcing?.kind === 'static');
}
