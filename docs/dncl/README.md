# DNCL モード（日本語プログラミング）

> **🆕 Smalruby 独自** — upstream に存在しない、Smalruby のために新規追加された機能

## 概要

Ruby タブで **日本語のプログラミング言語（DNCL モード）** を使えるようにする機能。`a = 1`, `if`, `while` ではなく `a ← 1`, `もし...ならば`, `を繰り返す` のように、英語キーワードを一切使わずにプログラムを書ける。

DNCL は大学入学共通テスト手順記述標準言語（DNCLv2）を参考にした日本語ベースの記法で、Smalruby ではこれを内部的に Ruby コードにトランスパイルしてから Scratch ブロックに変換して実行する。

```
DNCL コード → Ruby コード → Scratch ブロック → 実行
```

ブロック → Ruby → DNCL の逆方向変換にも対応しているため、ビジュアルブロックで作った作品を日本語コードで読むことも可能。

## ユーザーストーリー

- **小学校高学年**として、英語を覚えなくても本格的なプログラミングをしたい
- **共通テスト対策中の高校生**として、DNCL を実際に動くプログラムとして書いて練習したい
- **教師**として、英語キーワードに躓く生徒に「日本語でプログラミングできる」段階的な学習体験を提供したい
- **プログラミング初心者**として、`if (x > 0) { ... }` のような記号より「もし x > 0 ならば」のように母国語で読みたい

## UI / 操作フロー

Ruby タブの **ruby-toolbar** の「日本語(DNCL)」ボタン (`ruby-toolbar-mode-dncl`) で切替。

| モード | 表示内容 |
|---|---|
| Ruby | `if x > 0` |
| 日本語 (DNCL) | `もし x > 0 ならば` |

DNCL モードに切り替えると：
- Monaco Editor の言語定義が DNCL 用に切り替わる（シンタックスハイライト、補完）
- 既存の Ruby コードは自動的に DNCL 表記に変換されて表示される
- 編集後 Ruby に戻すと、DNCL 表記が Ruby に戻って表示される

DNCL モードと**ふりがな**は排他（DNCL 自体が日本語のためふりがな不要）。

## 主要ファイル

### scratch-gui

#### DNCL ↔ Ruby トランスパイラ

`packages/scratch-gui/src/lib/dncl/`:

| ファイル | 役割 |
|---|---|
| `dncl-to-ruby.js` | DNCL → Ruby 変換のエントリポイント |
| `dncl-line-converter.js` | 行単位の DNCL → Ruby 変換 |
| `dncl-identifier-converter.js` | 識別子（変数名）の変換 |
| `dncl-builtins.js` | DNCL 組み込み関数の定義（`表示する`, `入力する` など）|
| `dncl-keywords.js` | DNCL キーワード定義（`もし`, `ならば`, `を繰り返す` など）|
| `dncl-validator.js` | DNCL コードの構文検証 |
| `dncl-state.js` | パーサー状態管理 |
| `dncl-source-map.js` | DNCL 行 ↔ Ruby 行のマッピング（エラー位置表示用）|
| `dncl-block-filter.js` | DNCL モードで使えるブロックのフィルタ |
| `paren-utils.js` | 括弧解析ユーティリティ |
| `ruby-to-dncl.js` | Ruby → DNCL 逆変換のエントリポイント |
| `ruby-to-dncl-line-converter.js` | 行単位の Ruby → DNCL 変換 |
| `ruby-to-dncl-identifier.js` | 識別子の逆変換 |
| `ruby-to-dncl-builtins.js` | 組み込み関数の逆変換 |

#### Monaco Editor 言語定義

- `packages/scratch-gui/src/containers/ruby-tab/dncl-mode.js` — Monaco の DNCL 言語定義（トークナイザ、シンタックスハイライト）
- `packages/scratch-gui/src/containers/ruby-tab/dncl-snippets.js` — DNCL コード補完スニペット

#### UI / 状態管理

- `packages/scratch-gui/src/components/ruby-toolbar/ruby-toolbar.jsx` — DNCL モード切替ボタン
- `packages/scratch-gui/src/containers/ruby-tab.jsx` — DNCL モード state、エディタ切替制御
- `packages/scratch-gui/src/reducers/dncl-mode.js` — DNCL モードの Redux state
- `packages/scratch-gui/src/lib/locale-utils.js` — `isJapaneseLocale` (DNCL は日本語ロケール限定)

### scratch-vm

なし（GUI 側のトランスパイルで完結）。

### infra

なし。

## 関連ブロック

DNCL モードは特定のブロックに紐づくものではなく、**Ruby に変換できるすべてのブロックを DNCL でも書ける**。ただし dncl-block-filter.js により、DNCL モードでは表示しないブロック（class 定義など Ruby 高度機能）がある。

## 設定・データ永続化

### localStorage

- `smalruby:dnclMode` — DNCL モードのオン/オフ
  - 値が `'true'` のときのみ ON（デフォルト OFF）
  - 日本語以外のロケールでは無視される

### URL パラメータ

- `?rubyMode=dncl` または `?rubyMode=ja` または `?rubyMode=japanese` — DNCL モード強制 ON
- `?rubyMode=furigana` または `?rubyMode=ruby` — DNCL モード強制 OFF

## DNCLv2 との主な違い

Smalruby の DNCL モードは標準 DNCL（DNCLv2）と以下が異なる：

- **ブロック終端が日本語キーワード**（`を実行する`, `を繰り返す`, `と定義する`）。コロン `:` は使わない
- **条件分岐の末尾にコロンがない**（`もし 条件 ならば`）
- Scratch ブロックに変換されるため、**使える機能が Scratch の範囲に限定される**
- 変数に `@`, `$` プレフィックスは使えない（Ruby の変数記法は自動処理）

## 言語仕様

完全な構文・機能リストは **[`docs/smalruby-dncl-spec.ja.md`](../smalruby-dncl-spec.ja.md)** を参照。以下の要素を網羅：

- プログラム構造（文、コメント）
- 変数と代入
- リテラル（数値、文字列、真偽値、配列、ハッシュ）
- 演算子
- 制御構造（条件分岐、繰り返し）
- 関数定義
- DNCLv2 との違い

## テスト

- 単体テスト: `packages/scratch-gui/test/unit/lib/dncl/`
- 結合テスト: `packages/scratch-gui/test/integration/dncl-mode-validation.test.js`

## 関連ドキュメント

- [`docs/smalruby-dncl-spec.ja.md`](../smalruby-dncl-spec.ja.md) — DNCL 言語仕様完全版
- [`docs/ruby-editor/`](../ruby-editor/) — Ruby エディタ全般（DNCL の親機能）
- [`docs/furigana/`](../furigana/) — ふりがなモード（DNCL とは排他）

## 関連 Issue / PR

主要 PR は履歴を参照（`feat:.*dncl` で grep）。
