# スクリーンショット

デザインシステムの見本の画像を置く。名前は `<番号4桁>-<内容>[-<viewport>].png`（[`../../_screenshot-guidelines.md`](../../_screenshot-guidelines.md)）。

撮るときは、上流の値が見えるように 1366×1024 で開き、スモウルビーの吹き出しなどを隠すか、部品だけを切り抜く。

見本は `tools/playwright-verify/capture-design-system.mjs` で撮る（`DOCS_SHOTS=1` で下の画像を撮り直す。使い方は [`../README.md`](../README.md) の「撮影スクリプトで値と見本を取る」）。

| ファイル | 中身 |
|---|---|
| `0101-menu-bar.png` | メニューバー（「レッスン」「クラス」はスモウルビーの追加。「設定」の中身もスモウルビーで変えている） |
| `0201-code-tab-1366x1024.png` | コードタブの画面全体（Ruby タブはスモウルビーの追加） |
| `0401-variable-prompt.png` | 変数を作るモーダル |
| `0402-delete-sprite-confirm.png` | スプライトを削除するときの確認 |
