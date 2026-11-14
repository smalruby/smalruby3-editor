# 音タブ（音のエディター）

音タブは、左の一覧（`asset-panel`）と、右の音のエディター（`sound-editor`）でできている。録音のモーダル（`record-modal`）も音タブの中で開く。

- **値の正は上流 scratch-editor tag `v13.7.2` の CSS**（`git show v13.7.2:packages/scratch-gui/src/components/<部品>/<部品>.css`）。表の「ファイル」は `packages/scratch-gui/src/components/` からの道すじ。
- 「実測」は撮影スクリプト（`tools/playwright-verify/capture-design-system.mjs` の `sounds-tab`・`sound-selection`・`record-modal`・`record-modal-playback`）で 1366×1024 の画面から取った計算済みの値。上流の CSS と同じなら「一致」と書く。音が鳴るかどうかは headless の Chromium では確かめられないので、見た目の値だけを取った（`.claude/rules/scratch-gui/e2e-test.md` の「`?tab=sounds`」）。
- **左の一覧**（コスチュームタブと同じ部品）は [`paint.md`](paint.md) の「左の一覧」。項目の数字の下は、音では長さ（秒）になる。
- 見本: [`0801-sounds-tab.png`](screenshots/0801-sounds-tab.png)（左の一覧と音のエディター）、[`0802-sound-selection.png`](screenshots/0802-sound-selection.png)（波形の範囲を選んだところ）、[`0803-record-modal.png`](screenshots/0803-record-modal.png)（録音の前）、[`0804-record-modal-playback.png`](screenshots/0804-record-modal-playback.png)（録音のあと）

## 割り付け（`sound-editor/sound-editor.css`）

| 部分 | 値 | トークン | 実測 |
|---|---|---|---|
| 全体（`.editor-container`） | 余白 `calc(2 * $space)`（1rem）・縦に並べる | `$space-large` | 一致（16px） |
| 段（`.row`） | 横に並べる・縦は中央。段と段の間 `calc(2 * $space)` | `$space-large` | |
| 1 段目 | 名前と元に戻す・やり直す / コピー・貼り付け・音をコピー / 削除 | | |
| 2 段目 | 波形 | | |
| 3 段目 | 再生・止める / 効果のボタン 9 つ（右から左の言葉では並びを逆にする: `.row-reverse`） | | |
| まとまりの区切り（`.input-group`） | 右の余白 `calc(2 * $space)`・右に `1px dashed $ui-black-transparent`。となりのまとまりとの間 `calc(2 * $space)` | `$color-border`・`$space-large` | 一致（16px・`rgba(0, 0, 0, 0.15)` の点線） |

区切りの点線はペイントエディターと同じ形だが、色は違う（音は `$ui-black-transparent`、ペイントは paint の `$ui-pane-border` = `#D9D9D9`。[`paint.md`](paint.md)）。

## 名前の入力欄

GUI の丸い小さい入力欄（`forms/input.css` の `.input-form`。[`components/inputs.md`](components/inputs.md)）とラベル（`forms/label.css`）をそのまま使う。

| 状態 | 実測 |
|---|---|
| ふつう | 一致（高さ 32px・文字 10px の太字 `rgb(87, 94, 117)`・枠 `rgba(0, 0, 0, 0.15)`・角丸 32px）。ラベル「音」は 10px の太字 |
| ホバー | 一致（枠 `rgb(133, 92, 214)`） |
| フォーカス | 一致（枠 `rgb(133, 92, 214)`・輪 `rgba(133, 92, 214, 0.35) 0 0 0 4px`） |

コスチュームタブの名前の入力欄は scratch-paint の写しで、文字の大きさ・枠の色・ホバーが違う（[`paint.md`](paint.md) の「写しの部品」）。

## 元に戻す・やり直す（`.button-group` の `.button`）

2 つが横につながったボタン。

