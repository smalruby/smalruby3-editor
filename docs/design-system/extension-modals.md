# 拡張機能のモーダルと機器との接続

上流の値は tag `v13.7.2`。ファイルは `packages/scratch-gui/src/components/` から。

- **値の正は上流の CSS**（`git show v13.7.2:packages/scratch-gui/src/components/<部品>/<部品>.css`）。
- 「実測」は 1366×1024 の画面で開いて取った計算済みの値。上流の CSS と同じなら「一致」と書く。
- 「色」の列は `hsla(...)` から計算した 16 進（ブラウザが描く色で、実測と同じ）。
- 共通部品の値はほかのページにある。ここでは並びと、その画面だけの値を書く。
  - フルスクリーンのモーダル・ふつうのモーダル・閉じるボタン → [`components/modal.md`](components/modal.md)
  - 項目のカード → [`components/cards.md`](components/cards.md) の「ライブラリの項目」
  - ほかのモーダル（ライブラリ・ダイアログ・チュートリアル・デバッグ）との色の比較 → [`components/modal.md`](components/modal.md) の「モーダルの色の比較」
- 見本: [`0303-extension-library.png`](screenshots/0303-extension-library.png)（拡張機能のライブラリ）、[`0304-connection-modal.png`](screenshots/0304-connection-modal.png)（micro:bit の接続。Scratch Link が見つからないときの画面）

## 一覧

| 画面 | 開く場所 | 部品 | 形 | 見本 |
|---|---|---|---|---|
| 拡張機能を選ぶ | コードタブの左下の「拡張機能を追加」 | `library/library.jsx`（`containers/extension-library.jsx`）+ `library-item/library-item.jsx` の `featured` | フルスクリーンのモーダル（ライブラリと同じ部品） | `0303` |
| 機器との接続 | 機器を使う拡張機能（micro:bit など）のブロックのパレットの見出しの横の、つながり具合のボタン | `connection-modal/connection-modal.jsx`（`containers/connection-modal.jsx`） | ふつうのモーダル（幅 480px）。ヘッダーだけ緑 | `0304` |

## 拡張機能を選ぶ

並びは [`library.md`](library.md) のライブラリと同じ（ヘッダー → 項目の並び）。違うのは次の 3 つ。

- **絞り込みの帯が無い**（入力欄もタグも無い）。ヘッダーのすぐ下から項目が並ぶ。
- 項目が**大きいカード**（`.featured-item`。幅 300px）。上に絵、左下に拡張機能のアイコン、下に名前と説明。機器やネットにつなぐものは、さらに下に「必要なもの」（Bluetooth・インターネットのアイコン）と「協力」の欄が付く。
- まだ使えない拡張機能は、押せないカード（`.disabled`）になり、絵の上に「近日公開」の札が出る。

### 色

| 部分 | 上流の CSS（ファイル・セレクター） | 上流のトークン（値） | 色 | 別名 | 実測 |
|---|---|---|---|---|---|
| オーバーレイ | `modal/modal.css` `.modal-overlay` | `$ui-modal-overlay` | `#4D97FF` × 0.9 | `$color-overlay` | 一致。フルスクリーンでは見えない |
| 地（モーダル全体・項目の並び） | `modal/modal.css` `.modal-content.full-screen`・`library/library.css` `.library-scroll-grid` | `$ui-secondary` | `#E9F1FC` | 別名なし | 一致（`rgb(233, 241, 252)`） |
| ヘッダーの地 | `modal/modal.css` `.header` | `$looks-secondary` | `#855CD6` | `$color-primary` | 一致 |
| ヘッダーの文字（題・戻る） | `modal/modal.css` `.header-item` | `$ui-white` | `#FFFFFF` | `$color-surface` | 一致 |
| カードの地・枠・文字 | `library-item/library-item.css` `.library-item` | `white`・`2px solid $ui-black-transparent`・`$text-primary` | `#FFFFFF`・`#000000` × 0.15・`#575E75` | `$color-surface`・`$color-border`・`$color-text` | 一致 |
| カードのホバー | `library-item/library-item.css` `.library-item:hover` | 枠 `$looks-secondary` | `#855CD6` | `$color-primary` | 一致（枠の色だけ変わる） |
| 必要なもの・協力の文字 | `library-item/library-item.css` `.featured-extension-metadata` | `$text-primary` に不透明度 0.75 | `#575E75` × 0.75 | `$color-text` | 一致 |
| 「近日公開」の札 | `library-item/library-item.css` `.coming-soon-text` | 地 `$data-primary`・文字 `$ui-white`・影 `0 0 .5rem hsla(0, 0%, 0%, .25)` | `#FF8C1A` | 影は `$shadow-raised` | （スモウルビーの一覧には近日公開の拡張機能が無いので出ない） |
| 押せないカード | `library-item/library-item.css` `.library-item.disabled` | 不透明度 0.5・ホバーで枠が変わらない | | | （同上） |
| 選ばれた | —（選ぶとモーダルが閉じる） | | | | |

