# ダイアログ（削除の確認・変数／リスト／ブロックを作る）

上流の値は tag `v13.7.2`。ファイルは `packages/scratch-gui/src/components/` から。

- **値の正は上流の CSS**（`git show v13.7.2:packages/scratch-gui/src/components/<部品>/<部品>.css`）。
- 「実測」は 1366×1024 の画面で各ダイアログを開いて取った計算済みの値。上流の CSS と同じなら「一致」と書く。
- 共通部品の値はほかのページにある。ここでは各ダイアログの並びと、そのダイアログだけの値を書く。
  - モーダルの枠・ヘッダー・閉じるボタン → [`components/modal.md`](components/modal.md)
  - 主ボタン・副ボタン → [`components/buttons.md`](components/buttons.md) の「主ボタン・副ボタン」
  - 名前の入力欄 → [`components/inputs.md`](components/inputs.md) の「ダイアログの入力欄」
  - ブロックを作るの選べるカード → [`components/cards.md`](components/cards.md) の「選べるカード」
  - 削除の確認 → [`components/confirm.md`](components/confirm.md)

## 一覧

| ダイアログ | 開く場所 | 部品 | 形 | 見本 |
|---|---|---|---|---|
| 変数を作る | 「変数」のカテゴリの「変数を作る」 | `prompt/prompt.jsx`（`containers/prompt.jsx`） | ふつうのモーダル（幅 360px） | [`0401-variable-prompt.png`](screenshots/0401-variable-prompt.png)（スプライトを選んでいるとき）・[`0403-variable-prompt-stage.png`](screenshots/0403-variable-prompt-stage.png)（ステージを選んでいるとき） |
| リストを作る | 「変数」のカテゴリの「リストを作る」 | 同上（題とラベルの文だけ違う） | 同上 | （変数を作ると同じ） |
| 名前を変える・新しいメッセージ | 変数・リストの名前を変えるとき、新しいメッセージを作るとき | 同上（範囲の選択肢が出ない） | 同上 | （撮っていない） |
| ブロックを作る | 「ブロック定義」のカテゴリの「ブロックを作る」、定義のブロックを編集するとき | `custom-procedures/custom-procedures.jsx`（`containers/custom-procedures.jsx`） | ふつうのモーダル（幅 700px） | [`0404-custom-procedures.png`](screenshots/0404-custom-procedures.png) |
| 削除の確認 | スプライト・コスチューム・音の項目の削除のボタン | `delete-confirmation-prompt/`（`containers/sprite-selector-item.jsx`） | 項目の横の紫の吹き出し | [`0402-delete-sprite-confirm.png`](screenshots/0402-delete-sprite-confirm.png) |

どのダイアログも、オーバーレイ（`$ui-modal-overlay`）・白 25% の 4px の枠・紫のヘッダー（`$looks-secondary`）・右上の閉じるボタンは共有の `Modal` のまま（[`components/modal.md`](components/modal.md)）。削除の確認だけは共有の `Modal` を使わず、項目の横に出る吹き出し（`confirmation-prompt/` と `modal-with-arrow/`）。

## 色（ほかのモーダルと比べるための表）

ふつうのモーダル（変数・リスト・ブロックを作る）の色。ライブラリ（フルスクリーン）の色は [`library.md`](library.md) の「色」。

