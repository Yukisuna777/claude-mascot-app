const { app, BrowserWindow, ipcMain, dialog, clipboard, Menu } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 750,
    minWidth: 800,
    minHeight: 500,
    title: 'Claude Code Mascot',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── フォルダ選択ダイアログ ──────────────────────────────────────
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '作業フォルダを選択してください',
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// ── node-pty (PowerShell) ───────────────────────────────────────
let ptyProcess = null;

ipcMain.handle('start-pty', (event, cwd) => {
  if (ptyProcess) {
    ptyProcess.kill();
    ptyProcess = null;
  }

  const pty = require('node-pty');
  const shell = 'powershell.exe';

  ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: 120,
    rows: 30,
    cwd: cwd || os.homedir(),
    env: process.env,
  });

  ptyProcess.onData((data) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('pty-data', data);
    }
  });

  ptyProcess.onExit(() => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('pty-exit');
    }
  });

  return true;
});

ipcMain.on('pty-input', (event, data) => {
  if (ptyProcess) ptyProcess.write(data);
});

ipcMain.on('pty-resize', (event, { cols, rows }) => {
  if (ptyProcess) ptyProcess.resize(cols, rows);
});

// ── ログ保存 ───────────────────────────────────────────────────
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

let logStream = null;
let logEnabled = false;

ipcMain.handle('set-logging', (event, enabled) => {
  logEnabled = enabled;
  if (enabled && !logStream) {
    const now = new Date();
    const ts = now.toISOString().replace(/[-:T]/g, (c) => (c === 'T' ? '_' : c)).slice(0, 15);
    const filename = `session_${ts}.txt`;
    logStream = fs.createWriteStream(path.join(logsDir, filename), { flags: 'a' });
  } else if (!enabled && logStream) {
    logStream.end();
    logStream = null;
  }
  return logEnabled;
});

ipcMain.on('log-line', (event, text) => {
  if (logEnabled && logStream) {
    logStream.write(text + '\n');
  }
});

// ── クリップボード ─────────────────────────────────────────────
ipcMain.handle('clipboard-read', () => clipboard.readText());
ipcMain.handle('clipboard-write', (event, text) => clipboard.writeText(text));

// ── 右クリックコンテキストメニュー ────────────────────────────
ipcMain.on('show-context-menu', (event, hasSelection) => {
  const menu = Menu.buildFromTemplate([
    {
      label: 'コピー',
      enabled: hasSelection,
      click: () => event.sender.send('context-menu-action', 'copy'),
    },
    {
      label: 'ペースト',
      click: () => event.sender.send('context-menu-action', 'paste'),
    },
  ]);
  menu.popup({ window: mainWindow });
});
