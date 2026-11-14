# モーダル

上流の値は tag `v13.7.2`。ファイルは `packages/scratch-gui/src/components/` から。共有の `Modal`（`modal/modal.jsx` + `modal/modal.css`）を使うと、オーバーレイ・枠・ヘッダー・閉じるボタンが付く。独自のモーダルを作るときのきまりは `.claude/rules/scratch-gui/modals.md`（本文に不透明な背景を付ける）。

見本: [`0401-variable-prompt.png`](../screenshots/0401-variable-prompt.png)（ふつうのモーダル）。

## 形

| 部分 | 値（上流） | トークン | 実測 |
|---|---|---|---|
| オーバーレイ（`.modal-overlay`） | 画面全体・地 `$ui-modal-overlay`・重なり `$z-index-modal` | `$color-overlay` | 一致（`rgba(77, 151, 255, 0.9)`） |
| 枠（`.modal-content`） | 枠 `4px solid $ui-white-transparent`・角丸 `$space`（0.5rem）・上に 100px あけて中央・文字 `$text-primary`・Helvetica Neue・はみ出しを隠す。幅は使う側が決める（`prompt.css` は 360px） | `$radius-medium`・`$color-text` | 一致（4px・8px・360px）。ただしスモウルビーでは下の「枠の地」の白が枠の下まで塗るので、枠は不透明な白に見える（上流はオーバーレイが透けて淡い青） |
| 枠の地 | 上流は**無い**（本文が透明だとオーバーレイが透ける）。スモウルビーはマーカー付きで `$ui-white` を足している | `$color-surface` | 白（スモウルビーの変更） |
| フルスクリーン（`.modal-content.full-screen`） | 画面全体・地 `$ui-secondary`・枠と角丸なし（ライブラリで使う。[`../library.md`](../library.md)） | 別名なし | 一致（`rgb(233, 241, 252)`） |
| ヘッダー（`.header`） | 高さ `$library-header-height`（3.125rem）・地 `$looks-secondary`・文字 1rem の太さふつう・白（`.header-item`）・余白 1rem | `$color-primary`・`$font-size-base` | 一致（50px） |
| 題（`.header-item-title`） | 中央・字間 0.4px | | |
| 本文 | 共有のモーダルは持たない。使う側が書く（`prompt.css` の `.body`: 地 `$ui-white`・余白 `1.5rem 2.25rem`） | `$color-surface` | 一致（24px 36px） |

## 状態

| 部品 | 状態 | 値 | 実測 |
|---|---|---|---|
| 閉じるボタン（ヘッダーの右） | ふつう / ホバー | [`buttons.md`](buttons.md) の「閉じるボタン」の `.large`。ホバーで `scale(1.1)`・輪 4px | 一致 |
| 戻るボタン（フルスクリーンのヘッダーの左。`.back-button`） | ふつう | 太さふつう・左右の余白なし・矢印と「戻る」 | 一致（白） |
| 戻るボタン | ホバー・押した・フォーカス | — | 変化なし |
| ヘルプボタン（`.help-button`） | ふつう | 0.75rem・太さふつう | （撮っていない） |

モーダル自体には選ばれた・押せないの状態は無い。

## 独自のモーダル

- 共有の `Modal` を使い、オーバーレイ・枠・ヘッダーは上流のままにする。
- 本文のラッパーに `background-color: $color-surface` と余白（`$space-large` か `1.5rem 2.25rem`）を付ける。
- ボタンは右下に並べ、主ボタンを右端に置く（上流の `prompt.css` の `.button-row` と同じ。[`README.md`](README.md) の「独自の画面で使う形」）。
