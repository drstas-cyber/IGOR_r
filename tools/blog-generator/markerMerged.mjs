#!/usr/bin/env node
/* eslint-disable no-console */
// Detects a `blog-generator/rejected-*` marker PR that got MERGED instead
// of closed (the mistake this file exists to catch — see topicAvailability
// .mjs's header comment and README.md's "Unblocking a topic after an
// accidentally-merged rejection" decision record: a merged rejection
// permanently blocks its topic, on purpose, and recovery is a manual,
// reviewed `git rm` of the marker file, never automatic).
//
// This module only REPORTS what happened — which marker file(s) a merge
// commit added and which topic(s) they name — so publish-on-merge.yml's
// sibling job for `rejected-*` branches can email a human immediately
// instead of the mistake sitting silent until someone notices the topic
// never comes back up in a generator run. It never deletes anything.
//
// Mirrors publishOnMerge.mjs's getMergedArticleSlug() pattern deliberately
// (same git-diff-against-the-merge-commit's-first-parent approach, same
// `~1` note about Windows `^` mangling, same exec-injection for tests) —
// see that file for the reasoning, not repeated here.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import realFs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const REJECTED_DIR_PREFIX = 'src/data/generated-articles/.rejected/';

// parseAddedMarkerFiles (exported, pure) — filters `git diff --name-only`
// output down to marker files added under .rejected/ specifically.
export function parseAddedMarkerFiles(diffOutput) {
  return String(diffOutput || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith(REJECTED_DIR_PREFIX) && l.endsWith('.json'));
}

// getMergedMarkerFiles (exported) — fail-closed: throws on a git failure.
// Deliberately does NOT throw on zero or many results the way
// getMergedArticleSlug() does for real articles — a rejected-attempt PR's
// add-paths already includes citation-host-log.json alongside the marker,
// and this is a best-effort notification, not a gate; the caller decides
// what "zero" or "many" means for the email it builds.
export function getMergedMarkerFiles({ mergeSha, exec = execSync }) {
  let diffOutput;
  try {
    diffOutput = exec(`git diff --name-only --diff-filter=A ${mergeSha}~1 ${mergeSha} -- ${REJECTED_DIR_PREFIX}`, { encoding: 'utf8' });
  } catch (err) {
    throw new Error(`[markerMerged] git diff failed: ${err.message}. Refusing to guess which marker(s) this PR added.`);
  }
  return parseAddedMarkerFiles(diffOutput);
}

// readMarkerTopic (exported) — reads sourceTopic back out of a marker file
// already present in the checked-out working tree (this only ever runs
// post-merge, on main, in the same job that just checked main out — same
// assumption publishOnMerge.mjs's runPublishOnMerge makes for the real
// article file). Returns null, never throws, on any read/parse failure —
// a missing topic name degrades the email's specificity, it must never
// cost the notification itself.
export function readMarkerTopic({ filePath, fs = realFs }) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, filePath), 'utf8'));
    return data?.sourceTopic || null;
  } catch {
    return null;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const mergeShaArg = process.argv.find((a) => a.startsWith('--merge-sha='));
  const mergeSha = mergeShaArg ? mergeShaArg.slice('--merge-sha='.length) : '';
  if (!mergeSha) {
    console.error('[markerMerged] usage: node markerMerged.mjs --merge-sha=<sha>');
    process.exitCode = 1;
  } else {
    try {
      const files = getMergedMarkerFiles({ mergeSha });
      const markerFile = files.length === 1 ? files[0] : '';
      const topic = markerFile ? (readMarkerTopic({ filePath: markerFile }) || '') : '';
      if (files.length !== 1) {
        console.error(`[markerMerged] expected exactly 1 added marker file, found ${files.length}: ${JSON.stringify(files)} -- emailing without a specific file/topic name.`);
      }
      if (process.env.GITHUB_OUTPUT) {
        realFs.appendFileSync(process.env.GITHUB_OUTPUT, `marker_file=${markerFile}\n`);
        realFs.appendFileSync(process.env.GITHUB_OUTPUT, `topic=${topic}\n`);
      } else {
        console.log(JSON.stringify({ markerFile, topic }, null, 2));
      }
    } catch (err) {
      // Never fatal -- see this file's header comment: a bug here must
      // cost a less-specific email, never a red workflow step (the calling
      // workflow step also sets continue-on-error: true independently).
      console.error(`[markerMerged] non-fatal error: ${err.message}`);
      if (process.env.GITHUB_OUTPUT) {
        realFs.appendFileSync(process.env.GITHUB_OUTPUT, `marker_file=\n`);
        realFs.appendFileSync(process.env.GITHUB_OUTPUT, `topic=\n`);
      }
    }
  }
}
