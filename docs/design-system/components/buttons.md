# ボタン

上流の値は tag `v13.7.2`。ファイルは `packages/scratch-gui/src/components/` から。独自の画面で使う形は [`README.md`](README.md) の「独自の画面で使う形」。

## ボタンの土台（`button/button.css` の `.outlined-button`）

`button/button.jsx`（`ButtonComponent`）が使う。**色を持たない**土台で、使う側が色を決める。

| 状態 | 値 | トークン |
|---|---|---|
| ふつう | 角丸 `$form-radius`（0.25rem）・太字・左右の余白 0.75rem・`background` / `border` / `color` は `inherit`・`cursor: pointer` | `$radius-small`・`$font-weight-bold` |
| アイコン | 高さ 1.5rem・文字との間 0.5rem | 直書き・`$space-medium` |
| ホバー・押した・選ばれた・押せない・フォーカス | — | — |

## 主ボタン・副ボタン（ダイアログのボタン）

部品になっておらず、`prompt/prompt.css` などに書き写されている（書き写している場所は [`README.md`](README.md) の「上流で部品になっていないもの」）。基準は `prompt/prompt.css` の `.button-row button`。見本: [`0401-variable-prompt.png`](../screenshots/0401-variable-prompt.png)。

| 状態 | 主ボタン（`.ok-button`） | 副ボタン | トークン | 実測 |
|---|---|---|---|---|
| ふつう | 地 `$looks-secondary`・文字 白・枠なし（`border: $looks-secondary` は色だけの指定で、線の種類が無いので枠は描かれない） | 地 白・枠 `1px solid $ui-black-transparent`・文字の色は決めていない（ブラウザの既定の黒） | `$color-primary`・`$color-surface`・`$color-border` | 一致。主ボタン 52×39px・副ボタン 104×44px（主ボタンだけ枠が無いぶん低い） |
| 共通 | 余白 `0.75rem 1rem`・角丸 `0.25rem`・文字 `0.85rem`・太さ `600`（`custom-procedures.css` は `bold`）・ボタンの間 0.5rem | | `$radius-small`・`$font-size-dialog` | 一致（12px 16px・4px・13.6px・600） |
| ホバー | — | — | | 変化なし |
| 押した | — | — | | |
| 選ばれた | — | — | | |
| 押せない | —（`connection-modal.css` の `.connection-button:disabled` だけ地 `$looks-transparent`） | — | `$color-primary-transparent` | |
| フォーカス | —（ブラウザの既定の輪） | — | | `outline: auto 1px rgb(16, 16, 16)` |

## アイコンボタン（`icon-button/icon-button.css` の `.container`）

アイコンの下に文字が付く縦長のボタン。音のエディターの道具のボタン（コピー・貼り付けなど。`.tool-button`）と効果のボタン（速く・遅くなど。`.effect-button`）が使う。どちらも `sound-editor/sound-editor.css` で文字の色と大きさを上書きしている（2 つの違いと押せない状態は [`../sound-editor.md`](../sound-editor.md) の「道具のボタン・効果のボタン」）。

| 状態 | 値（`icon-button.css`） | トークン | 実測（音のエディターの効果のボタン `.effect-button`） |
|---|---|---|---|
| ふつう | 文字 `$looks-secondary`・0.75rem・角丸 0.5rem・地と枠なし・ボタンの間 1.25rem | `$color-primary`・`$font-size-small`・`$radius-medium` | 文字 `rgb(87, 94, 117)`・10px・余白 `4px 0`・60×44px（`.effect-button` が `$text-primary`・0.625rem・余白 `0.25rem 0` に上書き） |
| ホバー | — | | 変化なし |
| 押した | 地 `$looks-light-transparent` | 別名なし | 一致（`rgba(133, 92, 214, 0.15)`） |
| 選ばれた | — | | |
| 押せない | `.disabled`: 不透明度 0.5・`pointer-events: none` | | 一致（0.5。音のエディターの道具のボタン。[`../sound-editor.md`](../sound-editor.md)） |
| フォーカス | — | | |

## 切り替えボタン（`toggle-buttons/toggle-buttons.css`）

