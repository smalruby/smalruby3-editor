# コードタブ

上流の値は tag `v13.7.2`。ファイルは `packages/scratch-gui/src/components/` から。

- **値の正は上流の CSS**（`git show v13.7.2:packages/scratch-gui/src/components/<部品>/<部品>.css`）。ブロックのパレットの中は scratch-blocks `v2.1.19` の `src/css.ts` と、その元の Blockly 12.4.1・`@blockly/continuous-toolbox` の CSS。
- 「実測」は撮影スクリプト（`tools/playwright-verify/capture-design-system.mjs` の `code-tab`・`code-tab-large-stage`・`monitor`）で 1366×1024 の画面から取った計算済みの値。上流の CSS と同じなら「一致」と書く。
- **スモウルビーの既定のステージは「中」**（上流は「大」）。ステージ・スプライトの情報・ターゲットの一覧の実測は、「大」に切りかえた `code-tab-large-stage` の値（下の「ステージの大きさ」）。
- タブ・切り替えボタン・入力欄・スプライトの項目は共通部品の文書に書いた（[`components/tabs.md`](components/tabs.md)・[`components/buttons.md`](components/buttons.md)・[`components/inputs.md`](components/inputs.md)・[`components/cards.md`](components/cards.md)）。ブロックとカテゴリの色（`--colour-*` の値・3 つの色のモード）は [`blocks.md`](blocks.md)。
- 見本: [`0201-code-tab-1366x1024.png`](screenshots/0201-code-tab-1366x1024.png)（画面全体。スモウルビーの既定の「中」のステージ。Ruby タブ・右上のリンク・パレットの ◀ のボタンはスモウルビーの追加）

## 画面の割り付け（`gui/gui.css`）

| 部分 | 値 | トークン | 実測 |
|---|---|---|---|
| 本体（`.body-wrapper`） | 高さ `calc(100% - $menu-bar-height)`・地 `$ui-primary`・中は `box-sizing: border-box` | `$color-background` | |
| 2 列（`.flex-wrapper`） | 左にエディター、右にステージとターゲットの列 | | |
| エディターの列（`.editor-wrapper`） | `flex-basis: calc(1024px - 408px - (($space + $stage-standard-border-width) * 2))`（= 598px）・のこりの幅に広がる・縮まない。幅 1024px の画面でステージの列が 408px になるように決めた値 | | |
| タブの並び（`.tab-list`） | [`components/tabs.md`](components/tabs.md) | | |
| ステージとターゲットの列（`.stage-and-target-wrapper`） | 左右の余白 `$space`。幅はステージの幅で決まる | `$space-medium` | |
| ターゲットの一覧の箱（`.target-wrapper`） | 上の余白 `$space`・のこりの高さに広がる | `$space-medium` | 一致（上 8px） |
| アラートの置き場（`.alerts-container`） | 上から 53px・中央・`z-index: $z-index-alerts` | | |

## ブロックのパレット・カテゴリ・スクリプトエリア

見本: [`0204-category-menu.png`](screenshots/0204-category-menu.png)（カテゴリの一覧。上流の 9 つ）

### 枠（`blocks/blocks.css`）

| 部分 | 値 | トークン | 実測 |
|---|---|---|---|
| 全体の枠（`.injectionDiv`） | 枠 `1px solid $ui-black-transparent`・右の上下だけ角丸 `$space` | `$color-border`・`$radius-medium` | 一致（`0 8px 8px 0`） |
| カテゴリの一覧（`.blocklyToolbox`） | 右と下に `1px solid $ui-black-transparent`（scratch-blocks の `#ddd` を上書き）・高さ `calc(100% - 3.25rem)`（下の拡張機能のボタンの分）・スクロールバーを出さない | `$color-border` | （幅 60px） |
| フライアウト（`.blocklyFlyout`） | 右に `1px solid $ui-black-transparent` | `$color-border` | （幅 250px。タブの並びと同じ幅） |
| スクリプトエリアの地（`.blocklyMainBackground`） | 線を引かない（`stroke: none`。scratch-blocks の `#c6c6c6` を消す） | | |
| ドラッグで落とせるとき（`.drag-over:after`） | 全体に `$drop-highlight` を不透明度 0.75 で重ねる・動き `all 0.25s ease` | `$transition-standard` | （撮っていない） |
| ドラッグ中のブロック（`.blocklyBlockDragSurface`） | `z-index: $z-index-drag-layer`（1000） | | |

