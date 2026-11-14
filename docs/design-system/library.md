# ライブラリ（スプライト・背景・コスチューム・音を選ぶ）

上流の値は tag `v13.7.2`。ファイルは `packages/scratch-gui/src/components/` から。

- **値の正は上流の CSS**（`git show v13.7.2:packages/scratch-gui/src/components/<部品>/<部品>.css`）。
- 「実測」は 1366×1024 の画面で 4 つのライブラリを開いて取った計算済みの値。上流の CSS と同じなら「一致」と書く。
- 4 つのライブラリは同じ部品（`library/library.jsx` の `LibraryComponent`）で、違うのは絞り込みのタグと、音だけにある再生ボタン。値は 4 つとも同じだった（違うのは項目の絵の大きさとタグの数だけ）。
- 共通部品の状態は、ほかのページにある。ここでは並びとライブラリだけの値を書き、共通部品の細かい値はリンクで済ませる。
  - 戻るボタン・フルスクリーンのモーダル → [`components/modal.md`](components/modal.md)
  - 絞り込みの入力欄 → [`components/inputs.md`](components/inputs.md) の「絞り込み」
  - タグボタン → [`components/buttons.md`](components/buttons.md) の「タグボタン」
  - 項目（カード） → [`components/cards.md`](components/cards.md) の「ライブラリの項目」
- 見本: [`0301-library-header.png`](screenshots/0301-library-header.png)（ヘッダーと絞り込みの帯。「すべて」が選ばれた状態）、[`0302-sound-library-item.png`](screenshots/0302-sound-library-item.png)（音の項目のホバーと再生ボタン）、[`0504-library-filter-bar.png`](screenshots/0504-library-filter-bar.png)、[`0505-library-item-hover.png`](screenshots/0505-library-item-hover.png)

## 開き方と並び

| ライブラリ | 開く場所 | 部品（`containers/`） | タグ（上流の `lib/libraries/*-tags.js`） |
|---|---|---|---|
| スプライトを選ぶ | ターゲットの一覧の「スプライトを選ぶ」 | `sprite-library.jsx` | すべて・動物・人・ファンタジー・ダンス・音楽・スポーツ・食べ物・ファッション・文字 |
| 背景を選ぶ | ステージの欄の「背景を選ぶ」 | `backdrop-library.jsx` | すべて・ファンタジー・音楽・スポーツ・屋外・屋内・宇宙・海中・模様 |
| コスチュームを選ぶ | コスチュームタブの「コスチュームを選ぶ」 | `costume-library.jsx` | スプライトと同じ |
| 音を選ぶ | 音タブの「音を選ぶ」 | `sound-library.jsx`（`showPlayButton`） | すべて・動物・効果・ループ・音符・打楽器・宇宙・スポーツ・声・奇妙な音 |

上から次の順に並ぶ（`library.jsx` の `render`）。

1. **ヘッダー**（共有の `Modal` の `fullScreen`）: 左に「戻る」、中央に題。閉じるボタンの代わりに戻るボタンが出る。
2. **絞り込みの帯**（`.filter-bar`）: 左から、絞り込みの入力欄（`Filter`）・区切り（`Divider`）・タグボタンの並び（`.tag-wrapper`）。
3. **項目の並び**（`.library-scroll-grid`）: 160px の項目を左から折り返して並べ、縦にスクロールする。読み込みの間は真ん中に大きいスピナーが出る。

「メンバー」のタグ（`.membership-tag`・地 `$membership-blue`）は、メンバー専用の項目があるときだけ足される。上流のデータにも無いので出ない。

## 色（デバッグなどほかのモーダルと比べるための表）

ライブラリは**フルスクリーンのモーダル**。ふつうのモーダル（[`dialogs.md`](dialogs.md) の変数を作るなど）と違い、白い枠も白い本文も無く、淡い青の地の上に白い項目が並ぶ。

