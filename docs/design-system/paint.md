# コスチュームタブ（ペイントエディター）

コスチュームタブは、GUI の**左の一覧**（`asset-panel`）と、npm のパッケージ **scratch-paint** の**ペイントエディター**でできている。

- **値の正**: 左の一覧は上流 scratch-editor tag `v13.7.2` の CSS（`git show v13.7.2:packages/scratch-gui/src/components/<部品>/<部品>.css`）。ペイントエディターは scratch-paint `4.1.50`（v13.7.2 の `package.json` と同じ版）の `src/` の CSS。npm のパッケージに `src/` が入っているので、`node_modules/scratch-paint/src/` で読める。表の「ファイル」は `src/components/` からの道すじ。
- scratch-paint は npm のパッケージなので、**読んで記録するだけ**にする（直さない・上書きしない）。
- 「実測」は撮影スクリプト（`tools/playwright-verify/capture-design-system.mjs` の `costumes-tab`・`paint-color-picker`）で 1366×1024 の画面から取った計算済みの値。上流の CSS と同じなら「一致」と書く。
- 見本: [`0701-costumes-tab.png`](screenshots/0701-costumes-tab.png)（左の一覧とペイントエディター）、[`0702-paint-color-picker.png`](screenshots/0702-paint-color-picker.png)（色を選ぶ吹き出し）
- 日本語では、ペイントエディターのアイコンのボタン（グループ化・手前に出すなど）の**下の名前を出さない**（scratch-paint の `lib/hide-label.js` が `ja`・`ja-Hira` を「長すぎる言葉」としている）。見本もアイコンだけになる。

## 左の一覧（GUI。`asset-panel/asset-panel.css`・`asset-panel/selector.css`）

コスチュームタブと音タブで同じもの。音タブの文書（[`sound-editor.md`](sound-editor.md)）からもここを見る。

| 部分 | 値 | トークン | 実測 |
|---|---|---|---|
| 全体の枠（`asset-panel.css` の `.wrapper`） | 枠 `1px solid $ui-black-transparent`・地 白・右の上下だけ角丸 `$space`・文字 0.85rem・`"Helvetica Neue", Helvetica, Arial, sans-serif` | `$color-border`・`$color-surface`・`$radius-medium`・`$font-size-dialog` | 一致（`0 8px 8px 0`・13.6px） |
| 右の編集の場所（`.detail-area`） | 左に `1px solid $ui-black-transparent` | `$color-border` | |
| 一覧（`selector.css` の `.wrapper`） | 幅 150px・地 `$ui-tertiary` | 別名なし | 一致（150px・`rgb(217, 227, 242)`） |
| 項目の置き場（`.list-item`） | 5rem × 5rem・上下 0.5rem・左右は中央（`auto`） | | 一致（80×80px） |
| 項目 | スプライトの項目と同じ部品（[`components/cards.md`](components/cards.md) の「スプライトの項目」）。左上に番号（`.number`: 0.625rem の太字）、名前の下に大きさ・長さ（`.sprite-details`: 0.5rem） | `$font-size-xsmall` | 一致（番号 10px・700、大きさ 8px） |
| 一覧の終わり（`.list-area:after`） | 高さ 70px の空き（下の追加のボタンに最後の項目が隠れないように） | | |
| 追加のボタンの場所（`.new-buttons`） | 下にそろえる・上下の余白 0.75rem・文字 `$looks-secondary` | | |
| 追加のボタン | コードタブのスプライトの追加と同じ部品（[`code-tab.md`](code-tab.md) の「追加のボタン」） | | 一致（44×44px・ホバーで緑・`scale(1.1)`） |
| 下をうすく消す帯（`.new-buttons:before`） | 高さ 100px・`linear-gradient(rgba(232,237,241,0), rgba(232,237,241,1))` | 直書き | |
| 狭い画面（幅 1249px 以下。`$full-size-paint`） | 一覧の幅 80px・項目の幅 4rem | | （撮っていない） |

**気づいた点**: 下をうすく消す帯の色 `rgb(232, 237, 241)`（`#E8EDF1`）は、一覧の地 `$ui-tertiary`（`#D9E3F2`）と違う。一覧の下の端だけ、少し明るい灰色に変わる。`#E8EDF1` は scratch-paint の `$ui-background-blue` と同じ値で、GUI では全画面のときのステージの上の段（`stage-header.css`）にも直書きされている（[`tokens.md`](tokens.md) の「くり返し出る直書きの値」）。

