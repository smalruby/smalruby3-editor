# 共通部品

上流（Scratch）の GUI の共通部品の形と状態の表。部品ごとに 1 ファイル。

- **値の正は上流 scratch-editor tag `v13.7.2` の CSS**（`git show v13.7.2:packages/scratch-gui/src/components/<部品>/<部品>.css`）。表の「ファイル」は `packages/scratch-gui/src/components/` からの道すじ。
- 「実測」は `tools/playwright-verify/capture-design-system.mjs` で 1366×1024 の画面から取った計算済みの値（`tmp/design-system/styles.json`）。上流の CSS と同じなら「一致」と書き、違えばわけを書く。
- 「トークン」は上流の名前と、`smalruby-tokens.css` に別名があればその名前（[`../tokens.md`](../tokens.md)）。直書きの値は「直書き」と書く。
- 上流に無い状態は「—」。独自の画面で足すときは、下の「独自の画面で使う形」に従う。

## 状態の名前

| 状態 | CSS での書き方の例 | 撮影スクリプトで読む方法 |
|---|---|---|
| ふつう | （何も付かない） | そのまま読む |
| ホバー | `:hover` | `hover: true`（マウスを乗せて差を読む） |
| 押した | `:active` | `active: true`（押したまま差を読み、外へ動かしてから離す） |
| 選ばれた | `.is-selected`・`.active`・`[aria-pressed='true']`・`[data-highlighted]` | 選ばれている要素を別の部品として読む |
| 押せない | `:disabled`・`.disabled` | 押せない要素を別の部品として読む（無い画面では読まない） |
| フォーカス | `:focus`・`:focus-visible`・`:focus-within` | `focus: true`（キーを 1 つ押してからフォーカスし、差を読む） |

## 部品の一覧

| ファイル | 部品 | 見本 |
|---|---|---|
| [`buttons.md`](buttons.md) | ボタンの土台・主ボタン・副ボタン・アイコンボタン・切り替えボタン・タグボタン・閉じるボタン | `0401`・`0502`・`0504` |
| [`inputs.md`](inputs.md) | 入力欄（丸い小さい入力欄・ダイアログの入力欄・絞り込み） | `0503`・`0401`・`0504` |
| [`menus.md`](menus.md) | メニューバーの項目・メニュー・右クリックのメニュー | `0101`・`0102`・`0506` |
| [`modal.md`](modal.md) | モーダル（オーバーレイ・枠・ヘッダー・本文・閉じる・戻る） | `0401` |
| [`tabs.md`](tabs.md) | エディターのタブ | `0501` |
| [`cards.md`](cards.md) | ライブラリの項目・スプライトの項目 | `0505`・`0201` |
| [`confirm.md`](confirm.md) | 確認（削除の確認） | `0402` |
| [`alerts.md`](alerts.md) | アラート（注意・成功・お知らせ） | `0507` |

見本の画像は [`../screenshots/`](../screenshots/)（一覧は [`../screenshots/README.md`](../screenshots/README.md)）。

## 上流で部品になっていないもの

### 主ボタン・副ボタン

上流の `button/button.css` の `.outlined-button` は、角丸と太字だけを持つ土台で、色を持たない（`background`・`border`・`color` は `inherit`）。紫の塗りの**主ボタン**と白い**副ボタン**は部品になっておらず、ダイアログごとに CSS を書き写している。

| ファイル | 主ボタン | 副ボタン | 違い |
|---|---|---|---|
| `prompt/prompt.css` | `.button-row button.ok-button` | `.button-row button` | 太さ `600`。副ボタンの文字の色を決めていない（ブラウザの既定の黒になる） |
| `slider-prompt/slider-prompt.css` | 同上 | 同上 | `prompt.css` と同じ |
| `custom-procedures/custom-procedures.css` | 同上 | 同上 | 太さ `bold` |
| `record-modal/record-modal.css` | 同上 | 同上 | 副ボタンの文字が `$looks-secondary` |
| `connection-modal/connection-modal.css` | `.connection-button` | — | 角丸 `0.5rem`・余白 `0.6rem 0.75rem`・枠なし。`:disabled` だけ書いてある |
| `delete-confirmation-prompt/delete-confirmation-prompt.css` | — | `.button-row-button` | 紫の地の上の白いボタン。角丸 `2rem` |
| `confirmation-prompt/confirmation-prompt.css` | `.confirm-button` | `.cancel-button` | 紫の地の上。角丸 `2.5rem` |

どれも**ホバー・押した・フォーカスの書き方が無い**（`connection-modal` の `:disabled` と、`confirmation-prompt` の `:focus { outline: auto }` だけ）。

### フォーカスの書き方

上流のフォーカスの書き方は部品ごとにばらばら。v13.7.2 の `src/components/` の CSS で `:focus`（`:focus-visible`・`:focus-within` を含む）を書いているファイルは 18 個あり、書き方は次の 12 通り（「書いていない」を含む）。

