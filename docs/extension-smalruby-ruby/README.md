# 拡張機能: Smalruby Ruby

> **🆕 Smalruby 独自** — upstream に存在しない、Smalruby のために新規追加された拡張機能

- **Smalruby ランタイム対応**: ❌（smalruby3 gem 側はそもそも Ruby 環境のため、本拡張に相当する API は Ruby 言語自体が提供）
- **デフォルト表示**: ✅（拡張機能ライブラリにデフォルトで表示される）

## 概要

**Ruby 言語の組み込みメソッド**（`String`, `Array`, `Hash` のメソッド）を Scratch ブロックとして提供する拡張機能。「`.upcase`」「`.length`」「`.each` { ... }」のような Ruby 標準メソッドを、ブロックでも書けるようにすることで、**ブロックと Ruby コードの間の表現力ギャップ**を埋める。

Ruby 経験者にとっては馴染みの深いメソッドが、ブロックプログラミングのみのユーザーにとっては「リスト操作」「文字列操作」の道具として提供される。

加えて以下の補助機能も提供：

- **戻り値ブロック**: メソッドからの戻り値を扱う仕組み（`returnValue`, `returnValueTruthy`）
- **ブロックパラメータ**: ブロック内で受け取る引数 (`_1`, `_2` ...) を取得する仕組み (`blockParam`)

## ユーザーストーリー

- **Ruby を学んでいる中高生**として、Ruby 標準ライブラリのメソッドをブロックでも使いたい
- **ブロックプログラマー**として、文字列を大文字化する／配列の各要素に処理を適用するなど、より高度な操作をブロックでもしたい
- **Smalruby ユーザー**として、Ruby コードでよく使う `.map`, `.each`, `.select`, `.upcase` のようなメソッドが Scratch ブロックでも使えると嬉しい
- **メソッド作成の練習中**として、メソッドが「戻り値」を持つ概念をブロックで実体験したい

## UI / 操作フロー

1. ブロックパレットの「拡張機能を追加」から **Ruby** を選ぶ
2. ブロックパレットに Ruby 拡張ブロックが表示される
3. データ（文字列・配列・ハッシュ）に対して **stringMethod / arrayMethod / hashMethod** ブロックを使ってメソッドを呼び出す
4. メソッドの戻り値は `returnValue` ブロックで取得
5. ブロック付きメソッド（`.each` 等）は **arrayMethodWithBlock / hashMethodWithBlock** を使い、ブロック内で `blockParam` で引数を参照

## 主要ファイル

### scratch-gui

- `packages/scratch-gui/src/lib/libraries/extensions/smalruby-ruby/` — 拡張機能登録（アイコン）
- `packages/scratch-gui/src/lib/ruby-generator/` — 各メソッドカテゴリの Ruby 生成（要追加調査）

### scratch-vm

- `packages/scratch-vm/src/extensions/smalruby_ruby/index.js` — 拡張機能本体
  - `_setReturnValue` / `_getReturnValue` — スレッドローカルな戻り値管理
  - `stringMethod`, `arrayMethod`, `hashMethod` — メソッド実行ディスパッチ
  - `arrayMethodWithBlock`, `hashMethodWithBlock` — ブロック付きメソッド
  - `blockParam` — ブロック内の引数取得 (`_1`, `_2` ...)
- `packages/scratch-vm/src/extensions/smalruby_ruby/translations.json` — i18n
- メソッド実装は別ファイルに分割（要追加調査: string-methods.js, array-methods.js, hash-methods.js 等）

### infra

なし。

## 関連ブロック（主要 opcode）

| opcode | 説明 |
|---|---|
| `stringMethod` | 文字列メソッド呼び出し（`upcase`, `length`, `split` など）|
| `arrayMethod` | 配列メソッド呼び出し（`length`, `first`, `last`, `reverse` など）|
| `arrayMethodWithBlock` | ブロック付き配列メソッド（`each`, `map`, `select` など）|
| `hashMethod` | ハッシュメソッド呼び出し |
| `hashMethodWithBlock` | ブロック付きハッシュメソッド |
| `returnValue` | メソッドの戻り値取得 |
| `returnValueTruthy` | 戻り値の真偽（Ruby 流: nil/false/'' のみ偽）|
| `blockParam` | ブロック内引数取得 (`_1`, `_2` ...) |

> 各ブロックの Ruby 表現は [`docs/smalruby-language-spec-extensions.ja.md`](../smalruby-language-spec-extensions.ja.md) を参照。

## Ruby のセマンティクスとの関係

- 戻り値は **スレッドローカル** (`util.thread._smalrubyReturnValue`) に保存される
- Ruby の真偽値判定（`nil`, `false`, 空文字を「偽」、それ以外を「真」）を `returnValueTruthy` で再現
- ブロック内引数 (`_1`, `_2`) は Ruby 2.7+ の Numbered Block Parameters を意識

## 設定・データ永続化

なし。

## テスト

- VM 単体テスト: `packages/scratch-vm/test/unit/extension_smalruby_ruby_each.js` ほか

## 関連ドキュメント

- [`docs/ruby-editor/`](../ruby-editor/) — Ruby ↔ Blocks 変換
- [`docs/smalruby-language-spec.ja.md`](../smalruby-language-spec.ja.md) — Smalruby Ruby 言語仕様
- [`docs/smalruby-language-spec-extensions.ja.md`](../smalruby-language-spec-extensions.ja.md) — 拡張機能の Ruby 表現
- `.claude/rules/scratch-gui/extension-ruby-policy.md` — 拡張機能の Ruby 対応方針

## 関連 Issue / PR

主要 PR は履歴を参照（`feat:.*ruby_extension|smalruby_ruby` で grep）。
