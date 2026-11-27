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

### AI を使うボタン（`ai`）

見本: [`0510-classroom-ai-buttons.png`](../screenshots/0510-classroom-ai-buttons.png)（上から主・副・テキスト・押せない。右はくらべる用の AI を使わないボタン）。

押すと AI を呼ぶボタン（採点の［基準］タブの「AI に説明の案を出してもらう」「AI の案を出す」「フェアか確かめる」「AI に基準の文を書いてもらう」、採点の手順の「全員を採点」「コメントを下書き」）は、`<ClassroomButton ai variant="…">` で書く。キラキラのアイコン（3 つの星）は部品が文字の左に出すので、呼ぶ側で SVG を書かない。

- **規則**: クラス管理で AI を使うボタンは枠を虹色にし、色がゆっくりめぐる（5 秒で 1 周）。キラキラのアイコンを付ける。主ボタンは中を青のまま、副ボタンは白地、テキストボタンは枠を付けずアイコンだけ。押せないときと動きを減らす設定（`prefers-reduced-motion: reduce`）のときは止める（押せないときは虹も消す）。
- **規則**: 虹色は AI を使うボタンだけに使う。ほかのボタン・札・飾りに使わない。AI の結果を保存する・見るだけのボタンや、外の AI へ渡すもの（「学校の生成AI に相談」）には付けない。
- **理由**: 「AI がやる」と一目で分かる形をそろえる。autopilot と同じ色にして、AI を使うものの見た目を 1 つにする。

| 状態 | 主（`variant="primary"`） | 副（`variant="secondary"`） | テキスト（`variant="text"`） | トークン |
|---|---|---|---|---|
| ふつう | 枠 `2px` の虹色・中 `$color-action`・文字 白 | 枠 `2px` の虹色・地 白・文字 `$color-action` | 枠なし・アイコンだけ（地と文字はふつうのテキストボタン） | `$color-ai-1`〜`$color-ai-6`・`$size-ai-border` |
| 動き | 虹の角度を `@property --ai-angle` で回す（`$motion-ai` で 1 周） | 主と同じ | 動かない | `$motion-ai` |
| ホバー・押した | 中 `$color-action-dark` | 地 `$color-ai-wash`・文字 `$color-action-dark` | ふつうのテキストボタンと同じ | `$color-ai-wash` |
| 押せない | 虹を消し、ふつうの押せないボタンと同じ灰色。めぐりも止める | 主と同じ | ふつうの押せないテキストボタンと同じ | `$color-disabled`・`$color-disabled-text` |

- 作り: 地を `padding-box` の単色、枠を `conic-gradient` の `border-box` で塗る（autopilot のモニターの `.go` と同じ作り）。CSS は `classroom-modal.css` の `.ai-button`。
- コントラスト: 主ボタンの白い文字と青の地は、ふつうの主ボタンと同じ。虹は飾りの枠なので文字のコントラストの対象にしない。

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