## scratch-paint のトークン（GUI の古い写し）

scratch-paint の `src/css/colors.css`（13 個）と `src/css/units.css`（10 個）は、ファイルの先頭に「DO NOT EDIT / GUI からの写し」と書かれた **GUI の `colors.css`・`units.css` の古い写し**で、いまの GUI と値がずれているものがある。値はどちらも 16 進か Sass の式のまま写した。

「paint で使う CSS」は、scratch-paint 4.1.50 の `src/` の CSS（`css/` と `playground/` を除く 21 ファイル）のうち、その変数を使うファイルの数。

### 色（`src/css/colors.css`）

| 変数 | scratch-paint 4.1.50 | GUI v13.7.2 | くらべた結果 | paint で使う CSS |
|---|---|---|---|---|
| `$ui-pane-border` | `#D9D9D9` | （無い） | paint だけ。区切りの点線・ボタンの並びの枠 | 3 |
| `$ui-pane-gray` | `#F9F9F9` | （無い） | paint だけ。使われていない | 0 |
| `$ui-background-blue` | `#e8edf1` | （無い） | paint だけ。変数は使われていないが、同じ値を `paint-editor.css` の `.canvas-container` が直書きしている | 0 |
| `$text-primary` | `#575e75` | `hsla(225, 15%, 40%, 1)`（`#575E75`） | 同じ | 2 |
| `$looks-secondary` | `#855CD6` | `hsla(260, 60%, 60%, 1)`（`#855CD6`） | 同じ | 6 |
| `$looks-transparent` | `hsla(260, 60%, 60%, 0.35)` | `hsla(260, 60%, 60%, 0.35)` | 同じ | 4 |
| `$red-primary` | `#FF661A` | `hsla(20, 100%, 55%, 1)`（`#FF661A`） | 同じ | 0 |
| `$red-tertiary` | `#E64D00` | `hsla(20, 100%, 45%, 1)`（`#E64D00`） | 同じ | 0 |
| `$sound-primary` | `#CF63CF` | `hsla(300, 53%, 60%, 1)`（`#CF63CF`） | 同じ | 0 |
| `$sound-tertiary` | **`#A63FA6`** | `hsla(300, 48%, 50%, 1)`（**`#BD42BD`**） | **違う**（paint は GUI より暗い） | 0 |
| `$control-primary` | `#FFAB19` | `hsla(38, 100%, 55%, 1)`（上流のコメントは `#FFAB19`。Chrome は `rgb(255, 171, 26)` = `#FFAB1A` に描く） | 実質同じ（HSLA の丸めで青が 1 違う） | 0 |
| `$data-primary` | `#FF8C1A` | `hsla(30, 100%, 55%, 1)`（`#FF8C1A`） | 同じ | 1 |
| `$form-border` | `#E9EEF2` | （無い） | paint だけ。入力欄・ドロップダウンの枠（GUI の入力欄の枠は `$ui-black-transparent`） | 2 |

GUI の `colors.css` の残りの 32 個（`$ui-primary`・`$ui-white`・`$ui-black-transparent` など）は、paint の写しには無い。paint の CSS は、白を `white` と直書きし、黒の半透明を `rgba(0, 0, 0, 0.25)` などで直書きしている（下の「部品」の表）。

### 大きさ（`src/css/units.css`）

| 変数 | scratch-paint 4.1.50 | GUI v13.7.2 | くらべた結果 | paint で使う CSS |
|---|---|---|---|---|
| `$space` | `0.5rem` | `0.5rem` | 同じ | 0 |
| `$grid-unit` | `.25rem` | （無い） | paint だけ。paint の余白はこれの倍数（`calc(2 * $grid-unit)` = 0.5rem など）で書く | 10 |
| `$sprites-per-row` | `5` | `5` | 同じ | 0 |
| `$menu-bar-height` | `3rem` | `3rem` | 同じ | 0 |
| `$sprite-info-height` | `6rem` | `6rem` | 同じ | 0 |
| `$stage-menu-height` | `2.75rem` | `2.75rem` | 同じ | 0 |
| `$library-header-height` | **`4.375rem`** | **`3.125rem`** | **違う** | 0 |
| `$form-radius` | `calc($space / 2)` | `calc($space / 2)` | 同じ | 0 |
| `$full-size` | `1095px` | `1095px` | 同じ | 0 |
| `$full-size-paint` | **`1256px`** | **`1249px`** | **違う**（下の「画面の幅で変わるところ」） | 3 |

