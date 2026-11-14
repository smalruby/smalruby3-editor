# チュートリアルとデバッグ

上流の値は tag `v13.7.2`。ファイルは `packages/scratch-gui/src/components/` から。

- **値の正は上流の CSS**（`git show v13.7.2:packages/scratch-gui/src/components/<部品>/<部品>.css`）。
- 「実測」は 1366×1024 の画面で開いて取った計算済みの値。上流の CSS と同じなら「一致」と書く。
- 「色」の列は `hsla(...)` から計算した 16 進（ブラウザが描く色で、実測と同じ）。
- 左右のページ送り（矢印）の比べた表と、独自の画面で使う形は [`components/pager.md`](components/pager.md)。
- ほかのモーダル（ライブラリ・ダイアログ・拡張・接続）との色の比較は [`components/modal.md`](components/modal.md) の「モーダルの色の比較」。
- 見本: [`0901-debug-modal.png`](screenshots/0901-debug-modal.png)（デバッグ。2 番目の話題）、[`0902-tutorial-card.png`](screenshots/0902-tutorial-card.png)（チュートリアルのカード。4 枚のうち 3 枚目）

## 一覧

| 画面 | 開く場所（上流） | 部品 | 形 | 見本 |
|---|---|---|---|---|
| チュートリアルを選ぶ | メニューバーの「チュートリアル」 | `library/library.jsx`（`containers/tips-library.jsx`） | フルスクリーンのモーダル（ライブラリと同じ部品。カテゴリの見出しで分ける） | — |
| チュートリアルのカード | チュートリアルを選んだあと | `cards/cards.jsx`（`containers/cards.jsx`） | **モーダルではない**。画面の上に浮かぶ、ドラッグで動かせるカード（後ろの操作を止めない） | `0902` |
| デバッグ | メニューバーの「デバッグ」 | `debug-modal/debug-modal.jsx` | モーダル（`react-modal` を直接使う。**共有の `Modal` を使わない**） | `0901` |

スモウルビーでは、チュートリアルとデバッグはメニューバーに並べず、「?」のメニューの中にある（[`menu-bar.md`](menu-bar.md)）。

## チュートリアルを選ぶ

[`library.md`](library.md) のライブラリと同じ部品・同じ色（紫のヘッダー・淡い青の地・白いカード）。違うのは次の 2 つ。

- 絞り込みの帯が無く、**カテゴリの見出し**（`.library-category-title`: 2rem・太字・`$text-primary`・左 .5rem）の下に項目が並ぶ（`.library-category-items`: 折り返し・下 1rem）。
- 項目は拡張機能と同じ**大きいカード**（`.featured-item`。幅 300px。[`extension-modals.md`](extension-modals.md)）。

実測: ヘッダー `rgb(133, 92, 214)`・地 `rgb(233, 241, 252)`・見出し 32px 太字・カード 300px（どれも一致）。

## チュートリアルのカード

上から、**緑のヘッダー**（左に「チュートリアル」（一覧へ戻る）、中央に何枚目かの点、右に「縮小」「閉じる」）・**手順の題**・**手順の絵（または動画）**。左右のふちに、前と次の手順へ送る**丸い矢印**と、後ろに重なった次のカードに見える**のぞき札**（`.left-card` / `.right-card`）が付く。最後の手順では、ほかのチュートリアルの案内（`.decks`）と「もっと見る」（`.see-all-button`）が出る。

「縮小」を押すとヘッダーだけになる（本文と矢印が隠れる）。カード全体をドラッグで動かせる（`cursor: move`）。

### 色