| 部分 | 上流の CSS（ファイル・セレクター） | 上流のトークン（値） | 色 | 別名 | 実測 |
|---|---|---|---|---|---|
| オーバーレイ | `modal/modal.css` `.modal-overlay` | `$ui-modal-overlay`（`hsla(215, 100%, 65%, 0.9)`） | `#4C97FF` × 0.9 | `$color-overlay` | 一致（`rgba(77, 151, 255, 0.9)`）。フルスクリーンでは中身が画面を覆うので見えない |
| 地（モーダル全体） | `modal/modal.css` `.modal-content.full-screen` | `$ui-secondary`（`hsla(215, 75%, 95%, 1)`） | `#E9F1FC` | 別名なし | 一致（`rgb(233, 241, 252)`） |
| ヘッダーの地 | `modal/modal.css` `.header` | `$looks-secondary`（`hsla(260, 60%, 60%, 1)`） | `#855CD6` | `$color-primary` | 一致（`rgb(133, 92, 214)`） |
| ヘッダーの文字（題・戻る） | `modal/modal.css` `.header-item` | `$ui-white` | `#FFFFFF` | `$color-surface` | 一致 |
| 絞り込みの帯の地 | `library/library.css` `.filter-bar` | `$looks-transparent`（`hsla(260, 60%, 60%, 0.35)`）を地 `$ui-secondary` に重ねる | `#855CD6` × 0.35（見た目は `#C5BDEF` 前後） | `$color-primary-transparent` | 一致（`rgba(133, 92, 214, 0.35)`。画面の画素は `rgb(197, 189, 239)`） |
| 絞り込みの入力欄の地 | `filter/filter.css` `.filter` | `$ui-white` | `#FFFFFF` | `$color-surface` | 一致 |
| 絞り込みの文字 | `filter/filter.css` `.filter-input` | `$text-primary`（プレースホルダーは不透明度 0.5） | `#575E75` | `$color-text` | 一致 |
| 絞り込みのフォーカスの輪 | `filter/filter.css` `.filter:focus-within` | `$looks-transparent` | `#855CD6` × 0.35 | `$color-primary-transparent` | 一致（輪 4px） |
| 区切り | `divider/divider.css` `.divider` | `$ui-black-transparent`（`hsla(0, 0%, 0%, 0.15)`）の点線 | `#000000` × 0.15 | `$color-border` | 一致（`1px dashed rgba(0, 0, 0, 0.15)`） |
| タグボタン（ふつう） | `tag-button/tag-button.css` `.tag-button` | 地 `$looks-secondary`・文字 `$ui-white` | `#855CD6`・`#FFFFFF` | `$color-primary`・`$color-surface` | 一致 |
| タグボタン（選ばれた） | `tag-button/tag-button.css` `.tag-button.active` | 地 `$data-primary`（`hsla(30, 100%, 55%, 1)`） | `#FF8C1A` | 別名なし（`$color-warning` と同じ値だが意味が違う） | 一致（`rgb(255, 140, 26)`） |
| 項目の並びの地 | `library/library.css` `.library-scroll-grid` | `$ui-secondary` | `#E9F1FC` | 別名なし | 一致 |
| 項目の地 | `library-item/library-item.css` `.library-item` | `white`（直書き。`$ui-white` と同じ値） | `#FFFFFF` | `$color-surface` | 一致 |
| 項目の枠 | `library-item/library-item.css` `.library-item` | `$ui-black-transparent` | `#000000` × 0.15 | `$color-border` | 一致（2px） |
| 項目の文字（名前） | `library-item/library-item.css` `.library-item` | `$text-primary` | `#575E75` | `$color-text` | 一致 |
| 項目のホバー | `library-item/library-item.css` `.library-item:hover` | 枠 `$looks-secondary` | `#855CD6` | `$color-primary` | 一致（枠の色だけ変わる。影・地は変わらない） |
| 項目の選ばれた | —（選ぶとモーダルが閉じるので、選ばれた状態は無い） | | | | |
| 再生ボタン（音だけ） | `play-button/play-button.css` `.play-button` | 地 `$sound-primary`（`hsla(300, 53%, 60%, 1)`）・アイコン `$ui-white` | `#CF63CF` | 別名なし | 一致（`rgb(207, 99, 207)`） |
| 読み込み中のスピナー | `spinner/spinner.css` `.spinner.primary` | 輪 `$looks-transparent`・回る部分 `$looks-secondary` | `#855CD6` × 0.35・`#855CD6` | `$color-primary-transparent`・`$color-primary` | （一瞬だけ出るので撮っていない） |

