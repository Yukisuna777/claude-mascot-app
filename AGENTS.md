# AGENTS.md

AIエージェント（Claude Code など）がこのリポジトリで作業する際のガイドラインです。

## プロジェクト概要

Electron製のデスクトップアプリ。  
xterm.js + node-pty によるPowerShellターミナルと、ターミナル出力を監視してリアクションするマスコットキャラを同一ウィンドウに表示する。

## アーキテクチャの理解

### プロセス構造

```
Electron Main Process (main.js)
  ├── node-pty (PowerShellプロセスを管理)
  ├── ファイルシステム (ログ書き込み)
  └── IPC ハンドラ
        │ contextBridge (preload.js)
        ▼
Renderer Process (renderer/)
  ├── xterm.js (ターミナルUI)
  └── マスコット状態機械
```

### IPC通信のルール

- `ipcMain.handle` / `ipcRenderer.invoke` → 戻り値が必要な非同期操作
- `ipcMain.on` / `ipcRenderer.send` → 戻り値不要の一方向送信
- レンダラー → メイン: `window.electronAPI.*`（preload.jsで定義）
- メイン → レンダラー: `mainWindow.webContents.send('channel', data)`

**重要:** `nodeIntegration: false` + `contextIsolation: true` の構成。レンダラーからNode.jsを直接呼ぶことは禁止。必ずpreload.jsのcontextBridgeを経由する。

## 変更時の注意事項

### node-pty

- ネイティブモジュール。現在はNAPIプリビルドバイナリ（`prebuilds/win32-x64/`）を使用。
- Windowsターゲットのため `powershell.exe` をハードコード（`main.js:57`）。
- node-ptyのバージョンを上げる際はNAPIプリビルドが含まれているか確認すること。
- 万が一ビルドが必要になった場合は `npm run rebuild`（Python + Build Tools が必要）。

### xterm.js

- `xterm` と `xterm-addon-fit` はESM非対応のためCDN/バンドルは使わず `node_modules` からHTMLで直接読み込み。
- `renderer/index.html` の script タグの順序が重要: `xterm.js` → `xterm-addon-fit.js` → `renderer.js`。

### ANSI除去

- メインプロセスでは `strip-ansi`（CommonJS互換のv6系を指定）を使用。
- レンダラーでは `strip-ansi` がESMのため独自の簡易実装（`renderer.js:4-7`）を使用。
- v7以降はESMのみなので `package.json` の `"strip-ansi": "^6.0.1"` を維持すること。

### マスコット状態

- 状態定義は `renderer/renderer.js` の `STATES` オブジェクト（`renderer.js:10-41`）に集約。
- 検出優先度: `alert` > `error` > `done` > `working`（`renderer.js:68`）。
- `done` / `error` は一時的状態（5秒後に `waiting` に戻る）。
- キーワードを追加・変更する場合は `STATES[stateName].keywords` 配列を編集する。

### CSS / スタイル

- CSS変数（`:root`）でカラーパレットを管理（`styles.css:8-15`）。
- 状態別スタイルは `body.state-*` セレクターで制御（`styles.css:130-137`）。
- マスコット顔文字エリア: `#mascot-face`、状態ラベル: `#mascot-state-label`、メッセージ: `#mascot-message`。

## やってはいけないこと

- レンダラーで `require()` を直接呼ぶ（`nodeIntegration: false` のため動作しない）
- `preload.js` で公開するAPIにユーザー入力をそのままシェルコマンドとして渡す（コマンドインジェクション）
- `strip-ansi` を v7以上に上げる（ESMのみとなりメインプロセスで動かなくなる）
- `node_modules` をコミットに含める（`.gitignore` で除外済み）
- `logs/` 以下のファイルをコミットに含める

## ファイルを追加する際のガイドライン

- 新しいIPCチャンネルを追加する場合: `main.js` にハンドラ → `preload.js` に公開 → `renderer.js` で使用の順に実装する
- UIコンポーネントを追加する場合: HTML要素を `index.html` に追加し、スタイルを `styles.css` に、ロジックを `renderer.js` に記述する
- GIF画像を追加する場合: `assets/` に配置し `STATES` オブジェクトに `imageUrl` を追加する

## ログファイル

- 保存先: `logs/session_YYYYMMDD_HHMMSS.txt`
- 形式: ANSI除去済みの改行区切りテキスト
- `logs/` は `.gitignore` で除外済み。コミット不要。
