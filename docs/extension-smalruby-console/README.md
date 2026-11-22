# 拡張機能: コンソール

> **🆕 Smalruby 独自** — upstream に存在しない、Smalruby のために新規追加された拡張機能

- **Smalruby ランタイム対応**: ❌（smalruby3 gem 側には、このブロックに相当する API が無い）
- **デフォルト表示**: ✅（拡張機能ライブラリにデフォルトで表示される）

## 概要

日本語モード（共通テスト用プログラム表記）の **`表示する`**（コンソールに 1 行出す）と
**`入力する`**（コンソールで答えを受け取る）を表すブロック。日本語モードのために足す拡張機能はこれ 1 つだけ
（[`docs/dncl/design.md`](../dncl/design.md) の 5 章）。

Scratch には「言う」「聞いて待つ」しかないが、日本語のプログラムの `表示する` は、キャラクターの吹き出しではなく
コンソールへの出力を意味する。そこで、ステージをコンソールに切りかえて、行の出力と入力を見せる。

## ユーザーストーリー

- **情報I を学ぶ高校生**として、問題文のプログラムを日本語のまま動かし、`表示する` の結果を
  ターミナルのように上から順に読みたい
- **先生**として、日本語のプログラムがブロックではどう表されるかを見せたい（`表示する` はコンソールのブロック、
  ほかはいつものブロック）

## 画面

- ステージの上（緑の旗・停止・メッシュのボタンの後ろ）に **コンソールのボタン**を置く。
  コンソールの拡張機能を使う作品のとき（または、コンソールを表示しているとき）だけ出す。
- ボタンを押すと、ステージがコンソールに切りかわる（もう一度押すか、コンソールの［ステージにもどる］で戻る）。
  コンソールを隠しているあいだに表示した行の数を、ボタンに数字で出す。
- コンソールは、表示した行を上から順に出す。プログラムが答えを待っているあいだ（`入力する` か「聞いて待つ」）は、
  いちばん下に入力の欄を出す。Enter キーで答えると、答えも `> 答え` の行として残る。
  「聞いて待つ」の質問の文字があれば、入力の欄の前に出す。
- コンソールの表示中は、ステージの質問の欄を出さない（答えはコンソールで入れる）。
- 緑の旗で作品を始めると、行を消す。［消す］でも消せる。行は 1,000 行まで（古いものから消す）。
- 日本語モードのブロックパレットでは、拡張機能のうちコンソールだけを出す（`make-toolbox-xml.js`。ブロックの絞り込みは `dncl-block-filter.js`）。
- 日本語タブはコンソールを既定にする（タブからは `src/lib/smalruby-console.js` の
  `showSmalrubyConsole(dispatch)` / `hideSmalrubyConsole(dispatch)` を呼ぶ。Redux の
  `setSmalrubyConsoleVisible(bool)` を直接 dispatch してもよい）。
- 日本語タブを開いても、出すのは**コンソールの画面だけ**で、拡張機能は作品に足さない。拡張機能は、
  日本語 → Ruby の変換で `表示する` / `【外部からの入力】`（Ruby の `console.puts` / `console.gets`）が
  出て、そのブロックを作るときに初めて足す（変換器がブロックの opcode から拡張機能を読み込む）。
  表示も入力もしないプログラムの作品には、拡張機能が入らない。拡張機能が無いあいだは、
  日本語モードのブロックパレットにコンソールのブロックは出ない。

| data-testid                      | 要素                                             |
| -------------------------------- | ------------------------------------------------ |
| `smalruby-console-button`        | ステージの上のコンソールのボタン                 |
| `smalruby-console-button-unread` | ボタンの数字（隠しているあいだに表示した行の数） |
| `smalruby-console`               | コンソール                                       |
| `smalruby-console-lines`         | 行の並び                                         |
| `smalruby-console-line`          | 1 行（`data-kind` は `output` か `input`）       |
| `smalruby-console-input`         | 答えの入力の欄                                   |
| `smalruby-console-clear`         | ［消す］                                         |
| `smalruby-console-close`         | ［ステージにもどる］                             |

## 関連ブロック

