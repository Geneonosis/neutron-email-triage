import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('triage', {
  health: (): Promise<import('./types.js').CliResult> => ipcRenderer.invoke('triage:health'),
  config: (): Promise<import('./types.js').CliResult> => ipcRenderer.invoke('triage:config'),
  history: (limit: number): Promise<import('./types.js').CliResult> => ipcRenderer.invoke('triage:history', limit),
  run: (options: import('./types.js').RunOptions): Promise<import('./types.js').CliResult> => ipcRenderer.invoke('triage:run', options),
  move: (uid: number, destination: import('./types.js').MailDestination): Promise<import('./types.js').CliResult> =>
    ipcRenderer.invoke('triage:move', uid, destination),
});
