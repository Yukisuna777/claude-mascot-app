'use strict';

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
    keywords: ['Running', 'Writing', 'Reading', 'Executing', 'Compiling', 'Building', 'Installing', 'Fetching', 'Downloading'],
  },
  alert: {
    face: '(°ロ°)',
    label: '許可待ち',
    message: '確認してほしいことがあるよ！',
    keywords: ['Do you want', 'proceed?', 'Allow', 'Confirm', '[Y/N]', '(y/n)', 'Press any key', 'Are you sure'],
  },
  done: {
    face: '( ˘ω˘ )ﾖｼ',
    label: '完了',
    message: 'できたよ！お疲れさま！',
    keywords: ['✓', 'Done', 'Complete', 'Finished', 'Success', 'succeeded', 'passed'],
  },
  error: {
    face: '(╥ω╥)',
    label: 'エラー',
    message: 'うまくいかなかったみたい…',
    keywords: ['Error', 'error', 'Failed', 'failed', 'FAILED', '×', 'Exception', 'Traceback', 'cannot', 'Cannot'],
  },
};

// ── 状態管理 ──────────────────────────────────────────────────
let currentState = 'waiting';
let stateTimer = null;

const mascotFace  = document.getElementById('mascot-face');
const mascotState = document.getElementById('mascot-state');
const mascotMsg   = document.getElementById('mascot-message');

function setState(name, temporary = false) {
  if (stateTimer) { clearTimeout(stateTimer); stateTimer = null; }
  const s = STATES[name] || STATES.waiting;
  currentState = name;
  mascotFace.textContent  = s.face;
  mascotState.textContent = s.label;
  mascotMsg.textContent   = s.message;
  document.body.className = `state-${name}`;
  if (temporary) stateTimer = setTimeout(() => setState('waiting'), 5000);
}

function detectState(text) {
  const order = ['alert', 'error', 'done', 'working'];
  for (const name of order) {
    if (STATES[name].keywords.some((kw) => text.includes(kw))) {
      setState(name, name === 'done' || name === 'error');
      return;
    }
  }
  if (text.trim() && currentState === 'waiting') setState('working');
}

// ── ログビュー ─────────────────────────────────────────────────
const logView = document.getElementById('log-view');
const MAX_LOG_LINES = 80;

// PowerShell トランスクリプトのヘッダー行を除外するパターン
const SKIP_PATTERN = /^\*{3}|^Windows PowerShell|^Copyright|^Start time:|^End time:|^Machine:|^Username:/i;

function appendLog(text) {
  if (SKIP_PATTERN.test(text)) return;
  const div = document.createElement('div');
  div.className = 'log-line';
  div.textContent = text;
  // キーワード含む行は明るく
  const isHighlight = ['Error', 'Failed', 'Done', 'Success', '✓', 'Warning', 'Allow'].some((kw) => text.includes(kw));
  if (isHighlight) div.classList.add('highlight');
  logView.appendChild(div);

  // 行数制限
  while (logView.children.length > MAX_LOG_LINES) {
    logView.removeChild(logView.firstChild);
  }
  logView.scrollTop = logView.scrollHeight;
}

// ── 起動フロー ────────────────────────────────────────────────
const overlay    = document.getElementById('overlay');
const appEl      = document.getElementById('app');
const btnSelect  = document.getElementById('btn-select');
const cwdLabel   = document.getElementById('cwd-label');
const btnRestart = document.getElementById('btn-restart');

let currentCwd = null;

async function startSession(cwd) {
  currentCwd = cwd;
  cwdLabel.textContent = cwd;
  logView.innerHTML = '';
  setState('waiting');
  await window.electronAPI.startSession(cwd);
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
  await startSession(currentCwd);
});

// ── トランスクリプト行受信 ────────────────────────────────────
window.electronAPI.onTranscriptLine((line) => {
  appendLog(line);
  detectState(line);
});

// 初期状態
setState('waiting');