### カテゴリの一覧（scratch-blocks `css.ts`・`@blockly/continuous-toolbox`）

| 部分・状態 | 値 | 実測 |
|---|---|---|
| 一覧（`.blocklyToolbox`） | 地 `--colour-toolbox`・文字 `--colour-toolboxText`・`"Helvetica Neue", Helvetica, sans-serif`・`z-index: 40`（ドラッグ中のブロックがかぶさる） | 一致（白・`rgb(87, 94, 117)`・40） |
| 項目（`.blocklyToolboxCategory`） | 上下の余白 `0.375rem`・中央ぞろえ・`cursor: pointer` | 一致（6px 0・60×48px） |
| 色の丸（`.categoryBubble`） | 1.25rem の丸・下に 0.125rem。塗りはカテゴリの `colourPrimary`、枠は `1px solid` カテゴリの `colourTertiary`（`lib/make-toolbox-xml.js` の `secondaryColour`。ブロックの枠と同じ色） | 一致（20×20px・動きは塗り `rgb(76, 151, 255)`・枠 `rgb(51, 115, 204)`） |
| 名前（`.blocklyToolboxCategoryLabel`） | 文字 0.65rem・幅 60px・中央ぞろえ・折り返す | 一致（10.4px） |
| 拡張機能の絵（`.categoryIconBubble`） | 1.25rem の画像 | （撮っていない） |
| ホバー | 文字 `#4c97ff`（scratch-blocks の後ろの規則。前の規則の `--colour-toolboxHover` と同じ値）・地 `rgba(255, 255, 255, .2)`（Blockly の既定。白い地の上なので見えない） | 一致（`rgb(76, 151, 255)`） |
| 選ばれた（`.blocklyToolboxSelected`） | 地 `--colour-toolboxSelected` | 一致（`rgb(233, 238, 242)`） |
| 押した・押せない・フォーカス | — | |

上流の `blocks.css` は名前の文字を `.scratchCategoryMenuItemLabel { font-size: 0.65rem }` で決めているが、scratch-blocks v2 はこのクラスを出さない。効いているのは scratch-blocks の `.blocklyToolboxCategoryLabel` の `.65rem`（同じ値）。

### 拡張機能のボタン（`extension-button/extension-button.css`）

カテゴリの一覧の下の紫のボタン。

| 状態 | 値 | トークン | 実測 |
|---|---|---|---|
| ふつう（`.extension-button-container`） | 3.75rem × 3.25rem・地と枠 `$looks-secondary`（`1px solid`）・`z-index: $z-index-extension-button`（42）・上に 15px の影（`linear-gradient(rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.15))`） | `$color-primary` | 一致（60×52px・42） |
| アイコン | 1.75rem | | |
| フォーカス | `:focus-visible { outline: revert }`（ブラウザの既定の輪） | | 一致（`outline: auto 1px rgb(16, 16, 16)`） |
| ホバー・押した・押せない | — | | |

### フライアウト（scratch-blocks `css.ts`）

| 部分・状態 | 値 | 実測 |
|---|---|---|
| 地（`.blocklyFlyoutBackground`） | 塗り `--colour-flyout`・`fill-opacity: .8` | |
| カテゴリの見出し（`.blocklyFlyoutLabelText`） | 14pt の太字・`#575E75`・`"Helvetica Neue", Helvetica, sans-serif` | 一致（18.67px・700） |
| ボタン（「変数を作る」など。`.blocklyFlyoutButtonBackground`） | 線 `#c6c6c6`・ホバーで塗り白・文字 `--colour-textFieldText`。大きさは文字で決まる | （「変数を作る」は 160×41。フライアウトの縮尺 0.675 で 108×28px に写る） |
| チェックボックス（モニターを出す。`.blocklyFlyoutCheckbox`） | 25×25（`checkbox_bubble.ts` の `CHECKBOX_SIZE`）・ブロックとの間 12（`CHECKBOX_MARGIN`）・チェックしたら塗り `--colour-toolboxHover` | 一致（縮尺 0.675 で 17×17px に写る） |
| スクロールバー | つまみ `#bbb`・ホバー `#aaa`（灰色の地の上なので、スクリプトエリアより濃い） | |