色はライブラリと同じ（紫のヘッダー・淡い青の地・白いカード）。**拡張機能の緑（`$extensions-primary`）はモーダルには使っていない**。緑は、ブロックのカテゴリと、カードの左下のアイコンの絵（SVG の中の色）にだけ出る。

### 大きさと形

| 部分 | 値（上流） | トークン | 実測 |
|---|---|---|---|
| ヘッダー | ライブラリと同じ（高さ 3.125rem・題は中央・左に「戻る」） | | 一致（50px） |
| 項目の並び | 余白 0.5rem・左から折り返す | `$space-medium` | 一致（8px） |
| カード（`.featured-item`） | 幅 300px（`flex-basis` と `max-width`）・高さは中身で決まる・余白なし。まわり・枠・角丸は `.library-item` と同じ（`$space`・2px・`$space`） | `$radius-medium` | 一致（300px・2px・8px。音楽のカードは高さ 276px） |
| 名前（`.featured-text`） | 太字・余白 10px（拡張機能は左 1.25rem・左ぞろえ）。文字の大きさは決めていない（`<button>` の既定の 13.33px） | | 一致（13.33px・700） |
| 説明（`.featured-description`） | 太さふつう・行の高さ 1.375rem・上 .3125rem・下 .25rem | | 一致（22px） |
| 必要なもの・協力（`.featured-extension-metadata`） | 12px・不透明度 0.75・余白 `0 1.25rem 1rem`。見出しの下の値は太字（`.featured-extension-metadata-detail`） | | 一致 |
| 「近日公開」の札 | 角丸 1rem・余白 `.5rem 1rem`・`.875rem` 太字・絵の左上から `2 * $space` ずらす | `$font-size-medium` | （出ない） |

### 状態

| 部品 | ふつう | ホバー | 押した | 選ばれた | 押せない | フォーカス |
|---|---|---|---|---|---|---|
| カード | 白い地・黒 15% の枠 | 枠が紫 | — | —（選ぶと閉じる） | 不透明度 0.5・「近日公開」の札 | —（ブラウザの既定の輪） |
| 戻るボタン | [`library.md`](library.md) と同じ | — | — | — | — | — |

## 機器との接続

共有の `Modal` を使い、`headerClassName` で**ヘッダーの地だけ緑に変えている**（`connection-modal.css` の `.header`）。題は機器の名前で、その左に機器のアイコン（`headerImage`）、ヘッダーの左に「ヘルプ」（`.help-button`）、右に閉じるボタン。

本文は**上の帯**（`.activityArea`。高さ 165px の淡い紫の帯。絵・手順・見つかった機器の並び）と**下の欄**（`.bottom-area`。白い地に、進み具合の点・説明・ボタンの並び）の 2 段。手順（`PHASES`）ごとに中身が替わる。

| 手順 | 上の帯 | 下の欄 |
|---|---|---|
| 探す（`scanning`） | 見つかった機器のタイル（`.peripheral-tile`）の並び。無い間は回るレーダー | 点 1 つ目・「もう一度探す」 |
| 見つからない（`unavailable`） | 番号の丸（`.help-step-number`）付きの確かめる手順 2 つ | 点（オレンジ）・「もう一度試す」「ヘルプ」 |
| つないでいる（`connecting`） | 機器の絵と、揺れる Bluetooth の丸 | 点 2 つ目・「やめる」 |
| つながった（`connected`） | 機器の絵と、緑の Bluetooth の丸 | 点（緑）・「切断する」（赤）「エディターに戻る」 |
| うまくいかない（`error`） | 機器の絵と注意のアイコン | 点（オレンジ）・「もう一度つなぐ」「ヘルプ」 |
| 機器を更新する（`updatePeripheral`） | 機器の絵 | 説明・「更新する」 |

### 色

