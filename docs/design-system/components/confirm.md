# 確認

上流の値は tag `v13.7.2`。ファイルは `packages/scratch-gui/src/components/` から。

スプライト・コスチューム・音を削除するときに、項目の横に出る紫の吹き出し。共通の `confirmation-prompt/`（吹き出しの形・矢印の位置は `modal-with-arrow/`）に、`delete-confirmation-prompt/` が削除用のクラスを重ねる。見本: [`0402-delete-sprite-confirm.png`](../screenshots/0402-delete-sprite-confirm.png)。

## 形

| 部分 | 共通（`confirmation-prompt.css`） | 削除（`delete-confirmation-prompt.css` の上書き） | トークン | 実測（スプライトの削除） |
|---|---|---|---|---|
| 吹き出し（`.modal-container` + `.body`） | 地 `$looks-secondary`・角丸 0.5rem・余白 0.75rem・中の間 0.9375rem | 余白 `1rem 1.5rem`・中の間 0。幅 290px（`delete-confirmation-prompt.jsx` の `modalWidth`） | `$color-primary`・`$radius-medium` | 一致（290×170・8px） |
| 文（`.label`） | 白・1rem・太さ 700・行の高さ 1.5rem・中央 | 1.25rem・上 1rem・下 1.5rem | `$color-surface` | 一致（20px・700） |
| 決めるボタン（`.confirm-button`） | 地 白・文字 `$looks-secondary`・角丸 2.5rem・余白 `0.5rem 1rem`・文字 0.75rem の 700・アイコン 1.5rem | どちらのボタンも `.button-row-button`: 地 白・文字 `$looks-secondary`・枠 `1px solid $ui-black-transparent`・角丸 2rem・余白 `0.75rem 1rem`・0.85rem の 600・幅 47% | `$color-surface`・`$color-primary`・`$color-border`・`$font-size-dialog` | 削除の値と一致（32px・12px 16px・13.6px・600） |
| やめるボタン（`.cancel-button`） | 地なし・枠 `0.0625rem solid $ui-white`・文字 白 | 同上（決めるボタンと同じ白いボタンになる） | | 一致 |

削除の確認では「はい」「いいえ」が**同じ見た目**になる（どちらも白い地に紫の文字）。

## 状態

| 状態 | 値 | 実測 |
|---|---|---|
| ホバー | — | 変化なし |
| フォーカス | `.confirm-button:focus, .cancel-button:focus { outline: auto }`（ブラウザの既定の輪） | `outline-style: auto` |
| 押した・選ばれた・押せない | — | |

## 独自の画面で使うとき

- 取り消せない操作の確認は、この吹き出し（`ConfirmationPrompt`）か、ふつうのモーダル + 主ボタン・副ボタン（[`README.md`](README.md) の「独自の画面で使う形」）にする。
- 紫の地の上のボタンは、決める方を白い地・紫の文字、やめる方を白い枠・白い文字にする（共通の `confirmation-prompt.css` の形）。削除の確認のように同じ見た目にはしない。
- フォーカスは紫の地の上なので、白い線 `outline: 2px solid $color-surface; outline-offset: 2px;` を `:focus-visible` で引く（白は紫に対して 4.7:1。上流のプロジェクトの題名の欄の白 25% の輪は 1.56:1 で足りないので使わない。[`README.md`](README.md) の「フォーカス」）。
