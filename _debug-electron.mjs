import { app, BrowserWindow, ipcMain } from 'electron';
console.log('MAIN: boot');
const winRef = { value: null };
function createWindow() {
  console.log('MAIN: creating window');
  const win = new BrowserWindow({ webPreferences: { contextIsolation: true, nodeIntegration: false } });
  winRef.value = win;
  win.webContents.on('did-finish-load', () => console.log('MAIN: did-finish-load'));
  win.webContents.on('console-message', (_e, level, message) => console.log(`RENDERER[${level}]: ${message}`));
  win.loadFile('renderer/index.html');
}
ipcMain.handle('ping', async () => ({ ok: true }));
app.whenReady().then(createWindow);
