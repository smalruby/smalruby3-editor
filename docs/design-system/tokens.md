# トークン

上流（Scratch）の GUI のデザイントークンの一覧と、スモウルビーの独自の画面のための別名（`smalruby-tokens.css`）の一覧。

- **値の正は上流 scratch-editor tag `v13.7.2` の CSS**（`packages/scratch-gui/src/css/`）。下の値は tag から取り出したもの（`git show v13.7.2:packages/scratch-gui/src/css/<ファイル>`）。
- トークンは **PostCSS の変数**（`postcss-simple-vars`。書き方は Sass と同じ `$name`）だけ。CSS のカスタムプロパティ（`--*`）は無い。例外はブロックの色で、scratch-blocks が実行時に `--colour-*` を書き出す（[`blocks.md`](blocks.md)）。
- 「使う CSS」は、tag の `src/` の CSS のうち、そのトークンを参照するファイルの数（`src/css/` 自身は数えない）。0 は CSS からは使わず、JS の値と合わせるためだけにあるもの。

## スモウルビーとの差

上流のトークンのファイルとの差は 2 か所だけ。

| トークン | 上流 v13.7.2 | スモウルビー | マーカー | わけ |
|---|---|---|---|---|
| `$z-index-alerts` | `490` | `520` | あり（`=== Smalruby: alerts above modals so session-expired is visible ===`） | クラスのセッション切れのアラートを、モーダルより上に出す |
| `$ui-red` | （無い） | `hsla(0, 100%, 50%, 1)`（`#FF0000`） | **無い** | microbitMore のファームウェア更新の UI（`connection-modal.css`）が 1 か所使う |

`$ui-red` のマーカーの付け忘れは、デザインシステムの文書とは別の小さな Issue で直す。

## 色（`colors.css`・上流 41 個）

値の正は `hsla(...)`。16 進は上流のコメントにあるものを写した（コメントが無いものは計算した値）。不透明度が 1 でないものは、16 進の色をその不透明度で重ねる。