### スクリプトエリア

| 部分・状態 | 値 | 実測 |
|---|---|---|
| 地 | `--colour-workspace`（色のモードの `workspace`） | |
| 方眼（`containers/blocks.jsx` の `defaultOptions.grid`） | 間隔 40・線の長さ 2・色 `#ddd` | |
| はじめの縮尺 | `BLOCKS_DEFAULT_SCALE` = 0.675（`lib/layout-constants.js`） | |
| スクロールバー | つまみ `--colour-scrollbar`・ホバー `--colour-scrollbarHover` | |
| 拡大・縮小・元に戻す（`.blocklyZoom > image`） | ふつう 不透明度 1・ホバー 0.75・押した 0.6 | 一致（36×36px・ホバー 0.75） |

## ステージの上の段（`stage-header/stage-header.css` ほか）

見本: [`0202-stage-header.png`](screenshots/0202-stage-header.png)（「大」のステージ。大きさのボタンの真ん中「中」はスモウルビーの追加）

| 部分・状態 | 値 | トークン | 実測 |
|---|---|---|---|
| 段（`.stage-menu-wrapper`） | 高さ `$stage-menu-height`（2.75rem）・上下の余白 `$space`・左右に分ける | `$space-medium` | 一致（44px・8px 0） |
| 緑の旗（`green-flag/green-flag.css` の `.green-flag`） | 2rem・余白 0.375rem・角丸 0.25rem | `$radius-small` と同じ値（直書き） | 一致（32×32px・6px・4px） |
| 緑の旗のホバー | 地 `$looks-light-transparent` | 別名なし | 一致（`rgba(133, 92, 214, 0.15)`） |
| 緑の旗の動いている間（`.is-active`） | 地 `$looks-transparent` | `$color-primary-transparent` | （撮っていない） |
| 止める（`stop-all/stop-all.css` の `.stop-all`） | 緑の旗と同じ形・不透明度 0.5。動いている間（`.is-active`）は 1。ホバーは地 `$looks-light-transparent` | | 一致（0.5・ホバー `rgba(133, 92, 214, 0.15)`） |
| ターボモード（`turbo-mode/turbo-mode.css`） | 文字 0.625rem の太字 `$control-primary`・余白 0.25rem | `$font-size-xsmall`・`$font-weight-bold` | （撮っていない） |
| 大きさのボタンの並び（`.stage-size-row`） | ボタンの間 0.25rem。並びの中の箱は地 `$ui-white`・角丸 `$form-radius`（半透明の選ばれた色を白の上に重ねるため） | | |
| 大きさのボタン | 切り替えボタン（[`components/buttons.md`](components/buttons.md)） | | |
| 全画面のボタン（`.stage-button`） | `calc(2rem + 2px)` の正方形・枠 `1px solid $ui-black-transparent`・角丸 `$form-radius`・地 `$ui-white`・余白 0.375rem。`button/button.css` の土台を重ねているので太字 | `$color-border`・`$radius-small`・`$color-surface` | 一致（34×34px・4px） |
| 全画面のボタンの押した（`:active`） | 地 `$looks-transparent` | `$color-primary-transparent` | 一致（`rgba(133, 92, 214, 0.35)`） |
| 目立たせるとき（`.stage-button-highlighted`） | 角丸 4px・輪 `0 0 0 2px $motion-primary` | | （撮っていない） |
| 全画面の時の段（`.stage-header-wrapper-overlay`） | 地 `rgb(232, 237, 241)`（直書き。ペイントエディターの `$ui-background-blue` と同じ値）・`z-index: $z-index-stage-header` | | （撮っていない） |
| 全画面のボタンのホバー、旗・止める・全画面のボタンのフォーカス | — | | |