| 部分 | 上流の CSS（ファイル・セレクター） | 上流のトークン（値） | 色 | 別名 | 実測 |
|---|---|---|---|---|---|
| オーバーレイ | `modal/modal.css` `.modal-overlay` | `$ui-modal-overlay`（`hsla(215, 100%, 65%, 0.9)`） | `#4C97FF` × 0.9 | `$color-overlay` | 一致（`rgba(77, 151, 255, 0.9)`） |
| 枠 | `modal/modal.css` `.modal-content` | `$ui-white-transparent`（`hsla(0, 100%, 100%, 0.25)`）の 4px | `#FFFFFF` × 0.25 | 別名なし | 一致（`4px solid rgba(255, 255, 255, 0.25)`） |
| ヘッダーの地 | `modal/modal.css` `.header` | `$looks-secondary` | `#855CD6` | `$color-primary` | 一致（`rgb(133, 92, 214)`） |
| ヘッダーの文字 | `modal/modal.css` `.header-item` | `$ui-white` | `#FFFFFF` | `$color-surface` | 一致 |
| 閉じるボタン | `close-button/close-button.css` `.close-button.large` | 地と輪 `$ui-black-transparent`・× は白 | `#000000` × 0.15 | `$color-border` | 一致（ホバーで `scale(1.1)`・輪 4px） |
| 本文の地 | `prompt/prompt.css` `.body`・`custom-procedures/custom-procedures.css` `.body` | `$ui-white` | `#FFFFFF` | `$color-surface` | 一致 |
| 本文の文字 | `modal/modal.css` `.modal-content` | `$text-primary` | `#575E75` | `$color-text` | 一致（`rgb(87, 94, 117)`） |
| 名前の入力欄の文字 | `prompt/prompt.css` `.variable-name-text-input` | `$text-primary-transparent`（`hsla(225, 15%, 40%, 0.75)`） | `#575E75` × 0.75 | `$color-text-muted` | 一致 |
| 名前の入力欄の枠 | 同上 | `$ui-black-transparent` | `#000000` × 0.15 | `$color-border` | 一致 |
| 主ボタン（OK） | `prompt/prompt.css`・`custom-procedures/custom-procedures.css` `.button-row button.ok-button` | 地 `$looks-secondary`・文字 `white`（直書き） | `#855CD6`・`#FFFFFF` | `$color-primary`・`$color-surface` | 一致 |
| 副ボタン（キャンセル） | 同上 `.button-row button` | 地 `white`（直書き）・枠 `$ui-black-transparent`・文字の色は決めていない | `#FFFFFF`・`#000000` × 0.15・文字はブラウザの既定の黒 | `$color-surface`・`$color-border` | 一致（文字 `rgb(0, 0, 0)`） |
| ブロックを作るの作業の場 | `custom-procedures/custom-procedures.css` `.workspace :global(.blocklySvg)` | `$ui-primary`（`hsla(215, 100%, 95%, 1)`） | `#E5F0FF` | `$color-background` | 一致（`rgb(230, 240, 255)`） |
| 選べるカード（ふつう） | `custom-procedures/custom-procedures.css` `.option-card` | 地 `white`（直書き）・枠 `$ui-black-transparent` | `#FFFFFF`・`#000000` × 0.15 | `$color-surface`・`$color-border` | 一致 |
| 選べるカード（ホバー） | 同上 `.option-card:hover` | 枠 `$looks-secondary`・輪 `$looks-transparent` 4px | `#855CD6`・`#855CD6` × 0.35 | `$color-primary`・`$color-primary-transparent` | 一致 |
| クラウド変数の区切り | `prompt/prompt.css` `.cloud-option` | `hsla(0, 0%, 0%, .25)` の点線（直書き） | `#000000` × 0.25 | 別名なし | （クラウド変数を使えるときだけ出る。撮っていない） |

削除の確認（吹き出し）の色は [`components/confirm.md`](components/confirm.md)（地 `$looks-secondary`・文字とボタンの地 `$ui-white`・ボタンの文字 `$looks-secondary`・ボタンの枠 `$ui-black-transparent`）。

## 変数・リストを作る（`prompt/prompt.css`）

上から、ラベル・名前の入力欄・範囲の選択肢（またはお知らせの文）・ボタンの並び。

| 部分 | 値（上流） | トークン | 実測 |
|---|---|---|---|
| 枠（`.modal-content`） | 幅 360px（上に 100px あけて中央は共有の `Modal`） | | 一致（360×322px） |
| 本文（`.body`） | 地 `$ui-white`・余白 `1.5rem 2.25rem` | `$color-surface` | 一致（24px 36px） |
| ラベル（`.label`） | 太さ 500・下に 0.75rem。文字の大きさは決めていない（1rem） | | 一致（16px・500） |
| 名前の入力欄 | [`components/inputs.md`](components/inputs.md) の「ダイアログの入力欄」（高さ 3rem・角丸 5px・`.875rem`・下に 1.5rem）。開くと自動でフォーカスされ、ブラウザの既定の輪が出る | | 一致（48px・5px・14px） |
| 範囲の選択肢（`.options-row`） | 「すべてのスプライト用」「このスプライトのみ」のラジオボタンを左右の端に置く（`justify-content: space-between`）・太さふつう・下に 1.5rem。ラジオボタンはまわりに 3px | | 一致（ラジオボタン 13px） |
| 選べない選択肢（`.disabled-label`） | 不透明度 0.5（クラウド変数を選んだときの「このスプライトのみ」） | | （撮っていない） |
| お知らせの文（`.info-message`） | ステージを選んでいるとき、範囲の選択肢の代わりに「この変数はすべてのスプライトで利用できます。」・太さふつう・`.875rem`・中央・下に 1.5rem | `$font-size-medium` | 一致（14px・中央） |
| クラウド変数（`.cloud-option`） | 上に `1px dashed hsla(0, 0%, 0%, .25)`・上下の余白 1rem・中央。文（`.cloud-option-text`）は不透明度 .5 | | （撮っていない） |
| ボタンの並び（`.button-row`） | 右ぞろえ・`font-weight: bolder`（ボタンは自分の太さで上書き）。ボタンの間 0.5rem | | 一致 |
| ボタン | [`components/buttons.md`](components/buttons.md) の「主ボタン・副ボタン」（太さ `600`） | | 一致（OK 52×39px・キャンセル 104×44px） |

範囲の選択肢が出ないとき（名前を変える・新しいメッセージ）は、ラベル・入力欄・ボタンだけになる（`containers/blocks.jsx` の `handlePromptStart` の `showVariableOptions`）。

### 状態