GUI の `units.css` の残りの 8 個（`$library-filter-bar-height`・`$stage-standard-border-width`・`$menu-bar-standard-font-size` など）は、paint の写しには無い。

値がずれている変数のうち、paint の CSS が使っているのは `$full-size-paint` だけ。`$sound-tertiary` と `$library-header-height` は paint の中で使われていないので、画面の見た目には出ない。

### 画面の幅で変わるところ

ペイントエディターとその左の一覧は、画面の幅で 3 つの別々のしきい値を使っている。

| しきい値 | どこ | 狭いとき |
|---|---|---|
| 幅 1249px 以下 | GUI の `selector.css`（`$full-size-paint` = 1249px） | 左の一覧の幅 150px → 80px |
| 幅 1256px 以下 | scratch-paint の `paint-editor.css`・`label.css`・`tool-select-base.css`（paint の `$full-size-paint` = 1256px） | エディターの左右の余白・道具のボタンのまわりを詰め、道具を 1 列にし、ラベルを入力欄の上に置く |
| 幅 1274px より狭い | scratch-paint の `lib/layout-constants.js` の `fullSizeEditorMinWidth`（`fixed-tools.jsx` の `MediaQuery`） | 上の段のグループ化・手前に出すなどのボタンを「その他」のドロップダウンにまとめる |

GUI の `lib/layout-constants.js` の `fullSizePaintMinWidth` は 1250（CSS の 1249px は「1px 引いた値」）で、paint の 1256px・1274px とそろっていない。幅 1250〜1273px では、左の一覧は広いのに、エディターは詰めた並び（1256px 以下）や「その他」のドロップダウン（1274px 未満）になる。

### 写しの部品（「DO NOT EDIT」の付いたファイル）

`colors.css`・`units.css` のほかに、GUI の部品の CSS を写したファイルが 3 つある。どれも GUI の v13.7.2 とずれている。

| ファイル | GUI v13.7.2 とのずれ |
|---|---|
| `forms/input.css`（`.input-form`） | 文字 **0.75rem**（GUI は 0.625rem）・枠 **`$form-border`**（GUI は `$ui-black-transparent`）・**ホバーの紫の枠が無い**・フォーカスの輪は `0 0 0 $grid-unit`（同じ 4px）。`.input-small` に GUI の余白 `0 0.5rem` と `text-overflow: clip` が無く、paint だけ `.input-small-range`（4rem）がある |
| `forms/label.css` | ラベルの右の余白を `calc(2 * $grid-unit)` で書く（同じ 0.5rem）。GUI の `.input-group-column` と `white-space: nowrap` が無く、`$full-size-paint` 以下で入力欄の上に置く規則がある。右から左の言葉の規則の 2 つめが `[dir="ltr"] .input-label-secondary` になっている（paint の書き誤り） |
| `coming-soon/coming-soon.css` | 枠 `hsla(0, 0%, 0%, .1)`・影 `hsla(0, 0%, 0%, .25)`・`z-index: 100` を直書き（GUI は `$ui-black-transparent`・`$z-index-tooltip`） |

## ペイントエディターの部品（scratch-paint 4.1.50）

### 割り付け（`paint-editor/paint-editor.css`）

| 部分 | 値 | 実測 |
|---|---|---|
| 全体（`.editor-container`） | 余白 `calc(3 * $grid-unit)`（0.75rem）・縦に並べる | 一致（12px） |
| 上の段（`.editor-container-top`） | 下に `1px dashed $ui-pane-border`・下の余白 0.5rem。1 段目にコスチュームの名前・元に戻す・グループ化など（`fixed-tools`）、2 段目に塗りつぶし・枠線・太さ・道具ごとの操作（`mode-tools`） | 一致（`rgb(217, 217, 217)` の点線） |
| 段の中の区切り（`.mod-dashed-border`） | 右に `1px dashed $ui-pane-border`・右の余白 0.5rem（`mode-tools.css` は 0.75rem） | 一致 |
| 下の段（`.top-align-row`） | 上の余白 `calc(5 * $grid-unit)`（1.25rem）・幅 524px 以上。左に道具のボタン、右にキャンバス | |
| 道具のボタンの場所（`.mode-selector`） | 幅 7.5rem まで・2 列に並べる（幅 1256px 以下は 1 列） | |
| キャンバスの場所（`.controls-container`） | 左右に 0.5rem（幅 1256px 以下は 0.25rem） | |

