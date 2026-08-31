import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseAddedArticleSlugs, getMergedArticleSlug, runPublishOnMerge, buildFailureDetail } from './publishOnMerge.mjs';

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

  // FIX 3 (2026-08-31) -- the slug must reach $GITHUB_OUTPUT (via the
  // injected onSlugKnown callback the real CLI wires to a real
  // fs.appendFileSync) the moment it's resolved, BEFORE any write work --
  // not only in the success .then(), which last night's actual failure
  // (the git-diff-itself-failed case) never reached. This is what lets a
  // LATER throw -- including one that happens after the slug is known,
  // like the cap-guard case above -- still leave the slug behind for the
  // failure email to name.
  test('onSlugKnown fires with the resolved slug before any fs write, and survives a later throw (cap-guard)', async () => {
    const exec = (cmd) => {
      if (cmd.includes('git diff')) return 'src/data/generated-articles/x.json\n';
      throw new Error(`unexpected exec: ${cmd}`);
    };
    const fullHeaders = `${Array.from({ length: 50 }, (_, i) => `/blog/existing-${i}/\n  Cache-Control: x\n/blog/existing-${i}\n  Cache-Control: x`).join('\n')}\n/assets/*\n  Cache-Control: y\n`;
    const fakeFs = makeFakeFs({ articleJson: UNPUBLISHED_ARTICLE, headersText: fullHeaders });
    let onSlugKnownSlug = null;
    let writesWhenSlugKnownFired = null;
    const onSlugKnown = (slug) => {
      onSlugKnownSlug = slug;
      writesWhenSlugKnownFired = Object.keys(fakeFs.written).length;
    };
    await assert.rejects(
      () => runPublishOnMerge({ mergeSha: 'abc', exec, fs: fakeFs, blogArticlesSlugs: ['x'], onSlugKnown }),
      /over Cloudflare Pages/
    );
    assert.equal(onSlugKnownSlug, 'x', 'onSlugKnown must fire with the real slug even though the run ultimately throws');
    assert.equal(writesWhenSlugKnownFired, 0, 'onSlugKnown must fire before any fs write (the write phase)');
  });

  test('onSlugKnown never fires when slug resolution itself fails (git diff error) -- there is no slug to report', async () => {
    const exec = () => { throw new Error('git error'); };
    const fakeFs = makeFakeFs({ articleJson: UNPUBLISHED_ARTICLE, headersText: CLEAN_HEADERS });
    let called = false;
    const onSlugKnown = () => { called = true; };
    await assert.rejects(() => runPublishOnMerge({ mergeSha: 'abc', exec, fs: fakeFs, blogArticlesSlugs: ['x'], onSlugKnown }));
    assert.equal(called, false);
  });
});

// FIX 2 (2026-08-31) -- the failure email's --detail text must report what
// actually happened, never a guess. The original hardcoded Russian string
// ("вероятно, превышен лимит _headers...") was written before this
// workflow had ever run and was simply wrong on its first real failure
// (an unrelated shallow-checkout bug -- see README.md's "Publish-on-
// merge" decision record). This function is the one place that decision
// gets made, so it's the one place that needs a test proving each branch.
describe('buildFailureDetail — reports what happened, never asserts a cause it does not have', () => {
  test('a captured log containing the _headers cap-guard error -- names the real, identifiable cause', () => {
    const log = '[publishOnMerge] FATAL: insertCacheEntry: adding "x" would bring the total to 102 rules, over Cloudflare Pages\' 100-rule limit -- refusing to write. Prune stale entries...';
    const detail = buildFailureDetail(log);
    assert.match(detail, /100-rule limit/);
    assert.match(detail, /_headers/);
  });

  test('a captured log with any other error -- reports the captured text, invents no cause', () => {
    const log = 'fatal: bad revision \'abc~1\'\n[publishOnMerge] FATAL: [publishOnMerge] git diff failed: Command failed: git diff --name-only --diff-filter=A abc~1 abc -- src/data/generated-articles/\n. Refusing to guess which article this PR added.';
    const detail = buildFailureDetail(log);
    assert.match(detail, /bad revision/);
    assert.doesNotMatch(detail, /100-rule limit/);
    assert.doesNotMatch(detail, /_headers/i);
  });

  test('empty/unreadable log -- the neutral message, no cause named', () => {
    for (const empty of ['', '   \n', null, undefined]) {
      const detail = buildFailureDetail(empty);
      assert.equal(detail, 'publish sequence failed after merge; the article is merged on main but published:false -- see the run log.');
    }
  });

  test('a very long captured log is capped, not sent to the email in full', () => {
    const log = `x`.repeat(5000);
    const detail = buildFailureDetail(log);
    assert.ok(detail.length < 5000, 'a runaway stack trace must not produce an unreadable email');
  });
});
