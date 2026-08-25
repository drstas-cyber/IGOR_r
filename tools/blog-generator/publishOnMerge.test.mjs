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

describe('runPublishOnMerge — orchestration, real setPublishedInJson/insertCacheEntry, injected fs/exec', () => {
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

  const CLEAN_HEADERS = '/blog/*\n  Cache-Control: x\n\n/assets/*\n  Cache-Control: y\n';
  const UNPUBLISHED_ARTICLE = JSON.stringify({ slug: 'x', title: 'X', published: false, citations: [] });
  const PUBLISHED_COMPLETE_HEADERS = '/blog/*\n  Cache-Control: x\n\n/blog/x/\n  Cache-Control: y\n\n/blog/x\n  Cache-Control: y\n\n/assets/*\n  Cache-Control: y\n';
  const PUBLISHED_ARTICLE = JSON.stringify({ slug: 'x', title: 'X', published: true, citations: [] });

  test('a not-yet-published article: flips published:true and inserts the _headers pair, reports already_complete: false', async () => {
    const exec = (cmd) => {
      if (cmd.includes('git diff')) return 'src/data/generated-articles/x.json\n';
      throw new Error(`unexpected exec: ${cmd}`);
    };
    const fakeFs = makeFakeFs({ articleJson: UNPUBLISHED_ARTICLE, headersText: CLEAN_HEADERS });
    const result = await runPublishOnMerge({ mergeSha: 'abc', exec, fs: fakeFs, blogArticlesSlugs: ['x'] });
    assert.equal(result.alreadyComplete, false);
    assert.equal(result.slug, 'x');
    const writtenArticle = JSON.parse(Object.values(fakeFs.written).find((v) => v.includes('"slug"')));
    assert.equal(writtenArticle.published, true);
  });

  test('an ALREADY fully-published article (e.g. the silent auto-publish path already ran, or this workflow re-fires): no-op, reports already_complete: true, writes nothing', async () => {
    const exec = (cmd) => {
      if (cmd.includes('git diff')) return 'src/data/generated-articles/x.json\n';
      throw new Error(`unexpected exec: ${cmd}`);
    };
    const fakeFs = makeFakeFs({ articleJson: PUBLISHED_ARTICLE, headersText: PUBLISHED_COMPLETE_HEADERS });
    const result = await runPublishOnMerge({ mergeSha: 'abc', exec, fs: fakeFs, blogArticlesSlugs: ['x'] });
    assert.equal(result.alreadyComplete, true);
    assert.deepEqual(fakeFs.written, {}, 'an idempotent no-op must never write anything');
  });

  test('the _headers 100-rule cap-guard failure propagates as a real thrown error, not swallowed', async () => {
    const exec = (cmd) => {
      if (cmd.includes('git diff')) return 'src/data/generated-articles/x.json\n';
      throw new Error(`unexpected exec: ${cmd}`);
    };
    // 100 existing rules (50 slugs already at 2 rules each) -- adding one more tips it over MAX_HEADERS_RULES.
    const fullHeaders = `${Array.from({ length: 50 }, (_, i) => `/blog/existing-${i}/\n  Cache-Control: x\n/blog/existing-${i}\n  Cache-Control: x`).join('\n')}\n/assets/*\n  Cache-Control: y\n`;
    const fakeFs = makeFakeFs({ articleJson: UNPUBLISHED_ARTICLE, headersText: fullHeaders });
    await assert.rejects(
      () => runPublishOnMerge({ mergeSha: 'abc', exec, fs: fakeFs, blogArticlesSlugs: ['x'] }),
      /over Cloudflare Pages/
    );
  });
});
