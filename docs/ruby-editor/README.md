# Ruby エディタ

> **🆕 Smalruby 独自** — upstream に存在しない、Smalruby のために新規追加された機能
> upstream の Scratch はビジュアルブロックのみ。Smalruby は Monaco Editor を使った Ruby コード編集タブを独自に追加し、ブロックと Ruby コードを相互変換する機能を実装している。

## 概要

Ruby エディタは、Scratch ブロックと **Ruby コードを相互変換** しながら編集できるタブ機能。Monaco Editor で Ruby コードを書き、その結果がリアルタイムにブロックに変換され、逆にブロックを編集した結果も Ruby コードに反映される。

これによりユーザーは「ビジュアルプログラミング → テキストプログラミング」の段階的な学習を、同じ作品の中でシームレスに進められる。

## ユーザーストーリー

- **ブロックに慣れた小学生**として、テキストでプログラムを書く第一歩として、自分が作ったブロックがどんな Ruby コードになるか見たい
- **中学生・高校生**として、ビジュアルブロックでアイデアを試しつつ、本格的な Ruby コードを書く練習をしたい
- **教師**として、ブロックとテキストを行き来できる教材として使いたい
- **保護者**として、子どもがブロックから卒業して「本物のプログラミング言語」に進めるようにしたい

## UI / 操作フロー

### タブ切替

エディタ上部のタブで「ブロック」「コスチューム」「サウンド」「**Ruby**」を切替。Ruby タブが Smalruby 独自。

### Ruby タブの 3 モード

ruby-toolbar 上部のセグメントで切替：

| モード | testid | 表示 |
|---|---|---|
| **ふりがな** | `ruby-toolbar-mode-furigana` | Ruby + ふりがな（日本語ロケール時のみ）|
| **Ruby** | `ruby-toolbar-mode-ruby` | プレーン Ruby |
| **日本語 (DNCL)** | `ruby-toolbar-mode-dncl` | DNCL モード（日本語プログラミング）|

ふりがな・DNCL は独立した機能として個別ドキュメントあり（[`docs/furigana/`](../furigana/), [`docs/dncl/`](../dncl/)）。

### ruby-toolbar の操作

| ボタン | 機能 |
|---|---|
| 実行/停止 (`ruby-toolbar-execute`) | 緑旗を発火・停止 |
| 元に戻す/やり直す | Monaco の undo/redo |
| 検索 | Monaco の find |
| 自動置換 (`ruby-toolbar-auto-correct`) | 自動置換のオン/オフ |
| ルビティー (`ruby-toolbar-rubytee`) | AI アシスタントを開く（[`docs/rubytee/`](../rubytee/) 参照）|
| その他メニュー (`ruby-toolbar-more-menu`) | Ruby スクリプト保存、クラス挿入、プレビュー、自動置換設定 |
| スプライト切替 | エディタ対象スプライトの prev/next |

## 主要ファイル

### scratch-gui

#### Ruby ↔ Blocks 相互変換

| ディレクトリ | 役割 |
|---|---|
| `packages/scratch-gui/src/lib/ruby-to-blocks-converter/` | Ruby AST → Scratch ブロックデータへの変換（`@ruby/prism` AST を walk）|
| `packages/scratch-gui/src/lib/ruby-generator/` | Scratch ブロック → Ruby コード生成（拡張機能ごとに `motion.js`, `looks.js` などのジェネレータ）|

#### Ruby パーサー

| ファイル | 役割 |
|---|---|
| `packages/scratch-gui/src/lib/prism-parser.js` | `@ruby/prism` (WebAssembly) ローダ、prism インスタンスのキャッシュ |
| `packages/scratch-gui/src/lib/ruby-parser.js` | prism-parser を高レベル API でラップ |

#### Monaco Editor 統合

