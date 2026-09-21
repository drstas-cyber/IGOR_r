import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseAddedArticleSlugs, getMergedArticleSlug, runPublishOnMerge } from './publishOnMerge.mjs';

describe('parseAddedArticleSlugs — pure', () => {
  test('a single real article file -> its slug', () => {
    assert.deepEqual(
      parseAddedArticleSlugs('src/data/generated-articles/vail-ranch-temecula-neighborhood-guide.json\n'),
      ['vail-ranch-temecula-neighborhood-guide']
    );
  });

  test('excludes .rejected/ marker files -- never mistaken for a real article', () => {
    assert.deepEqual(
      parseAddedArticleSlugs('src/data/generated-articles/.rejected/some-topic.json\n'),
      []
    );
  });

  test('excludes files outside generated-articles/ entirely (e.g. citation-host-log.json, which also rides along in generator PRs)', () => {
    assert.deepEqual(
      parseAddedArticleSlugs('tools/blog-generator/citation-host-log.json\nsrc/data/generated-articles/x.json\n'),
      ['x']
    );
  });

  test('blank diff output -> empty array, not a crash', () => {
    assert.deepEqual(parseAddedArticleSlugs(''), []);
    assert.deepEqual(parseAddedArticleSlugs('   \n'), []);
  });

  test('two real article files (should never happen given the PR add-paths scoping, but must not silently pick one) -> both returned', () => {
    assert.deepEqual(
      parseAddedArticleSlugs('src/data/generated-articles/a.json\nsrc/data/generated-articles/b.json\n'),
      ['a', 'b']
    );
  });
});

describe('getMergedArticleSlug — fail-closed on ambiguity', () => {
  test('exactly one added article file -> its slug', () => {
    const exec = () => 'src/data/generated-articles/vail-ranch-temecula-neighborhood-guide.json\n';
    assert.equal(getMergedArticleSlug({ mergeSha: 'abc', exec }), 'vail-ranch-temecula-neighborhood-guide');
  });

  test('zero added article files -> throws, refuses to guess', () => {
    const exec = () => '';
    assert.throws(() => getMergedArticleSlug({ mergeSha: 'abc', exec }), /found 0 added article file/);
  });

  test('two added article files -> throws, refuses to guess which one', () => {
    const exec = () => 'src/data/generated-articles/a.json\nsrc/data/generated-articles/b.json\n';
    assert.throws(() => getMergedArticleSlug({ mergeSha: 'abc', exec }), /found 2 added article file/);
  });

  test('a git diff failure throws, never silently reports "nothing added"', () => {
    const exec = () => { throw new Error('git error'); };
    assert.throws(() => getMergedArticleSlug({ mergeSha: 'abc', exec }), /git diff failed/);
  });
});

