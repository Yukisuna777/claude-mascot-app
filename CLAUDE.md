# CLAUDE.md

## このプロジェクトについて

Electron製デスクトップアプリ。xterm.js + node-ptyのPowerShellターミナルと、出力を監視するマスコットキャラを表示する。
詳細なアーキテクチャ・変更ルールは `AGENTS.md` を参照。

## よく使うコマンド

```bash
npm start          # アプリ起動
npm run rebuild    # node-pryをElectron向けに再ビルド（通常不要）
```

## 重要な制約（必ず守ること）

- **レンダラーから `require()` を直接呼ばない** — `contextIsolation: true` のため動作しない
- **`strip-ansi` は v6系を維持** — v7以降はESMのみでメインプロセスで動かない
- **新しいIPC追加時は3点セットで** — `main.js` ハンドラ → `preload.js` 公開 → `renderer.js` 使用

## キーワード検出のカスタマイズ

`renderer/renderer.js` の `STATES` オブジェクトの `keywords` 配列を編集する。
検出優先度: `alert` > `error` > `done` > `working`
