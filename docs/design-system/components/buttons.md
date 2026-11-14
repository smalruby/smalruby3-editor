# ボタン

上流の値は tag `v13.7.2`。ファイルは `packages/scratch-gui/src/components/` から。独自の画面で使う形は [`README.md`](README.md) の「独自の画面で使う形」。

## ボタンの土台（`button/button.css` の `.outlined-button`）

`button/button.jsx`（`ButtonComponent`）が使う。**色を持たない**土台で、使う側が色を決める。

| 状態 | 値 | トークン |
|---|---|---|
| ふつう | 角丸 `$form-radius`（0.25rem）・太字・左右の余白 0.75rem・`background` / `border` / `color` は `inherit`・`cursor: pointer` | `$radius-small`・`$font-weight-bold` |
| アイコン | 高さ 1.5rem・文字との間 0.5rem | 直書き・`$space-medium` |
| ホバー・押した・選ばれた・押せない・フォーカス | — | — |

## 主ボタン・副ボタン（ダイアログのボタン）

部品になっておらず、`prompt/prompt.css` などに書き写されている（書き写している場所は [`README.md`](README.md) の「上流で部品になっていないもの」）。基準は `prompt/prompt.css` の `.button-row button`。見本: [`0401-variable-prompt.png`](../screenshots/0401-variable-prompt.png)。

| 状態 | 主ボタン（`.ok-button`） | 副ボタン | トークン | 実測 |
|---|---|---|---|---|
| ふつう | 地 `$looks-secondary`・文字 白・枠なし（`border: $looks-secondary` は色だけの指定で、線の種類が無いので枠は描かれない） | 地 白・枠 `1px solid $ui-black-transparent`・文字の色は決めていない（ブラウザの既定の黒） | `$color-primary`・`$color-surface`・`$color-border` | 一致。主ボタン 52×39px・副ボタン 104×44px（主ボタンだけ枠が無いぶん低い） |
| 共通 | 余白 `0.75rem 1rem`・角丸 `0.25rem`・文字 `0.85rem`・太さ `600`（`custom-procedures.css` は `bold`）・ボタンの間 0.5rem | | `$radius-small`・`$font-size-dialog` | 一致（12px 16px・4px・13.6px・600） |
| ホバー | — | — | | 変化なし |
| 押した | — | — | | |
| 選ばれた | — | — | | |
| 押せない | —（`connection-modal.css` の `.connection-button:disabled` だけ地 `$looks-transparent`） | — | `$color-primary-transparent` | |
| フォーカス | —（ブラウザの既定の輪） | — | | `outline: auto 1px rgb(16, 16, 16)` |

## アイコンボタン（`icon-button/icon-button.css` の `.container`）

アイコンの下に文字が付く縦長のボタン。音のエディターの道具のボタン（コピー・貼り付けなど。`.tool-button`）と効果のボタン（速く・遅くなど。`.effect-button`）が使う。どちらも `sound-editor/sound-editor.css` で文字の色と大きさを上書きしている（2 つの違いと押せない状態は [`../sound-editor.md`](../sound-editor.md) の「道具のボタン・効果のボタン」）。

| 状態 | 値（`icon-button.css`） | トークン | 実測（音のエディターの効果のボタン `.effect-button`） |
|---|---|---|---|
| ふつう | 文字 `$looks-secondary`・0.75rem・角丸 0.5rem・地と枠なし・ボタンの間 1.25rem | `$color-primary`・`$font-size-small`・`$radius-medium` | 文字 `rgb(87, 94, 117)`・10px・余白 `4px 0`・60×44px（`.effect-button` が `$text-primary`・0.625rem・余白 `0.25rem 0` に上書き） |
| ホバー | — | | 変化なし |
| 押した | 地 `$looks-light-transparent` | 別名なし | 一致（`rgba(133, 92, 214, 0.15)`） |
| 選ばれた | — | | |
| 押せない | `.disabled`: 不透明度 0.5・`pointer-events: none` | | （撮っていない） |
| フォーカス | — | | |

## 切り替えボタン（`toggle-buttons/toggle-buttons.css`）

横に並んだ四角いボタン。ステージの大きさ・スプライトの表示の切り替え。見本: [`0502-toggle-buttons.png`](../screenshots/0502-toggle-buttons.png)。

| 状態 | 値 | トークン | 実測 |
|---|---|---|---|
| ふつう | 34×34px・枠 `1px solid $ui-black-transparent`（となりとの間は 1 本）・両端だけ角丸 `$form-radius`・アイコンは灰色で半透明（`filter: grayscale(100%) opacity(.5)`） | `$color-border`・`$radius-small` | 一致（34×34・4px 0 0 4px） |
| ホバー | — | | 変化なし |
| 押した | 地 `$looks-transparent` | `$color-primary-transparent` | 一致（`rgba(133, 92, 214, 0.35)`） |
| 選ばれた | `[aria-pressed='true']`: 地 `$looks-light-transparent`・アイコンの色が戻る | 別名なし | 一致（`rgba(133, 92, 214, 0.15)`） |
| 押せない | `.disabled .button`: `cursor: default` だけ | | |
| フォーカス | `:focus::before` に `1px solid $looks-secondary` の枠（ボタンの外側 1px）。`outline: none` | `$color-primary` | 一致（`::before` の枠 `1px solid rgb(133, 92, 214)`） |

## タグボタン（`tag-button/tag-button.css`）

ライブラリの絞り込みの丸いボタン。見本: [`0504-library-filter-bar.png`](../screenshots/0504-library-filter-bar.png)。

| 状態 | 値 | トークン | 実測 |
|---|---|---|---|
| ふつう | 地 `$looks-secondary`・文字 白・角丸 1.375rem・高さ `$library-filter-bar-height`（2.5rem）・余白 `.625rem 1rem` | `$color-primary`・`$color-surface` | 一致（22px・40px・10px 16px） |
| ホバー | — | | 変化なし |
| 押した | — | | |
| 選ばれた | `.active`: 地 `$data-primary`（オレンジ） | `$color-warning` と同じ値（意味は違うので別名は使わない） | 一致（`rgb(255, 140, 26)`） |
| 押せない | — | | |
| フォーカス | `:focus-visible`: ブラウザの既定の輪を `outline-offset: -2px` で内側に寄せる（並びの `overflow: hidden` で切れないように） | | 一致（`outline: auto`・offset `-2px`） |

## 閉じるボタン（`close-button/close-button.css`）

モーダルのヘッダー・アラートの右の丸いボタン。

| 状態 | 値 | トークン | 実測 |
|---|---|---|---|
| ふつう（`.large`） | 1.75rem の丸・地 `$ui-black-transparent`・輪 `0 0 0 2px $ui-black-transparent`・動き `all 0.15s ease-out` | `$color-border`・`$radius-round` | 一致（28×28・2px） |
| ふつう（`.large.orange`） | 地と輪 `hsla(29, 100%, 54%, 0.2)`（アラートの注意で使う） | 直書き | 一致（`rgba(255, 134, 20, 0.2)`） |
| ふつう（`.small`） | 0.825rem の丸・地 `$looks-secondary`・文字 白 | `$color-primary` | （撮っていない） |
| ホバー（`.large`） | `transform: scale(1.1, 1.1)`・輪が 4px に | | 一致（輪 4px・`matrix(1.1, 0, 0, 1.1, 0, 0)`） |
| 押した・選ばれた・押せない・フォーカス | — | | |
