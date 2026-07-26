import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  getLocallyAttemptedTopics,
  getOpenPrAttemptedTopics,
  pickNextAvailableTopic,
} from './topicAvailability.mjs';

function isolatedDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'topic-avail-test-'));
}

function writeJson(dir, name, data) {
  fs.writeFileSync(path.join(dir, name), JSON.stringify(data), 'utf8');
}

describe('getLocallyAttemptedTopics — local ground truth (main\'s checkout)', () => {
  test('empty/nonexistent dir returns an empty set', () => {
    const dir = isolatedDir();
    const known = getLocallyAttemptedTopics(path.join(dir, 'does-not-exist'));
    assert.equal(known.size, 0);
  });

  test('a real generated-article file with sourceTopic is included', () => {
    const dir = isolatedDir();
    writeJson(dir, 'some-article.json', { sourceTopic: 'What First-Time Buyers Should Know About Home Inspections', slug: 'x' });
    const known = getLocallyAttemptedTopics(dir);
    assert.ok(known.has('What First-Time Buyers Should Know About Home Inspections'));
  });

  test('a rejected-attempt marker under .rejected/ is included too', () => {
    const dir = isolatedDir();
    fs.mkdirSync(path.join(dir, '.rejected'));
    writeJson(path.join(dir, '.rejected'), 'rejected-topic.json', { sourceTopic: 'Some Rejected Topic', rejectedAt: '2026-01-01T00:00:00.000Z' });
    const known = getLocallyAttemptedTopics(dir);
    assert.ok(known.has('Some Rejected Topic'));
  });

  test('a malformed JSON file is skipped, does not throw', () => {
    const dir = isolatedDir();
    fs.writeFileSync(path.join(dir, 'broken.json'), '{ not valid json', 'utf8');
    assert.doesNotThrow(() => getLocallyAttemptedTopics(dir));
  });

  test('a file with no sourceTopic field contributes nothing', () => {
    const dir = isolatedDir();
    writeJson(dir, 'no-source-topic.json', { slug: 'x', title: 'y' });
    const known = getLocallyAttemptedTopics(dir);
    assert.equal(known.size, 0);
  });
});