| 状態 | 値 | トークン | 実測 |
|---|---|---|---|
| ふつう（`.button`） | 高さ 2rem・余白 0.35rem・地 白・枠 `1px solid $ui-black-transparent`・角丸 0.25rem・文字 0.85rem・`outline: none`。並びの中では、内側の角を 0 にし（外側だけ `$form-radius`）、となりとの間の枠を 1 本にする（`.button:not(:last-child)` の右の枠を消す）。並びは左に 1rem | `$color-surface`・`$color-border`・`$radius-small`・`$font-size-dialog` | 一致（32×32px・`4px 0 0 4px`） |
| ホバー | — | | 変化なし |
| 押した | 地 `$looks-transparent` | `$color-primary-transparent` | 一致（`rgba(133, 92, 214, 0.35)`） |
| 選ばれた | — | | |
| 押せない（`:disabled`） | アイコンの不透明度 0.25 だけ（ボタンの地と枠は変わらない） | | 一致（0.25） |
| フォーカス | `:focus::before` に `1px solid $looks-secondary` の枠（ボタンの外側 1px。角丸は並びの位置に合わせる） | `$color-primary` | 一致（`::before` の枠 `1px solid rgb(133, 92, 214)`・`4px 0 0 4px`） |

形は切り替えボタン（[`components/buttons.md`](components/buttons.md) の「切り替えボタン」）と同じ考え方で、フォーカスも同じ `::before` の枠で描く。

## 道具のボタン・効果のボタン（`icon-button/icon-button.css` + `sound-editor.css`）

アイコンの下に名前が付く縦長のボタン。土台は GUI のアイコンボタン（[`components/buttons.md`](components/buttons.md) の「アイコンボタン」）で、`sound-editor.css` の `.tool-button`・`.effect-button` が文字の色と大きさを上書きしている。

| 部分・状態 | 道具のボタン（`.tool-button`: コピー・貼り付け・音をコピー・削除） | 効果のボタン（`.effect-button`: 速く・遅く・大きく・小さく・ミュート・フェードイン・フェードアウト・逆向き・ロボット） | 実測 |
|---|---|---|---|
| ふつう | 幅の基準 60px・文字 `$text-primary` 0.625rem・余白 `0.25rem 0`・角丸 0.5rem（`icon-button.css`）。となりとの間は 0（`icon-button.css` の `margin-top: 1.25rem` を消す） | 同じ | 一致（道具 64×48px・効果 60×44px・10px・8px） |
| アイコン | 4rem × 1.5rem・下に -0.375rem | 1.25rem × 1.25rem・下に -0.375rem | 一致（効果 20×20px） |
| 名前（`icon-button.css` の `.title`） | 上に 0.5rem・中央 | 同じ | 一致（上 8px） |
| ホバー | — | — | 変化なし |
| 押した | 地 `$looks-light-transparent`（`icon-button.css`） | 同じ | 一致（`rgba(133, 92, 214, 0.15)`） |
| 押せない（`.disabled`） | 不透明度 0.5・`pointer-events: none`（貼り付けは何もコピーしていないとき、削除は範囲を選んでいないとき） | — | 一致（0.5） |
| フォーカス | — | — | |

道具のボタンのアイコンの幅（4rem）が基準の幅（60px）より大きいので、道具のボタンは 64px に広がる。

## 再生・止める（`.round-button`）

| 状態 | 値 | トークン | 実測 |
|---|---|---|---|
| ふつう | 3rem の丸・地 `$looks-secondary`・枠 `4px solid $ui-white-dim`・余白 0.75rem・`outline: none` | `$color-primary` | 一致（48×48px・枠 `rgba(255, 255, 255, 0.75)`） |
| ホバー・押した・選ばれた・押せない・フォーカス | — | | 変化なし |

枠は白の 75% で、下の紫の地（`background-clip` が既定の `border-box`）と重なり、淡い紫の輪に見える。

## 波形（`sound-editor.css` の `.waveform-container`・`waveform/waveform.css`）

| 部分 | 値 | トークン | 実測 |
|---|---|---|---|
| 枠（`.waveform-container`） | 地 `hsla(300, 53%, 60%, 0.15)`（`$sound-primary` の 15% を直書き）・枠 `1px solid $ui-black-transparent`・角丸 5px・上下 20px | `$color-border` | 一致（`rgba(207, 99, 207, 0.15)`・5px・`20px 0`） |
| 波形（`.waveform-path`） | 塗り `hsl(300, 54%, 72%)`（上流のコメント: `$sound-primary` より明るい色。重なる部分があるので半透明にできない）・線 `$sound-tertiary`・線の太さ 1 | 別名なし | 一致（塗り `rgb(222, 145, 222)`・線 `rgb(189, 66, 189)`） |

