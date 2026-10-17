#!/usr/bin/env node
/**
 * neutron-email-triage worker
 *
 * Classifies recent Proton Mail inbox messages with the Jev decision model
 * (TypeSafe System One API) and, ONLY when explicitly enabled with a
 * calibrated threshold, moves high-confidence junk to Trash.
 *
 * Defaults to DRY RUN: classifies and logs, moves nothing.
 *
 * Usage:
 *   npm run run -- --limit 50
 *   npm run run -- --limit all
 *   npm run run -- --limit 100 --offset 100
 *   npm run run -- --include-body
 *   npm run run -- --unreadonly
 *   npm run run -- --reclassify
 *   npm run run -- --execute --trash-threshold 0.97
 *
 * Required environment variables:
 *   PROTON_MAIL_BRIDGE_HOSTNAME, PROTON_MAIL_BRIDGE_PORT,
 *   PROTON_MAIL_BRIDGE_USERNAME, PROTON_MAIL_BRIDGE_PASSWORD
 *   TYPESAFE_AI_API_KEY
 */

import { ImapFlow } from 'imapflow';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { argv, env } from 'node:process';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { realpathSync } from 'node:fs';
import type { EmailRecommendation, HistoryEntry, MailDestination, WorkerResponse } from './types.js';

interface RunArgs {
  limit: number;
  offset: number;
  includeBody: boolean;
  execute: boolean;
  trashThreshold: number | null;
  unreadOnly: boolean;
  reclassify: boolean;
  json: boolean;
}

interface TriageDecision {
  choice: string;
  probabilities: Record<string, number>;
}

interface StoredDecision extends Omit<HistoryEntry, 'choice' | 'probabilities'>, TriageDecision {
  messageId: string;
  date?: string | null;
  action?: string;
  confidence?: number | null;
  model?: string;
}

interface EmailForClassification {
  from: string;
  subject: string;
  date: Date | null;
  snippet?: string | null;
}

interface ClassificationResult {
  choice: string;
  probabilities: Record<string, number>;
  confidence: number | null;
  usage: unknown;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function confidenceScore(result: {
  confidence?: number | null;
  probabilities?: Record<string, number>;
}): number | null {
  if (typeof result.confidence === 'number' && Number.isFinite(result.confidence)) {
    return result.confidence;
  }
  const scores = Object.values(result.probabilities ?? {}).filter(Number.isFinite);
  return scores.length ? Math.max(...scores) : null;
}

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
// Tests override this so they never touch the real decision log.
const DEFAULT_DECISIONS_LOG = env.NEUTRON_EMAIL_TRIAGE_LOG
  ?? env.PROTON_TRIAGE_LOG
  ?? join(SCRIPT_DIR, '..', 'decisions.jsonl');
const MODEL = 'jev-1.14.0'; // pinned: thresholds are calibrated against this exact model
const TYPESAFE_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const TRASH_FOLDER = 'Trash';
const DEFAULT_LIMIT = 20;
const BODY_SNIPPET_CHARS = 600;
const MIN_TRASH_THRESHOLD = 0.9;

function redactSecret(value: string | undefined): string | null {
  if (!value) return null;
  return `${value.slice(0, 3)}***`;
}

function printResult(result: WorkerResponse, asJson: boolean): void {
  if (asJson) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    process.stdout.write(`${result.message}\n`);
  }
}

// ---------------------------------------------------------------- CLI args

export function parseArgs(argv: string[]): { args: RunArgs; errors: string[] } {
  const args: RunArgs = {
    limit: DEFAULT_LIMIT,
    offset: 0,
    includeBody: false,
    execute: false,
    trashThreshold: null,
    unreadOnly: false,
    reclassify: false,
    json: false,
  };
  const errors = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--limit': {
        const v = argv[++i];
        if (v === undefined) { errors.push('--limit requires a value (number or "all")'); break; }
        args.limit = v === 'all' ? Infinity : Number(v);
        if (Number.isNaN(args.limit)) errors.push(`--limit value is not a number: ${v}`);
        break;
      }
      case '--offset': {
        const v = argv[++i];
        if (v === undefined) { errors.push('--offset requires a value'); break; }
        args.offset = Number(v);
        if (Number.isNaN(args.offset)) errors.push(`--offset value is not a number: ${v}`);
        break;
      }
      case '--include-body': args.includeBody = true; break;
      case '--execute': args.execute = true; break;
      case '--trash-threshold': {
        const v = argv[++i];
        if (v === undefined) { errors.push('--trash-threshold requires a value'); break; }
        args.trashThreshold = Number(v);
        if (Number.isNaN(args.trashThreshold)) errors.push(`--trash-threshold value is not a number: ${v}`);
        break;
      }
      case '--unreadonly': args.unreadOnly = true; break;
      case '--reclassify': args.reclassify = true; break;
      case '--json': args.json = true; break;
      default:
        errors.push(`Unknown argument: ${a}`);
    }
  }
  return { args, errors };
}