| トークン | 値 | 16 進 | 使う CSS | メモ |
|---|---|---|---|---|
| `$ui-primary` | `hsla(215, 100%, 95%, 1)` | `#E5F0FF` | 7 | 画面の地の淡い青 |
| `$ui-secondary` | `hsla(215, 75%, 95%, 1)` | `#E9F1FC` | 3 | フルスクリーンのモーダルの地 |
| `$ui-tertiary` | `hsla(215, 50%, 90%, 1)` | `#D9E3F2` | 3 | |
| `$ui-modal-overlay` | `hsla(215, 100%, 65%, 0.9)` | `#4C97FF` × 0.9 | 4 | モーダルの後ろ |
| `$ui-alert-overlay` | `hsla(215, 100%, 65%, 0.4)` | `#4C97FF` × 0.4 | 1 | |
| `$ui-white` | `hsla(0, 100%, 100%, 1)` | `#FFFFFF` | 36 | |
| `$ui-white-dim` | `hsla(0, 100%, 100%, 0.75)` | `#FFFFFF` × 0.75 | 2 | |
| `$ui-white-transparent` | `hsla(0, 100%, 100%, 0.25)` | `#FFFFFF` × 0.25 | 7 | |
| `$ui-transparent` | `hsla(0, 100%, 100%, 0)` | `#FFFFFF` × 0 | 1 | 透明 |
| `$ui-black-transparent` | `hsla(0, 0%, 0%, 0.15)` | `#000000` × 0.15 | 36 | 枠線・区切り線 |
| `$ui-black-transparent-10` | `hsla(0, 0%, 0%, 0.10)` | `#000000` × 0.1 | 2 | |
| `$ui-green` | `hsla(163, 85%, 35%, 1)` | `#0DA57A` | 1 | |
| `$ui-green-2` | `hsla(163, 85%, 40%, 1)` | `#0FBD8C` | 1 | |
| `$ui-orange` | `hsla(37, 96%, 55%, 1)` | `#FAA51D` | 1 | |
| `$ui-alert-orange` | `hsla(32, 100%, 94%, 1)` | `#FFF0DF` | 1 | 注意のアラートの地 |
| `$text-primary` | `hsla(225, 15%, 40%, 1)` | `#575E75` | 20 | 本文の文字 |
| `$text-primary-transparent` | `hsla(225, 15%, 40%, 0.75)` | `#575E75` × 0.75 | 3 | |
| `$motion-primary` | `hsla(215, 100%, 65%, 1)` | `#4C97FF` | 6 | |
| `$motion-tertiary` | `hsla(215, 60%, 50%, 1)` | `#3373CC` | 0 | |
| `$looks-secondary` | `hsla(260, 60%, 60%, 1)` | `#855CD6` | 38 | 主の色（メニューバー・主ボタン・選ばれた状態） |
| `$looks-transparent` | `hsla(260, 60%, 60%, 0.35)` | `#855CD6` × 0.35 | 18 | フォーカスの輪・ホバーの枠 |
| `$looks-light-transparent` | `hsla(260, 60%, 60%, 0.15)` | `#855CD6` × 0.15 | 6 | |
| `$looks-secondary-dark` | `hsla(260, 42%, 51%, 1)` | `#714EB6` | 1 | |
| `$red-primary` | `hsla(20, 100%, 55%, 1)` | `#FF661A` | 3 | |
| `$red-tertiary` | `hsla(20, 100%, 45%, 1)` | `#E64D00` | 2 | |
| `$sound-primary` | `hsla(300, 53%, 60%, 1)` | `#CF63CF` | 1 | |
| `$sound-tertiary` | `hsla(300, 48%, 50%, 1)` | `#BD42BD` | 1 | |
| `$control-primary` | `hsla(38, 100%, 55%, 1)` | `#FFAB19` | 2 | |
| `$data-primary` | `hsla(30, 100%, 55%, 1)` | `#FF8C1A` | 7 | 注意のアラートの枠 |
| `$pen-primary` | `hsla(163, 85%, 40%, 1)` | `#0FBD8C` | 3 | |
| `$pen-transparent` | `hsla(163, 85%, 40%, 0.25)` | `#0FBD8C` × 0.25 | 1 | |
| `$pen-tertiary` | `hsla(163, 86%, 30%, 1)` | `#0B8E69` | 1 | |
| `$error-primary` | `hsla(30, 100%, 55%, 1)` | `#FF8C1A` | 3 | |
| `$error-light` | `hsla(30, 100%, 70%, 1)` | `#FFB366` | 1 | |
| `$error-transparent` | `hsla(30, 100%, 55%, 0.25)` | `#FF8C1A` × 0.25 | 2 | |
| `$extensions-primary` | `hsla(163, 85%, 40%, 1)` | `#0FBD8C` | 4 | |
| `$extensions-tertiary` | `hsla(163, 85%, 30%, 1)` | `#0B8E69` | 2 | 成功のアラートの枠 |
| `$extensions-transparent` | `hsla(163, 85%, 40%, 0.35)` | `#0FBD8C` × 0.35 | 2 | |
| `$extensions-light` | `hsla(163, 57%, 85%, 1)` | `#C3EFE2`（計算） | 1 | 成功のアラートの地 |
| `$membership-blue` | `hsla(215, 60%, 46%, 1)` | `#2F6ABC` | 1 | |
| `$drop-highlight` | `hsla(215, 100%, 77%, 1)` | `#8ABBFF`（計算） | 4 | ドロップ先の強調 |

## 大きさ（`units.css`・17 個）

| トークン | 値 | 使う CSS | メモ |
|---|---|---|---|
| `$space` | `0.5rem` | 25 | 余白の基本 |
| `$sprites-per-row` | `5` | 1 | |
| `$menu-bar-height` | `3rem` | 4 | メニューバーの高さ（48px） |
| `$sprite-info-height` | `6rem` | 1 | |
| `$stage-menu-height` | `2.75rem` | 4 | |
| `$library-header-height` | `3.125rem` | 2 | |
| `$library-filter-bar-height` | `2.5rem` | 3 | |
| `$stage-standard-border-width` | `0.0625rem` | 2 | |
| `$stage-full-screen-border-width` | `0.1875rem` | 1 | |
| `$stage-full-screen-stage-padding` | `0.1875rem` | 1 | |
| `$form-radius` | `calc($space / 2)`（= `0.25rem`） | 9 | 入力欄・ボタンの角丸 |
| `$full-size` | `1095px` | 0 | `layout-constants.js` と合わせる |
| `$full-size-paint` | `1249px` | 1 | `layout-constants.js` と合わせる |
| `$menu-bar-standard-font-size` | `0.75rem` | 2 | |
| `$menu-bar-large-font-size` | `0.875rem` | 1 | |
| `$menu-bar-button-size` | `2rem` | 2 | |
| `$menu-bar-item-max-width` | `12rem` | 2 | |

