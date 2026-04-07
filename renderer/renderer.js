'use strict';

// ── ANSI除去（strip-ansiはESMなのでレンダラーでは簡易版を使用） ──
function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1B\][^\x07]*\x07/g, '');
}

// ── マスコット状態定義 ─────────────────────────────────────────
const STATES = {
  waiting: {
    face: '( ´ω` )',
    label: '待機中',
    message: '何でも聞いてね！',
    keywords: [],
  },
  working: {
    face: '( ´ ▽ ` )ﾉ',
    label: '作業中',
    message: 'がんばってるよ〜！',
    keywords: ['Running', 'Writing', 'Reading', 'Executing', 'Compiling', 'Building', 'Installing'],
  },
  alert: {
    face: '(°ロ°)',
    label: '許可待ち',
    message: '確認してほしいことがあるよ！',
    keywords: ['Do you want', 'proceed?', 'Allow', 'Confirm', '[Y/N]', '(y/n)', 'Press any key'],
  },
  done: {
    face: '( ˘ω˘ )ﾖｼ',
    label: '完了',
    message: 'できたよ！お疲れさま！',
    keywords: ['✓', 'Done', 'Complete', 'Finished', 'Success', 'succeeded'],
  },
  error: {
    face: '(╥ω╥)',
    label: 'エラー',
    message: 'うまくいかなかったみたい…',
    keywords: ['Error', 'error', 'Failed', 'failed', 'FAILED', '×', 'Exception', 'Traceback'],
  },
};

// ── 状態管理 ──────────────────────────────────────────────────
let currentState = 'waiting';
let stateTimer = null;

const mascotFace = document.getElementById('mascot-face');
const mascotLabel = document.getElementById('mascot-state-label');
const mascotMsg = document.getElementById('mascot-message');

function setState(name, temporary = false) {
  if (stateTimer) { clearTimeout(stateTimer); stateTimer = null; }
  const s = STATES[name] || STATES.waiting;
  currentState = name;
  mascotFace.textContent = s.face;
  mascotLabel.textContent = s.label;
  mascotMsg.textContent = s.message;
  document.body.className = `state-${name}`;

  if (temporary) {
    // done / error は5秒後にwaitingへ戻る
    stateTimer = setTimeout(() => setState('waiting'), 5000);
  }
}

function detectState(text) {
  // 優先度: alert > error > done > working
  const order = ['alert', 'error', 'done', 'working'];
  for (const name of order) {
    const kws = STATES[name].keywords;
    if (kws.some((kw) => text.includes(kw))) {
      const temporary = name === 'done' || name === 'error';
      setState(name, temporary);
      return;
    }
  }
  // 特定キーワードなし → 何か出力があれば working、なければ変えない
  if (text.trim().length > 0 && currentState === 'waiting') {
    setState('working');
  }
}

// ── ターミナル初期化 ───────────────────────────────────────────
const term = new Terminal({
  fontFamily: '"Cascadia Code", "Consolas", monospace',
  fontSize: 14,
  theme: {
    background: '#1e1e2e',
    foreground: '#f8f8f2',
    cursor: '#bd93f9',
    selectionBackground: '#44475a',
    black: '#21222c', red: '#ff5555', green: '#50fa7b',
    yellow: '#f1fa8c', blue: '#bd93f9', magenta: '#ff79c6',
    cyan: '#8be9fd', white: '#f8f8f2',
    brightBlack: '#6272a4', brightRed: '#ff6e6e', brightGreen: '#69ff94',
    brightYellow: '#ffffa5', brightBlue: '#d6acff', brightMagenta: '#ff92df',
    brightCyan: '#a4ffff', brightWhite: '#ffffff',
  },
  cursorBlink: true,
  scrollback: 5000,
  allowTransparency: false,
});

const fitAddon = new FitAddon.FitAddon();
term.loadAddon(fitAddon);

// ── 起動フロー ────────────────────────────────────────────────
const overlay  = document.getElementById('overlay');
const appEl    = document.getElementById('app');
const btnSelect = document.getElementById('btn-select');
const cwdLabel  = document.getElementById('cwd-label');
const toggleLog = document.getElementById('toggle-log');
const btnRestart = document.getElementById('btn-restart');

let currentCwd = null;

