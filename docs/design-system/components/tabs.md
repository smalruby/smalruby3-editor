# タブ

上流の値は tag `v13.7.2`。ファイルは `packages/scratch-gui/src/components/gui/gui.css`（react-tabs の見た目を上書きしている）。

コード・コスチューム・音のエディターのタブ。見本: [`0501-tabs.png`](../screenshots/0501-tabs.png)（4 つめの Ruby タブはスモウルビーの追加なので写していない）。

| 状態 | 値 | トークン | 実測 |
|---|---|---|---|
| 並び（`.tab-list`） | 高さ `$stage-menu-height`（2.75rem）・幅 250px（ブロックのパレットに合わせる）・下にそろえる・文字 0.80rem の太さ 500 | 別名なし | （スモウルビーの変更で幅が広がる。下の注） |
| ふつう（`.tab`） | 高さ 80%・角丸 `1rem 1rem 0 0`・枠 `1px solid $ui-black-transparent`・余白 `0.125rem 1.25rem 0`・文字 0.75rem `$text-primary-transparent`・地 `$ui-tertiary`・となりと 0.5rem 重ねる（左が上） | `$color-border`・`$font-size-small`・`$color-text-muted` | 一致（16px 16px 0 0・12px・`rgb(217, 227, 242)`） |
| アイコン | 幅 1.375rem・灰色（`grayscale(100%)`） | | |
| ホバー | 地 `$ui-primary` | `$color-background` | 一致（`rgb(230, 240, 255)`） |
| 選ばれた（`.is-selected`） | 高さ 90%・文字 `$looks-secondary`・地 `$ui-white`・いちばん上に重ねる・アイコンの色が戻る | `$color-primary`・`$color-surface` | 一致（高さ 35px → 40px） |
| フォーカス（選ばれたタブ） | 輪を消している（`outline: none; box-shadow: none`） | | |
| 押した・押せない | — | | |

注: スモウルビーは `.tab-list-container` を足して Ruby タブを並べ、低い画面ではタブを 36px に縮める（`gui.css` のマーカーの中）。値は上流の CSS を正にする。

独自の画面でタブを作るときは、この形（白い選ばれたタブ・紫の文字・淡い青のホバー）に合わせる。フォーカスは消さずに [`README.md`](README.md) の紫の輪を `:focus-visible` で付ける。