| 書き方 | 部品（ファイル） | 実測 |
|---|---|---|
| 枠の色 + 紫の輪 `box-shadow: 0 0 0 0.25rem $looks-transparent` | 入力欄 `.input-form:focus`（`forms/input.css`） | 枠 `rgb(133, 92, 214)`・輪 `rgba(133, 92, 214, 0.35) 0 0 0 4px` |
| 紫の輪（`:focus-within`） | 絞り込み `.filter:focus-within`（`filter/filter.css`） | 輪 4px |
| 紫の輪 3px | 質問の入力欄 `.question-input > input:focus`（`question/question.css`） | （撮っていない） |
| 白い輪 `0 0 0 calc($space * .5) $ui-white-transparent` + 地を白に | プロジェクトの題名 `.title-field:focus`（`menu-bar/project-title-input.css`） | （撮っていない） |
| 枠の色 `$looks-secondary` + 内側の線 `inset 0 0 0 1px $ui-black-transparent` | 回転のしかたの選択 `.rotation-select:focus`（`sprite-info/sprite-info.css`）。上流の CSS は `box-shadow` の行の末尾に余分な `)` があり、その行は効かない（枠の色だけ変わる） | （撮っていない） |
| 枠を白に `border: 1px solid white` | 言語の選択 `.language-select:focus`（`language-selector/language-selector.css`） | （撮っていない） |
| 青い輪 `0 0 0 2px $ui-blue-25percent`（そのファイルだけの変数。選ばれたときと同じ見た目） | テレメトリーのラジオボタン `input[type="radio"]:focus`（`telemetry-modal/telemetry-modal.css`） | （撮っていない） |
| `::before` の 1px の紫の枠 | 切り替えボタン `.button:focus::before`（`toggle-buttons/toggle-buttons.css`）、音のエディターのボタンの並び（`sound-editor/sound-editor.css`） | 枠 `1px solid rgb(133, 92, 214)` |
| ブラウザの既定の輪（`outline: auto` / `revert`） | 確認のボタン（`confirmation-prompt.css`）、拡張機能のボタン `:focus-visible`（`extension-button.css`）、タグボタン `:focus-visible` + `outline-offset: -2px`（`tag-button.css`）、吹き出し `.modal-content:focus-visible { outline: revert }`（`modal-with-arrow/modal-with-arrow.css`） | `outline: auto 1px rgb(16, 16, 16)` |
| 消している（`outline: none`） | タブ `.tab.is-selected:focus { outline: none; box-shadow: none }`（`gui/gui.css`）、録音のボタン（`record-modal.css`）、再生のボタン `.play-button:focus`（`play-button/play-button.css`）、お知らせの吹き出し `.modal-content:focus-visible`（`feature-callout-popover/feature-callout-popover.css`。開いたときに輪が出ないように） | — |
| 見た目でなく幅を変える | ライブラリの絞り込みの `.filter-input:focus`（`library/library.css`。入力があるときも同じ） | 幅 184px → 300px |
| 書いていない（ブラウザの既定） | 主ボタン・副ボタン・ダイアログの入力欄（`prompt.css`）・閉じるボタン・ライブラリの項目 | `outline: auto 1px rgb(16, 16, 16)`（主ボタン・ダイアログの入力欄） |

## 独自の画面で使う形

独自の画面（レッスン・クラス管理など）では、上流の部品を**書き写さず**、次の形でそろえる。値は `smalruby-tokens.css` の別名で書く。

### 主ボタン・副ボタン

上流のダイアログのボタン（`prompt.css`）の形を基準にし、上流に無い状態を足す。

```css
@import '../../css/smalruby-tokens.css';

.primary-button,
.secondary-button {
    padding: 0.75rem 1rem;
    border-radius: $radius-small;
    font-size: $font-size-dialog;
    font-weight: $font-weight-bold;
    cursor: pointer;
}

/* 主ボタン: 1 つの画面に 1 つ（決める・進む操作） */
.primary-button {
    background-color: $color-primary;
    border: 1px solid $color-primary;
    color: $color-surface;
}

.primary-button:active {
    background-color: $color-primary-dark;
    border-color: $color-primary-dark;
}

/* 副ボタン: やめる・戻る操作 */
.secondary-button {
    background-color: $color-surface;
    border: 1px solid $color-border;
    color: $color-text;
}

.secondary-button:active {
    background-color: $color-background;
}

/* 押せない: 上流の connection-modal と同じく淡い紫にする（主ボタン）。副ボタンは薄くする。
   どちらも文字のコントラストは 3:1 に届かない（押せない部品は WCAG 1.4.3 の対象外） */
.primary-button:disabled {
    background-color: $color-primary-transparent;
    border-color: transparent;
    cursor: default;
}

.secondary-button:disabled {
    opacity: 0.5;
    cursor: default;
}

/* フォーカス: 下の「フォーカス」の形（2px の紫の線を 2px 外に） */
.primary-button:focus-visible,
.secondary-button:focus-visible {
    outline: 2px solid $color-primary;
    outline-offset: 2px;
}
```