| 部分 | 上流の CSS（ファイル・セレクター） | 上流のトークン（値） | 色 | 別名 | 実測 |
|---|---|---|---|---|---|
| オーバーレイ | `modal/modal.css` `.modal-overlay` | `$ui-modal-overlay` | `#4D97FF` × 0.9 | `$color-overlay` | 一致（`rgba(77, 151, 255, 0.9)`） |
| 枠 | `modal/modal.css` `.modal-content` | `$ui-white-transparent` の 4px | `#FFFFFF` × 0.25 | 別名なし | 値は一致。見た目は白（スモウルビーの既定の地。[`components/modal.md`](components/modal.md)） |
| **ヘッダーの地** | `connection-modal/connection-modal.css` `.header` | **`$pen-tertiary`**（`hsla(163, 86%, 30%, 1)`） | `#0B8E69` | 別名なし（`$extensions-tertiary` とほぼ同じ値。下の注） | 一致（`rgb(11, 142, 105)`） |
| ヘッダーの文字（題・ヘルプ） | `modal/modal.css` `.header-item` | `$ui-white` | `#FFFFFF` | `$color-surface` | 一致 |
| 閉じるボタン | `close-button/close-button.css` `.close-button.large` | 地と輪 `$ui-black-transparent` | `#000000` × 0.15 | `$color-border` | 一致（28px・輪 2px） |
| 本文の地 | `connection-modal.css` `.body`・`.bottom-area` | `$ui-white` | `#FFFFFF` | `$color-surface` | 一致 |
| 上の帯の地 | `connection-modal.css` `.activityArea` | `$looks-light-transparent`（`hsla(260, 60%, 60%, 0.15)`） | `#855CD6` × 0.15 | 別名なし | 一致（`rgba(133, 92, 214, 0.15)`） |
| 本文の文字 | `modal/modal.css` `.modal-content` | `$text-primary` | `#575E75` | `$color-text` | 一致 |
| 主ボタン（`.connection-button`） | `connection-modal.css` `.connection-button` | 地 `$looks-secondary`・文字 `white` | `#855CD6` | `$color-primary` | 一致 |
| 主ボタンの押せない | `connection-modal.css` `.connection-button:disabled` | 地 `$looks-transparent` | `#855CD6` × 0.35 | `$color-primary-transparent` | （撮っていない） |
| 切断のボタン（`.red-button`） | `connection-modal.css` `.red-button` | 地 `$red-primary` | `#FF661A` | 別名なし | （撮っていない） |
| 機器のタイル | `connection-modal.css` `.peripheral-tile` | 地 `$ui-white`・ボタンは主ボタンと同じ紫 | `#FFFFFF`・`#855CD6` | `$color-surface`・`$color-primary` | （機器が無いので撮っていない） |
| 電波の強さ | `connection-modal.css` `.signal-bar`・`.green-bar` | `#DBDBDB`（直書き）・`$pen-primary` | `#DBDBDB`・`#0FBD8C` | 別名なし | （同上） |
| 番号の丸 | `connection-modal.css` `.help-step-number` | 地 `$pen-tertiary`・文字 `$ui-white` | `#0B8E69` | 別名なし | 一致（32px・太字） |
| つないでいる丸 | `connection-modal.css` `.bluetooth-connecting-icon` | 地 `$looks-secondary`・輪 4px `$looks-transparent` | `#855CD6` | `$color-primary`・`$color-primary-transparent` | （撮っていない） |
| つながった丸 | `connection-modal.css` `.bluetooth-connected-icon` | 地 `$pen-primary`・輪 4px `$pen-transparent` | `#0FBD8C` | 別名なし | （撮っていない） |
| 進み具合の点（進行中） | `connection-modal.css` `.dots-holder`・`.active-step-dot`・`.inactive-step-dot` | 入れ物 `$looks-light-transparent`・今 `$looks-secondary`・まだ `$looks-transparent` | 紫 15%・`#855CD6`・紫 35% | `$color-primary`・`$color-primary-transparent` | （撮っていない） |
| 進み具合の点（成功） | `.dots-holder-success`・`.success-dot` | `$pen-transparent`・`$pen-primary` | `#0FBD8C` × 0.25・`#0FBD8C` | 別名なし | （撮っていない） |
| 進み具合の点（失敗） | `.dots-holder-error`・`.error-dot` | `$error-transparent`・`$error-primary` | `#FF8C1A` × 0.25・`#FF8C1A` | 別名なし | 一致（見つからないとき。`rgba(255, 140, 26, 0.25)`） |

注: 接続のモーダルの緑は 3 つのトークン名で書かれている。`$pen-tertiary`（`hsla(163, 86%, 30%, 1)`）と `$extensions-tertiary`（`hsla(163, 85%, 30%, 1)`）は彩度が 1% 違うだけで、どちらも `#0B8E69` に描かれる。`$pen-primary` と `$extensions-primary` は同じ値（`#0FBD8C`）。上流はペンの拡張の色の名前を、拡張機能の色の名前に置きかえる途中で両方を残している。

まとめると、接続のモーダルは**ヘッダーと番号の丸と「つながった」の印だけ緑**で、ボタン・上の帯・進行中の点は、ほかのモーダルと同じ**紫**。緑は「拡張機能・機器」のしるしとして、紫は「操作」のしるしとして使い分けている。

### 大きさと形

