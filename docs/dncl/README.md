# DNCL モード（日本語プログラミング）

> **🆕 Smalruby 独自** — upstream に存在しない、Smalruby のために新規追加された機能

## 概要

Ruby タブで **日本語のプログラミング言語（DNCL モード）** を使えるようにする機能。`a = 1`, `if`, `while` ではなく `a ← 1`, `もし...ならば`, `を繰り返す` のように、英語キーワードを一切使わずにプログラムを書ける。

DNCL は大学入学共通テスト手順記述標準言語（DNCLv2）を参考にした日本語ベースの記法で、Smalruby ではこれを内部的に Ruby コードにトランスパイルしてから Scratch ブロックに変換して実行する。

```
DNCL コード → (DNCLv2 pre-processor) → Smalruby DNCL → Ruby コード → Scratch ブロック → 実行
```

**DNCLv2 互換**: 共通テスト 例題サイト（[nodai2hitc.github.io/ictl_example](https://nodai2hitc.github.io/ictl_example/)）で公開されている DNCLv2 形式のプログラムを **そのままコピペして実行** できる。`(N) ` 行番号、`｜` / `⎿` インデントマーカー、`もし ... ならば:` 末尾コロン、`の間繰り返す:` / `増やしながら繰り返す:` 形式、`hidari = 0 , migi = kazu - 1` のような同一行複数代入、`and` / `or`、`NAME(ARGS) を定義する` 形式の関数定義などをサポート。詳細は「DNCLv2 互換」セクション参照。

ブロック → Ruby → DNCL の逆方向変換にも対応しているため、ビジュアルブロックで作った作品を日本語コードで読むことも可能（turn-around 後は Smalruby DNCL 形式に正規化される）。

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
| `dncl-to-ruby.js` | DNCL → Ruby 変換のエントリポイント（pre-processor → validator → line converter） |
| `dncl-v2-preprocessor.js` | **DNCLv2 → Smalruby DNCL 正規化**（行番号、コロン、`｜` / `⎿`、複数代入、`and` / `or`、関数定義 opener） |
| `dncl-line-converter.js` | 行単位の DNCL → Ruby 変換 |
| `dncl-identifier-converter.js` | 識別子（変数名）の変換 |
| `dncl-builtins.js` | DNCL 組み込み関数の定義（`表示する`, `要素数` など）。`表示する` 多引数は `puts(... + ...)` に展開 |
| `dncl-keywords.js` | DNCL キーワード定義（`もし`, `ならば`, `を繰り返す` など）|
| `dncl-validator.js` | DNCL コードの構文検証 |
| `dncl-state.js` | パーサー状態管理 |
| `dncl-source-map.js` | DNCL 行 ↔ Ruby 行のマッピング（エラー位置表示用）|
| `dncl-block-filter.js` | DNCL モードで使えるブロックのフィルタ |
| `paren-utils.js` | 括弧解析ユーティリティ |
| `ruby-to-dncl.js` | Ruby → DNCL 逆変換のエントリポイント |
| `ruby-to-dncl-line-converter.js` | 行単位の Ruby → DNCL 変換 |
| `ruby-to-dncl-identifier.js` | 識別子の逆変換 |
| `ruby-to-dncl-builtins.js` | 組み込み関数の逆変換。`puts(... + ...)` の左寄せ `+` チェーンを `表示する(...)` 多引数にフラット化（display fragment 限定） |

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

## Block ↔ Ruby ↔ DNCL の変換マトリクス

Smalruby の Ruby タブは **3 つのモード** (Ruby / DNCL / ふりがな) を切り替えられ、それぞれが内部の Ruby 表現を異なる形式で表示します。さらに **Scratch ブロックタブ** とも双方向変換します。

ほとんどの構文は **3 方向すべてが round-trip 安定** ですが、いくつかの **意図的に不可逆な変換** があり、設計の根拠とともに本セクションで明示します。

### `表示する` (display) の変換マトリクス

| 方向 | 変換結果 | 備考 |
|---|---|---|
| Block `looks_sayforsecs(msg, n)` → **Ruby** | `say(msg, n)` | 秒数を保持 |
| Block `looks_sayforsecs(msg, n)` → **DNCL** | `表示する(msg)` | **秒数 n は無視** |
| **DNCL** `表示する(args)` → Ruby | `puts(args)` | **不可逆: `say` には戻さない** |
| **DNCL** `表示する(args)` → Block | `looks_sayforsecs(...)` + `@ruby:method:puts` コメント + secs=1 | Ruby に戻すと `puts(args)` |

### 不可逆な変換とその理由

#### 1. Block `say(msg, n)` → DNCL `表示する(msg)` （秒数喪失）

**理由**: DNCL は「Console に値を表示する」という抽象的な操作を表現する言語で、秒数 (Scratch の吹き出し表示時間) は概念として持っていません。

**結果**: Block で秒数を 2 にしても DNCL では `表示する(msg)` (秒数情報なし) になり、再度 Ruby/Block に戻すと **秒数は 1 (デフォルト)** にリセットされます。

#### 2. DNCL `表示する` → Ruby `puts` （`say` には戻さない）

**理由**: `puts` の方が「Console に出力する」という意味に近く、DNCL の `表示する` のセマンティクスと一致します。`say` は Scratch の吹き出し演出を含むため、DNCL の純粋な「表示」とは概念的に異なります。

**結果**: 一度 DNCL モードを経由した `say(msg, n)` は **`puts(msg)` に変換されたまま戻らない**。秒数情報も失われます。

これは「DNCL モードに切り替えると、その時点でブロックが『表示する』ブロックに正規化される」という設計意図を反映した仕様で、教育的な観点で「DNCL 的な書き方」に揃えるためのものです。

### 変換マトリクスを lock-in するテスト

このマトリクスを保証する単体テスト: `packages/scratch-gui/test/unit/lib/dncl/dncl-say-block-roundtrip.test.js`

## DNCLv2 互換

Smalruby は **DNCLv2 形式のプログラムをそのまま実行** できる。これは「pre-processor が DNCLv2 構文を Smalruby DNCL に正規化してから既存パイプラインに流す」設計で実現している（`dncl-v2-preprocessor.js`）。

### 対応する DNCLv2 構文

| DNCLv2 構文 | 例 | 正規化後 |
|---|---|---|
| 行番号 | `(1) Data = [1, 2, 3]` | `Data = [1, 2, 3]` |
| 末尾コロン | `もし a > 0 ならば:` | `もし a > 0 ならば` |
| `の間繰り返す` | `a > 0 の間繰り返す:` | `a > 0 の間` |
| `増やしながら繰り返す` | `i を ... 増やしながら繰り返す:` | `i を ... 増やしながら` |
| `減らしながら繰り返す` | `i を ... 減らしながら繰り返す:` | `i を ... 減らしながら` |
| インデントマーカー (`｜`) | `  ｜ a = 1` | `  a = 1`（2 スペース/marker） |
| 暗黙の `end` (`⎿`) | `  ⎿ a = 1` (1 marker) | `  a = 1` + 自動で `を実行する` 追加 |
| 同一行複数 `⎿` | `  ⎿  ⎿ a = 1` | 2 個の `end` を一度に追加 |
| 同一行複数代入 | `a = X , b = Y` | 2 行に分割 |
| `and` / `or` | `a > 0 and b == 1` | `a > 0 かつ b == 1` |
| 関数定義 | `calc(x) を定義する:` | `関数 calc(x)` |
| `表示する` 多引数 | `表示する(a, "は", b)` | `puts(@a.to_s + "は" + @b.to_s)`（1 つの吹き出し）|

### 対応しない DNCLv2 機能

以下は **未対応**（必要なら別 issue で対応）:

- `要素数 N の配列 A` 形式の配列宣言
- `変数 に 式 を入れる` 形式の自然言語代入
- 全角ブラケット `［］`

### Smalruby 独自の差分

- **ブロック終端が日本語キーワード**（`を実行する`, `を繰り返す`, `と定義する`）。turn-around 後はこの形式に正規化される
- Scratch ブロックに変換されるため、**使える機能が Scratch の範囲に限定される**
- 変数に `@`, `$` プレフィックスは使えない（Ruby の変数記法は自動処理）

### 動作確認用例題

完全な DNCLv2 例題（線形探索）の round-trip テスト: `test/unit/lib/dncl/dncl-v2-example.test.js`

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
  - `dncl-v2-preprocessor.test.js` — DNCLv2 正規化テスト（53 cases）
  - `dncl-v2-example.test.js` — DNCLv2 例題の end-to-end 変換テスト
  - `dncl-display-multi-arg.test.js` — `表示する` 多引数 / `puts(... + ...)` round-trip
  - `dncl-to-ruby.test.js` — DNCL → Ruby 変換ユニットテスト
  - `ruby-to-dncl.test.js` — Ruby → DNCL 逆変換ユニットテスト
  - `dncl-roundtrip.test.js` — DNCL ↔ Ruby round-trip 安定性
- Round-trip テスト (左結合演算子の括弧除去): `packages/scratch-gui/test/unit/lib/ruby-roundtrip-puts-concat.test.js`
- 結合テスト: `packages/scratch-gui/test/integration/dncl-mode-validation.test.js`

## 関連ドキュメント

- [`docs/smalruby-dncl-spec.ja.md`](../smalruby-dncl-spec.ja.md) — DNCL 言語仕様完全版
- [`docs/ruby-editor/`](../ruby-editor/) — Ruby エディタ全般（DNCL の親機能）
- [`docs/furigana/`](../furigana/) — ふりがなモード（DNCL とは排他）

## 関連 Issue / PR

主要 PR は履歴を参照（`feat:.*dncl` で grep）。