/**
 * Safety gates. Returns a list of violation messages; empty = OK to run.
 * Pure function so it can be unit tested without touching the filesystem
 * or the network.
 */
export function validateRun(args: RunArgs): string[] {
  const errors = [];
  if (args.execute && (args.trashThreshold === null || Number.isNaN(args.trashThreshold))) {
    errors.push(
      'SAFETY: --execute requires --trash-threshold <probability 0..1>.',
      'Run in dry-run mode first, review decisions.jsonl, then pick a conservative threshold.',
    );
  } else if (args.execute && args.trashThreshold !== null && args.trashThreshold < MIN_TRASH_THRESHOLD) {
    errors.push(
      `SAFETY: refusing to run with trash threshold ${args.trashThreshold} (< ${MIN_TRASH_THRESHOLD}). Start at 0.95 or higher.`,
    );
  }
  return errors;
}

// ------------------------------------------------------------- Jev question

// The classification rubric. review is the safe default for uncertainty.
// other exists so the model has an honest escape hatch instead of a bad fit.
export const TRIAGE_QUESTION = {
  type: 'choice',
  instructions:
    'Classify this email for an inbox-triage system. Never assume an email should be deleted: trash is only for clearly unsolicited junk. ' +
    'The user is a software developer; personal mail, order confirmations, receipts, account/security notices, ' +
    'and services they actively use are keep. Recommend archive for useful or potentially useful mail that does not need to stay in the inbox, ' +
    'such as newsletters or routine notifications. Choose the option that best matches.',
  criteria: {
    keep: 'personally relevant; the user reads this sender or topic (personal mail, orders, receipts, security notices, actively-used services)',
    archive: 'useful or potentially useful mail that does not need to stay in the inbox, such as newsletters, routine notifications, or reference material',
    review: 'uncertain - could be junk or could matter; the safe default when unsure',
    trash: 'clearly junk, safe to delete (unsolicited marketing, newsletters the user never signed up for, spam, noise)',
    other: 'does not fit any option; leave for human review',
  },
};

/**
 * The core safety decision, extracted so it can be unit tested.
 * A stored decision only justifies a move if BOTH hold:
 *  - the model's winning choice was `trash`, AND
 *  - P(trash) is at or above the threshold (>=, boundary inclusive).
 */
export function shouldMoveToTrash(entry: TriageDecision | null | undefined, trashThreshold: number | null): boolean {
  if (!entry) return false;
  if (entry.choice !== 'trash') return false;
  const pTrash = entry.probabilities?.trash;
  if (typeof pTrash !== 'number' || Number.isNaN(pTrash)) return false;
  return trashThreshold !== null && pTrash >= trashThreshold;
}

/**
 * Call the Jev API. fetchImpl is injectable for tests.
 */
