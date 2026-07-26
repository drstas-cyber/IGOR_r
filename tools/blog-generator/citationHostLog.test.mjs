import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendHostLogEntries, readHostLog, buildHostLogEntries } from './citationHostLog.mjs';

function isolatedLogPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'host-log-test-'));
  return path.join(dir, 'citation-host-log.json');
}

describe('readHostLog', () => {
  test('a nonexistent log file reads as an empty array', () => {
    assert.deepEqual(readHostLog(isolatedLogPath()), []);
  });

  test('a corrupted log file reads as an empty array rather than throwing', () => {
    const logPath = isolatedLogPath();
    fs.writeFileSync(logPath, '{ not valid json', 'utf8');
    assert.deepEqual(readHostLog(logPath), []);
  });

  test('a log file containing a non-array reads as an empty array', () => {
    const logPath = isolatedLogPath();
    fs.writeFileSync(logPath, JSON.stringify({ not: 'an array' }), 'utf8');
    assert.deepEqual(readHostLog(logPath), []);
  });
});

describe('appendHostLogEntries', () => {
  test('creates the file and directory if neither exists', () => {
    const logPath = isolatedLogPath();
    const entries = [{ runId: '1', host: 'law.justia.com', status: 403 }];
    const result = appendHostLogEntries(logPath, entries);
    assert.equal(result.length, 1);
    assert.ok(fs.existsSync(logPath));
  });

  test('appends to existing entries rather than overwriting them', () => {
    const logPath = isolatedLogPath();
    appendHostLogEntries(logPath, [{ runId: '1', host: 'a.gov', status: 403 }]);
    const result = appendHostLogEntries(logPath, [{ runId: '2', host: 'b.gov', status: 429 }]);
    assert.equal(result.length, 2);
    assert.equal(readHostLog(logPath).length, 2);
  });

  test('an empty entries array is a no-op, does not create the file', () => {
    const logPath = isolatedLogPath();
    appendHostLogEntries(logPath, []);
    assert.equal(fs.existsSync(logPath), false);
  });
});

describe('buildHostLogEntries — pure', () => {
  test('only UNREACHABLE_LIKELY_BOT outcomes are logged, not RESOLVED or FAILED', () => {
    const citationResults = [
      { id: '1', host: 'a.gov', status: 200, outcome: 'RESOLVED', url: 'https://a.gov/x' },
      { id: '2', host: 'b.gov', status: 403, outcome: 'UNREACHABLE_LIKELY_BOT', url: 'https://b.gov/x' },
      { id: '3', host: 'c.gov', status: 404, outcome: 'FAILED', url: 'https://c.gov/x' },
    ];
    const entries = buildHostLogEntries({ runId: 'r1', sourceTopic: 'Test Topic', citationResults });
    assert.equal(entries.length, 1);
    assert.equal(entries[0].host, 'b.gov');
    assert.equal(entries[0].status, 403);
    assert.equal(entries[0].sourceTopic, 'Test Topic');
    assert.equal(entries[0].runId, 'r1');
    assert.ok(entries[0].loggedAt);
  });

  test('zero UNREACHABLE_LIKELY_BOT results produces zero entries', () => {
    const entries = buildHostLogEntries({ runId: 'r1', sourceTopic: 't', citationResults: [{ outcome: 'RESOLVED' }] });
    assert.deepEqual(entries, []);
  });
});