### 上の段のボタンと入力欄

| 部品・状態 | 値 | ファイル | 実測 |
|---|---|---|---|
| コスチュームの名前（`.costume-input`） | 幅 8rem。入力欄は paint の写しの `.input-form`（上の「写しの部品」）: 高さ 2rem・余白 `0 0.75rem`・文字 0.75rem の太字 `$text-primary`・枠 `1px solid $form-border`・角丸 2rem・動き `0.25s ease-out` | `fixed-tools/fixed-tools.css`・`forms/input.css` | 一致（128×32px・12px・700・`rgb(233, 238, 242)`・32px） |
| 入力欄のホバー | —（GUI の入力欄と違い、変わらない） | | 変化なし |
| 入力欄のフォーカス | 枠 `$looks-secondary`・輪 `0 0 0 $grid-unit $looks-transparent` | `forms/input.css` | 一致（`rgba(133, 92, 214, 0.35) 0 0 0 4px`） |
| ラベル（`.input-label`） | 0.625rem の太字・右に 0.5rem（幅 1256px 以下は太さふつうで入力欄の上） | `forms/label.css` | 一致（10px・700） |
| 並んだボタン（元に戻す・やり直す。`.button-group-button`） | 枠 `1px solid $ui-pane-border`（となりとの間は 1 本）・両端だけ角丸 0.25rem・余白 .35rem・アイコン 1.25rem | `fixed-tools/fixed-tools.css` | 一致（33×33px・`rgb(217, 217, 217)`・`4px 0 0 4px`） |
| 名前の付いたアイコンのボタン（グループ化・手前に出すなど。`.mod-edit-field`） | 地と枠なし・余白 `.25rem .325rem`・角丸 0.25rem・幅 3rem 以上・アイコン 1.5rem。名前（`.edit-field-title`）は 0.625rem・上に .125rem（日本語では出さない） | `labeled-icon-button/labeled-icon-button.css` | 一致（48×32px・4px） |
| ボタンの押した（`button.css` の `.button:active`） | 地 `$looks-transparent` | `button/button.css` | 一致（`rgba(133, 92, 214, 0.35)`） |
| ボタンの押せない（`.mod-disabled`） | 不透明度 .5・`cursor: auto`・押しても地が変わらない | `button/button.css` | 一致（0.5） |
| 色のボタン（塗りつぶし・枠線。`.color-button`） | 3rem × 2rem。左の色の見本（`.color-button-swatch`: 2rem）と右の ▾（`.color-button-arrow`: 1rem・文字 `#575e75` 0.75rem）。枠 `1px solid rgba(0, 0, 0, 0.25)`・外側の角だけ 4px の角丸 | `color-button/color-button.css` | 一致（32×32px・16×32px） |
| 枠線の太さ（`.input-small-range`） | 幅 4rem・中央ぞろえ（入力欄の形はコスチュームの名前と同じ） | `forms/input.css` | 一致（64×32px） |
| 道具ごとの操作の段（`.mode-tools`） | 高さ 3rem 以上。アイコン 2rem | `mode-tools/mode-tools.css` | 一致（48px） |
| 「その他」・文字の書体のドロップダウン（`.dropdown`） | 枠 `1px solid $form-border`・角丸 5px・幅 3.5rem 以上・文字 `$looks-secondary`・余白 .5rem。開いている間（`.mod-open`）は地 `$form-border` | `dropdown/dropdown.css` | （撮っていない。「その他」は幅 1274px 未満で出る。書体は文字の道具で出る） |
| 「その他」の項目（`.mod-menu-item`） | 余白 0.75rem・幅 6.25rem 以上・動き `0.1s ease`・ホバーで地 `$looks-transparent`。区切り（`.mod-top-divider`）は上に `1px solid $ui-pane-border` | `fixed-tools/fixed-tools.css` | （撮っていない） |
| 書体の項目（`font-dropdown.css` の `.mod-menu-item`） | 幅 8.5rem・ホバーで地 `$looks-secondary`・文字 白 | `font-dropdown/font-dropdown.css` | （撮っていない） |
| フォーカス | ボタンの並び・道具のボタン・名前の付いたボタンは `outline: none`（フォーカスの見た目を消している） | | |