## ステージ（`stage/stage.css`・`stage-wrapper/stage-wrapper.css`）

### ステージの大きさ（`lib/layout-constants.js`・`lib/screen-utils.js`）

| 大きさ | 倍率 | 大きさ（px） | いつ |
|---|---|---|---|
| 大（`large`） | 1 | 480 × 360 | 「大」を選んでいて、画面の幅が 1096px 以上（`fullSizeMinWidth`） |
| 大・狭い画面（`largeConstrained`） | 0.85 | 408 × 306 | 「大」を選んでいて、画面の幅が 1096px より狭い |
| 小（`small`） | 0.5 | 240 × 180 | 「小」を選んだとき |

上流の既定は「大」。スモウルビーは「中」（0.75・360 × 270）を足して既定にしている（下の「スモウルビーの追加」）。

### ステージの部品

| 部分・状態 | 値 | トークン | 実測（大） |
|---|---|---|---|
| ステージ（`.stage`） | 枠 `$stage-standard-border-width`（0.0625rem）`solid $ui-black-transparent`・角丸 `$space`・はみ出しを隠す・枠は大きさに含めない（`content-box`） | `$color-border`・`$radius-medium` | 一致（480×360px + 枠 1px・8px） |
| 全画面（`.stage.full-screen`） | 枠 `$stage-full-screen-border-width`（0.1875rem）`solid rgb(126, 133, 151)`（直書き）。まわり（`.stage-wrapper.full-screen`）は地 `$ui-white`・余白 `$stage-full-screen-stage-padding`・`z-index: $z-index-stage-wrapper-overlay` | | （撮っていない） |
| 色を拾う間（`.color-picker-background`） | ステージに `rgba(0, 0, 0, 0.55)` を重ねる | | |
| ドラッグ中のスプライト（`.dragging-sprite`） | 影 `drop-shadow(5px 5px 5px $ui-black-transparent)`・`z-index: $z-index-dragging-sprite` | | |
| 一覧で選んだスプライトを知らせる枠（`.frame`。`containers/target-highlight.jsx`） | 地 `$looks-transparent`・枠 `2px solid $looks-secondary`・角丸 0.5rem。0.75 秒で消える | `$color-primary-transparent`・`$color-primary`・`$radius-medium` | |
| 緑の旗を押して始める（`.green-flag-overlay`。VM が動き出す前 = `isStarted` が偽のときだけ） | 全体に `rgba(0,0,0,0.25)`・中央に 5rem の丸（地 `rgba(255,255,255,0.75)`・枠 `3px solid $ui-white`） | | |

### 質問（「〜と聞いて待つ」。`question/question.css`）

| 部分・状態 | 値 | トークン |
|---|---|---|
| 箱（`.question-container`） | 外の余白 `$space`・枠 `2px solid $ui-black-transparent`・角丸 `$space`・余白 1rem・地 白 | `$color-border`・`$radius-medium`・`$space-large` |
| 質問の文字（`.question-label`） | 0.75rem の太字 `$text-primary`・下に `$space` | `$font-size-small`・`$color-text` |
| 入力欄 | 丸い小さい入力欄（[`components/inputs.md`](components/inputs.md)）の太さをふつうに、右にボタンの場所を空ける。フォーカスの輪は 3px | |
| 送るボタン（`.question-submit-button`） | `calc(2rem - $space)` の丸・地 `$looks-secondary`・文字 白 | `$color-primary` |

### モニター（`monitor/monitor.css`）

見本: [`0205-monitor.png`](screenshots/0205-monitor.png)（「x座標」のふつうの表示）

