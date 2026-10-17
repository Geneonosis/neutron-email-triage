/**
 * proton-triage unit tests
 *
 * Run with:  node --test
 *
 * These tests cover the logic that can run without Bridge or a Jev key:
 * argument parsing, safety gates, the stored-decision threshold rule,
 * log parsing, and the Jev client (with an injected fetch).
 * The IMAP plumbing (connection, move-to-Trash) is exercised by dry runs
 * against the real Bridge - deliberately not mocked here.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  parseArgs,
  validateRun,
  shouldMoveToTrash,
  classifyEmail,
  loadLoggedEntries,
  logDecision,
  TRIAGE_QUESTION,
} from './dist/worker.js';

// ------------------------------------------------------------ parseArgs

test('parseArgs: defaults', () => {
  const { args, errors } = parseArgs([]);
  assert.deepEqual(errors, []);
  assert.equal(args.limit, 20);
  assert.equal(args.offset, 0);
  assert.equal(args.execute, false);
  assert.equal(args.trashThreshold, null);
  assert.equal(args.includeBody, false);
  assert.equal(args.unreadOnly, false);
  assert.equal(args.reclassify, false);
});

test('parseArgs: --limit all becomes Infinity', () => {
  const { args, errors } = parseArgs(['--limit', 'all']);
  assert.deepEqual(errors, []);
  assert.equal(args.limit, Infinity);
});

test('parseArgs: numeric limit and offset', () => {
  const { args, errors } = parseArgs(['--limit', '100', '--offset', '120']);
  assert.deepEqual(errors, []);
  assert.equal(args.limit, 100);
  assert.equal(args.offset, 120);
});

test('parseArgs: execute + threshold + flags', () => {
  const { args, errors } = parseArgs(['--execute', '--trash-threshold', '0.9', '--unreadonly', '--include-body', '--reclassify']);
  assert.deepEqual(errors, []);
  assert.equal(args.execute, true);
  assert.equal(args.trashThreshold, 0.9);
  assert.equal(args.unreadOnly, true);
  assert.equal(args.includeBody, true);
  assert.equal(args.reclassify, true);
});

test('parseArgs: unknown argument is an error', () => {
  const { errors } = parseArgs(['--nope']);
  assert.ok(errors.some((e) => e.includes('--nope')));
});

test('parseArgs: non-numeric threshold is an error', () => {
  const { errors } = parseArgs(['--trash-threshold', 'abc']);
  assert.ok(errors.some((e) => e.includes('not a number')));
});

test('parseArgs: missing value for flag is an error', () => {
  const { errors } = parseArgs(['--limit']);
  assert.ok(errors.some((e) => e.includes('--limit requires a value')));
});

// ------------------------------------------------------------ safety gates

test('validateRun: execute without threshold is blocked', () => {
  const { args } = parseArgs(['--execute']);
  const violations = validateRun(args);
  assert.ok(violations.some((v) => v.includes('--execute requires --trash-threshold')));
});

test('validateRun: execute with threshold below 0.9 is blocked', () => {
  for (const t of [0.5, 0.7, 0.89]) {
    const { args } = parseArgs(['--execute', '--trash-threshold', String(t)]);
    assert.ok(validateRun(args).some((v) => v.includes('refusing')), `threshold ${t} should be refused`);
  }
});

test('validateRun: execute at 0.9 and above is allowed', () => {
  for (const t of [0.9, 0.95, 1.0]) {
    const { args } = parseArgs(['--execute', '--trash-threshold', String(t)]);
    assert.deepEqual(validateRun(args), [], `threshold ${t} should pass`);
  }
});

test('validateRun: dry run never needs a threshold', () => {
  const { args } = parseArgs(['--limit', 'all']);
  assert.deepEqual(validateRun(args), []);
});

// ------------------------------------------- stored-decision threshold rule

const entry = (choice, pTrash) => ({
  choice,
  probabilities: { keep: 0, review: 1 - pTrash, trash: pTrash, other: 0 },
  confidence: 0.9,
});

test('shouldMoveToTrash: exactly at threshold moves (boundary inclusive)', () => {
  assert.equal(shouldMoveToTrash(entry('trash', 0.9), 0.9), true);
});

test('shouldMoveToTrash: just below threshold does not move', () => {
  assert.equal(shouldMoveToTrash(entry('trash', 0.8999), 0.9), false);
});

test('shouldMoveToTrash: high P(trash) but choice=review does NOT move', () => {
  // belt-and-braces: even a 0.99 probability must not trash a review decision
  assert.equal(shouldMoveToTrash(entry('review', 0.99), 0.9), false);
});

test('shouldMoveToTrash: high P(trash) but choice=keep does NOT move', () => {
  assert.equal(shouldMoveToTrash(entry('keep', 0.99), 0.9), false);
});

test('shouldMoveToTrash: missing probabilities does not move', () => {
  assert.equal(shouldMoveToTrash({ choice: 'trash' }, 0.9), false);
  assert.equal(shouldMoveToTrash({ choice: 'trash', probabilities: {} }, 0.9), false);
});

test('shouldMoveToTrash: NaN probability does not move', () => {
  assert.equal(shouldMoveToTrash({ choice: 'trash', probabilities: { trash: NaN } }, 0.9), false);
});

test('shouldMoveToTrash: null/undefined entry does not move', () => {
  assert.equal(shouldMoveToTrash(null, 0.9), false);
  assert.equal(shouldMoveToTrash(undefined, 0.9), false);
});

// ------------------------------------------------------------ log I/O

test('loadLoggedEntries: parses entries and keys by messageId', () => {
  const dir = mkdtempSync(join(tmpdir(), 'proton-triage-test-'));
  try {
    const logPath = join(dir, 'decisions.jsonl');
    writeFileSync(logPath, [
      JSON.stringify({ messageId: 'a@x', choice: 'trash', probabilities: { trash: 0.95 } }),
      '',
      'this line is not json {{{',
      JSON.stringify({ messageId: 'b@x', choice: 'keep', probabilities: { trash: 0.01 } }),
    ].join('\n') + '\n');
    const logged = loadLoggedEntries(logPath);
    assert.equal(logged.size, 2);
    assert.equal(logged.get('a@x').choice, 'trash');
    assert.equal(logged.get('b@x').choice, 'keep');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadLoggedEntries: last line wins for duplicate messageId', () => {
  const dir = mkdtempSync(join(tmpdir(), 'proton-triage-test-'));
  try {
    const logPath = join(dir, 'decisions.jsonl');
    writeFileSync(logPath, [
      JSON.stringify({ messageId: 'a@x', choice: 'keep', probabilities: { trash: 0.1 } }),
      JSON.stringify({ messageId: 'a@x', choice: 'trash', probabilities: { trash: 0.95 } }),
    ].join('\n') + '\n');
    const logged = loadLoggedEntries(logPath);
    assert.equal(logged.get('a@x').choice, 'trash');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadLoggedEntries: missing file returns empty map', () => {
  const logged = loadLoggedEntries('/nonexistent/path/decisions.jsonl');
  assert.equal(logged.size, 0);
});

test('logDecision: writes valid JSONL that round-trips', () => {
  const dir = mkdtempSync(join(tmpdir(), 'proton-triage-test-'));
  try {
    const logPath = join(dir, 'decisions.jsonl');
    logDecision(logPath, { ts: '2026-10-14T00:00:00Z', messageId: 'z@x', choice: 'trash', probabilities: { trash: 0.97 } });
    logDecision(logPath, { ts: '2026-10-14T00:00:01Z', messageId: 'y@x', choice: 'keep', probabilities: { trash: 0.02 } });
    const lines = readFileSync(logPath, 'utf8').trim().split('\n');
    assert.equal(lines.length, 2);
    const logged = loadLoggedEntries(logPath);
    assert.equal(logged.get('z@x').probabilities.trash, 0.97);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ------------------------------------------------------------ classifyEmail

test('classifyEmail: parses a well-formed Jev response', async () => {
  const fakeFetch = async (url, opts) => {
    assert.equal(url, 'https://api.typesafe.ai/v1/systemone');
    assert.equal(opts.method, 'POST');
    assert.match(opts.headers.Authorization, /^Bearer test-key$/);
    const body = JSON.parse(opts.body);
    assert.equal(body.model, 'jev-1.14.0');
    assert.ok(body.state.subject);
    assert.equal(body.questions.triage.type, 'choice');
    assert.ok(body.questions.triage.criteria.trash);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        model: 'jev-1.14.0',
        answers: {
          triage: {
            type: 'choice',
            choice: 'trash',
            confidence: 0.96,
            probabilities: { keep: 0, review: 0.03, trash: 0.97, other: 0 },
          },
        },
        usage: { input_tokens: 447, output_tokens: 46 },
      }),
    };
  };
  const result = await classifyEmail(
    { from: 'deals@x.example', subject: 'SPAM', date: null },
    { typesafeKey: 'test-key', fetchImpl: fakeFetch },
  );
  assert.equal(result.choice, 'trash');
  assert.equal(result.probabilities.trash, 0.97);
  assert.equal(result.confidence, 0.96);
  assert.equal(result.usage.input_tokens, 447);
});

test('classifyEmail: HTTP error surfaces the status and body', async () => {
  const fakeFetch = async () => ({ ok: false, status: 401, text: async () => 'unauthorized' });
  await assert.rejects(
    classifyEmail({ from: 'a', subject: 'b', date: null }, { typesafeKey: 'k', fetchImpl: fakeFetch }),
    /Jev API 401/,
  );
});

test('classifyEmail: malformed response shape is rejected', async () => {
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({ answers: { triage: { choice: 'trash' } } }), // no probabilities
  });
  await assert.rejects(
    classifyEmail({ from: 'a', subject: 'b', date: null }, { typesafeKey: 'k', fetchImpl: fakeFetch }),
    /Unexpected Jev response shape/,
  );
});

test('classifyEmail: missing key throws immediately', async () => {
  await assert.rejects(classifyEmail({ from: 'a', subject: 'b' }, {}));
});

test('TRIAGE_QUESTION: rubric includes archive with descriptions', () => {
  assert.equal(TRIAGE_QUESTION.type, 'choice');
  for (const opt of ['keep', 'archive', 'review', 'trash', 'other']) {
    assert.ok(TRIAGE_QUESTION.criteria[opt], `missing criteria for ${opt}`);
    assert.ok(typeof TRIAGE_QUESTION.criteria[opt] === 'string');
  }
  assert.match(TRIAGE_QUESTION.instructions, /archive/i);
  assert.match(TRIAGE_QUESTION.criteria.archive, /newsletters/i);
});