`waveform.css` の `.baseline`（線 `$sound-tertiary`）は、v13.7.2 の `waveform.jsx` が使っていない。`sound-editor.css` の `.trim-button` も `sound-editor.jsx` が使っていない。

## 範囲を選ぶ（`audio-trimmer/audio-trimmer.css`。`audio-selector.jsx`）

波形の上をドラッグすると範囲を選べる。見本: [`0802-sound-selection.png`](screenshots/0802-sound-selection.png)

| 部分 | 値 | トークン | 実測 |
|---|---|---|---|
| 選んだ範囲（`.selection-background`） | 地 `$looks-secondary`・不透明度 0.5 | `$color-primary` | 一致 |
| 範囲の端の線（`.selector .trim-line`） | `1px solid $looks-secondary`（幅 0 の箱の枠なので 2px に見える） | `$color-primary` | 一致（2px） |
| 持ち手（`.trim-handle`） | 30×30px の画像（`icon--handle.svg`）。波形の枠の上下に 27px（`calc(-30px + 3px)`）はみ出す。画像の動き `0.2s` | | 一致（30×30px） |
| 再生中の位置（`.playhead`） | 左に `1px solid $looks-secondary` | `$color-primary` | （撮っていない） |

`audio-trimmer.css` の `$hover-scale: 1.25` は定義だけで使われていない（持ち手のホバーの見た目は無い）。

## 録音のモーダル（`record-modal/record-modal.css`・`meter/meter.css`）

音タブの追加のボタンの「録音する」で開く。ヘッダーと閉じるボタンは共通のモーダル（[`components/modal.md`](components/modal.md)）。見本: [`0803-record-modal.png`](screenshots/0803-record-modal.png)（録音の前）・[`0804-record-modal-playback.png`](screenshots/0804-record-modal-playback.png)（録音のあと。両端の切り落とす部分が赤い斜線）

### 録音の前・録音の間

| 部分・状態 | 値 | トークン | 実測 |
|---|---|---|---|
| 箱（`.modal-content`） | 幅 600px | | 一致（600px） |
| 本文（`.body`） | 地 `$ui-white`・余白 `1.5rem 2.25rem` | `$color-surface` | 一致（`24px 36px`） |
| 音量のメーターと波形の枠（`.meter-container`・`.waveform-container`） | 地 `$ui-primary`・枠 `1px solid $ui-black-transparent`・角丸 5px・余白 3px・高さ 180px。メーターの右に 5px | `$color-background`・`$color-border` | 一致（`rgb(230, 240, 255)`・5px・180px） |
| 音量のメーター（`meter.css`） | 下から緑 11・黄 5・赤 3 の段（`meter.jsx`）。緑 塗り `rgb(171, 220, 170)`・線 `rgb(174, 211, 168)`、黄 塗り `rgb(251, 219, 130)`・線 `rgb(239, 212, 134)`、赤 塗り `rgb(251, 194, 142)`・線 `rgb(235, 189, 142)`。音量より上の段に `$ui-primary` を不透明度 0.75 で重ねる（`.mask`） | 直書き（その画面だけの値） | 一致（緑） |
| 説明の文字（`.help-text`） | `rgb(167, 170, 181)`（直書き）・0.95rem・太さ 500・上に 10px | | 一致（15.2px・500） |
| 録音中の文字（`.recording-text`）・再生中の文字（`.playing-text`） | `$red-primary`・`$looks-secondary` | `$color-primary` | 一致（再生中 `rgb(133, 92, 214)`） |
| 大きいボタンの並び（`.main-button-row`） | 上に 15px・ボタンは地と枠なし・余白 `0.5rem 0.75rem`・角丸 0.25rem | | 一致 |
| 録音のボタン（`.record-button-circle`） | 直径 50 の丸（SVG）・塗り `$red-primary`・線 `$red-tertiary` | | 一致（塗り `rgb(255, 102, 26)`・線 `rgb(230, 77, 0)`） |
| 録音のボタンの外の輪（`.record-button-circle-outline`） | 塗り `$red-primary`・不透明度 0.2・動き `0.1s`。半径を音量で広げる（`27 + 音量 × 5`） | | 一致（0.2） |
| ボタンの押せない | 不透明度 0.25 | | |
| ボタンのホバー・押した | — | | 変化なし |
| ボタンのフォーカス | `:active, :focus { outline: none }`（消している） | | |

