import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Regression test for the eac8380 incident: package.json's "build" script
// is "A && B || true && C && D && E", which -- because && and || share the
// same left-to-right precedence -- parses as "((A && B) || true) && C && D
// && E". That means ANY failure of A (tools/fetch-blog-data.js) used to be
// silently swallowed by the "|| true", so vite build (and everything after
// it) ran anyway, on stale committed data. This test exercises the *actual*
// string in package.json's "scripts.build" (not a copy), substituting cheap
// stand-ins for the two real steps so it only tests the &&/|| control-flow
// shape, not fetch-blog-data.js or generate-llms.js themselves.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));
const buildScript = pkg.scripts.build;

function runWithStandins({ fetchExit, llmsExit, tailExit = 0 }) {
  const substituted = buildScript
    .replace('node tools/fetch-blog-data.js', `node -e "process.exit(${fetchExit})"`)
    .replace('node tools/generate-llms.js', `node -e "process.exit(${llmsExit})"`)
    .replace(
      /vite build && node tools\/seo-prerender\.js && node tools\/version-stamp\.js/,
      `node -e "process.exit(${tailExit})"`
    );
  return spawnSync(substituted, { shell: true });
}

describe('package.json "build" script -- &&/|| exit-code propagation (regression for eac8380)', () => {
  test('fetch-blog-data.js fatal (non-zero) fails the whole chain', () => {
    const result = runWithStandins({ fetchExit: 1, llmsExit: 0 });
    assert.notEqual(
      result.status,
      0,
      'a fetch-blog-data.js failure must fail the build, not be swallowed by "|| true"'
    );
  });

  test('generate-llms.js failure alone does not fail the chain (existing || true behavior preserved)', () => {
    const result = runWithStandins({ fetchExit: 0, llmsExit: 1 });
    assert.equal(
      result.status,
      0,
      'generate-llms.js failures are still non-fatal by design -- only its own step, not the whole chain'
    );
  });

  test('both steps succeed -> chain proceeds to the tail and exits zero', () => {
    const result = runWithStandins({ fetchExit: 0, llmsExit: 0 });
    assert.equal(result.status, 0);
  });

  test('fetch-blog-data.js succeeds, generate-llms.js fails, tail still runs', () => {
    // Belt-and-suspenders: proves "(generate-llms || true)" doesn't also
    // accidentally swallow a tail (vite build/seo-prerender/version-stamp)
    // failure -- only generate-llms.js's own exit code is absorbed.
    const result = runWithStandins({ fetchExit: 0, llmsExit: 1, tailExit: 1 });
    assert.notEqual(result.status, 0, 'a real tail failure (e.g. vite build) must still fail the build');
  });
});

