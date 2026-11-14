# メニューバー

上流の値は tag `v13.7.2`。ファイルは `packages/scratch-gui/src/components/` から。

- **値の正は上流の CSS**（`git show v13.7.2:packages/scratch-gui/src/components/<部品>/<部品>.css`）。
- 「実測」は撮影スクリプト（`tools/playwright-verify/capture-design-system.mjs` の `menu-bar`・`menu-file`・`menu-edit`・`menu-help`）で 1366×1024 の画面から取った計算済みの値。上流の CSS と同じなら「一致」と書く。
- 項目・メニューの状態（ホバー・開いている・押せない）は共通部品の [`components/menus.md`](components/menus.md) に書いた。ここには並びと、メニューバーだけの部品を書く。
- 見本: [`0101-menu-bar.png`](screenshots/0101-menu-bar.png)（スモウルビーの画面。「レッスン」「クラス」はスモウルビーの追加、「設定」の中身もスモウルビーで変えている。下の「スモウルビーの追加」）

## 上流の並び（`menu-bar/menu-bar.jsx`）

左から右へ。出る条件は `menu-bar.jsx` の props。

| 場所 | 項目 | 部品（クラス） | 出る条件 |
|---|---|---|---|
| 左 | ロゴ | `.menu-bar-item` の中の `.scratch-logo` | いつも |
| 左 | 設定（言語・色のモード・テーマ） | `SettingsMenu`（`settings-menu.css`） | 言語・色のモード・テーマのどれかを変えられるとき |
| 左 | ファイル | `.menu-bar-item.hoverable` + メニュー | `canManageFiles` |
| 左 | 編集 | `.menu-bar-item.hoverable` + メニュー | いつも |
| 中 | プロジェクトの題 | `.menu-bar-item.growable` の中の `ProjectTitleInput` | `canEditTitle`（題を変えられないときは作者の情報 `AuthorInfo`） |
| 中 | 共有・リミックス・コミュニティ | `ShareButton`・`.remix-button`・`CommunityButton` | Scratch のサイトの中で使うときだけ（`canShare`・`canRemix`・`enableCommunity`） |
| 中 | 区切り | `Divider`（`.divider`） | いつも |
| 中 | チュートリアル・デバッグ | `.menu-bar-item.no-offset.hoverable`（2 つ） | いつも |
| 右 | 保存の状態・マイスタッフ・アカウント | `SaveStatus`・`.mystuff-button`・`AccountNav` | 保存できるとき・ログインできるとき |
| 右 | 「?」（about） | `.menu-bar-item.hoverable` の中の `.about-icon` + メニュー | `onClickAbout` があるとき（デスクトップ版など） |

左の 4 つ（ロゴ〜編集）と、区切りのあとの 2 つ（チュートリアル・デバッグ）は、それぞれ `.file-group`（横に並べる箱）に入る。`.file-group` の中の項目だけ、余白が大きい（下の表）。

## メニューバーの枠（`menu-bar/menu-bar.css` の `.menu-bar`）

| 値 | トークン | 実測 |
|---|---|---|
| 高さ `$menu-bar-height`（3rem）・`box-sizing: border-box` | 別名なし | 一致（48px） |
| 地 `$looks-secondary`・文字 `$ui-white` | `$color-primary`・`$color-surface` | 一致（`rgb(133, 92, 214)`・白） |
| 文字 `$menu-bar-standard-font-size`（0.75rem）の太字・`"Helvetica Neue", Helvetica, Arial, sans-serif` | `$font-size-small`・`$font-weight-bold` | 一致（12px・700） |
| 左右に分ける（`display: flex; justify-content: space-between`）。左は `.main-menu`（のこりの幅を使う）、右は `.account-info-group` | | |
| 重なり順 `$z-index-menu-bar`（491。`gui/gui.css` の `.menu-bar-position`） | | 一致（491） |

メニューバーから開くメニューは `.menu-bar-menu`（`margin-top: $menu-bar-height`・`z-index: $z-index-menu-bar`）でメニューバーの下に出る。メニューそのものの値は [`components/menus.md`](components/menus.md)。

## 項目の並べ方（`.menu-bar-item`）

| 場所 | 値 | トークン | 実測 |
|---|---|---|---|
| ふつう | 高さ `$menu-bar-height`・余白 `0 0.25rem`・文字 白・折り返さない・縦の中央 | `$space-small` | 一致（「?」: 余白 0 4px・48px） |
| `.file-group` の中 | 外の余白 `0 .25rem`・余白 `0 0.75rem` | | 一致（「ファイル」: 外 0 4px・余白 0 12px・88px 幅） |
| `.file-group` の中の `.no-offset`（チュートリアル・デバッグ） | 外の余白 `0 .25rem`・余白 `0 0.25rem` | | （上流の並びはスモウルビーに無いので撮っていない） |
| アイコンと文字（`.collapsible-label`） | 文字の外の余白 `0 .5rem 0 .25rem`。右に下向きの三角（`dropdown-caret.svg` をクラス無しで置く） | | |
| チュートリアル・デバッグのアイコン（`.help-icon`） | 外の余白 `0 .25rem 0 0` | | |
| 幅 1024px 以下 | 文字（`.collapsible-label`・`.tutorials-label`・`.debug-label`）を消してアイコンだけにする | | |
| ホバー・開いている・押せない | [`components/menus.md`](components/menus.md) の「メニューバーの項目」 | | |

