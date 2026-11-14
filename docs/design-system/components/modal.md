# モーダル

上流の値は tag `v13.7.2`。ファイルは `packages/scratch-gui/src/components/` から。共有の `Modal`（`modal/modal.jsx` + `modal/modal.css`）を使うと、オーバーレイ・枠・ヘッダー・閉じるボタンが付く。独自のモーダルを作るときのきまりは `.claude/rules/scratch-gui/modals.md`（本文に不透明な背景を付ける）。

見本: [`0401-variable-prompt.png`](../screenshots/0401-variable-prompt.png)（ふつうのモーダル）、[`0304-connection-modal.png`](../screenshots/0304-connection-modal.png)（ヘッダーが緑のモーダル）、[`0901-debug-modal.png`](../screenshots/0901-debug-modal.png)（共有の `Modal` を使わないモーダル）。

ほかのモーダルと並べた色の比較と、独自の画面での色の使い分けは、下の「モーダルの色の比較」「独自の画面での色の使い分け」。

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

## モーダルの色の比較

上流のモーダルを並べた表。各画面の細かい値（CSS の場所・トークン・実測）は、それぞれのページの「色」の表にある: [`../library.md`](../library.md)・[`../dialogs.md`](../dialogs.md)・[`../extension-modals.md`](../extension-modals.md)・[`../tutorial-debug.md`](../tutorial-debug.md)。

| 部分 | ライブラリ（スプライトなどを選ぶ） | ダイアログ（変数を作るなど） | 拡張機能を選ぶ | 機器との接続 | チュートリアルのカード | デバッグ |
|---|---|---|---|---|---|---|
| 部品 | 共有の `Modal`（フルスクリーン） | 共有の `Modal` | 共有の `Modal`（フルスクリーン） | 共有の `Modal`（ヘッダーだけ上書き） | モーダルでない（浮いたカード） | `react-modal` を直接（独自の CSS） |
| 幕 | `$ui-modal-overlay`（青 90%。中身が覆うので見えない） | `$ui-modal-overlay` | `$ui-modal-overlay`（見えない） | `$ui-modal-overlay` | 無い（後ろを操作できる） | 透明（後ろは見えるが触れない） |
| 枠 | 無い | 4px `$ui-white-transparent`（スモウルビーでは白） | 無い | 4px `$ui-white-transparent`（スモウルビーでは白） | 1px `$ui-tertiary` + 影 | 無い（影 `$ui-black-transparent-10`） |
| ヘッダーの地 | **紫** `$looks-secondary` | **紫** `$looks-secondary` | **紫** `$looks-secondary` | **濃い緑** `$pen-tertiary`（`#0B8E69`） | **緑** `$extensions-primary`（`#0FBD8C`） | **緑** `$ui-green-2`（`#0FBD8C`） |
| ヘッダーの文字 | 白・1rem・ふつう | 白・1rem・ふつう | 白・1rem・ふつう | 白・1rem・ふつう | 白・0.625rem・太字 | 白・1rem・太字 |
| ヘッダーの文字のコントラスト | 4.7:1 | 4.7:1 | 4.7:1 | 4.1:1 | 2.4:1 | 2.4:1 |
| 閉じる | 「戻る」（左） | 黒 15% の丸 28px（右） | 「戻る」（左） | 黒 15% の丸 28px（右） | 「閉じる」の文字とアイコン | 黒 15% の丸 32px（SVG） |
| 本文の地 | 淡い青 `$ui-secondary` | 白 `$ui-white` | 淡い青 `$ui-secondary` | 白 + 上の帯は紫 15% `$looks-light-transparent` | 白 `$ui-white` | 白（直書き） |
| 本文の文字 | `$text-primary` | `$text-primary` | `$text-primary` | `$text-primary` | `$text-primary` | `$text-primary`（一覧は緑 `$ui-green`） |
| 主ボタン | —（タグボタンが紫） | 紫 `$looks-secondary` | — | 紫 `$looks-secondary` | 紫 `$looks-secondary`（「もっと見る」） | — |
| ホバー | 項目の枠が紫 | — | カードの枠が紫 | — | ヘッダーのボタンの地が黒 15%・送る丸が大きくなる | — |
| 選ばれた | タグがオレンジ `$data-primary` | — | — | —（進み具合の点が紫） | 点が白 | 話題の地が淡い緑 `#D1FAEE`（直書き）・太字 |
| 押せない | — | — | カードが半透明 | ボタンが紫 35% `$looks-transparent` | 送る丸を出さない | 送る丸を出さない |
| ページ送り | — | — | — | — | 緑の丸（[`pager.md`](pager.md)） | 緑の丸（SVG） |