| opcode                  | ブロック（ja）      | 種類     | 説明                               |
| ----------------------- | ------------------- | -------- | ---------------------------------- |
| `smalrubyConsole_print` | `[TEXT] を表示する` | コマンド | コンソールに 1 行出す              |
| `smalrubyConsole_input` | `入力する`          | 値       | コンソールで答えを待ち、答えを返す |

- `入力する` は「聞いて待つ」の質問（文字なし）として尋ねる。「聞いて待つ」と同じ順番待ちに並び、
  答えは「答え」ブロックにも入る。

## 日本語・Ruby との対応

| 日本語                   | ブロック                              | Ruby                     |
| ------------------------ | ------------------------------------- | ------------------------ |
| `表示する(x)`            | `(x) を表示する`                      | `console.puts(@x)`       |
| `x = 【外部からの入力】` | `x を (入力する) にする`              | `@x = console.gets`      |
| `x = 【整数を入力】`     | `x を ((入力する) の切り捨て) にする` | `@x = console.gets.to_i` |

- **`console.puts` / `console.gets` は、日本語モードとブロックのあいだの形**。ブロックがルビータブを
  通っても消えないように、ほかの拡張機能と同じく生成器と変換器の対を持つ。
- **Ruby の `puts` / `gets` はコンソールのブロックにしない**（`puts` はいままでどおり「言う」）。
  ルビータブは Scratch の部分集合なので、コンソールを Ruby で書く形は案内しない（補完・スニペットに出さない。
  言語仕様にも載せない）。

## 主要ファイル

### scratch-vm

- `packages/scratch-vm/src/extensions/smalruby_console/index.js` — 拡張機能本体（`print` は
  ランタイムのイベント `SMALRUBY_CONSOLE_PRINT` を出す。`input` は `sensing_askandwait` で尋ねる）
- `packages/scratch-vm/src/extensions/smalruby_console/translations.json` — i18n
- `packages/scratch-vm/src/extensions/smalruby_console/console-icon.svg` / `console-icon-uri.js` — ブロックのアイコン
- `packages/scratch-vm/src/extension-support/smalruby-extensions.js` — 登録（`smalrubyConsole`）

### scratch-gui

- `packages/scratch-gui/src/lib/libraries/extensions/smalruby-console/` — 拡張機能ライブラリのエントリ
- `packages/scratch-gui/src/lib/ruby-generator/smalruby-console.js` — ブロック → Ruby
- `packages/scratch-gui/src/lib/ruby-to-blocks-converter/smalruby-console.js` — Ruby → ブロック
- `packages/scratch-gui/src/components/smalruby-console/smalruby-console.jsx` — コンソール（ステージに重ねる。
  VM の `SMALRUBY_CONSOLE_PRINT` と `PROJECT_START` を聞いて行を足す・消す）
- `packages/scratch-gui/src/components/smalruby-console/smalruby-console-button.jsx` — ステージの上のボタン
- `packages/scratch-gui/src/reducers/smalruby-console.js` — 表示するか・行・隠しているあいだの行の数
- `packages/scratch-gui/src/lib/smalruby-console.js` — ほかの画面（日本語タブ）から表示する口
- upstream のファイル（マーカー付き）: `src/components/stage/stage.jsx`・`src/containers/stage.jsx`・
  `src/components/stage-header/stage-header.jsx`（`docs/maintenance/smalruby-markers-gui.md`）

### infra

なし。

## 設定・データ永続化

なし。表示した行・コンソールを表示しているかは作品に保存しない（Redux だけに持つ）。

## テスト

- VM: `packages/scratch-vm/test/unit/extension_smalruby_console.js`
- ブロック ⇔ Ruby: `packages/scratch-gui/test/unit/lib/ruby-roundtrip/extension-smalruby-console-table.test.js`
- 画面: `packages/scratch-gui/test/unit/components/smalruby-console.test.jsx`、
  `packages/scratch-gui/test/unit/reducers/smalruby-console-reducer.test.js`

## 関連ドキュメント

- [`docs/dncl/design.md`](../dncl/design.md) — 日本語モードの基本設計（5 章: 拡張機能）
- [`docs/dncl/README.md`](../dncl/README.md) — 日本語モード