横に並んだ四角いボタン。ステージの大きさ・スプライトの表示の切り替え。表示の切り替えに使う形で、道具・モードの切り替えには使わない（[`README.md`](README.md) の「選ぶボタン（2 つの形の使い分け）」）。見本: [`0502-toggle-buttons.png`](../screenshots/0502-toggle-buttons.png)。

| 状態 | 値 | トークン | 実測 |
|---|---|---|---|
| ふつう | 34×34px・枠 `1px solid $ui-black-transparent`（となりとの間は 1 本）・両端だけ角丸 `$form-radius`・アイコンは灰色で半透明（`filter: grayscale(100%) opacity(.5)`） | `$color-border`・`$radius-small` | 一致（34×34・4px 0 0 4px） |
| ホバー | — | | 変化なし |
| 押した | 地 `$looks-transparent` | `$color-primary-transparent` | 一致（`rgba(133, 92, 214, 0.35)`） |
| 選ばれた | `[aria-pressed='true']`: 地 `$looks-light-transparent`・アイコンの色が戻る | 別名なし | 一致（`rgba(133, 92, 214, 0.15)`） |
| 押せない | `.disabled .button`: `cursor: default` だけ | | |
| フォーカス | `:focus::before` に `1px solid $looks-secondary` の枠（`top`〜`left` を `-1px` にして、ボタンの枠に重ねて紫に塗り替える。外に足すのではない）。`outline: none` | `$color-primary` | 一致（`::before` の枠 `1px solid rgb(133, 92, 214)`） |

## スイッチ（独自。`ruby-toolbar/ruby-toolbar.css` の `.switch`）

上流に無い部品。**1 つのものを表示する / しないを、押すたびに入れ替える**ときに使う（日本語タブのツールバーの「行番号と罫線」・`ruby-toolbar-rules`）。形は VS Code の設定のトグル（つまみが左右に動く丸いトラック）を手本にし、色は主の色にそろえた。

- **切り替えボタンとの使い分け**: 2 つ以上の**並んだ選択肢から 1 つ選ぶ**（ステージの大きさ・スプライトの表示する / しない）は切り替えボタン。**1 つのことの ON / OFF だけ**で、ラベルに「何を」を書けば足りるもの（「行番号と罫線」）はスイッチ。スイッチのラベルには「表示する」のような動詞を付けず、ON で何が見えるかの名前だけを書く（VS Code の設定と同じ）。
- **道具・モードの切り替えには使わない**（[`README.md`](README.md) の「選ぶボタン」）。スイッチで切りかえてよいのは、見た目だけが変わり、押したあとの操作が変わらないもの。
- **意味づけ**: `<button type="button" role="switch" aria-checked="true|false">`。ラベルはボタンの中の文字（トラックは `aria-hidden`）。ツールチップ（`title`）に、ON で何が起きるかを 1 文で書く。
- **キーボード**: `Tab` で止まり、`Space` / `Enter` で入れ替える（`<button>` の既定）。エディタのフォーカスを動かさないときは `mousedown` を `preventDefault()` する（マウスで押してもフォーカスは動かず、キーボードでは止まれる）。

| 状態 | 値 | トークン |
|---|---|---|
| ふつう（OFF） | 全体: 高さ 32px（ツールバーのアイコンボタンと同じ）・余白 `0 6px`・地なし。トラック: 28×16px・角丸 8px・地 `$ui-white`・枠 `1px solid $text-primary-transparent`。つまみ: 10px の丸・`$text-primary-transparent`・左。ラベル: 12px・太さ 600・`$text-primary` | `$color-surface`・`$color-text-muted`・`$color-text` |
| ON（`aria-checked='true'`） | トラック: 地と枠 `$looks-secondary`。つまみ: `$ui-white`・右へ 12px（`transform`。0.2 秒） | `$color-primary`・`$color-surface` |
| ホバー | 全体の地 `hsla(0, 0%, 0%, 0.05)`（ツールバーのアイコンボタンのホバーと同じ） | 直書き |
| 押した | — | |
| 押せない | — | |
| フォーカス | `:focus-visible`: `outline: 2px solid $looks-secondary`・`outline-offset: 2px`（[`README.md`](README.md) の「フォーカス」） | `$color-primary` |
| 右から左（`[dir='rtl']`） | つまみは右から始まり、ON で左へ動く | |
| ダーク | エディタのまわりの画面にダークの見た目は無い（ブロックの色の `dark` も画面から選べない。[`../blocks.md`](../blocks.md)）。ダークを足すときは、トラックの OFF の地を画面の地に、枠とつまみを補助の文字の色にそろえ、ON は主の色のまま | |

