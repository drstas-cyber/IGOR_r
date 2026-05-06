// Writes dist/version.json with build provenance: { commit, branch, timestamp, dirty, buildEnv }.
// Lives at https://temeculavalleyhomes.us/version.json after deploy and lets you confirm the
// live site corresponds to a specific git commit, built in CI from a clean checkout.
//
// Field semantics:
//   commit    — git rev-parse HEAD at build time
//   branch    — git rev-parse --abbrev-ref HEAD
//   timestamp — ISO 8601 build time
//   dirty     — true if `git status --porcelain` was non-empty at build time
//               (i.e. uncommitted/untracked files were present in the build tree)
//   buildEnv  — 'ci' if process.env.GITHUB_ACTIONS === 'true', else 'local'
//
// A healthy production deploy reports buildEnv='ci' and dirty=false. Any other combination
// indicates the build did not come through the canonical git push -> GitHub Actions ->
// Cloudflare Pages auto-deploy path.

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

const commit = git('rev-parse HEAD') || 'unknown';
const branch = git('rev-parse --abbrev-ref HEAD') || 'unknown';
const status = git('status --porcelain');
const dirty = status === null ? null : status.length > 0;
const timestamp = new Date().toISOString();
const buildEnv = process.env.GITHUB_ACTIONS === 'true' ? 'ci' : 'local';

const payload = { commit, branch, timestamp, dirty, buildEnv };

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
  `[version-stamp] dist/version.json: commit=${commit.slice(0, 7)} branch=${branch} dirty=${dirty} buildEnv=${buildEnv} ts=${timestamp}`
);
