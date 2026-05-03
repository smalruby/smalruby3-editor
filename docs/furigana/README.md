# ふりがな (Furigana)

> **🆕 Smalruby 独自** — upstream に存在しない、Smalruby のために新規追加された機能

## 概要

Ruby タブで表示中の Ruby コードに対して、変数・メソッド・リテラル・制御構造などに**日本語のふりがなラベル**を Monaco Editor の上に重ねて表示する機能。プログラミング初学者が Ruby のコードを「日本語の文章として」読めるようにすることで、英語ベースの構文に対する心理的ハードルを下げることを目的とする。

例:
- `x = 10` → `変数x` `紐付ける` `数値10`
- `move(10)` → `10歩` `動かす`
- `if x > 5` → `もし` `変数x` `5` `より大きい` `ならば`

ふりがなは表示のみ（コード自体は変更されない）で、Monaco Editor の **ViewZones** API を使ってコード行の上に挿入される。

## ユーザーストーリー

- **ローマ字読みが苦手な初学者**として、`if` `else` `def` などの英単語を見ただけでは何をしているか分からないので、コードに日本語のふりがなを表示してプログラムを「日本語の文章」として理解したい
- **小学生**として、変数代入を「変数 x に 10 を紐付ける」のように母国語で説明されたい
- **教師**として、生徒が Ruby を読めるようになるまでの段階的な学習補助として、ふりがなのオン/オフを切り替えられるようにしたい

## UI / 操作フロー

Ruby タブの **ruby-toolbar** 内にある「ふりがな」モード切替ボタンで有効化する。

| モード | ボタン | ふりがな表示 |
|---|---|---|
| ふりがな | `ruby-toolbar-mode-furigana` | ✅ ON |
| Ruby | `ruby-toolbar-mode-ruby` | ❌ OFF |
| 日本語 (DNCL) | `ruby-toolbar-mode-dncl` | ❌ OFF（DNCL モード自体が日本語のため不要）|

**初期状態**:
- 日本語ロケール (`ja`, `ja-Hira`) のときのみ有効化対象
- `localStorage` に保存された設定を尊重（デフォルト ON）
- URL パラメータ `?rubyMode=furigana` (または `rubi`) で強制 ON

## 主要ファイル

### scratch-gui

- **アノテーション生成（AST → ふりがなラベル）**:
  - `packages/scratch-gui/src/lib/furigana-annotator.js` — エントリポイント。prism AST を walk してラベルを生成
  - `packages/scratch-gui/src/lib/furigana-node-handlers.js` — AST ノード種別ごとのハンドラー
  - `packages/scratch-gui/src/lib/furigana-call-helpers.js` — メソッド呼び出しのラベル生成
  - `packages/scratch-gui/src/lib/furigana-extension-handlers.js` — 拡張機能ブロックのラベル
  - `packages/scratch-gui/src/lib/furigana-label-map.js` — メソッド名 → ふりがなラベルの対応表
- **レンダラー（Monaco への挿入）**:
  - `packages/scratch-gui/src/containers/ruby-tab/furigana-renderer.js` — Monaco ViewZones で表示
- **UI トグル / 状態管理**:
  - `packages/scratch-gui/src/containers/ruby-tab.jsx` — `furiganaEnabled` state、debounce 制御
  - `packages/scratch-gui/src/containers/ruby-tab/constants.js` — `FURIGANA_ENABLED_KEY = 'smalruby:furiganaEnabled'`
  - `packages/scratch-gui/src/components/ruby-toolbar/ruby-toolbar.jsx` — モード切替ボタン
  - `packages/scratch-gui/src/components/ruby-toolbar/icon--furigana.svg` — 「ふ」アイコン
- **テスト**:
  - `packages/scratch-gui/test/unit/lib/furigana-annotator.test.js` — 63 件のユニットテスト
  - `packages/scratch-gui/test/unit/lib/furigana-annotator-perf.test.js` — パフォーマンス計測

### scratch-vm

ふりがな機能は表示のみで VM 側の変更を伴わない。

### infra

なし。

## ふりがな対応表

詳細な Ruby → ふりがな の対応一覧は **[`furigana-mapping.md`](furigana-mapping.md)** を参照。変数・リテラル・メソッド・算術・比較・論理・制御構造・メソッド定義・クラス・case/when の全パターンを網羅。

## 設定・データ永続化

- **localStorage キー**: `smalruby:furiganaEnabled`
  - `'false'` 以外（未設定含む）→ ON
  - `'false'` のみ OFF
  - 日本語以外のロケールでは無視される
- **URL パラメータ**: `?rubyMode=furigana` または `?rubyMode=rubi` で強制 ON。`?rubyMode=ruby` または `?rubyMode=dncl` で強制 OFF。`src/lib/url-params.js` で解析

## 実装のポイント / ハマりどころ

### 1. プロダクションビルドでは `node.constructor.name` が使えない

`@ruby/prism` の AST ノード種別を取得する際、`node.constructor.name` は terser によって minify されてしまい、本番ビルドで動作しなくなる。

**必ず `node.toJSON().type`** を使って安定したノード種別文字列を取得する。

### 2. アダプティブ debounce

タイピング中の連続レンダリングを抑えるため、debounce 時間を**前回のレンダリング所要時間に応じて動的調整**する：

```javascript
debounceMs = Math.max(50, lastRenderMs * 2);
```

実測値（500〜1000 行のプログラム）: 10〜30ms

### 3. 日本語ロケール限定

`isJapaneseLocale(locale)` でガード。`en` ロケールでは設定値に関わらず無効化される。

## 関連ドキュメント

- [`furigana-mapping.md`](furigana-mapping.md) — Ruby → ふりがな対応表（全パターン）
- [`docs/ruby-editor/`](../ruby-editor/) — Ruby エディタ全般 (準備中)
- [`docs/dncl/`](../dncl/) — 日本語プログラミングモード (準備中)
- `.claude/rules/scratch-gui/extension-ruby-policy.md` — 新しい拡張機能のふりがな追加方針
- `.claude/rules/scratch-gui/ruby-mode.md` — Ruby モード全般

## 関連 Issue / PR

- PR #223 — 機能初期実装（develop へマージ済み）