| 部分・状態 | 値 | トークン | 実測 |
|---|---|---|---|
| 箱（`.monitor-container`） | 地 `$ui-primary`・枠 `1px solid $ui-black-transparent`・角丸 `calc($space / 2)`・文字 0.75rem・動き `box-shadow 0.2s`・`z-index: $z-index-monitor`（48） | `$color-background`・`$color-border`・`$radius-small`・`$font-size-small` | 一致（`rgb(230, 240, 255)`・4px・12px・48） |
| 名前（`.label`） | 太字・外の余白 `0 5px` | | 一致 |
| 値（`.value`） | 幅 40px 以上・角丸 `calc($space / 2)`・余白 `0 2px`。地はカテゴリの色（色のモードの `colourPrimary`）、文字は色のモードの `text`（JS で付ける） | | 一致（動きは `rgb(76, 151, 255)`・白） |
| 大きい表示（`.large-value`） | 文字 1rem・高さ 1.4rem 以上・幅 3rem 以上 | `$font-size-base` | （撮っていない） |
| ドラッグ中（`.dragging`） | 影 `3px 3px 5px #888888`（直書き）・`z-index: $z-index-monitor-dragging` | | （撮っていない） |
| リスト（`.list-header`・`.list-body`・`.list-footer`） | 見出しと下の段は地 白・0.75rem の太字 `$text-primary`。中は地 `$ui-primary`。項目（`.list-value`）は枠 `1px solid $ui-black-transparent`・角丸 `calc($space / 2)`・高さ 22px | | （撮っていない） |

モニターはステージの縮尺に合わせて縮む（`.monitor-list-scaler`）。見本はステージが「大」のときの大きさ。

## スプライトの情報（`sprite-info/sprite-info.css`・`forms/label.css`）

見本: [`0203-target-pane.png`](screenshots/0203-target-pane.png) の上の段（「大」のステージ）、[`0503-input-form.png`](screenshots/0503-input-form.png)（スモウルビーの「中」の詰めた並び）

| 部分・状態 | 値 | トークン | 実測（大） |
|---|---|---|---|
| 箱（`.sprite-info`） | 余白 0.75rem・地 白・文字 `$text-primary`・上だけ角丸 `$space`・下に `1px solid $ui-black-transparent` | `$color-surface`・`$color-text`・`$radius-medium`・`$color-border` | 一致（12px・`8px 8px 0 0`・400×135px） |
| 並び | 1 段目に名前・x・y、2 段目に表示する・大きさ・向き（`.row`。両端にそろえる）。1 段目の下に 0.5rem | | |
| ラベル（`.input-label`） | 0.625rem の太字・右に 0.5rem。2 つめの書き方（`.input-label-secondary`）は太さふつう | `$font-size-xsmall`・`$font-weight-bold` | 一致（10px・700） |
| ラベルの置き場所 | 日本語など横に広い言葉（`isWideLocale`）では入力欄の上に置く（`Label` の `above`）。「表示する」のラベルは「大」のときだけ | | |
| x・y のアイコン（`.icon-wrapper`） | `calc(2rem + 2px)` の正方形・余白 0.5rem | | |
| 入力欄 | 丸い小さい入力欄（[`components/inputs.md`](components/inputs.md)）。名前は幅 8rem（`.sprite-input`）、x・y は `.input-small`（3rem）、大きさ・向きは 4rem（`.larger-input input`） | | |
| 表示する・隠す | 切り替えボタン（[`components/buttons.md`](components/buttons.md)） | | |
| 小さいステージのとき | 名前の段と x・y の段の 2 段だけ | | |

向きを変える吹き出し（`direction-picker/`）はこの文書では撮っていない。

## ターゲットの一覧（`target-pane/target-pane.css`・`sprite-selector/`・`stage-selector/`）

見本: [`0203-target-pane.png`](screenshots/0203-target-pane.png)（「大」のステージ。スプライトの一覧と、右のステージの欄）

### スプライトの一覧（`sprite-selector/sprite-selector.css`）

