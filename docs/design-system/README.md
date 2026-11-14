# デザインシステム

> **🔧 upstream 改良** — 上流（Scratch）の GUI のデザインのきまりをそのまま記録する
> **改良点**: 上流の値は変えずに、独自の画面のための意味の名前の別名（`smalruby-tokens.css`）を足す

## 概要

スモウルビーのデザインシステム。上流の GUI から**デザイントークン**（色・大きさ・余白・角丸・文字・影・重なり順）と部品の形を取り出し、表とスクリーンショットにまとめる。

**目的**: Scratch に由来するデザインのきまりをはっきりさせ、スモウルビー独自の機能（レッスン・クラス管理など）の UI を速く、Scratch の画面とずれずに作れるようにする。いまは独自の画面ごとに色や大きさを決めていて、Scratch の画面と少しずつずれている（独自の画面の CSS には 16 進の色の直書きが約 700 か所ある）。

設計の出発点は EPIC [#1809](https://github.com/smalruby/smalruby3-editor/issues/1809)。

## 方針

| 項目 | 決めたこと |
|---|---|
| 名前 | 上流の Sass（PostCSS）の変数名をそのまま残し、意味の名前の別名を足す |
| 独自の画面での使い方 | 新しい `packages/scratch-gui/src/css/smalruby-tokens.css` を `@import` する |
| 値の正 | 上流 scratch-editor tag `v13.7.2` の CSS（基準は `.claude/rules/upstream-tracking.md`）。実際の画面の計算済みの値はスモウルビーの変更が混ざるので、見本の画像と確かめにだけ使う |
| 見本の形 | Markdown の表とスクリーンショットだけ（HTML の見本は作らない） |
| ダーク・高コントラスト | 上流と同じく、ブロックの色だけ記録する（GUI の枠は色のモードで変わらない） |
| 見つけたずれ | マーカーの無い上流ファイルの変更などは、この文書とは別の小さな Issue で直す |

## 対象（上流の Scratch 由来の画面）

- メイン画面のメニューバー:「ロゴ」「ファイル」「編集」「チュートリアル」「デバッグ」
- コードタブのすべて（ブロックパレット・カテゴリ・スクリプトエリア・ステージ・スプライトの情報・ターゲットの一覧）
- コスチュームタブのすべて（ペイントエディター）
- 音タブのすべて（音のエディター）
- 拡張機能のモーダル
- デバッグのモーダル
- チュートリアルのモーダル
- スプライト・ステージ（背景）・コスチューム・音を選ぶモーダル（ライブラリ）
- スプライトを削除するときの確認
- 変数・リスト・関数（ブロック定義）を作るモーダル
- micro:bit のような標準の拡張機能の、機器と接続するモーダル

## 対象外（スモウルビー独自）

レッスン、クラス管理、クラス（生徒の画面）、設定メニュー、SP（スマホ）用の画面、Ruby タブ・日本語タブなど、スモウルビーで独自に作ったもの。上流の画面の中にあるスモウルビーの変更（`=== Smalruby: ... ===` のマーカーの付いたところ）も記録しない。

これらは**トークンを使う側**。このデザインシステムに合わせて作る。

## 文書の地図

| ファイル | 中身 |
|---|---|
| [`tokens.md`](tokens.md) | 上流のトークン（色・大きさ・文字・重なり順）の一覧、くり返し出る直書きの値、意味の名前の別名 |
| [`blocks.md`](blocks.md) | ブロックのカテゴリの色（3 つの色のモード）と形の寸法 |
| [`paint.md`](paint.md) | ペイントエディター（scratch-paint）の値と、GUI との食い違い |
| [`menu-bar.md`](menu-bar.md) | メニューバー（ロゴ・設定・ファイル・編集・プロジェクトの題・区切り・チュートリアル・デバッグ・「?」）の並びと値、スモウルビーの追加 |
| [`code-tab.md`](code-tab.md) | コードタブ（画面の割り付け・ブロックのパレット・カテゴリ・スクリプトエリア・ステージ・モニター・スプライトの情報・ターゲットの一覧）の値、スモウルビーの追加 |
| [`library.md`](library.md) | スプライト・背景・コスチューム・音を選ぶライブラリ（フルスクリーンのモーダル）の並び・色・値、スモウルビーの追加 |
| [`dialogs.md`](dialogs.md) | 変数・リスト・ブロックを作るダイアログと削除の確認の並び・色・値、スモウルビーの追加 |
| [`components/`](components/) | 共通部品（ボタン・入力欄・メニュー・モーダル・タブ・カード・確認・アラート）の状態の表と、独自の画面で使うボタン・フォーカスの形 |
| [`screenshots/`](screenshots/) | 見本の画像（名前の付け方は [`../_screenshot-guidelines.md`](../_screenshot-guidelines.md)） |

## 独自の画面でトークンを使う

独自の画面の CSS の先頭で `smalruby-tokens.css` を読み込み、意味の名前で書く。`smalruby-tokens.css` は上流の `colors.css`・`units.css`・`z-index.css` を読み込むので、上流の名前もそのまま使える。

```css
/* packages/scratch-gui/src/components/my-modal/my-modal.css */
@import '../../css/smalruby-tokens.css';

.body {
    /* モーダルの本文には必ず不透明な背景を付ける（.claude/rules/scratch-gui/modals.md） */
    background-color: $color-surface;
    color: $color-text;
    padding: $space-large;
    font-size: $font-size-dialog;
}

.ok-button {
    background-color: $color-primary;
    color: $color-surface;
    border: 1px solid $color-primary-dark;
    border-radius: $radius-small;
    font-weight: $font-weight-bold;
    transition: $transition-standard;
}

.ok-button:focus-visible {
    box-shadow: 0 0 0 0.25rem $color-primary-transparent;
}
```

- `@import` の道すじは、その CSS から `src/css/` への相対パス（ほかの CSS が `colors.css` を読み込むときと同じ）。ビルドでは `postcss-import` が中身を埋め込み、`postcss-simple-vars` が変数を値に置きかえる。
- `colors.css` などをほかに読み込んでいても、いっしょに読み込んでよい。
- 直書きの値を足したくなったら、まず [`tokens.md`](tokens.md) にトークンが無いか見る。無くて、ほかの画面でもくり返し使うなら別名を足す（下の「文書を新しく保つ」）。

## 撮影スクリプトで値と見本を取る

`tools/playwright-verify/capture-design-system.mjs` は、対象の画面（メニューバーとファイル・編集・「?」のメニュー・コードタブ（スモウルビーの既定の「中」のステージと、上流の既定の「大」のステージ）・モニター・コスチュームタブ・音タブ・拡張機能・ライブラリ・チュートリアル・デバッグ・削除の確認・変数／リスト／ブロックを作る・機器との接続・右クリックのメニュー・アラート）を 1 つずつ開き、部品ごとの計算済みのスタイルとホバー・フォーカス・押したときの値、スクリーンショットと部品の切り抜きを取る。dev server だけあれば動く（stg・ログインは不要）。

```bash
# dev server を起動しておく（ほかの人と重ならないポートでもよい）
cd tools/playwright-verify
BASE=http://localhost:8601 node capture-design-system.mjs   # 全部の画面
LIST=1 node capture-design-system.mjs                        # 画面の id の一覧
ONLY=menu-bar,variable-prompt node capture-design-system.mjs # 一部の画面だけ
DOCS_SHOTS=1 node capture-design-system.mjs                  # screenshots/ の見本も撮り直す
```

- 出力は `tmp/design-system/`（git に入れない）。`<番号>-<画面>.png`、切り抜き `<番号>-<画面>-<切り抜き>.png`、部品ごとの値の `styles.json`（ホバー・フォーカス・押したときに変わる値は `hover` / `focus` / `active` に差分だけ）、scratch-blocks がページに書き出す `--colour-*` の `block-colours.json`。
- 画面は **1366×1024** で開く。高さが低いと、スモウルビーの「低い画面での圧縮」でメニューバーが 48px から縮む（縮んでいると警告を出す）。スモウルビーの吹き出し（ようこそ・レッスンのヒントなど）は隠す。
- **値の正は上流の CSS**。取った値は、文書の表の値が実際の画面と合っているかの確かめと、見本の画像に使う。メニューバーの「レッスン」「クラス」や Ruby タブ、スモウルビーの拡張機能などスモウルビーの変更も写るので、文書には上流の部分だけを書く。
- 開けない画面・切り抜く部品が無い画面・必須の部品が見つからない画面が 1 つでもあれば exit 1（拡張機能のライブラリの絞り込みのように、もともと無い部品は無くてよいものとして数える）。
- `screenshots/` に置く見本は少数だけ（`DOCS_SHOTS=1` で撮り直す画面はスクリプトの `DOC_SHOT_NAMES`）。`DOCS_SHOTS=1` は 1366×1024 でメニューバーが 48px のときだけ動く（違う条件で見本を上書きしない）。ほかの画像は `tmp/` で見て、必要な部品だけを切り抜いて足す。

## 主要ファイル

- `packages/scratch-gui/src/css/colors.css`・`units.css`・`typography.css`・`z-index.css` — 上流のトークン（変えない）
- `packages/scratch-gui/src/css/smalruby-tokens.css` — スモウルビーの別名（独自のファイル。Prettier の対象）
- `packages/scratch-gui/test/unit/css/smalruby-tokens.test.js` — `smalruby-tokens.css` をビルドと同じ PostCSS のプラグインでコンパイルし、未定義の変数が無いことを確かめるテスト（上流でトークンが消えたら落ちる）
- `packages/scratch-gui/src/lib/settings/color-mode/` — ブロックの 3 つの色のモード（[`blocks.md`](blocks.md)）
- `tools/playwright-verify/capture-design-system.mjs` — 対象の画面を headless で開き、計算済みのスタイル・ホバーの値・スクリーンショットを取る撮影スクリプト（下の「撮影スクリプトで値と見本を取る」）

## 文書を新しく保つ

- **upstream のマージのとき**: `src/css/` の 4 つのファイルが変わったら、[`tokens.md`](tokens.md) の表と基準のタグ（このページと `tokens.md` の `v13.7.2`）を直す。部品の CSS が変わったら、`components/` と各画面の文書（`menu-bar.md`・`code-tab.md`・`library.md`・`dialogs.md` など）を見直す。
- **別名を足す・変えるとき**: `smalruby-tokens.css` に 1 行のコメント付きで足し、`tokens.md` の「意味の名前の別名」の表にも足す（両方をいっしょに直す）。上流にトークンがあるときは、それを指す別名にする（値を写さない）。
- **上流のトークンのファイルを変えるとき**: 原則として変えない。どうしても変えるときは、マーカーを付けて `docs/maintenance/smalruby-markers-gui.md` に載せ、`tokens.md` の「スモウルビーとの差」にも書く。
- **スクリーンショット**: 上流の値の見本なので、スモウルビーの吹き出しなどが写らないようにして撮る。撮り直しはファイル名を変えない（[`../_screenshot-guidelines.md`](../_screenshot-guidelines.md)）。
