# カード

上流の値は tag `v13.7.2`。ファイルは `packages/scratch-gui/src/components/` から。

## ライブラリの項目（`library-item/library-item.css` の `.library-item`）

スプライト・背景・コスチューム・音・拡張機能を選ぶモーダルの 1 つ分。見本: [`0505-library-item-hover.png`](../screenshots/0505-library-item-hover.png)（ホバー）。

| 状態 | 値 | トークン | 実測（スプライト） |
|---|---|---|---|
| ふつう | 160×160px・まわりに `$space`・余白 `1rem 1rem 0`・地 白・枠 `2px solid $ui-black-transparent`・角丸 `$space`・文字 `$text-primary`・中央ぞろえ | `$color-surface`・`$color-border`・`$radius-medium`・`$color-text` | 一致（160×160・2px・8px） |
| 名前（`.library-item-name`） | 幅 80%・上下 0.25rem・はみ出しは「…」 | | 一致 |
| ホバー | 枠 `2px $looks-secondary` | `$color-primary` | 一致（`rgb(133, 92, 214)`） |
| 押せない（`.disabled`） | 不透明度 .5・`cursor: auto`・ホバーでも枠は変わらない | | （撮っていない） |
| 押した・選ばれた・フォーカス | — | | |
| 拡張機能の大きいカード（`.featured-item`） | 幅 300px・高さ自由・余白なし・題は太字・説明は太さふつう・行の高さ 1.375rem・必要なもの/協力は 12px で不透明度 0.75 | | （撮っていない。見本の画像は大きいので置かない） |

## スプライトの項目（`sprite-selector-item/sprite-selector-item.css`）

ターゲットの一覧のスプライト・コスチュームタブと音タブの左の一覧。見本: [`0201-code-tab-1366x1024.png`](../screenshots/0201-code-tab-1366x1024.png) の右の「スプライト1」。

| 状態 | 値 | トークン | 実測 |
|---|---|---|---|
| ふつう | 枠 `2px solid $ui-black-transparent`・角丸 `$space`・文字 0.8rem `$text-primary`・中央ぞろえ | `$color-border`・`$radius-medium`・`$color-text` | （選ばれた項目だけ撮った） |
| ホバー | 枠 `2px $looks-secondary`・地 `$ui-white`・絵に影 `drop-shadow(0 0 2px $ui-black-transparent)` | `$color-primary`・`$color-surface` | （撮っていない） |
| 選ばれた（`.is-selected`） | 枠 `2px $looks-secondary`・輪 `0 0 0 4px $looks-transparent`・地 `$ui-white`・名前の帯が紫（`.sprite-info` の地 `$looks-secondary`） | `$color-primary`・`$color-primary-transparent` | 一致（64×64・輪 4px） |
| 押した・押せない・フォーカス | — | | |

選ばれたスプライトの紫の輪（`0 0 0 4px $looks-transparent`）は、入力欄のフォーカスの輪と同じ形。独自の画面のカードで「選ばれた」を表すときもこの形にする（枠 `$color-primary` + 輪 `$color-primary-transparent`。選ばれたことは紫の枠で分かる）。フォーカスはこれと別に、[`README.md`](README.md) の「フォーカス」の `outline` で描く（淡い輪だけではコントラストが足りない）。

## 選べるカード（`custom-procedures/custom-procedures.css` の `.option-card`）

ブロックを作るモーダルの「入力（数または文字列）」などのカード。

| 状態 | 値 | トークン | 実測 |
|---|---|---|---|
| ふつう | 地 白・枠 `2px solid $ui-black-transparent`・角丸 `$space`・余白 `calc($space * 2)`・動き `all 0.2s` | `$color-surface`・`$color-border`・`$radius-medium`・`$space-large` | 一致（2px・8px・16px） |
| ホバー | 枠 `2px $looks-secondary`・輪 `0 0 0 4px $looks-transparent` | `$color-primary`・`$color-primary-transparent` | 一致 |
| 押した・選ばれた・押せない・フォーカス | — | | |