export async function classifyEmail(
  email: EmailForClassification,
  { typesafeKey, fetchImpl = globalThis.fetch }: { typesafeKey?: string; fetchImpl?: typeof fetch } = {},
): Promise<ClassificationResult> {
  if (!typesafeKey) throw new Error('classifyEmail: typesafeKey is required');

  const state: EmailForClassification = {
    from: email.from,
    subject: email.subject,
    date: email.date,
  };
  if (email.snippet) state.snippet = email.snippet;

  const res = await fetchImpl(TYPESAFE_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${typesafeKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      state,
      questions: { triage: TRIAGE_QUESTION },
    }),
  });
  if (!res.ok) {
    throw new Error(`Jev API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json() as {
    answers?: { triage?: { choice?: string; probabilities?: Record<string, number>; confidence?: number | null } };
    usage?: unknown;
  };
  const answer = data.answers?.triage;
  if (!answer || !answer.choice || !answer.probabilities) {
    throw new Error(`Unexpected Jev response shape: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return {
    choice: answer.choice,
    probabilities: answer.probabilities,
    confidence: answer.confidence ?? null,
    usage: data.usage ?? null,
  };
}

// ----------------------------------------------------------------- log I/O

/**
 * Load logged decisions from a JSONL file.
 * Returns Map<messageId, entry>; last line wins (reclassify updates).
 * Malformed lines are ignored, never fatal.
 */
export function loadLoggedEntries(decisionsLogPath: string): Map<string, StoredDecision> {
  const logged = new Map();
  if (!existsSync(decisionsLogPath)) return logged;
  for (const line of readFileSync(decisionsLogPath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line) as StoredDecision;
      logged.set(e.messageId, e);
    } catch {
      // ignore malformed lines
    }
  }
  return logged;
}

export function logDecision(decisionsLogPath: string, entry: HistoryEntry): void {
  appendFileSync(decisionsLogPath, JSON.stringify(entry) + '\n');
}

