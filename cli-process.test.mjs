import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import electronPath from 'electron';
import { runCli } from './dist/cli-process.js';
import { startFakeBridge } from './test-bridge.mjs';

for (const executable of [process.execPath, electronPath]) {
  const runtime = executable === process.execPath ? 'Node' : 'Electron';
  for (const prefix of [[], ['run'], ['scan']]) {
    test(`${runtime}: ${prefix[0] || 'legacy flags'} returns JSON from a fake mailbox`, { timeout: 15_000 }, async () => {
      const dir = mkdtempSync(join(tmpdir(), 'triage-launch-'));
      const logPath = join(dir, 'decisions.jsonl');
      const bridge = startFakeBridge({
        messages: [{ uid: 1, messageId: '<test@local>', subject: 'Test receipt' }],
      });
      try {
        writeFileSync(logPath, JSON.stringify({
          messageId: '<test@local>', choice: 'keep', probabilities: { trash: 0 },
        }) + '\n');
        const port = await bridge.listen();
        const result = await runCli([...prefix, '--limit', '1'], {
          executable,
          timeoutMs: 10_000,
          environment: {
            ...process.env,
            PROTON_MAIL_BRIDGE_HOSTNAME: '127.0.0.1',
            PROTON_MAIL_BRIDGE_PORT: String(port),
            PROTON_MAIL_BRIDGE_USERNAME: 'test',
            PROTON_MAIL_BRIDGE_PASSWORD: 'test',
            TYPESAFE_AI_API_KEY: 'test-key',
            PROTON_TRIAGE_LOG: logPath,
          },
        });
        assert.equal(result.code, 0, JSON.stringify(result));
        assert.equal(result.parsed.ok, true);
        assert.deepEqual(JSON.parse(result.stdout), result.parsed);
        assert.equal(result.parsed.summary.skipped, 1);
        assert.equal(result.parsed.summary.moved, 0);
        assert.equal(result.parsed.recommendations[0].subject, 'Test receipt');
        assert.equal(result.parsed.recommendations[0].from, 'Sender <sender@example.com>');
        assert.equal(result.parsed.recommendations[0].recommendation, 'keep');
        assert.equal(result.parsed.recommendations[0].confidence, 0);
        assert.ok(result.parsed.recommendations[0].date);
        assert.equal(bridge.moved.length, 0);
      } finally {
        await bridge.close();
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }
}

test('Electron runtime reports validation errors as JSON without contacting a mailbox', async () => {
  const result = await runCli(['run', '--execute'], { executable: electronPath, timeoutMs: 10_000 });
  assert.equal(result.code, 1);
  assert.equal(result.parsed.ok, false);
  assert.match(result.parsed.error, /requires --trash-threshold/);
  assert.deepEqual(JSON.parse(result.stdout), result.parsed);
});

test('launch errors resolve promptly with an explicit failure', async () => {
  const result = await runCli(['health'], { executable: join(tmpdir(), 'missing-triage-executable.exe') });
  assert.equal(result.code, 1);
  assert.equal(result.parsed.ok, false);
  assert.match(result.parsed.error, /ENOENT/);
});

test('move command moves an inbox message to Trash or Archive', { timeout: 15_000 }, async () => {
  for (const destination of ['trash', 'archive']) {
    const bridge = startFakeBridge({
      messages: [{ uid: 42, messageId: `<move-${destination}@local>`, subject: 'Test message' }],
    });
    try {
      const port = await bridge.listen();
      const result = await runCli(['move', '--uid', '42', '--destination', destination], {
        timeoutMs: 10_000,
        environment: {
          ...process.env,
          PROTON_MAIL_BRIDGE_HOSTNAME: '127.0.0.1',
          PROTON_MAIL_BRIDGE_PORT: String(port),
          PROTON_MAIL_BRIDGE_USERNAME: 'test',
          PROTON_MAIL_BRIDGE_PASSWORD: 'test',
        },
      });
      assert.equal(result.code, 0, JSON.stringify(result));
      assert.equal(result.parsed.ok, true);
      assert.equal(bridge.moves.length, 1);
      assert.equal(bridge.moves[0].uid, 42);
      assert.match(bridge.moves[0].destination.toLowerCase(), new RegExp(`${destination}$`));
    } finally {
      await bridge.close();
    }
  }
});