| 部分・状態 | 値 | トークン | 実測（大） |
|---|---|---|---|
| 並べ方（`target-pane.css`） | スプライトの一覧（のこりの幅）とステージの欄（`.stage-selector-wrapper`: 幅 72px・左に `calc($space / 2)`）を横に並べる | | |
| 一覧（`.sprite-selector`） | 地 `$ui-secondary`・枠 `1px solid $ui-black-transparent`（下は無し）・上だけ角丸 `$space`・右に `calc($space / 2)` | `$color-border`・`$radius-medium` | 一致（`rgb(233, 241, 252)`・`8px 8px 0 0`・402px） |
| 項目の置き場（`.sprite-wrapper`） | 1 行に `$sprites-per-row`（5）個: 幅 `calc((100% / 5) - $space)`・4rem〜6rem・高さ 4rem 以上・まわり `calc($space / 2)` | | 一致（70×64px・まわり 4px） |
| スクロールする部分（`.scroll-wrapper`） | 高さ `calc(100% - $sprite-info-height)` | | |
| 項目（スプライト） | [`components/cards.md`](components/cards.md) の「スプライトの項目」 | | |
| 削除のボタン（`delete-button/delete-button.css` の `.delete-button-visible`） | 1.75rem の丸・地 `$looks-secondary`・文字 白・輪 `0 0 0 2px $looks-transparent`・動き `all 0.15s ease-out`。押したあと（`.delete-button-clicked`）は地 `$data-primary` | `$color-primary`・`$color-primary-transparent`・`$radius-round` | （撮っていない） |
| ドラッグで落とせるとき（`.scroll-wrapper-dragging`・`.raised`） | 地 `$drop-highlight`。`.raised` はホバーで `scale(1.05)` + 0.5 秒ゆれる・動き `all 0.25s ease` | `$transition-standard` | |
| ブロックを受け取ったとき（`.receivedBlocks`） | 0.25 秒だけ光る（`box-shadow: 0 0 10px #7fff1e`） | | |

### 追加のボタン（`action-menu/action-menu.css`）

スプライトの一覧（右から `1rem`・下から `0.75rem`）とステージの欄（下から `0.75rem`）の下の丸いボタン。マウスを乗せると上に選べるボタンが並ぶ。

| 部分・状態 | 値 | トークン | 実測 |
|---|---|---|---|
| ふつう（`.main-button`） | `$main-button-size`（2.75rem）の丸・地 `$looks-secondary`・輪 `0 0 0 4px $looks-transparent`・`z-index: $z-index-add-button`（46） | `$color-primary`・`$color-primary-transparent` | 一致（44×44px・46） |
| ホバー | 地 `$extensions-primary`（緑）・`scale(1.1)`・輪 6px。動きは `transition: transform, box-shadow 0.5s`（上流の書き方のまま。輪だけ 0.5 秒で動き、大きさはすぐ変わる） | 別名なし | 一致（`rgb(15, 189, 140)`・`matrix(1.1, 0, 0, 1.1, 0, 0)`・輪 6px） |
| 選べるボタン（`.more-button`） | `$more-button-size`（2.25rem）・地 `$looks-secondary-dark`・開くときの動き `max-height 1s`。上の端だけ丸い | `$color-primary-dark` | （撮っていない） |
| ボタンのホバー（`.button:hover`） | 地 `$extensions-primary`。まだ使えないもの（`.coming-soon`）は `$data-primary` | | |
| ボタンの名前の吹き出し（`.tooltip`） | 地 `$extensions-primary`・枠 `1px solid hsla(0, 0%, 0%, .1)`・角丸 `$form-radius`・影 `0 0 .5rem hsla(0, 0%, 0%, .25)`・`z-index: $z-index-tooltip` | `$radius-small`・`$shadow-raised` | （撮っていない） |
| フォーカス | `.button` に `outline: none`（フォーカスの見た目を消している） | | |

### ステージの欄（`stage-selector/stage-selector.css`）

