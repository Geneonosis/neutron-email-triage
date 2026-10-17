import { app, BrowserWindow, ipcMain } from 'electron';
import { runCli } from './cli-process.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getHealthResult, getConfigResult, getHistoryResult } from './worker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const userDataPath = app.isPackaged
  ? join(app.getPath('appData'), 'proton-triage')
  : join(__dirname, '..', '.electron-data');
app.setPath('userData', userDataPath);
const decisionsLogPath = app.isPackaged
  ? join(userDataPath, 'decisions.jsonl')
  : undefined;

function runWorker(args: string[]) {
  if (!decisionsLogPath) return runCli(args);
  return runCli(args, {
    environment: { ...process.env, PROTON_TRIAGE_LOG: decisionsLogPath },
  });
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.webContents.on('console-message', ({ level, message }) => {
    console.log(`[renderer:${level}] ${message}`);
  });
  win.loadFile(join(__dirname, 'renderer', 'index.html'));
}

ipcMain.handle('triage:health', async () => ({
  code: 0,
  stdout: '',
  stderr: '',
  parsed: getHealthResult(),
}));
ipcMain.handle('triage:config', async () => ({
  code: 0,
  stdout: '',
  stderr: '',
  parsed: getConfigResult(decisionsLogPath),
}));
ipcMain.handle('triage:history', async (_e, limit: number = 50) => ({
  code: 0,
  stdout: '',
  stderr: '',
  parsed: getHistoryResult(limit, decisionsLogPath),
}));
ipcMain.handle('triage:run', async (_e, options: import('./types.js').RunOptions = {}) => {
  const args = ['run'];
  if (options.limit) args.push('--limit', String(options.limit));
  if (options.offset) args.push('--offset', String(options.offset));
  if (options.includeBody) args.push('--include-body');
  if (options.unreadOnly) args.push('--unreadonly');
  if (options.reclassify) args.push('--reclassify');
  if (options.execute) {
    args.push('--execute');
    if (options.trashThreshold != null) args.push('--trash-threshold', String(options.trashThreshold));
  }
  return runWorker(args);
});
ipcMain.handle(
  'triage:move',
  async (_e, uid: number, destination: import('./types.js').MailDestination) =>
    runWorker(['move', '--uid', String(uid), '--destination', destination]),
);

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