### 道具のボタン（`tool-select-base/tool-select-base.css`）

左の 2 列の、選択・形を変える・筆・消しゴム・塗りつぶし・文字・直線・円・四角のボタン（ビットマップのときは並びが変わる）。

| 状態 | 値 | トークン | 実測 |
|---|---|---|---|
| ふつう（`.mod-tool-select`） | まわりと余白 `$grid-unit`（0.25rem）・角丸 .25rem・地と枠なし・アイコン 2rem・動き `0.2s`（幅 1256px 以下はまわりを 0） | `$radius-small` と同じ値（直書き） | 一致（40×40px・4px） |
| ホバー | — | | 変化なし |
| 押した | 地 `$looks-transparent`（`button.css`） | `$color-primary-transparent` | 一致（`rgba(133, 92, 214, 0.35)`） |
| 選ばれた（`.is-selected`） | 地 `$looks-secondary`・アイコンを白に（`filter: brightness(0) invert(1)`） | `$color-primary` | 一致（`rgb(133, 92, 214)`・`brightness(0) invert(1)`） |
| フォーカス | `outline: none`（消している） | | 変化なし |
| 押せない | — | | |

### キャンバスとその下

| 部品・状態 | 値 | ファイル | 実測 |
|---|---|---|---|
| キャンバスの枠（`.canvas-container`） | 幅 402px 以上・枠 `1px solid #e8edf1`（直書き。`$ui-background-blue` と同じ値）・角丸 .25rem | `paint-editor/paint-editor.css` | 一致（`rgb(232, 237, 241)`・4px） |
| キャンバスの地（`.paper-canvas`） | `#D9E3F2`（直書き。GUI の `$ui-tertiary` と同じ値）。その上に透明を表す市松模様を paper.js で描く（`helper/layer.js`） | `containers/paper-canvas.css` | 一致（`rgb(217, 227, 242)`） |
| スクロールバー（`.vertical-scrollbar`・`.horizontal-scrollbar`） | 太さ 8px・まわり 4px・地 `rgba(190, 190, 190, 0.8)`・角丸 4px | `scrollable-canvas/scrollable-canvas.css` | 一致（8px・4px） |
| 下の段（`.canvas-controls`） | 高さ 36px・上に `$grid-unit`。左にビットマップ・ベクターの切り替え、右に拡大・縮小 | `paint-editor/paint-editor.css` | |
| ビットマップに変換（`.bitmap-button`） | 地 `$looks-secondary`・文字 白の太字 `calc(3 * $grid-unit)`（0.75rem）・行の高さ 1.5rem・余白 0.5rem・角丸 5px | `paint-editor/paint-editor.css` | 一致（12px・700・5px） |
| ビットマップに変換のホバー | — | | 変化なし |
| ビットマップに変換の押した | 地 `$looks-transparent`（`button.css` の `:active` が紫の地を上書きし、押している間は淡い紫の地に白い文字になる） | `button/button.css` | 一致（`rgba(133, 92, 214, 0.35)`） |
| 拡大・元の大きさ・縮小（`.button-group-button`） | 上の段の並んだボタンと同じ形（`paint-editor.css` に同じ規則が写されている） | `paint-editor/paint-editor.css` | 一致（33×33px） |
| 色を拾う虫眼鏡（`.eye-dropper`） | 丸・枠 `1px solid #222` | `loupe/loupe.css` | （撮っていない） |

### 色を選ぶ吹き出し（`color-picker/color-picker.css`・`forms/slider.css`）

色のボタンを押すと出る。吹き出しは `react-popover`。見本: [`0702-paint-color-picker.png`](screenshots/0702-paint-color-picker.png)