まとめると、ライブラリの色は **紫（`$looks-secondary`）・淡い紫（`$looks-transparent`）・淡い青（`$ui-secondary`）・白・枠の黒 15%・本文の文字（`$text-primary`）** の 6 つと、選ばれたタグのオレンジ（`$data-primary`）、音の再生ボタンのピンク（`$sound-primary`）でできている。ホバーと選ばれたは、どちらも地ではなく**枠や塗りの色を紫・オレンジに変える**形。

## 大きさと形

| 部分 | 値（上流） | トークン | 実測 |
|---|---|---|---|
| ヘッダー | 高さ `$library-header-height`（3.125rem）・文字 1rem の太さふつう・題は中央で字間 0.4px・項目の余白 1rem | 別名なし・`$font-size-base` | 一致（50px・16px） |
| 戻るボタン（`.back-button`） | ボタンの土台（`button/button.css`）+ 太さふつう・左右の余白なし。矢印のアイコン 1.5rem と「戻る」。文字の大きさは決めていない（ボタンの既定の 13.33px になる） | | 一致（58×26px・13.33px・400） |
| 絞り込みの帯 | 余白 1rem・文字 `.875rem`・部品の間 `.75rem`（`.filter-bar-item` の右の外の余白） | `$space-large`・`$font-size-medium` | 一致（高さ 72px） |
| 絞り込みの入力欄 | [`components/inputs.md`](components/inputs.md) の「絞り込み」（丸い白い欄・幅 11.5rem → 入力中 18.75rem） | | 一致（184px → 300px） |
| 区切り | 高さ `$library-filter-bar-height` を `scaleY(1.39)` で伸ばした 1px の点線 | | 一致（見た目の高さ 56px） |
| タグボタン | [`components/buttons.md`](components/buttons.md) の「タグボタン」（角丸 1.375rem・高さ 2.5rem・余白 `.625rem 1rem`）。文字は土台の太字で、大きさは決めていない（13.33px） | | 一致（40px・700） |
| タグの並び（`.tag-wrapper`） | 横に並べて折り返す・行の間 `.5rem` | | |
| 項目の並び | 余白 0.5rem・高さはヘッダーと絞り込みの帯をひいたのこり（`calc(100% - $library-header-height - $library-filter-bar-height - 2rem)`）・縦にスクロール | `$space-medium` | 一致（余白 8px） |
| 項目 | [`components/cards.md`](components/cards.md) の「ライブラリの項目」（160×160px・まわり `$space`・余白 `1rem 1rem 0`・枠 2px・角丸 `$space`）。`<button>` で、文字の大きさは決めていない（13.33px） | `$radius-medium` | 一致（160×160・8px） |
| 項目の絵（`.library-item-image-container-wrapper`） | 高さ 100px・幅 100%。絵は `max-width` / `max-height` 100% | | 一致（124×100px の枠） |
| 項目の名前 | 幅 80%・上下 0.25rem・はみ出しは「…」 | `$space-small` | 一致 |
| 再生ボタン | 2.5rem の丸・右上から `.5rem`・アイコンは 50%・動き `all 0.15s ease-out` | `$radius-round` | 一致（40×40px） |
| 読み込み中のスピナー | `.spinner.large`（2.5rem）・`level="primary"` | | （撮っていない） |

## 状態

