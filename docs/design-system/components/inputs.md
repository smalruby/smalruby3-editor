# 入力欄

上流の値は tag `v13.7.2`。ファイルは `packages/scratch-gui/src/components/` から。

## 丸い小さい入力欄（`forms/input.css` の `.input-form`）

スプライトの情報（名前・x・y・大きさ・向き）など、画面の中の小さい入力欄。見本: [`0503-input-form.png`](../screenshots/0503-input-form.png)。

| 状態 | 値 | トークン | 実測（スプライトの名前） |
|---|---|---|---|
| ふつう | 高さ 2rem・余白 `0 0.75rem`・文字 0.625rem の太字 `$text-primary`・枠 `1px solid $ui-black-transparent`・角丸 2rem・`outline: none`・動き `0.25s ease-out` | `$font-size-xsmall`・`$font-weight-bold`・`$color-text`・`$color-border` | 一致（32px・10px・700・32px） |
| ふつう（`.input-small`） | 幅 3rem・余白 `0 0.5rem`・中央ぞろえ（x・y などの数） | | （撮っていない） |
| ホバー | 枠 `$looks-secondary` | `$color-primary` | 一致（`rgb(133, 92, 214)`） |
| フォーカス | 枠 `$looks-secondary`・輪 `0 0 0 0.25rem $looks-transparent` | `$color-primary`・`$color-primary-transparent` | 一致（輪 `rgba(133, 92, 214, 0.35) 0 0 0 4px`） |
| 押した・選ばれた・押せない | — | | |

独自の画面の入力欄は、この形（ホバーとフォーカスの紫の枠と輪）を基準にする。角丸は用途で選ぶ（画面の中の小さい欄は 2rem、ダイアログの中の大きい欄は `$radius-small`）。

## ダイアログの入力欄（`prompt/prompt.css` の `.variable-name-text-input`）

変数・リストを作るときの名前の欄。見本: [`0401-variable-prompt.png`](../screenshots/0401-variable-prompt.png)。

| 状態 | 値 | トークン | 実測 |
|---|---|---|---|
| ふつう | 幅 100%・高さ 3rem・余白 `0 1rem`・枠 `1px solid $ui-black-transparent`・角丸 5px・文字 `.875rem`・`$text-primary-transparent` | `$color-border`・`$font-size-medium`・`$color-text-muted` | 一致（48px・5px・14px） |
| フォーカス | —（書いていない。ブラウザの既定の輪が出る） | | `outline: auto 1px rgb(16, 16, 16)` |
| ホバー・押した・選ばれた・押せない | — | | |

開くと自動でフォーカスされるので、ふつうの値は撮影スクリプトでフォーカスを外してから読んでいる（`blurFirst`）。

ラベルは `.label`（太さ 500・下に 0.75rem）。

## 絞り込み（`filter/filter.css` の `.filter` と `.filter-input`）

ライブラリのヘッダーの下の検索欄。見本: [`0504-library-filter-bar.png`](../screenshots/0504-library-filter-bar.png)。

| 状態 | 値 | トークン | 実測 |
|---|---|---|---|
| ふつう（枠 `.filter`） | 地 白・角丸 10rem・高さ `$library-filter-bar-height`（2.5rem） | `$color-surface` | 一致（160px・40px） |
| ふつう（入力 `.filter-input`） | 地と枠なし・文字 0.75rem `$text-primary`・余白 `.625rem 2rem .625rem 3rem`（左に虫めがね）。プレースホルダーは 0.875rem・不透明度 0.5 | `$font-size-small`・`$color-text` | 一致（12px・10px 32px 10px 48px） |
| フォーカス | `.filter:focus-within`: 輪 `0 0 0 .25rem $looks-transparent`。`library/library.css` で幅が 11.5rem → 18.75rem に広がる（`transition: .2s`） | `$color-primary-transparent` | 一致（輪 4px・幅 184px → 300px） |
| 入力あり（`.is-active`） | 右の × のボタンが出る（`opacity: 1`）。× はホバーで `scale(1.2)` | | （撮っていない） |
| ホバー・押した・押せない | — | | |
