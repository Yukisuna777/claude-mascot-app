# Claude Code Mascot App

Claude Code を使いながら、ターミナル出力に反応してリアクションするデスクトップマスコットキャラクターのElectronアプリです。

## 概要

ウィンドウを左右に分割して、左側にPowerShell内蔵ターミナル、右側にマスコットキャラを表示します。
ターミナルの出力をリアルタイムで監視し、キーワードに応じてマスコットの状態が変化します。

```
┌─────────────────────────────────────────┐
│ toolbar: 📁 cwd  [ログ保存]  [再起動]   │
├───────────────────────┬─────────────────┤
│                       │                 │
│   xterm.js            │  マスコット     │
│   (PowerShell)        │  ( ´ω` )       │
│                       │  待機中         │
│                       │                 │
└───────────────────────┴─────────────────┘
```

## マスコットの状態

| 状態 | 顔文字 | トリガーキーワード |
|---|---|---|
| 待機中 | `( ´ω` )` | デフォルト |
| 作業中 | `( ´ ▽ ` )ﾉ` | Running / Writing / Reading / Building 等 |
| 許可待ち | `(°ロ°)` | Do you want / Allow / [Y/N] / proceed? 等 |
| 完了 | `( ˘ω˘ )ﾖｼ` | Done / ✓ / Success / Finished 等 |
| エラー | `(╥ω╥)` | Error / Failed / Exception / Traceback 等 |

完了・エラー状態は5秒後に自動で待機中に戻ります。

## 必要環境

- Windows 10/11
- Node.js v18以上
- npm

> **Note:** node-pty はNAPIビルド済みのプリビルドバイナリを使用しているため、Python / Visual Studio Build Tools は不要です。

## セットアップ

```bash
git clone https://github.com/Yukisuna777/claude-mascot-app.git
cd claude-mascot-app
npm install
npm start
```

## 起動フロー

1. アプリ起動
2. フォルダ選択ダイアログが開く
3. 作業フォルダを選択するとPowerShellが起動
4. ターミナル操作開始・マスコット監視開始

## 機能

### ターミナル
- xterm.js + node-pty による本物のPTY（PowerShell）
- Dracula テーマ配色
- フォント: Cascadia Code / Consolas
- スクロールバック: 5000行
- ウィンドウリサイズに自動追従

### マスコット
- ターミナル出力のANSIコードを除去してキーワード検出
- 左右ペインはドラッグでリサイズ可能

### ログ保存
- ツールバーの「ログ保存」チェックボックスで ON/OFF 切り替え
- 保存先: `logs/session_YYYYMMDD_HHMMSS.txt`
- ANSI除去済みのテキストを保存

## ファイル構成

```
claude-mascot-app/
├── main.js          # メインプロセス（PTY管理・ログ・ダイアログ）
├── preload.js       # コンテキストブリッジ（IPC公開）
├── renderer/
│   ├── index.html   # 画面構造
│   ├── renderer.js  # マスコット状態管理・xterm.js初期化
│   └── styles.css   # Dracula風ダークテーマ
├── assets/          # マスコット画像置き場（現在はテキスト顔文字）
└── logs/            # セッションログ（自動生成）
```

## GIF画像の差し替え

現在はテキスト顔文字をプレースホルダーとして使用しています。
`assets/` フォルダに以下のファイルを置き、`renderer/renderer.js` の `STATES` オブジェクトに `imageUrl` プロパティを追加することで差し替えできます。

| ファイル名 | 状態 |
|---|---|
| `waiting.gif` | 待機中 |
| `working.gif` | 作業中 |
| `alert.gif` | 許可待ち |
| `done.gif` | 完了 |
| `error.gif` | エラー |

## IPC API（preload.js）

| メソッド | 方向 | 説明 |
|---|---|---|
| `selectFolder()` | invoke | フォルダ選択ダイアログを開く |
| `startPty(cwd)` | invoke | PowerShellをcwdで起動 |
| `sendInput(data)` | send | キー入力をPTYへ送信 |
| `resize(cols, rows)` | send | PTYのサイズ変更 |
| `onPtyData(cb)` | on | PTY出力を受信 |
| `onPtyExit(cb)` | on | PTY終了を受信 |
| `setLogging(enabled)` | invoke | ログ保存ON/OFF |
| `logLine(text)` | send | 1行ログ書き込み |

## 依存パッケージ

| パッケージ | 用途 |
|---|---|
| `electron` | デスクトップアプリフレームワーク |
| `node-pty` | 擬似ターミナル（PTY） |
| `xterm` | ターミナルエミュレータUI |
| `xterm-addon-fit` | xtermのリサイズアドオン |
| `strip-ansi` | ANSIエスケープコード除去（メインプロセス用） |