| 部分 | 上流の CSS（ファイル・セレクター） | 上流のトークン（値） | 色 | 別名 | 実測 |
|---|---|---|---|---|---|
| 幕 | —（**無い**。後ろの画面が見えたまま操作できる） | | | | 一致 |
| カードの枠 | `cards/card.css` `.card` | `1px solid $ui-tertiary`（`hsla(215, 50%, 90%, 1)`） | `#D9E3F2` | 別名なし | 一致（`rgb(217, 227, 242)`） |
| カードの影 | `cards/card.css` `.card` | `0 5px 25px 5px $ui-black-transparent` | `#000000` × 0.15 | 別名なし | 一致 |
| **ヘッダーの地** | `cards/card.css` `.header-buttons` | **`$extensions-primary`**（`hsla(163, 85%, 40%, 1)`）・下の線 `1px solid $extensions-tertiary` | `#0FBD8C`・`#0B8E69` | 別名なし | 一致（`rgb(15, 189, 140)`） |
| ヘッダーの文字・アイコン | `cards/card.css` `.shrink-expand-button`・`.remove-button`・`.all-button` | `white` | `#FFFFFF` | `$color-surface` | 一致 |
| ヘッダーのボタンのホバー | `cards/card.css` `:hover` | 地 `$ui-black-transparent` | `#000000` × 0.15 | `$color-border` | 一致（`rgba(0, 0, 0, 0.15)`） |
| 何枚目かの点（今） | `cards/card.css` `.active-step-pip` | 地 `$ui-white`・輪 `0 0 0 2px $ui-black-transparent` | `#FFFFFF` | `$color-surface` | 一致 |
| 何枚目かの点（ほか） | `cards/card.css` `.inactiveStepPip` | 地 `$ui-white-transparent` | `#FFFFFF` × 0.25 | 別名なし | 一致（`rgba(255, 255, 255, 0.25)`） |
| 本文の地 | `cards/card.css` `.step-body` | `$ui-white` | `#FFFFFF` | `$color-surface` | 一致 |
| 手順の題 | `cards/card.css` `.step-title` | `$text-primary` | `#575E75` | `$color-text` | 一致 |
| 手順の絵の地と枠 | `cards/card.css` `.step-image` | `#F9F9F9`・`1px solid #ddd`（どちらも直書き） | `#F9F9F9`・`#DDDDDD` | 別名なし | （スモウルビーの手順は Ruby のエディターを写した絵が多い） |
| **ページ送りの丸** | `cards/card.css` `.left-button`・`.right-button` | 地 `$extensions-primary`・輪 `0 0 0 4px $extensions-transparent` | `#0FBD8C`・`#0FBD8C` × 0.35 | 別名なし | 一致（`rgba(15, 189, 140, 0.35) 0 0 0 4px`） |
| ページ送りのホバー | `cards/card.css` `:hover` | 輪が 6px・`scale(1.125)` | | | 一致 |
| のぞき札 | `cards/card.css` `.left-card`・`.right-card`（`::after`） | 地 `$ui-white`（不透明度 0.9）・枠 `$ui-tertiary`・上の 2.5rem が `$extensions-primary` | `#FFFFFF`・`#D9E3F2`・`#0FBD8C` | 別名なし | 一致（上の帯 40px） |
| ほかのチュートリアルの案内 | `cards/card.css` `.deck`・`.deck-name` | 枠 `1px solid $ui-black-transparent`・名前 `$looks-secondary` | `#855CD6` | `$color-border`・`$color-primary` | （撮っていない） |
| 「もっと見る」 | `cards/card.css` `.see-all-button` | 地 `$looks-secondary`・文字 `$ui-white` | `#855CD6` | `$color-primary` | （撮っていない） |

### 大きさと形

| 部分 | 値（上流） | トークン | 実測 |
|---|---|---|---|
| カードの置き場（`.card-container`） | 幅は 468px 以上・まわり `0.5rem 2rem`・重なり `$z-index-card`（480。モーダルの 510 より下） | | スモウルビーは幅 498px（下の「スモウルビーの追加」） |
| カード（`.card`） | 角丸 0.75rem・Helvetica Neue | | 一致（12px） |
| ヘッダー | 文字 0.625rem 太字・ボタンの余白 0.75rem・アイコン 1.25rem | `$font-size-xsmall` | 一致（10px・700。高さ 63px） |
| 何枚目かの点 | 0.5rem の丸・間 0.25rem | | 一致（8px） |
| 手順の題 | 0.9rem 太字・まわり 0.9rem・中央ぞろえ | | 一致（14.4px） |
| 本文 | 高さ 256px 以上（絵が替わっても高さが変わらないように） | | 一致（256px） |
| 手順の絵 | 450×200px まで・角丸 0.5rem・下と左右 0.5rem | `$radius-medium` | スモウルビーは 480×360px まで |
| ページ送りの丸 | 44px の丸・アイコン 1.75rem・カードのふちから 27px 外へ（丸の中心がふちのすぐ外）・上下は 50% から 15px 上 | | 一致（44px・28px・`left: -27px`） |
| のぞき札 | 幅 .75rem・高さ 90%・上 5%・外側だけ角丸 0.75rem | | 一致（12px） |
| 「もっと見る」 | 余白 `0.5rem 1rem`・角丸 0.25rem・.75rem 太字 | `$radius-small`・`$font-size-small` | （撮っていない） |

### 状態

| 部品 | ふつう | ホバー | 押した | 選ばれた | 押せない | フォーカス |
|---|---|---|---|---|---|---|
| ヘッダーのボタン（チュートリアル・縮小・閉じる） | 緑の地に白 | 地が黒 15% | — | — | — | —（`<div>` で、キーボードで届かない） |
| ページ送りの丸 | [`components/pager.md`](components/pager.md) | 輪 6px・1.125 倍 | — | — | 最初と最後は出さない | —（`<div>` で、キーボードで届かない） |
| 何枚目かの点 | 白 25% | — | — | 今の手順は白・輪 2px | — | —（押せない） |
| カード全体 | ドラッグで動く | — | — | — | — | — |