export function history(limit = 50, decisionsLog = DEFAULT_DECISIONS_LOG): HistoryEntry[] {
  if (!existsSync(decisionsLog)) return [];
  const rows = readFileSync(decisionsLog, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .reverse();
  return rows.slice(0, limit) as HistoryEntry[];
}

export function getHealthResult() {
  return {
    ok: true,
    command: 'health',
    checks: {
      bridgeHost: env.PROTON_MAIL_BRIDGE_HOSTNAME || '127.0.0.1',
      bridgePort: Number(env.PROTON_MAIL_BRIDGE_PORT || 1143),
      hasBridgeUsername: Boolean(env.PROTON_MAIL_BRIDGE_USERNAME),
      hasBridgePassword: Boolean(env.PROTON_MAIL_BRIDGE_PASSWORD),
      hasTypeSafeKey: Boolean(env.TYPESAFE_AI_API_KEY),
    },
    message: 'Health checks computed.',
  };
}

export function getConfigResult(decisionsLog = DEFAULT_DECISIONS_LOG) {
  return {
    ok: true,
    command: 'config',
    config: {
      model: MODEL,
      decisionsLog,
      bridgeHost: env.PROTON_MAIL_BRIDGE_HOSTNAME || '127.0.0.1',
      bridgePort: Number(env.PROTON_MAIL_BRIDGE_PORT || 1143),
      bridgeUsername: env.PROTON_MAIL_BRIDGE_USERNAME ?? null,
      bridgePasswordMasked: redactSecret(env.PROTON_MAIL_BRIDGE_PASSWORD),
      typeSafeKeyMasked: redactSecret(env.TYPESAFE_AI_API_KEY),
      minTrashThreshold: MIN_TRASH_THRESHOLD,
    },
    message: 'Config loaded.',
  };
}

export function getHistoryResult(
  limit = 50,
  decisionsLog = DEFAULT_DECISIONS_LOG,
): WorkerResponse {
  const entries = history(limit, decisionsLog);
  return {
    ok: true,
    command: 'history',
    count: entries.length,
    entries,
    message: `Loaded ${entries.length} history entries.`,
  };
}

// -------------------------------------------------------------------- main

function requiredEnv(name: string): string {
  const v = env[name];
  if (!v) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

function createBridgeClient(): ImapFlow {
  return new ImapFlow({
    host: env.PROTON_MAIL_BRIDGE_HOSTNAME || '127.0.0.1',
    port: Number(env.PROTON_MAIL_BRIDGE_PORT || 1143),
    auth: {
      user: requiredEnv('PROTON_MAIL_BRIDGE_USERNAME'),
      pass: requiredEnv('PROTON_MAIL_BRIDGE_PASSWORD'),
    },
    tls: { rejectUnauthorized: false },
    logger: false,
  });
}

function parseMoveArgs(args: string[]): { uid: number; destination: MailDestination } {
  let uid: number | undefined;
  let destination: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json') continue;
    if (args[i] === '--uid') {
      uid = Number(args[++i]);
    } else if (args[i] === '--destination') {
      destination = args[++i];
    } else {
      throw new Error(`Unknown move argument: ${args[i]}`);
    }
  }
  if (!Number.isSafeInteger(uid) || !uid || uid < 1) {
    throw new Error('move requires a positive --uid');
  }
  if (destination !== 'trash' && destination !== 'archive') {
    throw new Error('move requires --destination trash or archive');
  }
  return { uid, destination };
}

export async function moveInboxMessage(
  uid: number,
  destination: MailDestination,
): Promise<{ uid: number; destination: string }> {
  if (!Number.isSafeInteger(uid) || uid < 1) {
    throw new Error('Message UID must be a positive integer.');
  }
  if (destination !== 'trash' && destination !== 'archive') {
    throw new Error(`Unsupported message destination: ${destination}`);
  }

  const client = createBridgeClient();
  await client.connect();
  let lock: Awaited<ReturnType<ImapFlow['getMailboxLock']>> | undefined;
  try {
    const specialUse = destination === 'archive' ? '\\archive' : '\\trash';
    const mailboxes = await client.list();
    const mailbox = mailboxes.find((entry) =>
      entry.specialUse?.toLowerCase() === specialUse
      || entry.path.split(/[/.]/).at(-1)?.toLowerCase() === destination,
    );
    if (!mailbox) {
      const label = destination === 'archive' ? 'Archive' : 'Trash';
      throw new Error(`Could not find a ${label} mailbox in the Proton Mail Bridge account.`);
    }

    lock = await client.getMailboxLock('INBOX');
    const result = await client.messageMove(uid, mailbox.path, { uid: true });
    if (!result) {
      throw new Error(`Message ${uid} was not moved to ${mailbox.path}.`);
    }
    return { uid, destination: mailbox.path };
  } finally {
    lock?.release();
    await client.logout();
  }
}

export async function main(): Promise<void> {
  const rawArgv = argv.slice(2);
  const hasCommand = Boolean(rawArgv[0] && !rawArgv[0].startsWith('--'));
  const command = hasCommand ? rawArgv[0] : 'run';
  const commandArgs = hasCommand ? rawArgv.slice(1) : rawArgv;
  if (command === 'move') {
    const options = parseMoveArgs(commandArgs);
    const result = await moveInboxMessage(options.uid, options.destination);
    printResult({
      ok: true,
      command,
      uid: result.uid,
      destination: result.destination,
      message: `Moved message ${result.uid} to ${result.destination}.`,
    }, true);
    return;
  }
  const { args, errors: argErrors } = parseArgs(commandArgs);
  const out = {
    log: (...parts: unknown[]) => { if (!args.json) console.log(...parts); },
    err: (...parts: unknown[]) => console.error(...parts),
  };
  for (const e of argErrors) out.err(e);
  if (argErrors.length) throw new Error(argErrors.join('\n'));

  if (command === 'health') {
    printResult(getHealthResult(), args.json);
    return;
  }

  if (command === 'config') {
    printResult(getConfigResult(), args.json);
    return;
  }

  if (command === 'history') {
    printResult(getHistoryResult(Number.isFinite(args.limit) ? args.limit : 50), args.json);
    return;
  }

  if (command !== 'run' && command !== 'scan') {
    throw new Error(`Unknown command: ${command}`);
  }

  const violations = validateRun(args);
  for (const v of violations) out.err(v);
  if (violations.length) throw new Error(violations.join('\n'));

  const decisionsLog = DEFAULT_DECISIONS_LOG;

  const mode = args.execute ? 'EXECUTE (moves to Trash!)' : 'DRY RUN (moves nothing)';
  out.log(`neutron-email-triage  model=${MODEL}  mode=${mode}  limit=${args.limit === Infinity ? 'ALL' : args.limit}  offset=${args.offset}`);
  if (args.execute) out.log(`  trash threshold: P(trash) >= ${args.trashThreshold}`);
  if (args.includeBody) out.log('  including body snippet (leaves Proton encryption boundary)');

  const typesafeKey = requiredEnv('TYPESAFE_AI_API_KEY');

  // Bridge serves a self-signed cert on localhost; verification is not meaningful here.
  // The connection is only ever to 127.0.0.1 (set via PROTON_MAIL_BRIDGE_HOSTNAME).
  const bridgeHost = env.PROTON_MAIL_BRIDGE_HOSTNAME || '127.0.0.1';
  const bridgePort = Number(env.PROTON_MAIL_BRIDGE_PORT || 1143);
  const client = createBridgeClient();

  await client.connect();
  out.log(`Connected to ${bridgeHost}:${bridgePort}`);

  // Read-only in dry-run; the connection cannot modify anything.
  const lock = await client.getMailboxLock('INBOX', { readOnly: !args.execute });
  out.log(`Mailbox INBOX locked (${args.execute ? 'read-write' : 'read-only'})`);
  const logged = loadLoggedEntries(decisionsLog);
  let classified = 0;
  let skipped = 0;
  let skippedBelowThreshold = 0;
  let failed = 0;
  let moved = 0;
  let total = 0;
  const wouldTrash = [];
  const recommendations: EmailRecommendation[] = [];

  try {
    const searchCriteria = args.unreadOnly ? { unseen: true } : { all: true };
    const uids = (await client.search(searchCriteria, { uid: true })) || [];
    // newest first: UIDs are assigned in arrival order
    uids.reverse();
    // --offset walks deeper into history: offset N means "skip the newest N messages"
    const fetchUids = uids.slice(
      args.offset,
      args.limit === Infinity ? undefined : args.offset + args.limit,
    );
    total = fetchUids.length;
    out.log(`Found ${uids.length} messages, processing ${fetchUids.length} (oldest first in fetch order: newest)`);

    // IMPORTANT: collect all fetch results FIRST, then act on them.
    // Issuing IMAP commands (messageMove, fetchOne) while a fetch stream is
    // still open breaks the connection mid-stream (the pending command never
    // settles, the event loop drains, and Node exits silently). Dry runs never
    // hit this because they only make HTTP calls inside the loop.
    const messages = [];
    for await (const msg of client.fetch(fetchUids.join(','), { uid: true, envelope: true, flags: true }, { uid: true })) {
      messages.push(msg);
    }
    out.log(`Fetched ${messages.length} messages; processing`);

    for (const msg of messages) {
      const from = msg.envelope?.from?.[0]
        ? `${msg.envelope.from[0].name ?? ''} <${msg.envelope.from[0].address}>`.trim()
        : '(unknown sender)';
      const subject = msg.envelope?.subject ?? '(no subject)';
      const messageId = msg.envelope?.messageId ?? `uid-${msg.uid}`;
      const emailDate = msg.envelope?.date?.toISOString() ?? null;

      const existing = logged.get(messageId);
      if (existing && !args.reclassify) {
        let recordedAction = existing.action;
        // Already classified - act on the STORED decision (no new Jev call).
        if (shouldMoveToTrash(existing, args.trashThreshold) && args.execute) {
          out.log(`  moving uid=${msg.uid} P(trash)=${(existing.probabilities.trash).toFixed(3)} "${subject.slice(0, 50)}"`);
          try {
            await client.messageMove({ uid: msg.uid }, TRASH_FOLDER, { uid: true });
            moved++;
            recordedAction = 'moved-to-trash';
            logDecision(decisionsLog, {
              ts: new Date().toISOString(),
              uid: msg.uid,
              date: emailDate,
              messageId,
              from,
              subject,
              choice: existing.choice,
              probabilities: existing.probabilities,
              confidence: existing.confidence ?? null,
              model: existing.model ?? MODEL,
              mode: 'execute',
              trashThreshold: args.trashThreshold,
              action: 'moved-to-trash',
              executedFrom: 'stored-decision',
            });
            out.log(`  TRASHED (stored) uid=${msg.uid} P(trash)=${(existing.probabilities.trash).toFixed(3)} "${subject.slice(0, 50)}"`);
          } catch (err) {
            failed++;
            out.err(`  move failed uid=${msg.uid}: ${errorMessage(err)}`);
          }
        } else {
          if (args.execute) skippedBelowThreshold++;
          else skipped++;
        }
        recommendations.push({
          uid: msg.uid,
          date: emailDate ?? existing.date ?? null,
          subject,
          from,
          confidence: confidenceScore(existing),
          recommendation: existing.choice,
          probabilities: existing.probabilities,
          action: recordedAction,
        });
        continue;
      }

      let snippet = null;
      if (args.includeBody) {
        try {
          const part = await client.fetchOne(msg.uid, { uid: true, source: true }, { uid: true });
          const text = part && part.source ? part.source.toString('utf8') : '';
          snippet = text.slice(0, BODY_SNIPPET_CHARS);
        } catch {
          snippet = null;
        }
      }

      let result;
      try {
        result = await classifyEmail({ from, subject, date: msg.envelope?.date ?? null, snippet }, { typesafeKey });
      } catch (err) {
        failed++;
        out.err(`  classify failed uid=${msg.uid}: ${errorMessage(err)}`);
        continue;
      }

      const pTrash = result.probabilities.trash ?? 0;
      const action = args.execute && shouldMoveToTrash({ choice: result.choice, probabilities: result.probabilities }, args.trashThreshold)
        ? 'moved-to-trash'
        : 'logged-only';
      let didMove = false;

      logDecision(decisionsLog, {
        ts: new Date().toISOString(),
        uid: msg.uid,
        date: emailDate,
        messageId,
        from,
        subject,
        choice: result.choice,
        probabilities: result.probabilities,
        confidence: result.confidence,
        model: MODEL,
        mode: args.execute ? 'execute' : 'dry-run',
        trashThreshold: args.trashThreshold,
        action,
      });

      if (action === 'moved-to-trash') {
        try {
          await client.messageMove({ uid: msg.uid }, TRASH_FOLDER, { uid: true });
          moved++;
          didMove = true;
          out.log(`  TRASHED uid=${msg.uid} P(trash)=${pTrash.toFixed(3)} "${subject.slice(0, 50)}"`);
        } catch (err) {
          failed++;
          out.err(`  move failed uid=${msg.uid}: ${errorMessage(err)}`);
        }
      } else {
        if (!args.execute && pTrash >= 0.5) wouldTrash.push({ uid: msg.uid, pTrash, subject });
        out.log(`  ${result.choice.padEnd(6)} uid=${msg.uid} P(trash)=${pTrash.toFixed(3)} "${subject.slice(0, 50)}"`);
      }
      recommendations.push({
        uid: msg.uid,
        date: emailDate,
        subject,
        from,
        confidence: confidenceScore(result),
        recommendation: result.choice,
        probabilities: result.probabilities,
        action: didMove ? 'moved-to-trash' : 'logged-only',
      });
      classified++;
    }
  } finally {
    lock.release();
    await client.logout();
    out.log('Logged out.');
  }

  out.log('\n--- summary ---');
  out.log(`classified: ${classified}  skipped (already logged): ${skipped}${args.execute ? `  skipped (below threshold): ${skippedBelowThreshold}` : ''}  failed: ${failed}  moved to trash: ${moved}`);
  if (!args.execute && wouldTrash.length) {
    out.log(`\nIf you had run with --execute --trash-threshold X, these would move:`);
    for (const w of wouldTrash.sort((a, b) => b.pTrash - a.pTrash).slice(0, 10)) {
      out.log(`  P(trash)=${w.pTrash.toFixed(3)} uid=${w.uid} "${w.subject.slice(0, 60)}"`);
    }
  }
  if (!args.execute) {
    out.log('\nDRY RUN COMPLETE - nothing was moved. Review decisions.jsonl.');
  }

  if (args.json) {
    const result = {
      ok: failed === 0,
      command,
      summary: {
        total,
        classified,
        skipped,
        skippedBelowThreshold,
        failed,
        moved,
      },
      wouldTrash: wouldTrash.slice(0, 10),
      recommendations,
      mode: args.execute ? 'execute' : 'dry-run',
      message: 'Run complete.',
    };
    console.log(JSON.stringify(result, null, 2));
  }
  if (failed) process.exitCode = 1;
}

// Run only when executed directly (not when imported by tests).
const isMain = process.argv[1]
  && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
if (isMain) {
  main().catch((err) => {
    if (argv.includes('--json')) {
      printResult({ ok: false, error: errorMessage(err) }, true);
    } else {
      console.error(err);
    }
    process.exitCode = 1;
  });
}