## 文字（`typography.css`）

変数は無く、要素の規則が 3 つだけ。

| 対象 | 値 |
|---|---|
| `body` の `font-family` | `"Helvetica Neue", Helvetica, Arial, sans-serif` |
| `h2` | `font-size: 1.5rem`・`font-weight: bold` |
| `p` | `font-size: 1rem`・`line-height: 1.5em` |

## 重なり順（`z-index.css`）

画面全体の重なり順だけを置くファイル。部品の中だけの `z-index` はここに無い。上から下へ、値の小さい順。

| トークン | 値 | 使う CSS | メモ |
|---|---|---|---|
| （ツールボックス） | `40` | — | scratch-blocks の中で決まる |
| `$z-index-extension-button` | `42` | 1 | |
| `$z-index-stage-indicator` | `45` | 1 | |
| `$z-index-add-button` | `46` | 1 | |
| `$z-index-tooltip` | `47` → **`490`** | 3 | 上流のファイルに 2 回ある。後ろの `490` が効く |
| `$z-index-monitor` | `48` | 1 | |
| `$z-index-stage-question` | `49` | 1 | |
| `$z-index-card` | `480` | 1 | チュートリアルのカード |
| `$z-index-tooltip-overlay` | `481` | 1 | |
| `$z-index-alerts` | `490`（スモウルビーは **`520`**） | 1 | 上の「スモウルビーとの差」 |
| `$z-index-menu-bar` | `491` | 2 | |
| `$z-index-loader` | `500` | 1 | |
| `$z-index-modal-overlay` | `501` | 1 | |
| `$z-index-modal` | `510` | 5 | |
| `$z-index-drag-layer` | `1000` | 2 | ブロックのドラッグも 1000（`blocks.css`） |
| `$z-index-monitor-dragging` | `1010` | 1 | |
| `$z-index-dragging-sprite` | `1020` | 1 | |
| `$z-index-stage-color-picker-background` | `2000` | 1 | |
| `$z-index-stage-with-color-picker` | `2010` | 1 | |
| `$z-index-stage-header` | `5000` | 1 | |
| `$z-index-stage-wrapper-overlay` | `5000` | 2 | |
| `$z-index-context-menu` | `10000` | 1 | 右クリックのメニューはいつも一番上 |

## くり返し出る直書きの値（トークンの候補）

上流でも、部品の CSS にはトークンを使わない直書きの値が多い（EPIC の対象の上流 CSS 約 70 ファイルで約 980 件）。そのうち、くり返し出るものをトークンの候補にした。「別名」の列は `smalruby-tokens.css` で名前を付けたもの。

| 種類 | 値 | 出る数（回 / ファイル） | 別名 |
|---|---|---|---|
| 角丸 | `0.25rem`（= `$form-radius`） | 16 / 13 | `$radius-small` |
| 角丸 | `0.5rem` | 10 / 9 | `$radius-medium` |
| 角丸 | `50%`・`100%`（丸） | 8 / 6・12 / 7 | `$radius-round` |
| 文字の大きさ | `0.85rem` | 13 / 10 | `$font-size-dialog` |
| 文字の大きさ | `0.625rem` | 12 / 8 | `$font-size-xsmall` |
| 文字の大きさ | `0.875rem`（`.875rem` の書き方ゆれを含む） | 15 / 12 | `$font-size-medium`（= `$menu-bar-large-font-size`） |
| 文字の大きさ | `0.75rem`（`.75rem` を含む） | 14 / 10 | `$font-size-small`（= `$menu-bar-standard-font-size`） |
| 文字の大きさ | `1rem` | 6 / 5 | `$font-size-base` |
| 文字の太さ | `bold`（ほかに `bolder`・`700`・`600`・`500` の書き方ゆれ） | 39 / 26 | `$font-weight-bold` |
| 影 | `0 0 .5rem hsla(0, 0%, 0%, .25)` | 3 / 2（library-item・action-menu） | `$shadow-raised` |
| 動き | `all 0.25s ease` | 6 / 5 | `$transition-standard` |
| 動き | `all 0.15s ease-out` | 4 / 3 | （まだ付けない） |
| 余白 | `0.25rem`・`0.5rem`・`1rem`（`$space` があるのに直書き） | 多い | `$space-small`・`$space-medium`・`$space-large` |
| 色 | `hsla(0, 0%, 0%, .25)` | 4 / 3 | （まだ付けない。影の中で使う） |
| 色 | `hsla(0, 0%, 0%, .1)`（= `$ui-black-transparent-10`） | 5 / 2 | （上流の名前を使う） |
| 色 | `#7fff1e`（ドラッグ中の光る枠） | 4 / 2（sprite-selector・stage-selector） | （まだ付けない） |
| 色 | `rgb(232, 237, 241)`（= ペイントの `$ui-background-blue`） | 2 / 2 | （まだ付けない。[`paint.md`](paint.md)） |

