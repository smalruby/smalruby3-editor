# メニュー

上流の値は tag `v13.7.2`。ファイルは `packages/scratch-gui/src/components/` から。

## メニューバーの項目（`menu-bar/menu-bar.css` の `.menu-bar-item`）

見本: [`0101-menu-bar.png`](../screenshots/0101-menu-bar.png)（「レッスン」「クラス」はスモウルビーの追加）。メニューバーそのものは高さ `$menu-bar-height`（3rem）・地 `$looks-secondary`・文字 0.75rem の太字（[`../tokens.md`](../tokens.md)）。

| 状態 | 値 | トークン | 実測 |
|---|---|---|---|
| ふつう | 文字 白・余白 `0 0.25rem`（ファイルのまとまりの中は `0 0.75rem`・間 0.25rem） | `$color-surface` | 一致（余白 0 12px） |
| ホバー（`.hoverable:hover`） | 地 `$ui-black-transparent` | `$color-border`（同じ値。意味は「暗く重ねる」） | 一致（`rgba(0, 0, 0, 0.15)`） |
| 選ばれた（`.active`。メニューを開いている間） | 地 `$ui-black-transparent` | 同上 | 一致 |
| 押せない（`.disabled`） | 不透明度 0.5 | | （撮っていない） |
| 押した・フォーカス | — | | |

## メニュー（`menu/menu.css`）

メニューバーから開くメニュー（ファイル・編集）。見本: [`0102-menu-file.png`](../screenshots/0102-menu-file.png)。

| 状態 | 値 | トークン | 実測 |
|---|---|---|---|
| ふつう（`.menu`） | 地 `$looks-secondary`・文字 白・枠 `1px solid $ui-black-transparent`・角丸 `0 0 8px 8px`（上はメニューバーにつながる）・影 `0 8px 8px 0 $ui-black-transparent`・幅 186〜260px | `$color-primary`・`$color-border` | 一致（205px 幅） |
| ふつう（`.menu-item`） | 行の高さ 34px・余白 `0 10px`・文字 .75rem の太字 | `$font-size-small`・`$font-weight-bold` | 一致（35px = 34px + 区切りの線） |
| 区切り（`.menu-section`） | 上に `1px solid $ui-black-transparent` | `$color-border` | 一致 |
| ホバー・選ばれた（`.active`）・開いている（`.expanded`） | 地 `$ui-black-transparent` | | 一致（ホバー `rgba(0, 0, 0, 0.15)`） |
| 子のメニュー（`.submenu`） | 角丸 8px・項目にホバーで開く | | （撮っていない） |
| 押した・押せない・フォーカス | — | | |

## 右クリックのメニュー（`context-menu/context-menu.css`）

スプライト・コスチューム・音の右クリック（Radix の ContextMenu）。見本: [`0506-context-menu.png`](../screenshots/0506-context-menu.png)。

| 状態 | 値 | トークン | 実測 |
|---|---|---|---|
| ふつう（`.context-menu-content`） | 地 白・枠 `1px solid $ui-black-transparent`・角丸 `calc($space / 2)`（0.25rem。先に書いた 6px は後ろの指定で上書きされる）・影 `0 0 5px 1px $ui-black-transparent`・上下の余白 5px・出るときの動き `opacity 0.2s ease` | `$color-surface`・`$color-border`・`$radius-small` | 一致（4px） |
| ふつう（`.menu-item`） | 高さ 25px・文字 13px `$text-primary`・余白 `0 40px 0 12px` | `$color-text` | 一致 |
| 区切り（`.menu-item-bordered`） | 上に `1px solid $ui-black-transparent` | `$color-border` | 一致 |
| ホバー・キーボードで選ぶ（`[data-highlighted]`） | 地 `$looks-secondary`・文字 白 | `$color-primary`・`$color-surface` | 一致 |
| 危ない操作（`.menu-item-danger[data-highlighted]`） | 地 `$error-primary` | 別名なし | （撮っていない） |
| 押した・押せない | — | | |

メニューの種類で、選ばれた項目の見せ方が違う（メニューバーのメニューは暗く重ねる、右クリックのメニューは紫で塗る）。独自の画面のメニューは、紫の地の上なら前者、白い地の上なら後者に合わせる。