## ロゴ（`.scratch-logo`）

| 値 | 実測 |
|---|---|
| 高さ 1.6rem・`vertical-align: middle`。押せるとき（`onClickLogo` があるとき）は `cursor: pointer` | 一致（25.6px） |

上流の画像は Scratch のロゴ（`scratch-logo.svg`。Android では別の画像）。スモウルビーは画像だけを自分のロゴに替えている（大きさは同じクラス）。

## プロジェクトの題（`menu-bar/project-title-input.css`）

入力欄は `forms/input.css` の `.input-form`（[`components/inputs.md`](components/inputs.md) の丸い小さい入力欄）に `.title-field` を重ねたもの。紫の地の上の入力欄の形。

| 状態 | 値 | トークン | 実測 |
|---|---|---|---|
| ふつう | 地 `$ui-white-transparent`・枠 `1px dashed $ui-black-transparent`・角丸 `$form-radius`・余白 `.5rem`・文字 白の太字 `.8rem`・高さは中身に合わせる（`.input-form` の 2rem を `height: auto` で上書き）・動き `0.25s ease-out`（`.input-form`） | `$color-border`・`$radius-small`・`$space-medium` | 一致（`rgba(255, 255, 255, 0.25)`・dashed・4px・8px・12.8px・33px） |
| ふつう（題が空のとき・`::placeholder`） | 文字 白・太さふつう・斜体・`.8rem` | | （撮っていない） |
| 幅 | 入れ物の `.menu-bar-item.growable` が最大 `$menu-bar-item-max-width`（12rem）で、のこりの幅に広がる（`flex: 1`）。入力欄は `.title-field-growable`（`flex-grow: 1`） | | 一致（184px = 12rem − 余白 0.25rem × 2） |
| ホバー | 地 `hsla(0, 100%, 100%, 0.5)`（直書き）。枠の色が `$looks-secondary`（`.input-form:hover`。紫の地の上なのでほとんど見えない） | 直書き・`$color-primary` | 一致（`rgba(255, 255, 255, 0.5)`・`rgb(133, 92, 214)`） |
| フォーカス | 地 `$ui-white`・文字 `$text-primary`・枠 `1px solid $ui-transparent`・白い輪 `0 0 0 calc($space * .5) $ui-white-transparent`・`outline: none` | `$color-surface`・`$color-text` | 一致（白・`rgb(87, 94, 117)`・輪 `rgba(255, 255, 255, 0.25) 0 0 0 4px`） |
| 押した・選ばれた・押せない | — | | |

## 区切り（`divider/divider.css` と `menu-bar.css` の `.divider`）

| 値 | トークン | 実測 |
|---|---|---|
| 右に `1px dashed $ui-black-transparent`・外の余白 `0 .5rem`・高さ 34px | `$color-border` | 一致（1×34px・外 0 8px） |

## 「?」（about）

上流では、デスクトップ版などが `onClickAbout` を渡したときだけ出る。項目が 1 つなら `AboutButton`（`.about-icon` のボタン）、配列ならメニューになる（メニューは左へ開く）。

| 値 | トークン | 実測 |
|---|---|---|
| 項目は `.menu-bar-item.hoverable`。アイコン `.about-icon` は高さ 1.25rem・外の余白 0.5rem | | 一致（44×48px・アイコン 20×20px・外 8px） |
| ホバー・開いている | 地 `$ui-black-transparent`（[`components/menus.md`](components/menus.md)） | 一致（`rgba(0, 0, 0, 0.15)`） |

## 設定（`menu-bar/settings-menu.css`）

上流の設定のメニュー（言語・色のモード・テーマ）。アイコン 1.5rem・選んだものに付くチェック（`.check`。選ばれていないときは `visibility: hidden`）・子のメニューの三角は `rotate(-90deg)`。言語の子のメニューは高さ `calc(100dvh - 5rem)` まで。幅 1024px 以下では文字（`.dropdown-label`）を消す。

スモウルビーはメニューの中身を変えている（クラス管理・表示モード・v1 への切り替えなど）ので、中身はこの文書の対象外。

## Scratch のサイトでだけ出る項目

スモウルビーの画面には出ない。値だけ記録する。

