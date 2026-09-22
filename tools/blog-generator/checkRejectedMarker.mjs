#!/usr/bin/env node
/* eslint-disable no-console */
// Determines whether generate.mjs wrote a rejected-attempt marker this
// run, for the GitHub Actions step that decides whether to open the
// rejected-attempt PR. Extracted out of inline workflow bash (2026-07-27,
// the "silent-discard gap" fix) specifically so it's unit-testable — see
// checkRejectedMarker.test.mjs — matching the exec-injection pattern
// already used by topicAvailability.mjs's getOpenPrAttemptedTopics().
//
// THREE possible states, not two. The prior inline-bash version
// (`git status --porcelain -- <dir> | grep -q '^??'`) silently folded "the
// .rejected/ directory doesn't exist at all" into the same `false` as "the
// directory exists and is genuinely empty of new files" -- a checkpoint
// whose entire job is "was a marker written this run" must never report a
// confident false on a question it couldn't actually answer (same bug
// class as the earlier implicit-success() catch on this exact PR-opening
// mechanism, see generate-article.yml's own comment on that incident).
// `unknown` is a distinct, explicit third state: it's the correct,
// unremarkable answer on a checkout before this repo's first-ever
// rejection ever happens (the directory genuinely has never been created),
// AND it's the loud signal worth surfacing if it ever shows up alongside a
// failed generate step and no new article -- exactly the silent-discard
// combination this whole check exists to catch. `true`/`false` stay
// strings, matching GITHUB_OUTPUT's string-only values and the existing
// `has_new_article` step's convention.
//
// NEW OR MODIFIED, not just new (2026-09-21, run 35640520872). Marker
// filenames are deterministic by topic slug, and Phase 3 / Model A lets a
// topic whose rejection was MERGED be retried once its quarantine expires.
// A repeat rejection therefore rewrites an already-TRACKED marker, which
// git reports as ` M`, not `??`. The previous `^??` test read that as
// "nothing rejected", skipped the rejected-attempt PR, and sent the run
// down the red-run path with the quarantine transition stranded in the
// runner. The question this answers is "did this run leave a changed
// marker JSON in the marker directory" -- whether git knew the path before
// is irrelevant. Attribution to THIS run relies on the workflow starting
// from a fresh actions/checkout (which deletes the workspace) with only
// setup-node / npm ci before the generator, so nothing else can dirty
// .rejected/ first.
import { execSync } from 'node:child_process';
import fs from 'node:fs';

// Porcelain v1 status letters that mean the file now has content this
// run put there. D (deleted) deliberately does not count: a deleted marker
// is not a written one.
const CONTENT_CHANGE = new Set(['A', 'M', 'R', 'C', 'T']);

// Unmerged (conflicted) entries, checked BEFORE CONTENT_CHANGE: several of
// them (AA, AU, UA) contain A, so the letter test alone would accept a
// conflict as a written marker. git's documented unmerged pairs are DD,
// AU, UD, UA, DU, AA, UU; any U in either column is treated as unmerged
// too, so an unlisted combination can never slip through. The generator
// never produces a conflict -- one here means the tree is not what this
// run wrote, so it must never report "true".
const UNMERGED_BOTH = new Set(['DD', 'AA']);

export function isUnmergedStatus(xy) {
  return UNMERGED_BOTH.has(xy) || xy.includes('U');
}

// Parses `git status --porcelain=v1 -z` output into [{ xy, path }]. With
// -z, paths are never quoted, and a rename/copy entry is followed by one
// extra NUL-terminated field holding its ORIGINAL path, which is skipped
// -- `path` is always the path the file has now.
export function parsePorcelainZ(output) {
  const fields = output.split('\0');
  const entries = [];
  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i];
    if (field.length < 4) continue; // trailing empty field after the last NUL
    const xy = field.slice(0, 2);
    entries.push({ xy, path: field.slice(3) });
    if (xy[0] === 'R' || xy[0] === 'C') i += 1;
  }
  return entries;
}

export function isChangedMarkerEntry({ xy, path: filePath }, rejectedDirPath) {
  const dir = rejectedDirPath.replace(/\\/g, '/').replace(/\/?$/, '/');
  if (!filePath.startsWith(dir) || !filePath.endsWith('.json')) return false;
  if (xy === '??') return true;
  if (isUnmergedStatus(xy)) return false;
  return CONTENT_CHANGE.has(xy[0]) || CONTENT_CHANGE.has(xy[1]);
}

export function checkRejectedMarker({
  rejectedDirPath = 'src/data/generated-articles/.rejected/',
  existsSync = fs.existsSync,
  exec = (cmd) => execSync(cmd, { encoding: 'utf8' }),
} = {}) {
  if (!existsSync(rejectedDirPath)) {
    return {
      state: 'unknown',
      reason: `${rejectedDirPath} does not exist -- cannot determine whether a marker was written this run. Expected (and harmless) on a checkout before this repo's first-ever rejection; alarming if paired with a failed generate step and no new article -- that combination means a discard happened with zero ground truth recorded.`,
    };
  }
  // --untracked-files=all: without it git collapses a brand-new file in a
  // brand-new directory into `?? <dir>/`, which carries no .json path to
  // match on.
  const status = exec(`git status --porcelain=v1 -z --untracked-files=all -- ${rejectedDirPath}`);
  const changed = parsePorcelainZ(status).filter((e) => isChangedMarkerEntry(e, rejectedDirPath));
  return {
    state: changed.length > 0 ? 'true' : 'false',
    reason: changed.length > 0
      ? `new or modified rejected marker(s) under the marker directory: ${changed.map((e) => `${e.xy.trim()} ${e.path}`).join(', ')}`
      : 'directory exists, no new or modified marker files -- genuinely nothing rejected this run',
  };
}

const isMain = process.argv[1] && process.argv[1].endsWith('checkRejectedMarker.mjs');
if (isMain) {
  const result = checkRejectedMarker();
  // Only this line goes to stdout -- the workflow step redirects stdout
  // straight into $GITHUB_OUTPUT, which expects nothing but `key=value`
  // lines. Human-readable context goes to stderr instead, so it still
  // shows in the job log without corrupting the captured output.
  console.log(`has_rejected_marker=${result.state}`);
  if (result.state === 'unknown') {
    console.error(`::warning::${result.reason}`);
  } else {
    console.error(`[checkRejectedMarker] ${result.reason}`);
  }
}