OFF のトラックの枠とつまみ（`$text-primary-transparent`）は白の上で 4.1:1 で、部品の境目に要る 3:1 を満たす。

## タグボタン（`tag-button/tag-button.css`）

ライブラリの絞り込みの丸いボタン。見本: [`0504-library-filter-bar.png`](../screenshots/0504-library-filter-bar.png)。

| 状態 | 値 | トークン | 実測 |
|---|---|---|---|
| ふつう | 地 `$looks-secondary`・文字 白・角丸 1.375rem・高さ `$library-filter-bar-height`（2.5rem）・余白 `.625rem 1rem` | `$color-primary`・`$color-surface` | 一致（22px・40px・10px 16px） |
| ホバー | — | | 変化なし |
| 押した | — | | |
| 選ばれた | `.active`: 地 `$data-primary`（オレンジ） | `$color-warning` と同じ値（意味は違うので別名は使わない） | 一致（`rgb(255, 140, 26)`） |
| 押せない | — | | |
| フォーカス | `:focus-visible`: ブラウザの既定の輪を `outline-offset: -2px` で内側に寄せる（並びの `overflow: hidden` で切れないように） | | 一致（`outline: auto`・offset `-2px`） |

## 閉じるボタン（`close-button/close-button.css`）

モーダルのヘッダー・アラートの右の丸いボタン。

| 状態 | 値 | トークン | 実測 |
|---|---|---|---|
| ふつう（`.large`） | 1.75rem の丸・地 `$ui-black-transparent`・輪 `0 0 0 2px $ui-black-transparent`・動き `all 0.15s ease-out` | `$color-border`・`$radius-round` | 一致（28×28・2px） |
| ふつう（`.large.orange`） | 地と輪 `hsla(29, 100%, 54%, 0.2)`（アラートの注意で使う） | 直書き | 一致（`rgba(255, 134, 20, 0.2)`） |
| ふつう（`.small`） | 0.825rem の丸・地 `$looks-secondary`・文字 白 | `$color-primary` | （撮っていない） |
| ホバー（`.large`） | `transform: scale(1.1, 1.1)`・輪が 4px に | | 一致（輪 4px・`matrix(1.1, 0, 0, 1.1, 0, 0)`） |
| 押した・選ばれた・押せない・フォーカス | — | | |

## クラス管理のボタン（`classroom-modal/classroom-button.jsx`）

スモウルビー独自。クラス管理（先生）と生徒の「クラス」のボタンは、どれも同じクラス（`classroom-modal.css` の `.primary-button` / `.secondary-button` / `.text-button` / `.danger-button`）を使う。新しく書くときは、このクラスを選ぶ `ClassroomButton` の `variant` で書く。形は上の「主ボタン・副ボタン」（Scratch のダイアログのボタン）にそろえ、主の色だけクラス管理の操作の青（`$color-action`）にする。

| 状態 | 主（`variant="primary"`） | 副（`variant="secondary"`） | テキスト（`variant="text"`） | トークン |
|---|---|---|---|---|
| ふつう | 地 `$color-action`・枠 `1px solid $color-action-dark`・文字 白 | 地 白・枠 `1px solid $color-border`・文字 `$color-action` | 地も枠も無し・文字 `$color-action`・左右の余白 0.625rem | `$color-action`・`$color-action-dark`・`$color-surface`・`$color-border` |
| 共通 | 高さ 36px 以上（`min-height`）・左右の余白 1rem・角丸 4px・文字 14px の太字・アイコンとの間 0.25rem・折り返さない（`white-space: nowrap`） | | | `$size-button-height`・`$radius-small`・`$font-size-medium`・`$font-weight-bold`・`$space-small` |
| ホバー・押した | 地 `$color-action-dark` | 地 `$color-background`・文字 `$color-action-dark` | 地 `$color-background`・文字 `$color-action-dark` | 淡い青の地の上の `$color-action` は 4.1:1 で足りないので、文字を濃い青（4.7:1）にする |
| 押せない | 地 `$color-disabled`・文字 `$color-disabled-text`・枠なし・`cursor: not-allowed` | 主と同じ | 箱にせず、文字だけ `$color-disabled-text` | `$color-disabled`・`$color-disabled-text` |
| フォーカス | `:focus-visible` で `outline: 2px solid $color-action; outline-offset: 2px` | | | |

