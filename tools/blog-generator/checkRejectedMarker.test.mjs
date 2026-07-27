import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { checkRejectedMarker } from './checkRejectedMarker.mjs';

// Fixed 2026-07-27: the prior inline-bash version silently treated "the
// .rejected/ directory doesn't exist" the same as "it exists and is
// empty" -- both reported `false`, so a checkpoint whose job is "was a
// marker written" gave a confident answer to a question it couldn't
// actually answer in the first case. `unknown` must be a distinct state.

describe('checkRejectedMarker — three-state directory check (2026-07-27)', () => {
  test('directory does not exist at all -> "unknown", never a confident "false"', () => {
    const result = checkRejectedMarker({
      rejectedDirPath: 'src/data/generated-articles/.rejected/',
      existsSync: () => false,
      exec: () => { throw new Error('exec must never be called when the directory does not exist'); },
    });
    assert.equal(result.state, 'unknown');
    assert.match(result.reason, /does not exist/);
  });

  test('directory exists with a new untracked marker file -> "true"', () => {
    const result = checkRejectedMarker({
      rejectedDirPath: 'src/data/generated-articles/.rejected/',
      existsSync: () => true,
      exec: (cmd) => {
        assert.match(cmd, /git status --porcelain/);
        assert.match(cmd, /\.rejected\//);
        return '?? src/data/generated-articles/.rejected/some-topic.json\n';
      },
    });
    assert.equal(result.state, 'true');
  });

  test('directory exists but genuinely has no new untracked files -> "false"', () => {
    const result = checkRejectedMarker({
      rejectedDirPath: 'src/data/generated-articles/.rejected/',
      existsSync: () => true,
      exec: () => '', // clean git status output
    });
    assert.equal(result.state, 'false');
  });

  test('directory exists with unrelated porcelain output (no "??" lines) -> "false"', () => {
    const result = checkRejectedMarker({
      rejectedDirPath: 'src/data/generated-articles/.rejected/',
      existsSync: () => true,
      exec: () => ' M src/data/generated-articles/.rejected/already-tracked.json\n',
    });
    assert.equal(result.state, 'false');
  });

  test('default rejectedDirPath matches the real repo path used by handleTrippedGate', () => {
    let seenPath;
    checkRejectedMarker({
      existsSync: (p) => { seenPath = p; return true; },
      exec: () => '',
    });
    assert.equal(seenPath, 'src/data/generated-articles/.rejected/');
  });
});