describe('runPublishOnMerge — orchestration, real setPublishedInJson + shared coverage validation, injected fs/exec', () => {
  function makeFakeFs({ articleJson, headersText }) {
    const written = {};
    return {
      written,
      readFileSync: (p) => {
        if (String(p).endsWith('.json')) return articleJson;
        if (String(p).endsWith('_headers')) return headersText;
        throw new Error(`unexpected read: ${p}`);
      },
      writeFileSync: (p, content) => { written[p] = content; },
      existsSync: () => true,
    };
  }

  // BATCH F / OPTION D: these fixtures used to contain per-slug pairs and,
  // in the "clean" case, a bare `/blog/*  Cache-Control` rule. Both are now
  // contract violations by definition -- the wildcard is prohibited outright
  // and a concrete pair would concatenate with the placeholder. The valid
  // fixture is the shared two-placeholder contract, identical for every
  // article, which is the whole point of the batch.
  const CC = '  Cache-Control: public, max-age=0, s-maxage=300, must-revalidate';
  const VALID_HEADERS = `/blog/\n${CC}\n/blog\n${CC}\n/blog/:slug/\n${CC}\n/blog/:slug\n${CC}\n\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n`;
  const UNPUBLISHED_ARTICLE = JSON.stringify({ slug: 'x', title: 'X', published: false, citations: [] });
  const PUBLISHED_ARTICLE = JSON.stringify({ slug: 'x', title: 'X', published: true, citations: [] });
  const gitDiffExec = (cmd) => {
    if (cmd.includes('git diff')) return 'src/data/generated-articles/x.json\n';
    throw new Error(`unexpected exec: ${cmd}`);
  };

  test('a not-yet-published article: flips published:true WITHOUT touching _headers, reports already_complete: false', async () => {
    const fakeFs = makeFakeFs({ articleJson: UNPUBLISHED_ARTICLE, headersText: VALID_HEADERS });
    const result = await runPublishOnMerge({ mergeSha: 'abc', exec: gitDiffExec, fs: fakeFs, blogArticlesSlugs: ['x'] });
    assert.equal(result.alreadyComplete, false);
    assert.equal(result.slug, 'x');
    const writtenArticle = JSON.parse(Object.values(fakeFs.written).find((v) => v.includes('"slug"')));
    assert.equal(writtenArticle.published, true);

    // THE Batch F regression: publication must not write public/_headers at
    // all, so the file cannot grow and cannot regain a concrete rule.
    const headerWrites = Object.keys(fakeFs.written).filter((p) => String(p).endsWith('_headers'));
    assert.deepEqual(headerWrites, [], 'publication must never write public/_headers');
  });

  test('publication adds no concrete rule and does not grow the rule count, for an arbitrary future slug', async () => {
    const exec = (cmd) => {
      if (cmd.includes('git diff')) return 'src/data/generated-articles/a-brand-new-future-article.json\n';
      throw new Error(`unexpected exec: ${cmd}`);
    };
    const article = JSON.stringify({ slug: 'a-brand-new-future-article', title: 'New', published: false, citations: [] });
    const fakeFs = makeFakeFs({ articleJson: article, headersText: VALID_HEADERS });
    const before = (VALID_HEADERS.match(/^\//gm) || []).length;
    const result = await runPublishOnMerge({ mergeSha: 'abc', exec, fs: fakeFs, blogArticlesSlugs: ['a-brand-new-future-article'] });
    assert.equal(result.alreadyComplete, false);
    assert.deepEqual(Object.keys(fakeFs.written).filter((p) => String(p).endsWith('_headers')), []);
    // _headers is byte-identical because it was never written.
    assert.equal((VALID_HEADERS.match(/^\//gm) || []).length, before);
    assert.ok(!VALID_HEADERS.includes('/blog/a-brand-new-future-article'));
  });

  test('an ALREADY fully-published article (e.g. the silent auto-publish path already ran, or this workflow re-fires): no-op, reports already_complete: true, writes nothing', async () => {
    const fakeFs = makeFakeFs({ articleJson: PUBLISHED_ARTICLE, headersText: VALID_HEADERS });
    const result = await runPublishOnMerge({ mergeSha: 'abc', exec: gitDiffExec, fs: fakeFs, blogArticlesSlugs: ['x'] });
    assert.equal(result.alreadyComplete, true);
    assert.deepEqual(fakeFs.written, {}, 'an idempotent no-op must never write anything');
  });

  test('a malformed shared header contract fails closed as a real thrown error, not swallowed', async () => {
    // Replaces the old 100-rule cap-guard case: under Option D publication
    // never inserts, so the cap is unreachable from here. The failure mode
    // that IS reachable is a broken/edited shared contract, and it must stop
    // the publish rather than flip published:true into a broken file.
    const brokenHeaders = VALID_HEADERS.replace(`/blog/:slug\n${CC}\n`, '');
    const fakeFs = makeFakeFs({ articleJson: UNPUBLISHED_ARTICLE, headersText: brokenHeaders });
    await assert.rejects(
      () => runPublishOnMerge({ mergeSha: 'abc', exec: gitDiffExec, fs: fakeFs, blogArticlesSlugs: ['x'] }),
      /shared blog article cache coverage in public\/_headers is invalid/
    );
    assert.deepEqual(fakeFs.written, {}, 'a failed coverage check must not flip published:true');
  });

  test('a concrete per-slug rule left in _headers fails closed rather than publishing into a concatenating file', async () => {
    const overlapping = `${VALID_HEADERS}\n/blog/x\n${CC}\n`;
    const fakeFs = makeFakeFs({ articleJson: UNPUBLISHED_ARTICLE, headersText: overlapping });
    await assert.rejects(
      () => runPublishOnMerge({ mergeSha: 'abc', exec: gitDiffExec, fs: fakeFs, blogArticlesSlugs: ['x'] }),
      /concatenate/
    );
  });

  // FIX 3 (2026-08-31) -- the slug must reach $GITHUB_OUTPUT (via the
  // injected onSlugKnown callback the real CLI wires to a real
  // fs.appendFileSync) the moment it's resolved, BEFORE any write work --
  // not only in the success .then(), which that night's actual failure
  // (the git-diff-itself-failed case) never reached. This is what lets a
  // LATER throw -- including one that happens after the slug is known,
  // like the malformed-coverage case above -- still leave the slug behind
  // for the failure email to name.
  test('onSlugKnown fires with the resolved slug before any fs write, and survives a later throw (malformed coverage)', async () => {
    const brokenHeaders = VALID_HEADERS.replace(`/blog/:slug\n${CC}\n`, '');
    const fakeFs = makeFakeFs({ articleJson: UNPUBLISHED_ARTICLE, headersText: brokenHeaders });
    let onSlugKnownSlug = null;
    let writesWhenSlugKnownFired = null;
    const onSlugKnown = (slug) => {
      onSlugKnownSlug = slug;
      writesWhenSlugKnownFired = Object.keys(fakeFs.written).length;
    };
    await assert.rejects(
      () => runPublishOnMerge({ mergeSha: 'abc', exec: gitDiffExec, fs: fakeFs, blogArticlesSlugs: ['x'], onSlugKnown }),
      /shared blog article cache coverage in public\/_headers is invalid/
    );
    assert.equal(onSlugKnownSlug, 'x', 'onSlugKnown must fire with the real slug even though the run ultimately throws');
    assert.equal(writesWhenSlugKnownFired, 0, 'onSlugKnown must fire before any fs write (the write phase)');
  });

  test('onSlugKnown never fires when slug resolution itself fails (git diff error) -- there is no slug to report', async () => {
    const exec = () => { throw new Error('git error'); };
    const fakeFs = makeFakeFs({ articleJson: UNPUBLISHED_ARTICLE, headersText: VALID_HEADERS });
    let called = false;
    const onSlugKnown = () => { called = true; };
    await assert.rejects(() => runPublishOnMerge({ mergeSha: 'abc', exec, fs: fakeFs, blogArticlesSlugs: ['x'], onSlugKnown }));
    assert.equal(called, false);
  });
});

// buildFailureDetail moved to notificationEmail.mjs 2026-08-31 (Task 0,
// notification-hardening pass) -- see notificationEmail.test.mjs for its
// tests. This file no longer imports or exports it; the isMain CLI block
// below now prints err.code as its own log line (Task 1) so a typed
// cap-guard error still survives into the captured log as a stable token
// for that function to detect.