コントラストは白い文字と地の比（WCAG の計算）。

### ちがいに意味があるか

- **ヘッダーの色は、モーダルの種類で分けている**: 紫は「エディターの操作（作る・選ぶ）」、緑は「手引き（チュートリアル・デバッグ）」と「拡張機能・機器（接続）」。上流は紫のアクセントに変えたとき、チュートリアルのカードと接続のモーダルの緑を残した（わけと履歴は [`../tutorial-debug.md`](../tutorial-debug.md) の「色の違いのわけ」）。
- **ボタンの紫は、ヘッダーの色にかかわらず同じ**: 接続のモーダルもチュートリアルのカードも、ボタンは紫。緑のモーダルでも「操作」は紫で書いている。
- **デバッグのモーダルの違い（透明な幕・枠なし・淡い緑の選ばれた話題・ホバーなし・同じ緑の別名 `$ui-green-2`）は、決めごとからではなく、作り方の違い**とみられる（共有の `Modal` を使わず、別の場所で作って取り込んだ）。
- **ライブラリとデバッグの違い**は、上の 2 つが重なったもの: ヘッダー（紫と緑）は種類の違い、幕・枠・選ばれた状態・ホバーの違いは作り方の違い。

## 独自の画面での色の使い分け

独自のモーダル（レッスン・クラス管理・メッシュなど）は、次のきまりで色を選ぶ。どれも `smalruby-tokens.css` の別名か、上流の名前で書く（[`../tokens.md`](../tokens.md)）。

| 部分 | 決めたこと | わけ |
|---|---|---|
| 部品 | 共有の `Modal` を使う。`react-modal` を直接使わない | 幕・枠・ヘッダー・閉じる・フォーカスの閉じ込めが上流のほかのモーダルとそろう |
| 幕 | 共有の `Modal` の青 90%（`$color-overlay`）のまま。透明にしない | 後ろが止まっていることが見て分かる。後ろを操作させたい手引きは、モーダルにせず浮いたパネルにする（チュートリアルのカードの形。枠 `1px solid $ui-tertiary`・影 `0 5px 25px 5px $ui-black-transparent`・角丸 0.75rem・重なり `$z-index-card`） |
| 枠 | 共有の `Modal` のまま（`.modal-content` の地・枠・影を上書きしない） | スモウルビーでは、上流の白 25% の枠が不透明な白に見える（`modal.css` の本文の既定の白が枠の下まで塗る）。どのモーダルも同じ白い縁になるので、独自の画面だけ上流の淡い青の縁をまねたり、影を足したりしない |
| ヘッダーの地（ふつう） | **紫 `$color-primary`**（共有の `Modal` のまま。`headerClassName` で変えない） | 作る・選ぶ・見る・設定するなど、エディターの操作のモーダルは上流のダイアログ・ライブラリと同じ紫。白い文字が 4.7:1 で読める |
| ヘッダーの地（つなぐ画面） | 拡張機能・機器・ネットワーク（メッシュなど）と**つなぐ**モーダルだけ、**濃い緑 `$extensions-tertiary`**（`#0B8E69`） | 上流の接続のモーダルと同じ色（同じ流れの中で色が変わらない）。名前は `$pen-tertiary` でなく `$extensions-tertiary` を使う（ほぼ同じ値で、意味が合う）。白い文字は 4.1:1 なので、ヘッダーの題は 1rem 以上にし、小さい文字を置かない |
| ヘッダーの地（使わない色） | 明るい緑（`$extensions-primary` / `$ui-green-2`）はヘッダーの地にしない。手引きの画面でも使わない | 白い文字が 2.4:1 で読みにくい（上流のチュートリアル・デバッグは、この点で手本にしない） |
| 本文の地 | 白 `$color-surface`。状態や絵を見せる帯は、接続のモーダルと同じ紫 15%（`$looks-light-transparent`）。一覧から選ぶフルスクリーンの画面だけ淡い青 `$ui-secondary` | 上流のダイアログ・接続・ライブラリと同じ。淡い緑（`#D1FAEE`）は使わない |
| 本文の文字 | `$color-text`。色の付いた文字（緑・紫）を本文や一覧の文字に使わない | `$text-primary` は白の上で 6.4:1。デバッグの一覧の緑の文字は白の上で 3.1:1・淡い緑の上で 2.8:1 で読みにくい |
| 主ボタン | **紫 `$color-primary`。ヘッダーが緑でも紫**（[`README.md`](README.md) の「主ボタン・副ボタン」） | 上流の接続のモーダルと同じ。緑のボタンは作らない |
| 一覧の行のホバー | 地 `$color-background`（淡い青） | 選ばれた（紫 15%）と区別でき、上流の画面の地の色で新しい色を足さない |
| 一覧の行の選ばれた | 地 `$looks-light-transparent`（紫 15%）・文字 `$color-text`・太字 | デバッグの話題の一覧と同じ「地 + 太字」の形を、紫で書く（文字は 5.3:1）。カードの選ばれたは [`cards.md`](cards.md)（紫の枠 + 輪） |
| 閉じる | 共有の `Modal` の閉じるボタン（[`buttons.md`](buttons.md) の「閉じるボタン」） | 自前の閉じるボタン（デバッグの SVG）を作らない |
| 左右に送る | [`pager.md`](pager.md) の形（紫の丸） | 送るのは操作なので、ヘッダーが緑でも紫 |
| 進み具合の点 | 接続のモーダルの点の色（進行中は紫、成功は緑 `$pen-primary`、失敗はオレンジ `$error-primary`） | 上流にある、白い地の上の進み具合の見せ方 |

