const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  startSession: (cwd) => ipcRenderer.invoke('start-session', cwd),
  onTranscriptLine: (callback) =>
    ipcRenderer.on('transcript-line', (_e, line) => callback(line)),
});