| 部分・状態 | 値 | トークン | 実測（大） |
|---|---|---|---|
| ふつう（`.stage-selector`） | 地 白・文字 `$text-primary`・枠 `1px solid $ui-black-transparent`（下は無し）・上だけ角丸 `$space`・動き `all 0.25s ease`・`cursor: pointer` | `$color-surface`・`$color-border`・`$radius-medium`・`$transition-standard` | 一致（72px 幅・`8px 8px 0 0`） |
| 見出し（`.header`） | 高さ `calc($stage-menu-height - 2px)`・地 白・下に `1px solid $ui-black-transparent`・上だけ角丸 `$space` | | 一致（42px） |
| 見出しの文字（`.header-title`） | 0.625rem の太字 `$text-primary` | `$font-size-xsmall`・`$font-weight-bold` | 一致（10px・700） |
| 「背景」（`.label`） | 0.6rem・上 0.75rem 下 0.25rem | | 一致（9.6px・12px 0 4px） |
| 背景の数（`.count`） | 0.625rem・余白 `0.3rem 0.75rem` | | 一致（10px・4.8px 12px） |
| 背景の絵（`.costume-canvas`） | 最大 64×48px・枠 `1px solid $ui-black-transparent`・角丸 .25rem・内側の影 `inset 0 0 4px $ui-black-transparent` | `$radius-small` | 一致（64×48px・4px） |
| ホバー | 枠 `$looks-secondary` | `$color-primary` | 一致（`rgb(133, 92, 214)`） |
| 選ばれた（`.is-selected`） | 上の角丸 .625rem・枠 `$looks-secondary`・輪 `0 0 0 4px $looks-transparent`・見出しの地 `$looks-secondary`・見出しの文字 白 | `$color-primary`・`$color-primary-transparent` | （撮っていない） |
| ドラッグで落とせるとき・ブロックを受け取ったとき | スプライトの一覧と同じ（`.raised`・`.receivedBlocks`） | | |
| 押した・押せない・フォーカス | — | | |

## バックパック（`backpack/backpack.css`）

スクリプトエリアの下の欄（`backpackVisible` のときだけ出る。上流のプレイグラウンドとスモウルビーは出している）。

| 部分 | 値 | トークン |
|---|---|---|
| 見出し（`.backpack-header`） | 上に 0.5rem・枠 `1px solid $ui-black-transparent`・地 `$ui-white`・余白 0.25rem・文字 0.85rem `$text-primary`・中央・右上だけ角丸 `$space`・動き 0.2s | `$color-border`・`$color-surface`・`$font-size-dialog`・`$color-text` |
| 一覧（`.backpack-list`） | 右に `1px solid $ui-black-transparent`・高さ 5.5rem 以上・横にスクロール | |

## スモウルビーの追加

上流の値とは分けて記録する。マーカーは `=== Smalruby: ... ===`（一覧は [`../maintenance/smalruby-markers-gui.md`](../maintenance/smalruby-markers-gui.md)）。

