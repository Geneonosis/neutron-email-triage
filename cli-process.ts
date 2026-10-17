import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const workerPath = fileURLToPath(new URL('./worker.js', import.meta.url));

import type { CliResult, WorkerResponse } from './types.js';

interface RunCliOptions {
  executable?: string;
  environment?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}

export function runCli(args: string[], {
  executable = process.execPath,
  environment = process.env,
  timeoutMs = 300_000,
}: RunCliOptions = {}): Promise<CliResult> {
  return new Promise((resolve) => {
    // In Electron, process.execPath is electron.exe, not node.exe.
    const child = spawn(executable, [workerPath, ...args, '--json'], {
      env: { ...environment, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (code: number, parsed: WorkerResponse | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({ code, stdout, stderr, parsed });
    };
    const timeout = setTimeout(() => {
      child.kill();
      finish(124, {
        ok: false,
        command: args[0],
        error: `Worker exceeded ${timeoutMs / 1000}s and was stopped. Some messages may already have been processed; review history before retrying.`,
      });
    }, timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (data: string) => { stdout += data; });
    child.stderr.on('data', (data: string) => { stderr += data; });
    child.on('error', (error) => {
      finish(1, { ok: false, command: args[0], error: error.message });
    });
    child.on('close', (code) => {
      if (settled) return;
      let parsed: WorkerResponse;
      try {
        parsed = JSON.parse(stdout) as WorkerResponse;
      } catch {
        finish(code || 1, {
          ok: false,
          command: args[0],
          error: stderr.trim() || `Worker exited (${code}) without a valid JSON response.`,
        });
        return;
      }
      const exitCode = code ?? 1;
      if (exitCode !== 0) {
        parsed.ok = false;
        parsed.error ??= stderr.trim() || `Worker exited (${exitCode}).`;
      }
      finish(exitCode, parsed);
    });
  });
}