| 部品・状態 | 値 | 実測 |
|---|---|---|
| 吹き出し（`:global(.Popover-body)`） | 地 白・枠 `1px solid #ddd`・余白 4px・角丸 4px・影 `0px 0px 8px 1px rgba(0, 0, 0, .3)` | 一致（176×273px） |
| 吹き出しの三角（`:global(.Popover-tipShape)`） | 塗り 白・線 `#ddd` | |
| 見出し（色・鮮やかさ・明るさ。`.row-header`） | 0.65rem・`#575E75`・まわり 8px。名前（`.label-name`）は太字、値（`.label-readout`）は左に 10px | 一致（10.4px） |
| スライダー（`.container`） | 150 × 22px・角丸 11px・まわり 8px（下 20px）。地のグラデーションは JS で付ける（`slider.jsx` の `backgroundImage`） | 一致（150×22px・11px） |
| スライダーのつまみ（`.handle`） | 26px の丸・地 白・輪 `0 0 0 4px rgba(0, 0, 0, 0.15)` | 一致 |
| 区切り（`.divider`） | 上に `1px solid #ddd`・まわり 8px | 一致 |
| 見本（塗りの種類・塗りなし・スポイト。`.swatch`） | 1.5rem の正方形・枠 `1px solid #ddd`・角丸 4px | 一致（26×26px・4px） |
| 選ばれた見本（`.active-swatch`） | 枠 `1px solid $looks-secondary`・輪 `0px 0px 0px 3px $looks-transparent` | （単色の塗りでは出ないので撮っていない） |
| 使えないグラデーション（`.inactive-gradient`） | `filter: saturate(0%)` | |

**気づいた点**: `.Popover-body` と `.Popover-tipShape` の規則は `:global` なので、ペイントエディターを開く前から GUI 全体に効いている（GUI の CSS といっしょに読み込まれる）。GUI の向きを変える吹き出し（`direction-picker/direction-picker.jsx`）も `react-popover` を使い、GUI の CSS には `.Popover-body` の規則が無いので、白い箱・灰色の枠・影はこの scratch-paint の規則で描かれている。

### そのほかの直書きの値

scratch-paint の CSS で、変数を使わずに書いている色は次のとおり（同じ値の GUI のトークンがあるものはそれも書く）。

| 値 | 使う場所 | 同じ値の GUI のトークン |
|---|---|---|
| `#ddd` | 色を選ぶ吹き出しの枠・三角の線・区切り・見本の枠 | （無い。scratch-blocks の `css.ts` にも同じ `#ddd` がある。[`code-tab.md`](code-tab.md)） |
| `rgba(0, 0, 0, 0.25)` | 色のボタンの枠（3 か所） | （無い。黒 25%） |
| `rgba(0, 0, 0, 0.15)` | スライダーのつまみの輪 | `$ui-black-transparent` |
| `#575e75`・`#575E75` | 色のボタンの ▾・吹き出しの見出し | `$text-primary` |
| `#e8edf1` | キャンバスの枠 | （無い。paint の `$ui-background-blue`） |
| `#D9E3F2` | キャンバスの地 | `$ui-tertiary` |
| `rgba(190, 190, 190, 0.8)` | スクロールバー | （無い） |
| `#222` | 色を拾う虫眼鏡の枠 | （無い） |
| `white` | 吹き出しの地・ビットマップに変換の文字・つまみ | `$ui-white` |

## スモウルビーの追加

コスチュームタブ（PC の画面）には、スモウルビーの見た目の変更は無い。

- scratch-paint はパッケージのまま使い、上書きする CSS も無い。
- GUI の `costume-tab.jsx`・`paint-editor-wrapper.jsx` は、`@scratch/scratch-vm` などのパッケージ名を `@smalruby/...` に変えただけ。
- SP（スマホ）用の画面（`mobile-gui.css` の `body.smalruby-mobile-mode` の規則・上の段を折りたたむ `mobile-paint-toolbar-toggle`）は、このデザインシステムの対象外。

## 独自の画面で使う形

- **scratch-paint の写しの値を使わない**。独自の画面は GUI のトークン（`smalruby-tokens.css`）で書く。とくに入力欄は GUI の形（文字 0.625rem・枠 `$color-border`・ホバーで紫の枠。[`components/inputs.md`](components/inputs.md)）にし、paint の `$form-border` の枠にしない。
- **道具を選ぶボタン**（いくつかの中から 1 つを選ぶアイコンのボタン）は、ペイントエディターの道具のボタンの形にそろえる: 角丸 `$radius-small`・選ばれたら地 `$color-primary` でアイコンを白に・押している間の地 `$color-primary-transparent`。上流は `outline: none` でフォーカスを消しているので、独自の画面では [`components/README.md`](components/README.md) の「フォーカス」の形（`:focus-visible` で `outline: 2px solid $color-primary; outline-offset: 2px;`）を足す。
- **区切りの点線**（ボタンのまとまりの間）は、ペイントの `$ui-pane-border`（`#D9D9D9`）ではなく、音のエディターと同じ `1px dashed $color-border` にする（GUI のトークンにそろえる）。