## デバッグ

上から、**緑のヘッダー**（左にデバッグのアイコンと題、右に閉じるボタン）、その下が左右 2 列。左 30% が**話題の一覧**（13 個。選ばれた話題は淡い緑の地・太字・アイコン付き）、右 70% が**話題の中身**（題・説明・絵）。中身の左右に、前と次の話題へ送る**丸い矢印**が付く。

共有の `Modal` を使わず `react-modal` を直接使う。そのため、オーバーレイ・枠・ヘッダー・閉じるボタンは**すべてデバッグのモーダルだけの CSS**（`debug-modal/debug-modal.css`）で、ほかのモーダルと形も色も違う。

### 色

| 部分 | 上流の CSS（ファイル・セレクター） | 上流のトークン（値） | 色 | 別名 | 実測 |
|---|---|---|---|---|---|
| 幕（`.debug-modal-overlay`） | `debug-modal/debug-modal.css` | `transparent`（**色が無い**。後ろの画面がそのまま見える。重なりは 510 の直書き） | — | — | 一致（`rgba(0, 0, 0, 0)`） |
| 枠 | `debug-modal.css` `.debug-modal-container` | **枠なし**。影 `0 4px 4px 0 $ui-black-transparent-10` | `#000000` × 0.1 | 別名なし | 一致 |
| 地（全体） | `debug-modal.css` `.debug-modal-container` | `white`（直書き） | `#FFFFFF` | `$color-surface` | 一致 |
| **ヘッダーの地** | `debug-modal.css` `.modal-header` | **`$ui-green-2`**（`hsla(163, 85%, 40%, 1)`） | `#0FBD8C` | 別名なし（`$extensions-primary` と同じ値） | 一致（`rgb(15, 189, 140)`） |
| ヘッダーの文字 | `debug-modal.css` `.header-title` | `white`（直書き） | `#FFFFFF` | `$color-surface` | 一致 |
| 閉じるボタン | `debug-modal.css` `.close-button` + `icons/icon--close.svg` | 色は SVG の中（地 黒 15% の丸・白い ×） | `#000000` × 0.15 | — | 見た目は共有の閉じるボタンに近い（32px）。ホバーの変化なし |
| 話題の一覧の区切り | `debug-modal.css` `.topic-list` | `1px solid $ui-green`（`hsla(163, 85%, 35%, 1)`） | `#0DA57A` | 別名なし | 一致（`rgb(13, 165, 122)`） |
| 話題の文字 | `debug-modal.css` `.topic-item` | `$ui-green` | `#0DA57A` | 別名なし | 一致 |
| 話題のホバー | — | — | | | 変化なし（`cursor: pointer` だけ） |
| 選ばれた話題 | `debug-modal.css` `.topic-item.active` | 地 `#D1FAEE`（直書き）・太字 | `#D1FAEE` | 別名なし | 一致（`rgb(209, 250, 238)`） |
| 中身の文字 | `debug-modal.css` `.info-container` | `$text-primary` | `#575E75` | `$color-text` | 一致 |
| ボタン（主・副） | —（無い） | | | | |
| **ページ送りの丸** | `debug-modal/icons/icon--prev.svg`・`icon--next.svg` | 色は SVG の中（地 `#0FBD8C`・外の輪 `#0FBD8C` × 0.25・白い矢印） | `#0FBD8C` | — | 一致 |

まとめると、デバッグの色は**明るい緑（`$ui-green-2`）・少し濃い緑（`$ui-green`）・淡い緑（直書き）・白・本文の文字**でできている。紫（`$looks-secondary`）も、モーダルの青い幕も使っていない。

### 大きさと形

| 部分 | 値（上流） | トークン | 実測 |
|---|---|---|---|
| 枠（`.debug-modal-container`） | 幅 1000px・高さは画面の 90% まで・角丸 8px・左右のまわり 40px・画面の上下左右の中央 | `$radius-medium` | 一致（1000×602px） |
| ヘッダー | 余白 `8px 12px`・角丸 `8px 8px 0 0`。題 1rem・行の高さ 1.25rem・700、アイコン 22px・間 8px | `$font-size-base` | 一致（高さ 58px・16px・700） |
| 閉じるボタン | 32×32px の `<button>`（地なし・枠なし）に SVG | | 一致 |
| 話題の一覧 | 幅 30% | | 一致（300px） |
| 話題 | 1rem・行の高さ 1.5rem・余白 `8px 8px 8px 12px`・アイコンとの間 8px | | 一致（高さ 40px） |
| 中身 | 幅 70%・余白 20px。文字の欄は左 70px あけ、題 24px/32px の 700、説明 16px/28px | | 一致 |
| ページ送りの丸 | 52px の SVG（中の丸 44px + 外の輪 4px）。上は枠の 50%（丸の上の端が真ん中）。前は中身の欄の左の端（枠の左から 320px）、次は枠の右の端から 24px 外 | | 一致（`top: 301px`・前 `left: 320px`・次 `right: -24px`） |