| 部品 | 値 |
|---|---|
| メニューバーのボタン（`.menu-bar-button`） | 高さ `$menu-bar-button-size`（2rem）。`button/button.css` の土台（[`components/buttons.md`](components/buttons.md)） |
| 共有（`share-button.css`） | 地 `$data-primary`。共有したあと（`.share-button-is-shared`）は地 `$ui-black-transparent`・`cursor: default` |
| リミックス（`.remix-button`） | 地 `$pen-primary`・アイコンの高さ 1.25rem |
| コミュニティ（`community-button.css`） | 輪 `0 0 0 1px $ui-black-transparent`・アイコンの高さ 1.25rem |
| 作者の情報（`author-info.css`） | 題 `$menu-bar-large-font-size` の太字・名前の行 `$menu-bar-standard-font-size`・どちらも最大 `$menu-bar-item-max-width` で「…」 |
| マイスタッフ・アカウント（`.mystuff-icon`・`.profile-icon`） | アイコンの高さ 1rem・プロフィールの画像は幅 `$menu-bar-button-size`・角丸 `$form-radius` |

## スモウルビーの追加

上流の値とは分けて記録する。マーカーは `=== Smalruby: ... ===`（一覧は [`../maintenance/smalruby-markers-gui.md`](../maintenance/smalruby-markers-gui.md)）。「マーカー無し」は、上流のファイルにマーカーを付けずに足した変更。

| 追加 | 中身 | ファイル | マーカー |
|---|---|---|---|
| ロゴ | 画像をスモウルビーのロゴに替える（大きさは上流のまま） | `menu-bar.jsx` | `replace Scratch logos with Smalruby logo` |
| 設定の中身 | クラス管理・表示モード・v1 への切り替えなど | `settings-menu.jsx` | `classroom management menu`・`display mode menu`・`v1 switch prevention` |
| チュートリアル・デバッグの場所 | メニューバーに並べず、「?」のメニューの先頭に入れる（上流の about の項目とは区切りで分ける）。「?」はいつも出す | `menu-bar.jsx`・`gui.jsx` | `help menu`・`about menu` |
| レッスン | 上流のチュートリアルの場所（区切りの間）に、同じ形（`.menu-bar-item.no-offset.hoverable` + `.help-icon`）で置く。文字のクラスは `.learn-label`（上流の `.tutorials-label` の名前を変えたもの。`@media (max-width: 1024px)` の規則も同じ） | `menu-bar.jsx`・`menu-bar.css` | `lessons button`（`.learn-label` の名前の変更はマーカー無し） |
| クラス・先生のメニュー | クラスのボタンと、先生がログインしているときのメニュー（`.teacher-menu`: 外の余白 `0 .25rem`・余白 `0 0.5rem`） | `menu-bar.jsx`・`menu-bar.css` | `classroom button`・`classroom teacher menu` |
| メッシュ | メッシュの拡張を読み込んだときだけ出るメニュー（`.mesh-icon` 21px・`.mesh-v2-domain` など） | `menu-bar.jsx`・`menu-bar.css` | マーカー無し |
| 保存の状態 | `.save-status`（0.75rem・白・不透明度 0.9）。Google ドライブの保存の失敗は `.save-directly-button-auth-error`（オレンジで点滅） | `menu-bar.css` | `improved auth_error UX`（`.save-status` はマーカー無し） |
| 読み取り専用の題 | Google ドライブの読み取り専用のプロジェクトでは題を押せない（`.title-field:disabled`: 枠を実線・不透明度 0.7） | `project-title-input.css` | `read-only project title for Google Drive` |
| 新しい版のお知らせ | 緑の吹き出し（`.update-tooltip`: 地 `$ui-green`・ホバー `$ui-green-2`・角丸 0.5rem） | `menu-bar.css` | `version update notification` |
| smalrubot | ファームウェアを書きこむメニュー | `menu-bar.jsx` | `smalrubot firmware menu` |
| ようこそ | 「?」の左の吹き出し | `menu-bar.jsx` | `welcome tooltip` |
| 低い画面での圧縮 | 高さ 800px 以下で、メニューバーと項目を 2.5rem（40px）に縮める | `menu-bar.css`・`gui.css` | `narrow-height menu bar compression`（`menu-bar.css`）・`narrow-height vertical chrome compression`（`gui.css`） |

## 独自の画面で使う形

メニューバーに独自の項目（メッシュなど）を足すときは、上流の項目の形をそのまま使う。値を書き写さない。

- 項目は `.menu-bar-item` + `.hoverable`（開いている間は `.active`）にし、`.file-group` に入れる。アイコンと文字は `<img>` + `.collapsible-label`（幅 1024px 以下で文字が消える）、メニューを開く項目は右に `dropdown-caret.svg`。
- メニューは `MenuBarMenu` + `MenuSection` / `MenuItem`（`menu/menu.css`）を使う。見た目は [`components/menus.md`](components/menus.md)。
- 高さを `48px` や `3rem` と書かない。`$menu-bar-height` を使う（スモウルビーは低い画面で 40px に縮めるので、項目は `height` を親に合わせる）。
- まとまりの間は `Divider` で区切る。
- 色は `smalruby-tokens.css` の別名で書く（地 `$color-primary`、ホバー・開いているときの重ね `$color-border` と同じ値の `$ui-black-transparent`、文字 `$color-surface`）。紫の地の上のフォーカスは白い線にする（[`components/README.md`](components/README.md) の「フォーカス」）。上流のメニューバーの項目にはフォーカスの書き方が無い。