その画面だけの値（meter の 6 色、waveform の色、debug-modal の `24px`・`16px`、close-button のオレンジの影、alert の `#555` など）はトークンにしない。各画面の文書に書く。

## 意味の名前の別名（`smalruby-tokens.css`）

独自の画面は、上流の名前の代わりにこの名前で書く。上流の名前を使ってもよい（どちらも同じ値になる）。

| 別名 | 中身 | 用途 |
|---|---|---|
| `$color-primary` | `$looks-secondary` | 主ボタンの塗り・選ばれた状態・メニューバー |
| `$color-primary-dark` | `$looks-secondary-dark` | 主の色の上の枠・押したときの塗り |
| `$color-primary-transparent` | `$looks-transparent` | フォーカスの輪・ホバーの枠 |
| `$color-text` | `$text-primary` | 本文の文字 |
| `$color-text-muted` | `$text-primary-transparent` | 補助の文字 |
| `$color-surface` | `$ui-white` | 本文・カード・モーダルの本文の背景 |
| `$color-background` | `$ui-primary` | 画面の地 |
| `$color-border` | `$ui-black-transparent` | 枠線・区切り線 |
| `$color-overlay` | `$ui-modal-overlay` | モーダルの後ろ |
| `$color-warning` / `$color-warning-background` | `$data-primary` / `$ui-alert-orange` | 注意（`alert.css` の `.warn`） |
| `$color-success` / `$color-success-background` | `$extensions-tertiary` / `$extensions-light` | 成功（`alert.css` の `.success`） |
| `$color-info` / `$color-info-background` | `$motion-primary` / `$ui-primary` | お知らせ（`alert.css` の `.info-blue`） |
| `$space-small` / `$space-medium` / `$space-large` | `calc($space / 2)` / `$space` / `calc($space * 2)` | 余白 0.25rem / 0.5rem / 1rem |
| `$radius-small` | `$form-radius` | ボタン・入力欄 |
| `$radius-medium` | `0.5rem` | カード・ライブラリの項目・吹き出し |
| `$radius-round` | `50%` | 丸いアイコンボタン・アバター |
| `$font-size-xsmall` | `0.625rem` | 入力欄のラベル・バッジ |
| `$font-size-small` | `$menu-bar-standard-font-size` | メニューバー・タブ |
| `$font-size-dialog` | `0.85rem` | ダイアログの本文・ボタン |
| `$font-size-medium` | `$menu-bar-large-font-size` | ライブラリ・フィルタ |
| `$font-size-base` | `1rem` | 本文 |
| `$font-size-heading` | `1.5rem` | 見出し |
| `$font-weight-bold` | `bold` | 太字 |
| `$shadow-raised` | `0 0 0.5rem hsla(0, 0%, 0%, 0.25)` | 浮いたカード |
| `$transition-standard` | `all 0.25s ease` | ホバー・選択の切り替え |

重なり順は別名を作らない。独自のモーダルやメニューは上流の `$z-index-modal` などをそのまま使う。

### 名前の付け方のきまり

- `<種類>-<意味>`。種類は `color`・`space`・`radius`・`font-size`・`font-weight`・`shadow`・`transition`。
- 大きさの段階は `xsmall`・`small`・`medium`・`large`。用途で決まるものは用途の名前（`dialog`・`heading`）。
- 上流にトークンがあるときは、別名はそれを指す（値を写さない）。上流で直書きのときだけ、ここで値を持つ。
- 上流の名前（`$looks-secondary` など）と、すでにある名前（部品の中だけの `$main-button-size` など）にぶつけない。