describe('getOpenPrAttemptedTopics — fail-closed (2026-07-26)', () => {
  test('missing repo argument throws', () => {
    assert.throws(() => getOpenPrAttemptedTopics({}), /repo is required/i);
  });

  test('gh pr list failure THROWS, does not silently return empty', () => {
    const exec = () => { throw new Error('simulated gh auth failure'); };
    assert.throws(() => getOpenPrAttemptedTopics({ repo: 'owner/repo', exec }), /gh pr list failed/i);
  });

  test('unparseable gh pr list output THROWS', () => {
    const exec = () => 'not json';
    assert.throws(() => getOpenPrAttemptedTopics({ repo: 'owner/repo', exec }), /could not parse gh pr list/i);
  });

  test('gh pr list returning a non-array THROWS', () => {
    const exec = () => JSON.stringify({ not: 'an array' });
    assert.throws(() => getOpenPrAttemptedTopics({ repo: 'owner/repo', exec }), /did not return an array/i);
  });

  test('a git fetch failure on one branch THROWS the whole call, does not skip that branch silently', () => {
    const exec = (cmd) => {
      if (cmd.startsWith('gh pr list')) return JSON.stringify([{ headRefName: 'blog-generator/auto-123' }]);
      if (cmd.startsWith('git fetch')) throw new Error('simulated network failure');
      throw new Error(`unexpected command in test: ${cmd}`);
    };
    assert.throws(() => getOpenPrAttemptedTopics({ repo: 'owner/repo', exec }), /git fetch of open PR branch/i);
  });

  test('non-blog-generator branches are ignored (no fetch attempted)', () => {
    const exec = (cmd) => {
      if (cmd.startsWith('gh pr list')) return JSON.stringify([{ headRefName: 'some-unrelated-branch' }]);
      throw new Error(`should not be called for an unrelated branch: ${cmd}`);
    };
    const known = getOpenPrAttemptedTopics({ repo: 'owner/repo', exec });
    assert.equal(known.size, 0);
  });

  test('success case: one open PR branch, one article file, sourceTopic extracted', () => {
    const exec = (cmd) => {
      if (cmd.startsWith('gh pr list')) return JSON.stringify([{ headRefName: 'blog-generator/auto-999' }]);
      if (cmd.startsWith('git fetch')) return '';
      if (cmd.startsWith('git ls-tree')) return 'src/data/generated-articles/some-slug.json\n';
      if (cmd.startsWith('git show')) return JSON.stringify({ sourceTopic: 'Understanding HOA Fees Before You Buy in a Planned Community', slug: 'some-slug' });
      throw new Error(`unexpected command: ${cmd}`);
    };
    const known = getOpenPrAttemptedTopics({ repo: 'owner/repo', exec });
    assert.ok(known.has('Understanding HOA Fees Before You Buy in a Planned Community'));
  });

  test('success case: rejected-marker file on an open PR branch is also picked up', () => {
    const exec = (cmd) => {
      if (cmd.startsWith('gh pr list')) return JSON.stringify([{ headRefName: 'blog-generator/rejected-999' }]);
      if (cmd.startsWith('git fetch')) return '';
      if (cmd.startsWith('git ls-tree')) return 'src/data/generated-articles/.rejected/some-topic.json\n';
      if (cmd.startsWith('git show')) return JSON.stringify({ sourceTopic: 'A Rejected Topic On A PR Branch', rejectedAt: '2026-01-01T00:00:00.000Z' });
      throw new Error(`unexpected command: ${cmd}`);
    };
    const known = getOpenPrAttemptedTopics({ repo: 'owner/repo', exec });
    assert.ok(known.has('A Rejected Topic On A PR Branch'));
  });

  test('multiple open PR branches: repeat run collision safety — two rejected attempts on the same topic, different run IDs, both readable with no error', () => {
    const exec = (cmd) => {
      if (cmd.startsWith('gh pr list')) {
        return JSON.stringify([
          { headRefName: 'blog-generator/rejected-111' },
          { headRefName: 'blog-generator/rejected-222' },
        ]);
      }
      if (cmd.startsWith('git fetch')) return '';
      if (cmd.startsWith('git ls-tree')) return 'src/data/generated-articles/.rejected/same-topic.json\n';
      if (cmd.startsWith('git show')) return JSON.stringify({ sourceTopic: 'A Topic That Keeps Tripping', rejectedAt: '2026-01-01T00:00:00.000Z' });
      throw new Error(`unexpected command: ${cmd}`);
    };
    const known = getOpenPrAttemptedTopics({ repo: 'owner/repo', exec });
    assert.ok(known.has('A Topic That Keeps Tripping'));
    assert.equal(known.size, 1, 'same topic from two branches should collapse to one entry, not error');
  });
});

describe('pickNextAvailableTopic — pure', () => {
  test('returns the first topic not in the attempted set', () => {
    const topics = [{ topic: 'A' }, { topic: 'B' }, { topic: 'C' }];
    const attempted = new Set(['A']);
    assert.deepEqual(pickNextAvailableTopic(topics, attempted), { topic: 'B' });
  });

  test('returns null when every topic has been attempted (queue exhausted, not an error)', () => {
    const topics = [{ topic: 'A' }, { topic: 'B' }];
    const attempted = new Set(['A', 'B']);
    assert.equal(pickNextAvailableTopic(topics, attempted), null);
  });

  test('empty topics array returns null', () => {
    assert.equal(pickNextAvailableTopic([], new Set()), null);
  });

  test('exact-string matching: whitespace/casing differences do NOT match — editing a topic\'s text makes it newly-eligible, deliberately', () => {
    const topics = [{ topic: 'What First-Time Buyers Should Know About Home Inspections' }];
    const attempted = new Set(['what first-time buyers should know about home inspections']); // different case
    assert.deepEqual(pickNextAvailableTopic(topics, attempted), topics[0], 'exact-string match only, case-sensitive — this is deliberate, not a bug');
  });
});