### 録音のあと

| 部分・状態 | 値 | トークン | 実測 |
|---|---|---|---|
| 切り落とす部分（`.trimmer .trim-background-mask`） | 枠 `1px solid $red-tertiary`・不透明度 0.5・`repeating-linear-gradient(45deg, $red-primary, $red-primary 10px, $red-tertiary 10px, $red-tertiary 20px)` の斜線（10px は `$stripe-size`）・外側の角だけ角丸 4px | | 一致（`rgb(230, 77, 0)`・0.5・`4px 0 0 4px`） |
| 切り落とす境の線（`.trim-line`） | `1px solid $red-tertiary` | | 一致 |
| 持ち手 | 範囲を選ぶときと同じ画像を、`filter: hue-rotate(-240deg) brightness(1.35)` で紫からオレンジに変える | | 一致 |
| 下のボタンの並び（`.button-row`） | 左右に分ける・太さ `bolder` | | |
| 再録音（副ボタン） | 余白 `0.75rem 1rem`・角丸 0.25rem・地 白・枠 `1px solid $ui-black-transparent`・文字 `$looks-secondary` 0.85rem の太さ 600 | `$color-surface`・`$color-border`・`$color-primary` | 一致（94×44px・`rgb(133, 92, 214)`） |
| 保存（主ボタン） | 地 `$looks-secondary`・文字 白・`border: $looks-secondary`（色だけの指定で、枠は描かれない）。ボタンの間 0.5rem | `$color-primary` | 一致（60×44px） |
| ボタンのホバー・押した・フォーカス | — | | 変化なし |

主ボタン・副ボタンの形は、変数を作るモーダルなどと同じ書き写し（[`components/README.md`](components/README.md) の「上流で部品になっていないもの」）。変数を作るモーダルでは枠の無い主ボタンが副ボタンより低くなる（39px と 44px）が、録音のモーダルでは並びが縦に引き伸ばす（`display: flex` の既定）ので、どちらも 44px になる。

撮影スクリプトは、偽のマイク（Chromium の `--use-fake-device-for-media-stream`）で 1.5 秒録音して「録音のあと」を撮る。録音を始めるには AudioContext が要り、スモウルビーは上流と同じくユーザーの操作のあとでしか作らないので、先に画面のどこかを押してから開く。

## スモウルビーの追加

音タブ（PC の画面）には、スモウルビーの見た目の変更は無い。

- `record-modal.jsx` に `id="recordModal"` を足している（マーカー `upstream warning fixes`。React の警告を消すためで、見た目は変わらない）。
- `?tab=sounds` で直接開いても落ちないように、`lib/audio/audio-buffer-player.js` を直している（見た目は変わらない）。
- `containers/` の `sound-tab.jsx`・`sound-editor.jsx`・`record-modal.jsx` は、`@scratch/scratch-vm` などのパッケージ名を `@smalruby/...` に変えただけ。
- SP（スマホ）用の画面は、このデザインシステムの対象外。

## 独自の画面で使う形

- **つながったボタン**（元に戻す・やり直すのような 2〜3 個の並び）は、この形にそろえる: 地 `$color-surface`・枠 `1px solid $color-border`（となりとの間は 1 本）・外側の角だけ `$radius-small`・押している間の地 `$color-primary-transparent`。上流は `outline: none` で `::before` の 1px の枠だけなので、独自の画面ではフォーカスを [`components/README.md`](components/README.md) の「フォーカス」の形（`outline: 2px solid $color-primary; outline-offset: 2px;`）で描く。
- **アイコンと名前のボタン**（効果のボタンの形）は [`components/buttons.md`](components/buttons.md) の「アイコンボタン」。名前の文字は `$color-text`・`$font-size-xsmall` にする（効果のボタンと同じ。アイコンボタンの土台の紫の 0.75rem ではなく）。
- 音の色（`$sound-primary`・`$sound-tertiary`）には別名を作っていない。音を表す独自の部品で使うときは、上流の名前で書く。