async function startSession(cwd) {
  currentCwd = cwd;
  cwdLabel.textContent = '📁 ' + cwd;

  // ターミナル描画
  const termEl = document.getElementById('terminal');
  term.open(termEl);
  fitAddon.fit();
  setState('waiting');

  // PTY起動
  await window.electronAPI.startPty(cwd);
}

btnSelect.addEventListener('click', async () => {
  const folder = await window.electronAPI.selectFolder();
  if (!folder) return;

  overlay.classList.add('hidden');
  appEl.classList.remove('hidden');

  await startSession(folder);
});

btnRestart.addEventListener('click', async () => {
  if (!currentCwd) return;
  term.clear();
  setState('waiting');
  await window.electronAPI.startPty(currentCwd);
});

// ── PTYデータ受信 ─────────────────────────────────────────────
let lineBuffer = '';

window.electronAPI.onPtyData((data) => {
  term.write(data);

  // ログ & 状態検出用: ANSIを除いてバッファリング
  const clean = stripAnsi(data);
  lineBuffer += clean;

  // 改行で分割して処理
  const lines = lineBuffer.split(/\r?\n/);
  lineBuffer = lines.pop(); // 末尾の未完行を残す

  for (const line of lines) {
    if (line.trim()) {
      detectState(line);
      window.electronAPI.logLine(line);
    }
  }
});

window.electronAPI.onPtyExit(() => {
  term.writeln('\r\n\x1b[90m[セッション終了]\x1b[0m');
  setState('waiting');
});

// ── キー入力 → PTY ───────────────────────────────────────────
term.onData((data) => {
  window.electronAPI.sendInput(data);
});

// ── リサイズ ──────────────────────────────────────────────────
const resizeObserver = new ResizeObserver(() => {
  fitAddon.fit();
  window.electronAPI.resize(term.cols, term.rows);
});
resizeObserver.observe(document.getElementById('terminal'));

window.addEventListener('resize', () => {
  fitAddon.fit();
  window.electronAPI.resize(term.cols, term.rows);
});

// ── ペインリサイザー（ドラッグ） ─────────────────────────────
const resizer = document.getElementById('resizer');
const termPane = document.getElementById('terminal-pane');
const mascotPane = document.getElementById('mascot-pane');

let dragging = false;
let startX = 0;
let startMascotW = 0;

resizer.addEventListener('mousedown', (e) => {
  dragging = true;
  startX = e.clientX;
  startMascotW = mascotPane.offsetWidth;
  resizer.classList.add('dragging');
  document.body.style.userSelect = 'none';
});

document.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const delta = startX - e.clientX;
  const newW = Math.min(480, Math.max(180, startMascotW + delta));
  mascotPane.style.width = newW + 'px';
  fitAddon.fit();
  window.electronAPI.resize(term.cols, term.rows);
});

document.addEventListener('mouseup', () => {
  if (!dragging) return;
  dragging = false;
  resizer.classList.remove('dragging');
  document.body.style.userSelect = '';
});

// ── ログ ON/OFF ───────────────────────────────────────────────
toggleLog.addEventListener('change', async () => {
  await window.electronAPI.setLogging(toggleLog.checked);
});

// ── コピー / ペースト ─────────────────────────────────────────
async function copySelection() {
  const sel = term.getSelection();
  if (sel) await window.electronAPI.clipboardWrite(sel);
}

async function pasteFromClipboard() {
  const text = await window.electronAPI.clipboardRead();
  if (text) window.electronAPI.sendInput(text);
}

// Ctrl+Shift+C / Ctrl+Shift+V をxtermより先に処理
term.attachCustomKeyEventHandler((e) => {
  if (e.type !== 'keydown') return true;
  if (e.ctrlKey && e.shiftKey && e.code === 'KeyC') {
    copySelection();
    return false; // xtermへ伝播しない
  }
  if (e.ctrlKey && e.shiftKey && e.code === 'KeyV') {
    pasteFromClipboard();
    return false;
  }
  return true;
});

// 右クリックメニュー
document.getElementById('terminal').addEventListener('contextmenu', () => {
  window.electronAPI.showContextMenu(term.hasSelection());
});

window.electronAPI.onContextMenuAction((action) => {
  if (action === 'copy') copySelection();
  if (action === 'paste') pasteFromClipboard();
});