| 部分 | 値（上流） | トークン | 実測 |
|---|---|---|---|
| 枠（`.modal-content`） | 幅 480px・行の高さ 1.75 | | 一致（480px・28px） |
| ヘッダー | ふつうのモーダルと同じ（高さ 3.125rem）。ヘルプは 0.75rem の太さふつう | `$font-size-small` | 一致（50px・12px） |
| 上の帯 | 高さ 165px・余白 .5rem・中身は中央 | `$space-medium` | 一致（165px・8px） |
| 下の欄 | 余白 `1rem .75rem .75rem`・中央ぞろえ・部品の間 1rem | `$space-large` | 一致（16px 12px 12px） |
| 主ボタン（`.connection-button`） | 余白 `0.6rem 0.75rem`・角丸 0.5rem・`0.85rem` の太さ 600・枠なし・まわり 0.25rem・アイコンとの間 0.5rem | `$radius-medium`・`$font-size-dialog` | 一致（9.6px 12px・8px・13.6px・600） |
| 並んだボタン（`.segmented-button`） | となりとの間 1px・内側の角丸を 0 に | | （撮っていない） |
| 機器のタイル | 高さ 55px・余白 10px・角丸 0.25rem・下に 0.5rem。名前のラベル 0.625rem 太字・名前 0.875rem | `$radius-small`・`$font-size-xsmall`・`$font-size-medium` | （撮っていない） |
| 番号の丸 | 2rem の丸・太字 | `$radius-round` | 一致（32px） |
| 進み具合の点 | 0.5rem の丸・間 0.3rem・入れ物は角丸 1rem・余白 `0.25rem 0.1rem` | | 一致（入れ物 16px の角丸） |
| レーダー | 小 40px・大 120px・4 秒で 1 回転 | | （撮っていない） |

### 状態

| 部品 | ふつう | ホバー | 押した | 選ばれた | 押せない | フォーカス |
|---|---|---|---|---|---|---|
| 主ボタン | 紫の塗り・白い文字 | —（変化なし） | — | — | 地が紫 35% | —（ブラウザの既定の輪） |
| 機器のタイルの「接続」 | 紫の塗り | — | — | — | — | — |
| 閉じるボタン | [`components/buttons.md`](components/buttons.md) の「閉じるボタン」 | `scale(1.1)`・輪 4px | — | — | — | — |

## スモウルビーの追加

上流と違うところ。上の表の値には入れていない。

| 場所 | 中身 | 見た目への影響 |
|---|---|---|
| `library/library.jsx`・`containers/extension-library.jsx` | 拡張機能のライブラリのヘッダーの右に「すべての拡張機能を表示」のチェック（`headerActions`。スモウルビーの拡張機能の絞り込み） | ヘッダーの右に白い文字のチェックが出る（見本 `0303` にも写る） |
| `lib/libraries/extensions/` | スモウルビーの拡張機能（甲子園・micro:bit More・メッシュ・smalrubot など）のカード | カードの中身だけ。部品の値は変わらない |
| `connection-modal/*.jsx`（マーカー付き） | メッシュの接続（`mesh-v2-*`）・smalrubot S1 の接続（`smalrubot-s1-*`）の手順、ネットワークの制限の見つけ方、機器の名前のラベル | 独自の手順の画面。上流の手順の値は変わらない |
| `connection-modal/connection-modal.css`（マーカー付き） | ネットワークの制限の表示（`.network-info`・`.copy-button` の緑 `#4CAF50`）、メッシュのひらがなの名前さがし（`.hiragana-*`） | 独自の手順だけ |
| `connection-modal/connection-modal.css`（**マーカー無し**） | `.important-instruction`（太字・`$ui-red`） | micro:bit More のファームウェア更新の説明だけ |
| `connection-modal/unavailable-step.jsx`・`update-peripheral-step.jsx`（**マーカー無し**） | 見つからないときの「機器を更新する」の説明とボタン、更新の手順の変更 | 見本 `0304` の「アップデート」のボタンと、その上の説明の文はスモウルビーの追加 |
| `modal/modal.css`（マーカー付き） | 本文の既定の白い地 | 枠が不透明な白に見える（上流は淡い青が透ける） |

## 独自の画面で使うとき

- 拡張機能・機器・ネットワーク（メッシュなど）と**つなぐ**画面は、この接続のモーダルの形（緑のヘッダー・淡い紫の帯・白い下の欄・紫のボタン）にする。色の選び方は [`components/modal.md`](components/modal.md) の「独自の画面での色の使い分け」。
- 進み具合を点で見せるときは、接続のモーダルの点（`.dots-holder`）の色にそろえる（進行中は紫、成功は緑、失敗はオレンジ）。
- 一覧から拡張機能のようなものを選ぶ画面は、ライブラリの形（[`library.md`](library.md)）を使う。
