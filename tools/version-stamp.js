// Writes dist/version.json with build provenance:
// { commit, branch, timestamp, dirty, dirtyFiles, buildEnv }.
// Lives at https://temeculavalleyhomes.us/version.json after deploy and lets you confirm the
// live site corresponds to a specific git commit, built in CI from a clean checkout.
//
// Field semantics:
//   commit     — git rev-parse HEAD at build time
//   branch     — git rev-parse --abbrev-ref HEAD
//   timestamp  — ISO 8601 build time
//   dirty      — true if `git status --porcelain` was non-empty at build time
//                (i.e. uncommitted/untracked files were present in the build tree)
//   dirtyFiles — the actual `git status --porcelain` lines (path + status code), not
//                just the boolean. Added 2026-07-26 after dirty:true showed up on a
//                Cloudflare Pages build with no known cause — a boolean gives you
//                nothing to investigate with; the file list does. null when dirty is
//                null/false, capped at 50 entries (with a count note) so a truly
//                pathological case can't bloat this file unboundedly.
//   buildEnv   — 'cf-pages' if process.env.CF_PAGES === '1' (Cloudflare Pages runner),
//                'ci' if process.env.GITHUB_ACTIONS === 'true' (GitHub Actions), else 'local'
//
// A healthy production deploy reports buildEnv='cf-pages' and dirty=false. The 'ci' value
// only appears in artifacts produced by the build-check workflow (which validates but does
// not deploy). 'local' on the live site means a wrangler-from-local upload bypassed the
// canonical git push -> Cloudflare Pages auto-deploy path.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DIST = path.join(PROJECT_ROOT, 'dist');

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return null;
  }
}

const commit = process.env.CF_PAGES_COMMIT_SHA || git('rev-parse HEAD') || 'unknown';
const branch = process.env.CF_PAGES_BRANCH || git('rev-parse --abbrev-ref HEAD') || 'unknown';
const status = git('status --porcelain');
const dirty = status === null ? null : status.length > 0;

const DIRTY_FILES_CAP = 50;
let dirtyFiles = null;
if (dirty) {
  const lines = status.split('\n').filter(Boolean);
  dirtyFiles = lines.slice(0, DIRTY_FILES_CAP);
  if (lines.length > DIRTY_FILES_CAP) {
    dirtyFiles.push(`... and ${lines.length - DIRTY_FILES_CAP} more (truncated at ${DIRTY_FILES_CAP})`);
  }
}

const timestamp = new Date().toISOString();
const buildEnv =
  process.env.CF_PAGES === '1' ? 'cf-pages' :
  process.env.GITHUB_ACTIONS === 'true' ? 'ci' :
  'local';

const payload = { commit, branch, timestamp, dirty, dirtyFiles, buildEnv };

if (!fs.existsSync(DIST)) {
  console.error('[version-stamp] dist/ not found — run vite build first.');
  process.exit(1);
}

fs.writeFileSync(
  path.join(DIST, 'version.json'),
  JSON.stringify(payload, null, 2) + '\n',
  'utf8'
);

console.log(
  `[version-stamp] dist/version.json: commit=${commit.slice(0, 7)} branch=${branch} dirty=${dirty}` +
  (dirtyFiles ? ` (${dirtyFiles.length} file(s), see dirtyFiles in the JSON)` : '') +
  ` buildEnv=${buildEnv} ts=${timestamp}`
);