- 上流の独自の画面の形（紫の主ボタン・ホバーなし）との違い: クラス管理は青を主の色にしているので、主・フォーカスの色を `$color-action` にする。Google Classroom の先生に見慣れた形にそろえるため、ホバーで地を少し濃くする。
- 副ボタンの文字は、上の「独自の画面で使う形」（`$color-text`）と違って青にする。作り替えの設計で人間が「この案でよい」と答えたモックの副ボタン（白地・枠・青の文字）に合わせたもので、主ボタンと同じ色の文字で「押せるもの」とひと目で分かるようにするため。
- 主ボタンは 1 画面に 1 つ（クラス管理の R2）。カードの下の「採点」「⚙ 設定」のような軽い操作はテキストボタンにする。
- `variant="danger"`（採点を離れる確認の［戻る］だけ）は形だけ同じにしてあり、色は画面ごとの Issue で R4 に合わせて見直す。
- 並べ方（副が左・主が右）は `TeacherScreen` / `TeacherSubView` の `footer` が持つ（[`../../classroom/source-code.md`](../../classroom/source-code.md)）。

## 外部アカウントでログインするボタン（`sign-in-button/sign-in-button.jsx`）

スモウルビー独自。Google・Microsoft などのアカウントでログインするボタン。クラス管理（先生）のログインと、不具合の報告のログインが使う。見本: [`../../classroom/screenshots/0201-teacher-login.png`](../../classroom/screenshots/0201-teacher-login.png)（Google のスクリプトが読めないときの形。読めたときは上の Google のボタンが Google の描くボタンに入れかわる）。

Google のボタンは Google（Identity Services の `renderButton`）が描き、見た目は options でしか変えられない。そこで**ほかのログインのボタンを Google のボタンの形にそろえる**。主ボタン・副ボタン（青・紫の塗り）にはしない。ログインの手段は並んだ選択肢で、どれも同じ重さで見せたいことと、Google と Microsoft の決まり（白い地にロゴと文字）に合わせるため。

| 状態 | 値 | トークン |
|---|---|---|
| ふつう | 幅 15rem（240px）・高さ 2.5rem（40px）・地 白・枠 `1px solid $color-border`・角丸 4px・文字 14px・太さ 500・文字の色 `$color-text`。ロゴ（1.125rem）を左に置き、文字はボタンの真ん中に | `$color-surface`・`$color-border`・`$radius-small`・`$font-size-medium`・`$color-text` |
| ホバー・押した | 地 `$color-background` | `$color-background` |
| 押せない | 地 `$color-disabled`・文字 `$color-disabled-text`・`cursor: not-allowed` | `$color-disabled`・`$color-disabled-text` |
| フォーカス | `:focus-visible` で `outline: 2px solid $color-action; outline-offset: 2px`（クラス管理のボタンと同じ） | `$color-action` |
| 並べ方 | 縦に 1 列・真ん中ぞろえ・ボタンの間 0.75rem（`SignInButtonList`）。画面の幅で横に並べ替えない（幅をそろえたまま見せるため） | |

- Google の描くボタンは `theme: 'outline'`・`size: 'large'`（高さ 40px）・`shape: 'rectangular'`・`logo_alignment: 'left'`・`width: 240`（`src/lib/teacher-auth.js` の `GOOGLE_BUTTON_WIDTH_PX`）で出す。幅を変えるときは `sign-in-button.css` の `$sign-in-button-width` と両方を直す。
- ロゴは各社のマークなので色を変えない（トークンにしない）。
- 文字は「〇〇でログイン」にそろえる。Google の描くボタンの文字は Google が決める（ログインしたことのあるブラウザでは「〇〇 でログイン」と名前とメールアドレスが出る）。
- Google のボタンが出るまで（スクリプトの読み込み中・読めなかったとき）は、同じ形の自前の Google のボタンを代わりに出す。押すと Google のボタンを出し直す。
