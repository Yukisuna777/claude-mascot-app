const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindow;
let transcriptWatcher = null;
let processedLines = 0;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 300,
    height: 430,
    minWidth: 240,
    minHeight: 320,
    title: 'Claude Code Mascot',
    alwaysOnTop: true,
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
  if (transcriptWatcher) transcriptWatcher.close();
  if (process.platform !== 'darwin') app.quit();
});

// ── フォルダ選択 ──────────────────────────────────────────────
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '作業フォルダを選択してください',
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// ── ログフォルダ ──────────────────────────────────────────────
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

// ── PowerShell を別ウィンドウで起動 ──────────────────────────
ipcMain.handle('start-session', async (event, cwd) => {
  // 前のウォッチャーを停止
  if (transcriptWatcher) {
    transcriptWatcher.close();
    transcriptWatcher = null;
  }

  const now = new Date();
  const ts = now.toISOString().replace(/[-:T]/g, (c) => (c === 'T' ? '_' : c)).slice(0, 15);
  const logPath = path.join(logsDir, `session_${ts}.txt`);

  // 起動スクリプトを一時ファイルへ書き出す
  const scriptPath = path.join(os.tmpdir(), 'claude_mascot_session.ps1');
  const esc = (s) => s.replace(/'/g, "''");
  const script = [
    `Start-Transcript -Path '${esc(logPath)}' -Append -Force`,
    `Set-Location '${esc(cwd)}'`,
    `Write-Host '--- Session started ---'`,
  ].join('\r\n');
  fs.writeFileSync(scriptPath, script, 'utf8');

  // cmd /c start で別ウィンドウのPowerShellを起動
  const child = spawn(
    'cmd.exe',
    ['/c', 'start', 'powershell.exe', '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
    { detached: true, stdio: 'ignore', cwd }
  );
  child.unref();

  // トランスクリプトファイルの監視開始
  watchTranscript(logPath);

  return { logPath, cwd };
});

// ── トランスクリプト監視 ──────────────────────────────────────
function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1B\][^\x07]*\x07/g, '');
}

function readNewLines(logPath) {
  if (!fs.existsSync(logPath)) return;
  try {
    const raw = fs.readFileSync(logPath);
    // Windows PowerShell は UTF-16 LE、PowerShell 7 は UTF-8 BOM
    let content;
    if (raw[0] === 0xFF && raw[1] === 0xFE) {
      content = raw.slice(2).toString('utf16le');
    } else {
      content = raw.toString('utf8').replace(/^\uFEFF/, '');
    }
    const lines = content.split(/\r?\n/).filter((l) => l.trim());
    const newLines = lines.slice(processedLines);
    processedLines = lines.length;

    if (!mainWindow.isDestroyed()) {
      for (const line of newLines) {
        mainWindow.webContents.send('transcript-line', stripAnsi(line));
      }
    }
  } catch (_) {
    // ファイルがロック中の場合は次の変更イベントで再試行
  }
}

function watchTranscript(logPath) {
  processedLines = 0;

  const tryWatch = () => {
    if (!fs.existsSync(logPath)) {
      setTimeout(tryWatch, 500);
      return;
    }
    readNewLines(logPath); // 初回読み込み
    transcriptWatcher = fs.watch(logPath, () => readNewLines(logPath));
  };

  tryWatch();
}
