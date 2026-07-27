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
import { execSync } from 'node:child_process';
import fs from 'node:fs';

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
  const status = exec(`git status --porcelain -- ${rejectedDirPath}`);
  const hasNewFile = /^\?\?/m.test(status);
  return {
    state: hasNewFile ? 'true' : 'false',
    reason: hasNewFile
      ? 'new untracked file(s) found under the rejected marker directory'
      : 'directory exists, no new untracked files -- genuinely nothing rejected this run',
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
