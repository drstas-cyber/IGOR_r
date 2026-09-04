import { test, describe, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGeneratedArticles, isGeneratedArticle, GENERATED_DIR } from './blog-generator/loadGenerated.js';
import { scanArticle, GENERATOR_LOG_ONLY_FINDING_KEYS } from './blog-compliance/scan.js';

// Regression test for the eac8380 incident. The incident itself was NOT
// caused by the no-key path -- BABYLOVE_API_KEY was present and the BLG
// fetch succeeded ("list: 30 total, 27 published, 3 skipped"). The real
// cause was package.json's "|| true" swallowing a correct FATAL refusal
// from the compliance gate (see build-chain.test.mjs for that half of the
// fix). This file tests the OTHER half of the three-part fix: BLG is now
// retired by default in fetch-blog-data.js itself, so it can't matter
// whether a key happens to be present -- only BLOG_INCLUDE_BLG='true' can
// re-enter that path at all.
//
// These tests spawn the real tools/fetch-blog-data.js (never mocked --
// that's the point: prove the actual default path in this actual repo).
//
// ISOLATION (2026-09-04, Phase 6B2b). They used to snapshot and restore
// the two files the script writes, including the TRACKED
// src/data/blog-articles.json. An interrupted run left the repo's real
// article data in whatever state a test produced; restoring afterwards
// cannot fix that, because the failure mode is never reaching the restore.
// Every spawn now redirects both outputs into a temp directory via
// TVH_BLOG_OUT_PATH / TVH_BLOG_COMPLIANCE_REPORT_PATH, so no tracked file
// is written at all and there is nothing to restore.
//
// The INPUT directory is deliberately NOT redirected everywhere. The
// real-corpus test below compares the script's output against
// loadGeneratedArticles() over the actual repo, and that coupling is the
// whole value of the test -- pointing it at an empty temp dir would make
// it assert nothing. TVH_GENERATED_DIR is set only where a test seeds its
// own synthetic article.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUT_PATH = path.join(PROJECT_ROOT, 'src', 'data', 'blog-articles.json');
const REPORT_PATH = path.join(PROJECT_ROOT, 'tools', 'blog-compliance', 'last-report.json');

// makeTempOutputs -- a fresh temp directory per call, holding the two
// files the script writes. Returned paths are fed to the spawn as env
// overrides so the real OUT_PATH/REPORT_PATH are never touched.
function makeTempOutputs() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fetch-blog-data-out-'));
  return {
    dir,
    outPath: path.join(dir, 'blog-articles.json'),
    reportPath: path.join(dir, 'last-report.json'),
  };
}