### 書き方の例

```jsx
// ふつうのモーダル（ヘッダーは紫のまま）
<Modal
    className={styles.modalContent}
    contentLabel={title}
    id="myModal"
    onRequestClose={onClose}
>
    <Box className={styles.body}>{children}</Box>
</Modal>

// つなぐ画面（ヘッダーだけ濃い緑。接続のモーダルと同じやり方）
<Modal
    className={styles.modalContent}
    contentLabel={title}
    headerClassName={styles.connectHeader}
    id="myConnectModal"
    onRequestClose={onClose}
>
    <Box className={styles.body}>
        <div className={styles.activity}>{/* 絵・状態 */}</div>
        <div className={styles.bottomArea}>{/* 説明・ボタン */}</div>
    </Box>
</Modal>
```

```css
@import '../../css/smalruby-tokens.css';

.modal-content {
    width: 480px; /* 幅だけ決める。地・枠・影は上書きしない */
}

/* 本文には必ず不透明な地を付ける（.claude/rules/scratch-gui/modals.md） */
.body {
    background-color: $color-surface;
    color: $color-text;
}

/* つなぐ画面だけ */
.connect-header {
    background-color: $extensions-tertiary;
}

/* 状態や絵を見せる帯（接続のモーダルの .activityArea と同じ） */
.activity {
    background-color: $looks-light-transparent;
    padding: $space-medium;
}

.bottom-area {
    background-color: $color-surface;
    padding: $space-large 0.75rem 0.75rem;
    text-align: center;
}

/* 一覧の行 */
.row {
    color: $color-text;
    cursor: pointer;
}

.row:hover {
    background-color: $color-background;
}

.row.is-selected {
    background-color: $looks-light-transparent;
    font-weight: $font-weight-bold;
}

.row:focus-visible {
    outline: 2px solid $color-primary;
    outline-offset: -2px; /* 一覧の中で切れないように内側に */
}
```

## 独自のモーダル

- 共有の `Modal` を使い、オーバーレイ・枠・ヘッダーは上流のままにする（ヘッダーの色を変えるのは、上の「つなぐ画面」だけ）。
- 本文のラッパーに `background-color: $color-surface` と余白（`$space-large` か `1.5rem 2.25rem`）を付ける。
- ボタンは右下に並べ、主ボタンを右端に置く（上流の `prompt.css` の `.button-row` と同じ。[`README.md`](README.md) の「独自の画面で使う形」）。
