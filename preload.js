const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // フォルダ選択
  selectFolder: () => ipcRenderer.invoke('select-folder'),

  // PTY制御
  startPty: (cwd) => ipcRenderer.invoke('start-pty', cwd),
  sendInput: (data) => ipcRenderer.send('pty-input', data),
  resize: (cols, rows) => ipcRenderer.send('pty-resize', { cols, rows }),

  // PTYイベント受信
  onPtyData: (callback) => ipcRenderer.on('pty-data', (_e, data) => callback(data)),
  onPtyExit: (callback) => ipcRenderer.on('pty-exit', (_e) => callback()),

  // ログ
  setLogging: (enabled) => ipcRenderer.invoke('set-logging', enabled),
  logLine: (text) => ipcRenderer.send('log-line', text),
});