- **ホバーの見た目は付けない**（上流のダイアログのボタンにホバーが無いのに合わせる。`cursor: pointer` だけ）。
- 太さは `$font-weight-bold` にする。上流は `prompt.css` などが `600`、`custom-procedures.css` などが `bold` でゆれており、トークンに `600` が無いので、`bold` にそろえる。
- 主ボタンにも枠 `1px solid $color-primary` を付ける。上流の `border: $looks-secondary` は色だけの指定で枠が描かれず、主ボタンだけ副ボタンより低くなっている（実測で 39px と 44px）。枠を付けて高さをそろえる。
- 副ボタンの文字は `$color-text` にする（上流の `prompt.css` は色を決めておらず、ブラウザの既定の黒になっている）。
- 主ボタンの押せない状態（淡い紫の地 + 白い文字）は、文字のコントラストが 1.6:1。上流の `connection-modal.css` の `:disabled` と同じ見た目で、押せないことを示すために淡くしている。
- 紫の地の上のボタン（確認の吹き出し）は [`confirm.md`](confirm.md) の形を使う。

### 選ぶボタン（2 つの形の使い分け）

**道具・モードの切り替え**（同時に 1 つだけ選ばれ、選んでいる間は操作が変わる。ペイントエディターの道具のボタン）は**塗りつぶし**（選ばれたら地 `$color-primary`・アイコン白。[`../paint.md`](../paint.md) の「道具のボタン」）、**表示の切り替え**（並べ方・表示の向き・ステージの大きさなど）は**淡い地**（選ばれたら地 `$looks-light-transparent`。[`buttons.md`](buttons.md) の「切り替えボタン」）にする。

### フォーカス

ボタン・カード・タブなどは、**`:focus-visible` で 2px の紫の線を 2px 外に引く**。

```css
.my-button:focus-visible {
    outline: 2px solid $color-primary;
    outline-offset: 2px;
}

/* 淡い輪も重ねたいとき（選ばれたスプライトの輪と同じ見た目）は box-shadow を足す */
.my-card:focus-visible {
    outline: 2px solid $color-primary;
    outline-offset: 2px;
    box-shadow: 0 0 0 0.25rem $color-primary-transparent;
}

/* 紫の地の上（確認の吹き出し・メニューなど）は白い線 */
.my-button-on-primary:focus-visible {
    outline: 2px solid $color-surface;
    outline-offset: 2px;
}
```

- **わけ（コントラスト）**: フォーカスの見た目は、まわりと 3:1 以上の差が要る（WCAG 2.2 の 1.4.11）。`$color-primary`（`#855CD6`）は白に対して 4.7:1、画面の地 `$color-background` に対して 4.1:1 で足りる。上流の淡い輪は足りない（紫 35% の輪は白に 1.6:1、紫の地の上の白 25% の輪は 1.56:1）。紫の地の上の白い線は、紫に対して 4.7:1。
- **わけ（強制カラーモード）**: `box-shadow` は Windows のハイコントラストなどの強制カラーモードで消える。`outline` は残るので、フォーカスは必ず `outline` で描き、淡い輪（`box-shadow`）は飾りとして重ねるだけにする。
- `outline: none` だけ書いて輪を消さない（キーボードで使う人が場所を見失う）。
- マウスで押したときは出さない（`:focus` ではなく `:focus-visible`）。
- **入力欄**は `:focus` で、上流と同じく枠の色を `$color-primary` に変える（[`inputs.md`](inputs.md)）。上流の入力欄の淡い輪が問題にならないのは、枠の色が `$ui-black-transparent`（白に 1.4:1）から `$color-primary`（4.7:1）に変わり、その変化でフォーカスが分かるため。輪は上流どおり重ねてよい。ただし `outline` は消さずに透明で残す（強制カラーモードでは透明の線が見える色で描かれる）:

```css
.my-input:focus {
    border-color: $color-primary;
    box-shadow: 0 0 0 0.25rem $color-primary-transparent;
    outline: 2px solid transparent;
}
```

## 撮影と見本

```bash
cd tools/playwright-verify
BASE=http://localhost:8601 ONLY=code-tab,sprite-library,variable-prompt,delete-sprite-confirm,context-menu,alerts node capture-design-system.mjs
DOCS_SHOTS=1 node capture-design-system.mjs   # 見本を撮り直す
```

部品の値を増やすときは、スクリプトの `SCENES` の `parts`（`hover` / `focus` / `active` / `pseudo`）と `crops` に足す。