| ファイル | 役割 |
|---|---|
| `packages/scratch-gui/src/containers/ruby-tab.jsx` | Ruby タブのメインコンテナ。Monaco 初期化、モード切替、debounce、永続化 |
| `packages/scratch-gui/src/containers/ruby-tab/editor-setup.js` | Monaco Editor の初期設定 |
| `packages/scratch-gui/src/containers/ruby-tab/smalruby-mode.js` | Monaco の Smalruby 言語定義 |
| `packages/scratch-gui/src/containers/ruby-tab/dncl-mode.js` | Monaco の DNCL 言語定義 |
| `packages/scratch-gui/src/containers/ruby-tab/snippets-completer.js` | コード補完エンジン |
| `packages/scratch-gui/src/containers/ruby-tab/*-snippets.json` | 拡張機能ごとのスニペット定義（motion, looks, sound, koshien, microbit-more など）|
| `packages/scratch-gui/src/containers/ruby-tab/quick-fix-provider.js` | エラー時の Quick Fix |
| `packages/scratch-gui/src/containers/ruby-tab/execution-highlighter.js` | 実行中の行ハイライト |
| `packages/scratch-gui/src/containers/ruby-tab/visual-report-bubble.js` | ブロックの実行結果をエディタにバブル表示 |

#### ruby-toolbar

| ファイル | 役割 |
|---|---|
| `packages/scratch-gui/src/components/ruby-toolbar/ruby-toolbar.jsx` | ツールバー本体 |
| `packages/scratch-gui/src/components/ruby-toolbar/target-selector.jsx` | スプライト切替セレクタ |
| `packages/scratch-gui/src/components/ruby-toolbar/messages.js` | i18n |

#### 補助機能

| ファイル | 役割 |
|---|---|
| `packages/scratch-gui/src/lib/auto-correct.js` | 自動置換（typo の自動修正）|
| `packages/scratch-gui/src/lib/insert-class.js` | 「クラス挿入」機能 |
| `packages/scratch-gui/src/lib/ruby-script-preview.js` | Ruby スクリプトのプレビュー生成 |
| `packages/scratch-gui/src/lib/ruby-screenshot.js` | Ruby コードの画像化 |
| `packages/scratch-gui/src/containers/ruby-downloader.jsx` | Ruby スクリプトの .rb ダウンロード |

#### 状態管理

- `packages/scratch-gui/src/reducers/ruby-code.js` — Ruby コード state
- `packages/scratch-gui/src/reducers/editor-tab.js` — `RUBY_TAB_INDEX` の管理
- `packages/scratch-gui/src/reducers/settings.js` — `rubyVersion` (1 / 2)

### scratch-vm

Ruby ↔ Blocks 変換は scratch-gui 側で完結する（VM 側の変更なし）。ただし Ruby 実行時は scratch-vm のブロック実行エンジンが使われる。

### infra

なし。Ruby 実行はブラウザ内で完結（`@ruby/prism` WebAssembly）。

### ruby/

Ruby ランタイム実装は `ruby/smalruby3/` (smalruby3 gem, SDL2 ベースのデスクトップランタイム)。エディタからは独立だが、生成された Ruby コードはこの gem でも実行できる。

## 関連ブロック

Ruby エディタはすべてのブロックと連携する（変換可能）。**カテゴリごとの Ruby コード対応** は以下の generator/converter を参照：

| カテゴリ | Ruby Generator | Ruby → Blocks Converter |
|---|---|---|
| motion | `motion.js` | `motion.js` |
| looks | `looks.js` | `looks.js` |
| sound | `sound.js` | `sound.js` |
| event | `event.js` | `event.js` |
| control | `control.js` | `control.js` |
| sensing | `sensing.js` | `sensing.js` |
| operators | `operators.js` | `operators.js` |
| data (variables/lists) | `data.js`, `data-list.js` | `data.js`, `data-list.js` |
| procedure | `procedure.js` | `procedure.js` |