function readIfExists(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

// runFetchBlogData -- ALWAYS redirects both outputs. `envOverrides` can add
// TVH_GENERATED_DIR on top when a test supplies its own input corpus.
function runFetchBlogData(envOverrides, outputs) {
  const env = {
    ...process.env,
    TVH_BLOG_OUT_PATH: outputs.outPath,
    TVH_BLOG_COMPLIANCE_REPORT_PATH: outputs.reportPath,
    ...envOverrides,
  };
  return spawnSync('node', ['tools/fetch-blog-data.js'], {
    cwd: PROJECT_ROOT,
    env,
    encoding: 'utf8',
  });
}

describe('fetch-blog-data.js -- BLG retired by default (regression for eac8380)', () => {
  let outputs;

  before(() => {
    outputs = makeTempOutputs();
  });

  after(() => {
    // Tidiness only. Nothing about repository safety depends on this
    // running -- the directory is outside the repo.
    fs.rmSync(outputs.dir, { recursive: true, force: true });
  });

  test('no BLOG_INCLUDE_BLG, no BABYLOVE_API_KEY: writes all published generated articles', () => {
    // TVH_GENERATED_DIR intentionally UNSET: this test's value is that it
    // compares the script's real output against the real repo corpus.
    const result = runFetchBlogData({
      BABYLOVE_API_KEY: undefined,
      BLOG_INCLUDE_BLG: undefined,
      BLOG_COMPLIANCE_FIXTURE: undefined,
    }, outputs);

    assert.equal(result.status, 0, `expected exit 0 on the default generated-only path; stderr: ${result.stderr}`);
    assert.match(result.stdout, /BLG retired/i);

    const expected = loadGeneratedArticles(); // real published generated-articles/, same call fetch-blog-data.js makes
    assert.ok(expected.length > 0, 'test fixture assumption: repo must have at least one published generated article');

    const written = JSON.parse(fs.readFileSync(outputs.outPath, 'utf8'));
    assert.equal(written.length, expected.length, 'must not silently drop or duplicate published generated articles');
    assert.deepEqual(
      written.map((a) => a.slug).sort(),
      expected.map((a) => a.slug).sort()
    );
  });

  test('BABYLOVE_API_KEY present but BLOG_INCLUDE_BLG unset: BLG path is still not entered', () => {
    // This is the exact scenario the incident review flagged: retirement
    // must not be "one leftover env var away from re-entering production."
    // A key alone -- with no explicit BLOG_INCLUDE_BLG=true -- must not
    // wake the BLG fetch path back up.
    const result = runFetchBlogData({
      BABYLOVE_API_KEY: 'leftover-test-key-should-be-ignored',
      BLOG_INCLUDE_BLG: undefined,
      BLOG_COMPLIANCE_FIXTURE: undefined,
    }, outputs);

    assert.equal(result.status, 0, `expected exit 0; stderr: ${result.stderr}`);
    assert.match(result.stdout, /BLG retired/i);
    // "[fetch-blog-data] list:" only ever gets logged by the real BLG-API
    // path (runFromApi -> fetchAllSummaries) -- its absence is direct proof
    // that path was never entered, not just that it happened to return
    // nothing.
    assert.doesNotMatch(result.stdout, /\[fetch-blog-data\] list:/);
  });
});

// ---------------------------------------------------------------------------
// Demotion parity (2026-08-12). Real incident: "seller-closing-costs-
// explained" had published:true and a merged PR (the generator's own
// Layer-1 report showed it clean, since exclusivity:superlative is
// demoted to log-only for generator articles), but this file's compliance
// filter called scanArticle() with no options for every article regardless
// of source, so the same finding full-enforce-tripped here and silently
// excluded the article from blog-articles.json every build. Fixed by
// scoping the demotion to isGeneratedArticle(a) -- these tests prove two
// things: (1) the real fix works on the exact real sentence shape, and (2)
// the BabyLoveGrowth path is unaffected by construction against the real
// frozen fixture, not just measured to currently produce the same count.
// ---------------------------------------------------------------------------

describe('demotion parity -- fetch-blog-data.js\'s batch filter now matches generate.mjs\'s Layer 1 (2026-08-12)', () => {
  test('a generator article whose only Layer 1 finding is the real seller-closing-costs-explained shape ("best done ... agent") no longer trips the batch filter, though it would have under the pre-fix no-demotion call', () => {
    const article = {
      slug: 'test-best-done-with-agent',
      title: 'Test Article',
      sourceTopic: 'Test Topic',
      content_html: '<p>Because rates vary, this is best done with input from your agent and escrow officer rather than a generic calculator.</p>',
      citations: [],
    };
    assert.equal(isGeneratedArticle(article), true, 'test fixture assumption: this article must look generator-sourced');

    const preFixBehavior = scanArticle(article); // no options -- what runComplianceFilter always called before 2026-08-12
    assert.equal(preFixBehavior.tripped, true, 'test fixture assumption: this sentence must actually trip Layer 1 with no demotion, matching the real incident');

    const postFixBehavior = scanArticle(article, { logOnlyFindingKeys: GENERATOR_LOG_ONLY_FINDING_KEYS }); // what fetch-blog-data.js's runComplianceFilter now calls for a generator article
    assert.equal(postFixBehavior.tripped, false, 'the demotion-parity fix must make this exact real article shape survive the batch filter');
  });

  test('the same sentence in a BabyLoveGrowth-shaped article (no sourceTopic) still trips -- the demotion must never reach non-generator content', () => {
    const blgArticle = {
      slug: 'test-blg-best-done',
      title: 'Test BLG Article',
      // no sourceTopic -- true BLG shape
      content_html: '<p>Because rates vary, this is best done with input from your agent and escrow officer.</p>',
    };
    assert.equal(isGeneratedArticle(blgArticle), false);
    const dispatched = scanArticle(blgArticle, isGeneratedArticle(blgArticle) ? { logOnlyFindingKeys: GENERATOR_LOG_ONLY_FINDING_KEYS } : {});
    assert.equal(dispatched.tripped, true, 'a BLG article must always get full enforce, regardless of what a generator article with identical wording would get');
  });

  // Manually re-verified 2026-08-12 against the real, gitignored frozen
  // fixture (tools/blog-compliance/.articles-cache.json, 28 articles, same
  // one this project's prior "reverifications" entries used) -- not run
  // here as an automated test because that fixture is deliberately never
  // committed (full article bodies, see fixture.js's header comment), so a
  // permanent test depending on it would throw for anyone without that
  // exact local file, including every real CI run. Result, recorded here
  // per this project's own "reverifications" discipline (see README.md and
  // pre-regeneration-baseline.json): 28/28 articles confirmed true BLG
  // shape (isGeneratedArticle() false for all), 27/28 tripped both before
  // AND after this change (scanArticle(a) vs. the isGeneratedArticle-scoped
  // dispatch), zero delta. The synthetic tests above are the permanent,
  // portable regression coverage for the same guarantee.
});

// ---------------------------------------------------------------------------
// Silent-drop guard, full pipeline (2026-08-12). Proven RED first: before
// assertNoGeneratedArticleSilentlyDropped() existed and was wired into
// buildAndWrite(), this exact scenario -- a published:true generator
// article that trips the compliance filter -- produced a clean exit 0 from
// the real fetch-blog-data.js, with the drop visible only as one
// console.log line among many (which is exactly what happened to the real
// "seller-closing-costs-explained" article on 2026-08-09/11). Spawns the
// real script against the real repo (same discipline as every other test
// in this file), with one synthetic article temporarily written into the
// real src/data/generated-articles/ directory and always removed
// afterward, success or failure.
// ---------------------------------------------------------------------------

describe('fetch-blog-data.js -- silent-drop guard, full pipeline (2026-08-12)', () => {
  const SYNTHETIC_SLUG = 'zz-test-synthetic-dropped-article-do-not-commit';
  let inputDir;
  let outputs;

  // The synthetic article now lands in a TEMP input directory, not the real
  // src/data/generated-articles/. Previously it was written into the real one
  // and removed in a finally block -- a published:true fixture sitting in the
  // directory the production build reads, for the duration of the test. An
  // interrupted run left it there, and the next build would pick it up. Same
  // defect class 6B2a fixed in merge.test.mjs.
  //
  // One genuine published article is copied in alongside it so the corpus is
  // realistic and non-empty: the second test's "clean build once the synthetic
  // is gone" assertion is only meaningful against a corpus that actually
  // produces articles.
  function seedInputDir({ withSynthetic }) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fetch-blog-data-in-'));
    const realFiles = fs.readdirSync(GENERATED_DIR).filter((f) => f.endsWith('.json'));
    const donor = realFiles.find((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(GENERATED_DIR, f), 'utf8')).published !== false;
      } catch {
        return false;
      }
    });
    assert.ok(donor, 'fixture assumption: the repo must have at least one published generated article to copy');
    fs.copyFileSync(path.join(GENERATED_DIR, donor), path.join(dir, donor));

    if (withSynthetic) {
      fs.writeFileSync(path.join(dir, SYNTHETIC_SLUG + '.json'), JSON.stringify({
        id: 'local-test-synthetic',
        title: 'Synthetic Test Article (DO NOT COMMIT)',
        slug: SYNTHETIC_SLUG,
        // A genuine, non-demoted tenure claim -- trips Layer 1 regardless of
        // the demotion-parity fix above, isolating this test to the drop
        // guard itself rather than re-proving the demotion.
        content_html: '<p>George has over a decade of experience helping buyers in Temecula.</p>',
        meta_description: 'Synthetic test fixture for the silent-drop guard -- exercises a real, non-demoted Layer 1 tenure trip.',
        hero_image_url: null,
        jsonLd: {},
        faqJsonLd: null,
        created_at: '2026-08-12T00:00:00.000Z',
        keywords: ['test'],
        citations: [],
        published: true,
        sourceTopic: 'Synthetic Test Topic (DO NOT COMMIT)',
      }, null, 2), 'utf8');
    }
    return dir;
  }

  afterEach(() => {
    // Tidiness only -- both directories are outside the repo, so nothing about
    // repository safety depends on this running.
    if (inputDir) fs.rmSync(inputDir, { recursive: true, force: true });
    if (outputs) fs.rmSync(outputs.dir, { recursive: true, force: true });
  });

  test('a published generated article that trips the (non-demoted) compliance filter fails the build loudly, names the article, and leaves blog-articles.json untouched', () => {
    inputDir = seedInputDir({ withSynthetic: true });
    outputs = makeTempOutputs();
    const outBefore = readIfExists(outputs.outPath);

    const result = runFetchBlogData({
      BABYLOVE_API_KEY: undefined,
      BLOG_INCLUDE_BLG: undefined,
      BLOG_COMPLIANCE_FIXTURE: undefined,
      TVH_GENERATED_DIR: inputDir,
    }, outputs);

    assert.notEqual(result.status, 0, 'a silently-dropped published generated article must fail the build, not exit 0');
    const combinedOutput = result.stdout + '\n' + result.stderr;
    assert.match(combinedOutput, /FATAL/);
    assert.match(combinedOutput, /did not make it into/);
    assert.match(combinedOutput, new RegExp(SYNTHETIC_SLUG));
    assert.match(combinedOutput, /Synthetic Test Article \(DO NOT COMMIT\)/);

    const outAfter = readIfExists(outputs.outPath);
    assert.equal(outAfter, outBefore, 'blog-articles.json must be left untouched on this FATAL -- never ship a half-written state');
  });

  test('the same synthetic article, once removed, no longer affects the build (cleanup verification)', () => {
    inputDir = seedInputDir({ withSynthetic: false });
    outputs = makeTempOutputs();
    assert.equal(fs.existsSync(path.join(inputDir, SYNTHETIC_SLUG + '.json')), false);

    const result = runFetchBlogData({
      BABYLOVE_API_KEY: undefined,
      BLOG_INCLUDE_BLG: undefined,
      BLOG_COMPLIANCE_FIXTURE: undefined,
      TVH_GENERATED_DIR: inputDir,
    }, outputs);
    assert.equal(result.status, 0, 'expected a clean build once the synthetic article is gone; stderr: ' + result.stderr);
  });

  // GUARD: the synthetic fixture must never appear in the REAL corpus dir.
  test('the synthetic fixture is never written into the real src/data/generated-articles/', () => {
    assert.equal(
      fs.existsSync(path.join(GENERATED_DIR, SYNTHETIC_SLUG + '.json')),
      false,
      'this suite must never write into the real generated-articles directory -- an interrupted run would leave a published:true fixture where the production build reads it',
    );
  });
});

