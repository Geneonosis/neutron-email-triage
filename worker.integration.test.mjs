/**
 * Integration test: the full execute path against a fake Bridge IMAP server.
 *
 * This is the test that would have caught the silent-exit bug: running
 * messageMove from inside the fetch-stream loop killed the connection,
 * the pending promise never settled, and Node exited 0 with no summary.
 * The worker now collects fetch results first and only then issues commands.
 *
 * No real mailbox, no real Jev key: all messages are pre-logged in a temp
 * decisions.jsonl so the stored-decision path runs with zero network calls.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { startFakeBridge } from './test-bridge.mjs';

const WORKER = join(dirname(fileURLToPath(import.meta.url)), 'dist', 'worker.js');

const MESSAGES = [
  {
    uid: 1,
    messageId: '<keep-1@x>',
    subject: 'Payment receipt for your order',
    fromName: 'Store', fromLocal: 'receipts', fromHost: 'store.example',
  },
  {
    uid: 2,
    messageId: '<junk-2@x>',
    subject: 'SALE 80% OFF EVERYTHING',
    fromName: 'SpamCo', fromLocal: 'deals', fromHost: 'spam.example',
  },
  {
    uid: 3,
    messageId: '<mid-3@x>',
    subject: 'Your weekly digest',
    fromName: 'Digest', fromLocal: 'news', fromHost: 'digest.example',
  },
];

function runWorker(args, { port, logPath }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [WORKER, ...args], {
      env: {
        ...process.env,
        PROTON_MAIL_BRIDGE_HOSTNAME: '127.0.0.1',
        PROTON_MAIL_BRIDGE_PORT: String(port),
        PROTON_MAIL_BRIDGE_USERNAME: 'test@example.com',
        PROTON_MAIL_BRIDGE_PASSWORD: 'test-pass',
        TYPESAFE_AI_API_KEY: 'test-key',
        PROTON_TRIAGE_LOG: logPath,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('execute mode moves stored high-confidence trash and nothing else', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'proton-triage-int-'));
  const logPath = join(dir, 'decisions.jsonl');
  try {
    // pre-log all three messages: one keeper, one clear junk, one borderline
    const entries = [
      { messageId: '<keep-1@x>', choice: 'keep', probabilities: { keep: 0.95, review: 0.04, trash: 0.01, other: 0 } },
      { messageId: '<junk-2@x>', choice: 'trash', probabilities: { keep: 0, review: 0.02, trash: 0.97, other: 0 } },
      { messageId: '<mid-3@x>', choice: 'review', probabilities: { keep: 0.2, review: 0.55, trash: 0.25, other: 0 } },
    ];
    writeFileSync(logPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');

    const bridge = startFakeBridge({ messages: MESSAGES });
    const port = await bridge.listen();
    try {
      const { code, stdout, stderr } = await runWorker(
        ['--execute', '--trash-threshold', '0.9', '--limit', 'all'],
        { port, logPath },
      );

      // The bug this guards against: silent exit 0 with no summary.
      assert.equal(code, 0, `worker exited ${code}\nstdout:\n${stdout}\nstderr:\n${stderr}`);
      assert.match(stdout, /--- summary ---/, `summary missing\nstdout:\n${stdout}\nstderr:\n${stderr}`);
      assert.match(stdout, /moved to trash: 1/, `expected 1 move\nstdout:\n${stdout}`);
      assert.match(stdout, /Logged out\./, `clean logout missing\nstdout:\n${stdout}`);

      // exactly the junk message moved on the server
      assert.equal(bridge.moved.length, 1);
      assert.equal(bridge.moved[0].uid, 2);
      assert.equal(bridge.inbox.length, 2);
      assert.deepEqual(bridge.inbox.map((m) => m.uid).sort(), [1, 3]);

      // the log records the move with the stored decision
      const logLines = readFileSync(logPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
      const moveEntry = logLines.find((l) => l.action === 'moved-to-trash');
      assert.ok(moveEntry, 'no moved-to-trash log entry');
      assert.equal(moveEntry.messageId, '<junk-2@x>');
      assert.equal(moveEntry.executedFrom, 'stored-decision');
      assert.equal(moveEntry.mode, 'execute');
      assert.equal(moveEntry.trashThreshold, 0.9);
    } finally {
      await bridge.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('execute mode leaves borderline review decisions alone', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'proton-triage-int-'));
  const logPath = join(dir, 'decisions.jsonl');
  try {
    writeFileSync(logPath, JSON.stringify({
      messageId: '<mid-3@x>', choice: 'review',
      probabilities: { keep: 0.2, review: 0.55, trash: 0.25, other: 0 },
    }) + '\n');

    const bridge = startFakeBridge({ messages: [MESSAGES[2]] });
    const port = await bridge.listen();
    try {
      const { code, stdout } = await runWorker(
        ['--execute', '--trash-threshold', '0.9', '--limit', 'all'],
        { port, logPath },
      );
      assert.equal(code, 0);
      assert.match(stdout, /moved to trash: 0/);
      assert.equal(bridge.moved.length, 0);
      assert.equal(bridge.inbox.length, 1);
    } finally {
      await bridge.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('dry run against the fake bridge classifies nothing new and moves nothing', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'proton-triage-int-'));
  const logPath = join(dir, 'decisions.jsonl');
  try {
    // empty log: all messages are new, but classifyEmail would hit the real
    // Jev endpoint - so this test uses a threshold-gated execute with
    // pre-logged entries instead. Here: verify dry-run plumbing works
    // (connect, lock, search, fetch, skip) when everything is already logged.
    writeFileSync(logPath, JSON.stringify({
      messageId: '<keep-1@x>', choice: 'keep',
      probabilities: { keep: 0.95, review: 0.04, trash: 0.01, other: 0 },
    }) + '\n');

    const bridge = startFakeBridge({ messages: [MESSAGES[0]] });
    const port = await bridge.listen();
    try {
      const { code, stdout } = await runWorker(['--limit', 'all'], { port, logPath });
      assert.equal(code, 0, stdout);
      assert.match(stdout, /DRY RUN COMPLETE/);
      assert.match(stdout, /skipped \(already logged\): 1/);
      assert.equal(bridge.moved.length, 0);
    } finally {
      await bridge.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