| 部品 | ホバー | 押した | フォーカス |
|---|---|---|---|
| 名前の入力欄 | — | — | —（ブラウザの既定の輪。開いたときにフォーカスが入る） |
| ラジオボタン | — | — | —（ブラウザの既定の輪） |
| 主ボタン・副ボタン | — | — | —（ブラウザの既定の輪） |
| 閉じるボタン | `scale(1.1)`・輪 4px | — | —（ブラウザの既定の輪） |

## ブロックを作る（`custom-procedures/custom-procedures.css`）

上から、定義のブロックを編集する作業の場（scratch-blocks のワークスペース）・選べるカード 3 つ・「画面を再描画せずに実行する」・ボタンの並び。

| 部分 | 値（上流） | トークン | 実測 |
|---|---|---|---|
| 枠（`.modal-content`） | 幅 700px・上に 50px（ほかのモーダルより背が高いので上をつめる） | | 一致（700×542px） |
| 作業の場（`.workspace`） | 高さ 200px 以上。地 `$ui-primary`（`.blocklySvg`） | `$color-background` | 一致（200px） |
| 本文（`.body`） | 地 `$ui-white`・余白 `1.5rem 2.25rem` | `$color-surface` | 一致（24px 36px） |
| 選べるカードの並び（`.options-row`） | 3 つを同じ幅で並べる（`flex-grow: 1`・`flex-basis: 100px`）・カードの間 1rem | | 一致（196×138px） |
| 選べるカード | [`components/cards.md`](components/cards.md) の「選べるカード」（枠 2px・角丸 `$space`・余白 `calc($space * 2)`・中央ぞろえ・動き `all 0.2s`） | | 一致 |
| カードの絵（`.option-icon`） | 高さ 48px まで・下に 0.5rem | | 一致（48px） |
| カードの題（`.option-title`） | 太字（文字は 1rem） | `$font-weight-bold` | 一致（16px・700） |
| カードの説明（`.option-description`） | CSS は無い（太さふつう・1rem） | | |
| 「画面を再描画せずに実行する」（`.checkbox-row`） | 上に 1rem。チェックボックスはまわりに 3px | | 一致 |
| ボタンの並び（`.button-row`） | 上に 1rem・右ぞろえ | | 一致 |
| ボタン | [`components/buttons.md`](components/buttons.md) の「主ボタン・副ボタン」。**太さ `bold`**（変数を作るの `600` と違う） | | 一致（700） |

### 状態

| 部品 | ホバー | 押した | フォーカス |
|---|---|---|---|
| 選べるカード | 枠が紫・紫の輪 4px | —（ホバーのまま） | —（`role="button"`・`tabIndex="0"` で、ブラウザの既定の輪） |
| 主ボタン・副ボタン・閉じるボタン | 変数を作ると同じ | | |

作業の場の中の定義のブロックの色と形は、ブロックの色のモード（[`blocks.md`](blocks.md)）に従う。

## 削除の確認

[`components/confirm.md`](components/confirm.md) にまとめた。スプライトの一覧・コスチュームタブの一覧・音タブの一覧の項目は、どれも `containers/sprite-selector-item.jsx` から同じ吹き出しを出す（文だけがスプライト・コスチューム・音で変わる。`delete-confirmation-prompt.jsx` の `entityType`）。

## スモウルビーの追加

上流と違うところ。上の表の値には入れていない。

| 場所 | 中身 | 見た目への影響 |
|---|---|---|
| `modal/modal.css`（マーカー付き） | `.modal-content` に既定の白い地 | なし（どのダイアログも本文が白い地を持つ） |
| `mobile-sprite-panel/mobile-sprite-panel.css` | すべてのモーダルのオーバーレイの重なりを 9999 に上げる（[`library.md`](library.md) の「スモウルビーの追加」） | 重なり順だけ |
| `prompt/prompt.jsx`（マーカー付き）・`custom-procedures/custom-procedures.jsx`（マーカー無し） | モーダルに `id` を付けた | なし |
| `containers/prompt.jsx`（マーカー付き） | 日本語の変換を決める Enter でダイアログを閉じない | なし（振る舞いだけ） |
| `containers/custom-procedures.jsx`（マーカー付き） | 作業の場のブロックを、メインのコードエリアと同じテーマ（`catblocks` / `classic`）で描く | 定義のブロックの形（テーマ）だけ。色は上流と同じ色のモード |

## 独自の画面で使うとき

- 名前を 1 つ入れて決めるダイアログは、変数を作るの形（幅 360px・本文の余白 `1.5rem 2.25rem`・ラベル・入力欄・右下にボタン）を基準にする。ボタンと入力欄は上流を書き写さず、[`components/README.md`](components/README.md) の「独自の画面で使う形」（主ボタン・副ボタン・フォーカス）で書く。
- いくつかの中から 1 つを選んで足すときは、ブロックを作るの選べるカード（[`components/cards.md`](components/cards.md)）の形を使う。
- 取り消せない操作の確認は [`components/confirm.md`](components/confirm.md) の「独自の画面で使うとき」。
