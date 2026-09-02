import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseAddedMarkerFiles, getMergedMarkerFiles, readMarkerTopic } from './markerMerged.mjs';

describe('parseAddedMarkerFiles — pure', () => {
  test('a single marker file -> returned', () => {
    assert.deepEqual(
      parseAddedMarkerFiles('src/data/generated-articles/.rejected/some-topic.json\n'),
      ['src/data/generated-articles/.rejected/some-topic.json']
    );
  });

  test('excludes real article files (never mistaken for a marker)', () => {
    assert.deepEqual(
      parseAddedMarkerFiles('src/data/generated-articles/vail-ranch-temecula-neighborhood-guide.json\n'),
      []
    );
  });

  test('excludes files outside .rejected/ that ride along in the same PR (e.g. citation-host-log.json)', () => {
    assert.deepEqual(
      parseAddedMarkerFiles('tools/blog-generator/citation-host-log.json\nsrc/data/generated-articles/.rejected/x.json\n'),
      ['src/data/generated-articles/.rejected/x.json']
    );
  });

  test('blank diff output -> empty array, not a crash', () => {
    assert.deepEqual(parseAddedMarkerFiles(''), []);
    assert.deepEqual(parseAddedMarkerFiles('   \n'), []);
  });
});

describe('getMergedMarkerFiles — reports, never throws on zero/many (that is the caller\'s call)', () => {
  test('exactly one marker file -> returned', () => {
    const exec = () => 'src/data/generated-articles/.rejected/x.json\n';
    assert.deepEqual(getMergedMarkerFiles({ mergeSha: 'abc', exec }), ['src/data/generated-articles/.rejected/x.json']);
  });

  test('zero marker files -> empty array, not a throw', () => {
    const exec = () => '';
    assert.deepEqual(getMergedMarkerFiles({ mergeSha: 'abc', exec }), []);
  });

  test('a git diff failure throws, never silently reports "nothing added"', () => {
    const exec = () => { throw new Error('git error'); };
    assert.throws(() => getMergedMarkerFiles({ mergeSha: 'abc', exec }), /git diff failed/);
  });
});

describe('readMarkerTopic — never throws, null on any failure', () => {
  test('a readable marker file -> its sourceTopic', () => {
    const fs = { readFileSync: () => JSON.stringify({ sourceTopic: 'How California\'s PCOR Works' }) };
    assert.equal(readMarkerTopic({ filePath: 'x.json', fs }), 'How California\'s PCOR Works');
  });

  test('a missing sourceTopic field -> null', () => {
    const fs = { readFileSync: () => JSON.stringify({ rejectedAt: '2026-01-01' }) };
    assert.equal(readMarkerTopic({ filePath: 'x.json', fs }), null);
  });

  test('an unreadable file -> null, not a throw', () => {
    const fs = { readFileSync: () => { throw new Error('ENOENT'); } };
    assert.equal(readMarkerTopic({ filePath: 'x.json', fs }), null);
  });

  test('unparseable JSON -> null, not a throw', () => {
    const fs = { readFileSync: () => 'not json' };
    assert.equal(readMarkerTopic({ filePath: 'x.json', fs }), null);
  });
});
