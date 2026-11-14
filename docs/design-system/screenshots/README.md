# スクリーンショット

デザインシステムの見本の画像を置く。名前は `<番号4桁>-<内容>[-<viewport>].png`（[`../../_screenshot-guidelines.md`](../../_screenshot-guidelines.md)）。

撮るときは、上流の値が見えるように 1366×1024 で開き、スモウルビーの吹き出しなどを隠すか、部品だけを切り抜く。

見本は `tools/playwright-verify/capture-design-system.mjs` で撮る（`DOCS_SHOTS=1` で下の画像を撮り直す。使い方は [`../README.md`](../README.md) の「撮影スクリプトで値と見本を取る」）。ただし `06xx`（ブロック）は撮影スクリプトでは撮らない（色のモードを切りかえて撮る。撮り方は [`../blocks.md`](../blocks.md) の「見本の撮り方」）。`0303`・`0304`・`0508`・`0509`・`0901`・`0902` もまだ撮影スクリプトの `DOC_SHOT_NAMES` に無い（同じ条件の 1366×1024 で、スモウルビーの吹き出しと光る演出を隠して撮った）。撮り直すときは、撮影スクリプトの拡張機能・接続・デバッグの画面に切り抜きを足して撮る。

| ファイル | 中身 |
|---|---|
| `0101-menu-bar.png` | メニューバー（「レッスン」「クラス」はスモウルビーの追加。「設定」の中身もスモウルビーで変えている。[`../menu-bar.md`](../menu-bar.md)） |
| `0102-menu-file.png` | ファイルのメニュー（[`../components/menus.md`](../components/menus.md)） |
| `0201-code-tab-1366x1024.png` | コードタブの画面全体（Ruby タブはスモウルビーの追加） |
| `0202-stage-header.png` | ステージの上の段（「大」のステージ。大きさのボタンの真ん中「中」はスモウルビーの追加。[`../code-tab.md`](../code-tab.md)） |
| `0203-target-pane.png` | スプライトの情報・スプライトの一覧・ステージの欄（「大」のステージ。[`../code-tab.md`](../code-tab.md)） |
| `0204-category-menu.png` | ブロックのカテゴリの一覧（上流の 9 つ。[`../code-tab.md`](../code-tab.md)） |
| `0205-monitor.png` | モニターのふつうの表示（「大」のステージ。[`../code-tab.md`](../code-tab.md)） |
| `0301-library-header.png` | スプライトのライブラリのヘッダーと絞り込みの帯（「すべて」が選ばれた状態。[`../library.md`](../library.md)） |
| `0302-sound-library-item.png` | 音のライブラリの項目のホバーと再生ボタン（[`../library.md`](../library.md)） |
| `0303-extension-library.png` | 拡張機能のライブラリのヘッダーと 1 行目のカード（右上の「すべての拡張機能を表示」はスモウルビーの追加。[`../extension-modals.md`](../extension-modals.md)） |
| `0304-connection-modal.png` | micro:bit の接続のモーダル（Scratch Link が見つからないとき。「アップデート」のボタンとその上の説明はスモウルビーの追加。スモウルビーの既定の地のため、枠（白 25%）が不透明な白に写る。[`../extension-modals.md`](../extension-modals.md)） |
| `0401-variable-prompt.png` | 変数を作るモーダル（スモウルビーの既定の地のため、枠（白 25%）が不透明な白に写る。上流では淡い青） |
| `0402-delete-sprite-confirm.png` | スプライトを削除するときの確認 |
| `0403-variable-prompt-stage.png` | ステージを選んでいるときの変数を作るモーダル（範囲の選択肢の代わりにお知らせの文。開いたときに入力欄に入るフォーカスの既定の輪も写る。スモウルビーの既定の地のため、枠（白 25%）が不透明な白に写る。上流では淡い青。[`../dialogs.md`](../dialogs.md)） |
| `0404-custom-procedures.png` | ブロックを作るモーダル（開いた直後の状態。定義のブロックの名前の欄が選ばれていて、その上に消すためのオレンジのごみ箱が出ている（scratch-blocks の描き方）。スモウルビーの既定の地のため、枠（白 25%）が不透明な白に写る。上流では淡い青。[`../dialogs.md`](../dialogs.md)） |
| `0501-tabs.png` | エディターのタブ（上流の 3 つだけ。[`../components/tabs.md`](../components/tabs.md)） |
| `0502-toggle-buttons.png` | 切り替えボタン（ステージの大きさ。[`../components/buttons.md`](../components/buttons.md)） |
| `0503-input-form.png` | 丸い小さい入力欄（スプライトの情報。[`../components/inputs.md`](../components/inputs.md)） |
| `0504-library-filter-bar.png` | ライブラリの絞り込みとタグボタン（「すべて」が選ばれた状態） |
| `0505-library-item-hover.png` | ライブラリの項目のホバー（[`../components/cards.md`](../components/cards.md)） |
| `0506-context-menu.png` | 右クリックのメニュー（[`../components/menus.md`](../components/menus.md)） |
| `0507-alerts.png` | アラート（注意・成功・お知らせ。[`../components/alerts.md`](../components/alerts.md)） |
| `0508-pager-debug.png` | デバッグのモーダルの「次へ」（モーダルの右の端から外へはみ出す。[`../components/pager.md`](../components/pager.md)） |
| `0509-pager-tutorial.png` | チュートリアルのカードの「次へ」と、後ろののぞき札（上の緑の帯から写る。[`../components/pager.md`](../components/pager.md)） |
| `0601-blocks-default.png` | ブロック: オリジナルの色のモード（カテゴリの欄とブロックパレットの切り抜き。[`../blocks.md`](../blocks.md)） |
| `0602-blocks-high-contrast.png` | ブロック: 高コントラスト |
| `0603-blocks-dark.png` | ブロック: ダーク（画面からは選べない。Redux で切りかえて撮った） |
| `0701-costumes-tab.png` | コスチュームタブ（左の一覧とペイントエディター。[`../paint.md`](../paint.md)） |
| `0702-paint-color-picker.png` | ペイントエディターの色を選ぶ吹き出し（塗りつぶし） |
| `0801-sounds-tab.png` | 音タブ（左の一覧と音のエディター。[`../sound-editor.md`](../sound-editor.md)） |
| `0802-sound-selection.png` | 音のエディターで波形の範囲を選んだところ |
| `0803-record-modal.png` | 録音のモーダル（録音の前） |
| `0804-record-modal-playback.png` | 録音のモーダル（録音のあと。両端の切り落とす部分） |
| `0901-debug-modal.png` | デバッグのモーダル（2 番目の話題。左右の矢印が両方出る。[`../tutorial-debug.md`](../tutorial-debug.md)） |
| `0902-tutorial-card.png` | チュートリアルのカード（4 枚のうち 3 枚目。中身の絵はスモウルビーのチュートリアル。次へ進む丸の光る演出は止めて撮った。[`../tutorial-debug.md`](../tutorial-debug.md)） |

番号の上 2 桁: 01 = メニューバー、02 = コードタブ、03 = 拡張機能・ライブラリ・機器との接続、04 = ダイアログ、05 = 共通部品の切り抜き、06 = ブロック、07 = コスチュームタブ（ペイントエディター）、08 = 音タブ（音のエディター）、09 = チュートリアル・デバッグ。