| 部品 | ふつう | ホバー | 押した | 選ばれた | 押せない | フォーカス |
|---|---|---|---|---|---|---|
| 戻るボタン | 白い文字と矢印 | — | — | — | — | —（ブラウザの既定の輪 `outline: auto`） |
| 絞り込みの入力欄 | 上の表 | — | — | 入力あり（`.is-active`）で右に × が出る。× はホバーで `scale(1.2)` | — | 枠に紫の輪 4px・幅が広がる |
| タグボタン | 紫の塗り | — | — | `.active` でオレンジの塗り（はじめは「すべて」） | — | ブラウザの既定の輪を `outline-offset: -2px` で内側に |
| 項目 | 白い地・黒 15% の枠 | 枠が紫。スプライトは、コスチュームが 2 つ以上あると絵が 300ms ごとに次のコスチュームへ変わる（`containers/library-item.jsx`）。音は絵の上にマウスを乗せると鳴る（項目の枠や名前の上では鳴らない） | —（ホバーのまま） | —（選ぶと閉じる） | —（`.disabled` は拡張機能の大きいカードだけ） | —（ブラウザの既定の輪） |
| 再生ボタン（音） | ピンクの丸に再生のアイコン | — | — | 鳴っている間はアイコンが止めるのアイコンに変わる（`.playing` に CSS は無い） | — | `outline: none`（輪を消している） |

## スモウルビーの追加

上流と違うところ。上の表の値には入れていない。

| 場所 | 中身 | 見た目への影響 |
|---|---|---|
| `lib/libraries/sprites.json`・`costumes.json` | Scratch のキャラクター（Cat・Cat Flying・Giga・Giga Walking・Gobo・Nano・Pico・Pico Walking・Tera）を除き、スモウルビーのキャラクター（Shimacat・Shimaraby）を足した。背景・音の項目は上流と同じ | 項目の中身だけ。部品の値は変わらない |
| `mobile-sprite-panel/mobile-sprite-panel.css` | `:global(.ReactModal__Overlay) { z-index: 9999 !important; }`。SP の画面の上にモーダルを出すため、**すべてのモーダル**の重なりを上流の `$z-index-modal`（510）から 9999 に上げている | 重なり順だけ（実測 9999） |
| `modal/modal.jsx`・`modal.css`（マーカー付き） | 本文の既定の白い地（`.modal-content`）、ヘッダーの右のボタン置き場（`headerActions`・`.header-item-actions`）、ヘッダーの下の読み込み中の帯（`loading`・`.progress-bar`・`$control-primary`）、ヘッダーの絵の大きさ（`.header-image` 3rem まで） | 4 つのライブラリでは使わない（白い地はフルスクリーンの `$ui-secondary` が上書きする）。`headerActions` は拡張機能のライブラリが使う |
| `library/library.css` | `.library-category { width: 100% }`（マーカー無し） | カテゴリ分けのあるライブラリ（チュートリアル）だけ。4 つのライブラリには出ない |
| `library/library.jsx` | チュートリアルのカテゴリの名前の差し替え、拡張機能の項目のキー | 4 つのライブラリには出ない |

## 独自の画面で使うとき

- 一覧から 1 つを選ぶ画面は、上流のライブラリの形（フルスクリーン・紫のヘッダー・淡い紫の絞り込みの帯・淡い青の地に白いカード）を使ってよい。色は上の表の別名で書く（`$color-primary`・`$color-primary-transparent`・`$color-surface`・`$color-border`・`$color-text`）。
- 選ばれたタグのオレンジ（`$data-primary`）は、絞り込みの「いま選んでいるもの」の印として上流が使っている色。独自の画面で同じ意味（絞り込みの選択中）に使うときは上流の名前 `$data-primary` をそのまま使い、注意（`$color-warning`）の別名は使わない。
- 項目のカードの状態（選ばれた・フォーカス）は [`components/cards.md`](components/cards.md) と [`components/README.md`](components/README.md) の「フォーカス」に従う。上流の項目はフォーカスの見た目を書いていない（ブラウザの既定の輪）。
