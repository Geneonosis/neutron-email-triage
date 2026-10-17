/**
 * A minimal fake Proton Mail Bridge IMAP server for integration tests.
 *
 * Implements just enough of IMAP4rev1 for the worker: greeting with
 * capabilities, LOGIN, SELECT/EXAMINE, UID SEARCH, UID FETCH (envelope),
 * UID MOVE (modeled on a real Bridge transcript: untagged COPYUID, then
 * EXPUNGE, then tagged OK), NOOP, LOGOUT.
 *
 * Never used against real accounts - tests only.
 */

import net from 'node:net';

export function startFakeBridge({ messages = [] } = {}) {
  // mutable mailbox state: array of message definitions, in uid order
  const inbox = messages.map((m) => ({ ...m }));
  const moved = []; // messages that were moved to "Trash"
  const moves = [];

  const server = net.createServer((socket) => {
    socket.write('* OK [CAPABILITY IMAP4rev1 MOVE UIDPLUS IDLE AUTH=PLAIN] fake-bridge ready\r\n');

    const send = (line) => socket.write(line + '\r\n');
    const tagOk = (tag, text) => send(`${tag} OK ${text}`);

    socket.on('data', (buf) => {
      const lines = buf.toString('utf8').split('\r\n');
      for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        handle(line);
      }
    });

    function seqOf(uid) {
      return inbox.findIndex((m) => m.uid === uid) + 1;
    }

    function envelope(m) {
      const date = m.date ?? 'Mon, 14 Oct 2026 12:00:00 +0000';
      const fromName = JSON.stringify(m.fromName ?? 'Sender');
      return `ENVELOPE (${JSON.stringify(date)} ${JSON.stringify(m.subject)} ((${fromName} NIL ${JSON.stringify(m.fromLocal ?? 'sender')} ${JSON.stringify(m.fromHost ?? 'example.com')})) NIL NIL NIL NIL NIL NIL ${JSON.stringify(m.messageId)})`;
    }

    function handle(line) {
      const m = line.match(/^(\S+)\s+(.*)$/);
      if (!m) return;
      const tag = m[1];
      const rest = m[2];

      if (/^LIST/i.test(rest)) {
        send('* LIST (\\Archive) "/" "Archive"');
        send('* LIST (\\Trash) "/" "Trash"');
        tagOk(tag, 'LIST completed');
      } else if (/^LOGIN/i.test(rest)) {
        tagOk(tag, 'LOGIN completed');
      } else if (/^(SELECT|EXAMINE)\s+INBOX/i.test(rest)) {
        send(`* ${inbox.length} EXISTS`);
        send('* OK [UIDVALIDITY 116825587] UIDs valid');
        send('* OK [UIDNEXT 1000] next');
        tagOk(tag, '[READ-WRITE] SELECT completed');
      } else if (/^UID\s+SEARCH/i.test(rest)) {
        const uidMatch = rest.match(/UID\s+(\d+)\s*$/i);
        if (uidMatch) {
          const u = Number(uidMatch[1]);
          send(`* SEARCH ${inbox.some((msg) => msg.uid === u) ? u : ''}`);
        } else {
          send(`* SEARCH ${inbox.map((msg) => msg.uid).join(' ')}`);
        }
        tagOk(tag, 'SEARCH completed');
      } else if (/^UID\s+FETCH/i.test(rest)) {
        const setMatch = rest.match(/^UID\s+FETCH\s+([\d:*,]+)\s/i);
        const set = setMatch ? setMatch[1] : '*';
        for (const msg of inbox) {
          if (uidInSet(msg.uid, set)) {
            send(`* ${seqOf(msg.uid)} FETCH (UID ${msg.uid} FLAGS () ${envelope(msg)})`);
          }
        }
        tagOk(tag, 'FETCH completed');
      } else if (/^UID\s+MOVE/i.test(rest)) {
        const uidMatch = rest.match(/^UID\s+MOVE\s+(\d+)\s+("?)(.*?)\2\s*$/i);
        const uid = Number(uidMatch?.[1]);
        const destination = uidMatch?.[3] ?? '';
        const msg = inbox.find((x) => x.uid === uid);
        if (!msg) {
          send(`${tag} BAD no such message`);
          return;
        }
        const seq = seqOf(uid);
        // modeled on the real Bridge transcript: untagged COPYUID, EXPUNGE, tagged OK
        send(`* OK [COPYUID 116825600 ${uid} ${1000 + moved.length}]`);
        inbox.splice(inbox.indexOf(msg), 1);
        moved.push(msg);
        moves.push({ uid, destination });
        send(`* ${seq} EXPUNGE`);
        tagOk(tag, 'Move completed');
      } else if (/^NOOP/i.test(rest)) {
        tagOk(tag, 'NOOP completed');
      } else if (/^LOGOUT/i.test(rest)) {
        send('* BYE fake-bridge');
        tagOk(tag, 'LOGOUT completed');
        socket.end();
      } else {
        // generic OK for optional commands (ID, ENABLE, CAPABILITY, ...)
        tagOk(tag, 'completed');
      }
    }
  });

  return {
    server,
    inbox,
    moved,
    moves,
    listen: () => new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port))),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function uidInSet(uid, set) {
  if (set === '*') return true;
  for (const part of set.split(',')) {
    if (part.includes(':')) {
      const [a, b] = part.split(':').map(Number);
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      if (uid >= lo && uid <= hi) return true;
    } else if (Number(part) === uid) {
      return true;
    }
  }
  return false;
}