### 状態

| 部品 | ふつう | ホバー | 押した | 選ばれた | 押せない | フォーカス |
|---|---|---|---|---|---|---|
| 話題 | 緑の文字 | — | — | 淡い緑の地・太字・アイコン | — | —（`<div>` で、キーボードで届かない） |
| 閉じるボタン | 黒 15% の丸 | — | — | — | — | ブラウザの既定の輪（`<button>`。開くと最初にフォーカスが来る） |
| ページ送りの丸 | [`components/pager.md`](components/pager.md) | — | — | — | 最初と最後は出さない | —（`<img>` で、キーボードで届かない） |

キーボードの Tab で動けるのは閉じるボタンだけ（`react-modal` がフォーカスをモーダルの中に閉じ込める）。Esc で閉じる。

## 色の違いのわけ

紫は「エディターの操作（作る・選ぶ）」、緑は「手引き（チュートリアル・デバッグ）と拡張機能・機器（接続）」の色として分けている。チュートリアルのカードは青から拡張機能の緑へ変えられ、接続のモーダルは作ったときから緑で（白い文字のために濃い緑へ変えたのは推測）、のちに共有の `Modal` などのアクセントを青から紫へ変えたときもこの 2 つの緑は残された。デバッグのモーダルは最初から上流の中で `react-modal` を直接使って作られ、あとの変更でヘッダーが明るい緑 `$ui-green-2`（`$extensions-primary` と同じ値）にそろえられた（チュートリアルに合わせたのかは推測）。幕が無い・枠が無い・選ばれた話題の色が直書き・ホバーが無いのは、決めごとではなく作り方の違いとみられる。同じ緑を 3 つの名前（`$extensions-primary`・`$pen-primary`・`$ui-green-2`）で書いていて、トークンの選び方はばらばら。独自の画面での使い分けは [`components/modal.md`](components/modal.md) の「独自の画面での色の使い分け」で決める。

確かめ方: `git log -S'<トークン名>' v13.7.2 -- packages/scratch-gui/src/components/<部品>/`（例: `cards/card.css` の `extensions-primary`・`debug-modal/debug-modal.css` の `ui-green-2`）。

## スモウルビーの追加

上流と違うところ。上の表の値には入れていない。

| 場所 | 中身 | 見た目への影響 |
|---|---|---|
| `menu-bar/menu-bar.jsx` | チュートリアルとデバッグを「?」のメニューの中へ移した（[`menu-bar.md`](menu-bar.md)） | 開く場所だけ |
| `lib/libraries/decks/` | スモウルビーのチュートリアル（Ruby の書き方など）とカテゴリの名前 | カードの中身だけ |
| `cards/cards.jsx`・`card.css`（マーカー付き） | 手順の絵の上の「ルビーを入力する」などのボタン（`.insert-code-button-overlay`）、次へ進む丸と押すボタンが黄色く光る演出（`.right-button-glow` など）、「チュートリアルを始める」・外のサイトを開くボタン | 見本 `0902` では光る演出を止めて撮った |
| `cards/card.css`（**マーカー無し**） | カードの幅を 500px まで（`max-width`）、題の折り返し（`word-break`）、点のクラス名を `.inactive-step-pip` に変えた、`.insert-code-button`（地 `$ui-green`・ホバー `$ui-green-2`。白い文字は 3.1:1 で、ホバーの明るい緑の上では 2.4:1） | カードの幅 498px（上流は中身で決まり 468px 以上）。手順の絵は 480×360px まで（マーカーの中） |
| `debug-modal/sections/messages.js`（**マーカー無し**） | 長い文の上の `// eslint-disable-next-line @stylistic/max-len` のコメントを消した（空白だけの行が残っている）。ほかの `debug-modal/` のファイルは変えていない | 見た目への影響は無い |

## 独自の画面で使うとき

- ヘッダーの色・幕・選ばれた状態の色は、デバッグのモーダルを手本にしない。[`components/modal.md`](components/modal.md) の「独自の画面での色の使い分け」に従う。
- 左右に送る画面は [`components/pager.md`](components/pager.md) の形にする（チュートリアルの丸の形を基にした、キーボードでも使える形）。
- 作業しながら見てほしい手引き（チュートリアルのカードのように、後ろの画面を止めないもの）は、モーダルにせず、幕の無い浮いたパネルにする。後ろの画面を止める画面は、共有の `Modal`（青い幕）を使う。デバッグのような「幕が無いのに後ろを触れないモーダル」（外を押すと閉じる）は作らない（後ろが止まっていることが見て分からない）。
