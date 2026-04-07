このフォルダにマスコット用のGIF/PNG画像を配置してください。

推奨ファイル名:
  waiting.gif  - 待機中アニメーション
  working.gif  - 作業中アニメーション
  alert.gif    - 許可待ち・注意アニメーション
  done.gif     - 完了アニメーション
  error.gif    - エラー時アニメーション

現在は renderer.js 内のテキスト顔文字がプレースホルダーとして機能しています。
GIFを追加する場合は renderer.js の STATES オブジェクトに imageUrl を追加し、
mascot-face 要素を <img> に切り替えてください。