// DEFAULT PRESERVATION. fetch-blog-data.js is the FIRST and FATAL step of every
// build, so the one thing that must never break is its behavior with no
// environment overrides set at all.
describe('fetch-blog-data.js -- path defaults with no env overrides (Phase 6B2b)', () => {
  const src = fs.readFileSync(path.join(PROJECT_ROOT, 'tools', 'fetch-blog-data.js'), 'utf8');

  test('each override falls back to the exact prior production expression', () => {
    assert.match(src, /process\.env\.TVH_BLOG_OUT_PATH/);
    assert.match(src, /process\.env\.TVH_BLOG_COMPLIANCE_REPORT_PATH/);
    assert.match(src, /\|\|\s*path\.join\(PROJECT_ROOT, 'src', 'data', 'blog-articles\.json'\)/);
    assert.match(src, /\|\|\s*path\.join\(PROJECT_ROOT, 'tools', 'blog-compliance', 'last-report\.json'\)/);
    assert.match(src, /loadGeneratedArticles\(process\.env\.TVH_GENERATED_DIR \|\| undefined\)/);
  });

  test('the real production paths this test file computes match what the script falls back to', () => {
    // Asserted structurally rather than by execution: actually running the
    // script with no overrides would rewrite the tracked
    // src/data/blog-articles.json, which is exactly what this batch exists to
    // stop the test suite from doing.
    assert.equal(OUT_PATH, path.join(PROJECT_ROOT, 'src', 'data', 'blog-articles.json'));
    assert.equal(REPORT_PATH, path.join(PROJECT_ROOT, 'tools', 'blog-compliance', 'last-report.json'));
  });
});