> 各ブロックの Ruby 表現詳細は [`docs/smalruby-language-spec.ja.md`](../smalruby-language-spec.ja.md) を参照。

## Ruby バージョン (v1 vs v2)

Smalruby Ruby は 2 つのバージョンが共存：

- **v1**: 旧バージョン（後方互換性のために保持）
- **v2**: 現行バージョン（推奨）

切替方法：
- URL パラメータ `?ruby_version=2`
- メニューバー「ファイル」→ 設定
- localStorage `smalruby:rubyVersion`

v1 コード自動検出 (`v1-detection.js`) があり、v1 構文を含むプロジェクトを開くとプロンプトが表示される。

## 設定・データ永続化

### localStorage

| キー | 用途 |
|---|---|
| `smalruby:furiganaEnabled` | ふりがなオン/オフ |
| `smalruby:dnclMode` | DNCL モードオン/オフ |
| `smalruby:autoCorrectEnabled` | 自動置換オン/オフ |
| `smalruby:autoCorrectSettings` | 自動置換のルール詳細 |
| `smalruby:rubyFontSize` | フォントサイズ |
| `smalruby:rubyVersion` | Ruby バージョン |

### URL パラメータ

| パラメータ | 値 | 効果 |
|---|---|---|
| `tab=ruby` | - | Ruby タブを初期表示 |
| `rubyMode` | `furigana` / `rubi` / `ruby` / `dncl` / `ja` / `japanese` | 初期モード |
| `ruby_version` | `1` / `2` | Ruby バージョン |
| `no_beforeunload` | `1` | beforeunload 無効化（Playwright 用）|

## デバッグ用グローバル

Ruby タブを一度開くと `window.smalruby` が利用可能：

```js
window.smalruby.vm        // Scratch VM インスタンス
window.smalruby.sprite    // 現在編集中の RenderedTarget
window.smalruby.blocks    // 現在のブロック
window.smalruby.runtime   // VM runtime

monaco.editor.getEditors()[0]  // Monaco エディタインスタンス
```

詳細は `packages/scratch-gui/src/containers/ruby-tab/debug-globals.js` 参照。

## アダプティブ debounce

タイピング中の連続レンダリングを抑えるため、ふりがなレンダラ等で **前回処理時間の 2 倍** を debounce 時間として動的調整する：

```js
debounceMs = Math.max(50, lastRenderMs * 2);
```

## テスト

- 単体テスト: `packages/scratch-gui/test/unit/lib/ruby-to-blocks-converter/`, `test/unit/lib/ruby-generator/`, `test/unit/lib/ruby-roundtrip-*.test.js`
- 結合テスト: `packages/scratch-gui/test/integration/ruby-tab*.test.js`

詳細は `.claude/rules/scratch-gui/testing.md` の "Testing Philosophy for Ruby ↔ Blocks Conversion" を参照。

## 関連ドキュメント

- [`docs/furigana/`](../furigana/) — ふりがな機能（Ruby エディタ上の表示モード）
- [`docs/dncl/`](../dncl/) — 日本語プログラミングモード
- [`docs/rubytee/`](../rubytee/) — AI アシスタント
- [`docs/smalruby-language-spec.ja.md`](../smalruby-language-spec.ja.md) — Smalruby Ruby 言語仕様
- [`docs/smalruby-language-spec-extensions.ja.md`](../smalruby-language-spec-extensions.ja.md) — 拡張機能の Ruby 表現
- [`docs/smalruby-language-spec-v1-diff.ja.md`](../smalruby-language-spec-v1-diff.ja.md) — Ruby v1 と v2 の差分
- `.claude/rules/scratch-gui/ruby-mode.md` — Ruby モード開発ルール
- `.claude/rules/scratch-gui/extension-ruby-policy.md` — 拡張機能の Ruby 対応方針

## 関連 Issue / PR

主要 PR は履歴を参照（`feat:.*ruby` で grep）。