| 追加 | 中身 | ファイル | マーカー |
|---|---|---|---|
| Ruby タブ | 4 つめのタブ。タブの並びを `.tab-list-container` で包む | `gui.jsx`・`gui.css` | `Ruby tab list container`（`gui.css`） |
| タブの右のリンク | プライバシーポリシー・フィードバック・不具合の報告（`.legal-links`・`.privacy-link`・`.feedback-link`: 0.65rem・`$text-primary-transparent`、ホバーで `$text-primary` と下線） | `gui.jsx`・`gui.css` | `legal links`（`gui.css`。不具合の報告のリンクは `bug report modal`、iPad の縦向きで消す規則は `iPad portrait legal links cleanup`） |
| 「中」のステージ | 0.75 倍（360 × 270）の大きさを足し、既定にする。大きさのボタンが 3 つになる | `layout-constants.js`・`screen-utils.js`・`stage-header.jsx`・`containers/stage-header.jsx`・`reducers/stage-size.js` | `middle stage size` |
| 「中」のときの詰めた並び | スプライトの情報を 2 段に詰める（`.compact`）。ステージの欄の見出しを出さない（`.no-header`） | `sprite-info.css`・`stage-selector.css` ほか | `compact middle sprite info`・`middle stage selector without header` |
| パレットの ◀ のボタン | ブロックのパレットを閉じる・開く | `containers/blocks.jsx` ほか | `palette-toggle initial render` ほか |
| ブロックのパレットまわりの `blocks.css` の変更 | ①ホバーの間、ブロックがフライアウトの右へはみ出して見えるようにする（`clip-path`）②カテゴリの名前の規則のクラス名を `.blocklyToolboxCategoryLabel` に変える ③`.blocks` に `position: relative` ④フライアウトのスクロールバーを左に 4px 離す（`margin-left: 4px`）⑤ホバー中のフライアウトで、スクロールバーの地にマウスを乗せたら不透明度 0.4 | `blocks.css` | ①④⑤ `show whole block shape on flyout hover`・② `v2 toolbox category label selector`・③ `palette toggle position` |
| 拡張機能のボタンの押せない見た目 | 日本語（DNCL）モードのとき（`.extension-button-disabled`: 不透明度 0.5・`cursor: not-allowed`）。押せなく見えるが、押すと確認が出て、「OK」でふりがなモードに戻してから拡張機能のモーダルを開く | `extension-button.css`・`extension-button.jsx` | `DNCL extension disabled`・`DNCL extension confirm` |
| 低い画面での圧縮 | 高さ 800px 以下で、タブの並びを 2.25rem（36px）に縮める | `gui.css` | `narrow-height vertical chrome compression` |
| iPad の縦向き | 幅 744〜1023px でエディターの列を縮められるようにし、ステージを「小」にする | `gui.css`・`gui.jsx` | `iPad portrait narrow desktop layout` ほか |
| レッスンの課題バー | メニューバーの下に 2.5rem の帯を出し、本体をその分縮める | `gui.css` | `lesson mode` |
| アラートの重なり順 | `$z-index-alerts` を 490 → 520 にして、アラート（`.alerts-container`）をモーダル（510）より上に出す（クラスのセッション切れを見せるため。[`tokens.md`](tokens.md) の「スモウルビーとの差」） | `css/z-index.css` | `alerts above modals so session-expired is visible` |

## 独自の画面で使う形

コードタブの上に独自の部品（メッシュの状態の窓など）を置くときは、次の形にそろえる。値は `smalruby-tokens.css` の別名で書く。別名が無いもの（`$looks-light-transparent`・`$ui-secondary` など）は上流の名前を使う。紫の地の上の白い文字は `$color-surface`（白い面の意味）ではなく `$ui-white` で書く。

- **白い欄**（スプライトの情報・ステージの欄の形）: 地 `$color-surface`・枠 `1px solid $color-border`・角丸 `$radius-medium`（画面の端につながる辺は 0）・中の余白 0.75rem か `$space-large`。
- **選ばれた欄・項目**: 枠 `$color-primary` + 輪 `0 0 0 4px $color-primary-transparent`（ステージの欄・スプライトの項目と同じ。[`components/cards.md`](components/cards.md)）。フォーカスはこれと別に `outline` で描く（[`components/README.md`](components/README.md) の「フォーカス」）。
- **小さいアイコンのボタン**（緑の旗の形）: 2rem・余白 0.375rem・角丸 `$radius-small`・ホバーの地 `$looks-light-transparent`・押している間（動いている間）の地 `$color-primary-transparent`。上流の旗・止めるにはフォーカスの書き方が無いので、[`components/README.md`](components/README.md) の「フォーカス」の形（`:focus-visible` で `outline: 2px solid $color-primary; outline-offset: 2px;`）を足す。
- **画面の上に浮かぶ小さい箱**（モニターの形）: 地 `$color-background`・枠 `1px solid $color-border`・角丸 `$radius-small`・文字 `$font-size-small`。重なり順は上流の `z-index.css` の名前を使う（ステージの上なら `$z-index-monitor` の近く、モーダル（`$z-index-modal` 510）より下）。モーダルより上に出すのはアラートだけ（スモウルビーは `$z-index-alerts` を 520 にしている）。
- ステージの大きさを決め打ちしない。スモウルビーの既定は「中」で、上流の既定は「大」。
