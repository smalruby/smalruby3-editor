# TryRuby 互換性作業ノート

## 概要

Ruby 公式サイトからリンクされている [TryRuby](https://try.ruby-lang.org/) の全56レッスンのサンプルコードを、スモウルビーの Ruby タブで入力してブロックに変換できるようにする作業。

- Issue: #524 (TryRuby 互換性), #529 (Ruby 拡張機能再設計)
- TryRuby ソース: `/Users/kouji/ghq/github.com/ruby/TryRuby`
- 日本語チュートリアル: `translations/ja/try_ruby_*.md` (56ファイル)

## 完了した作業

### マージ済み PR

| PR | 内容 |
|----|------|
| #525 | String#reverse 追加 |
| #526 | opcode リネーム (methodR/C) + 配列/ハッシュメソッド |
| #530 | **Ruby 拡張機能再設計** — クラス別 COMMAND + 戻り値ブロック |
| #531 | リファクタリング — 大ファイル分割 |
| #532 | String#* 文字列繰り返し |
| #533 | 裸のリテラル → 一時変数代入 |
| #534 | bang メソッド auto-split バグ修正 |
| #535 | 裸リテラル + hat/def/値ブロック リンクバグ修正 |
| #536 | べき乗演算子ガード条件修正 (`!value === 10` → `value !== 10`) |

### 現在のアーキテクチャ

Ruby 拡張機能は以下の5つの opcode で構成:

| opcode | 形状 | ブロックラベル |
|--------|------|-------------|
| `smalrubyRuby_stringMethod` | COMMAND | `文字列 ( ) . [▼]` |
| `smalrubyRuby_arrayMethod` | COMMAND | `配列 ( ) . [▼]` |
| `smalrubyRuby_hashMethod` | COMMAND | `ハッシュ ( ) . [▼]` |
| `smalrubyRuby_returnValue` | REPORTER | `(戻り値)` |
| `smalrubyRuby_returnValueTruthy` | BOOLEAN | `<戻り値が真?>` |

#### ファイル構成

**VM (scratch-vm):**
- `src/extensions/smalruby_ruby/index.js` — クラス定義, getInfo, 戻り値ブロック (~245行)
- `src/extensions/smalruby_ruby/block-definitions.js` — argumentsByMethod configs (~433行, データ)
- `src/extensions/smalruby_ruby/method-executors.js` — 実行ロジック (~224行)
- `src/extensions/smalruby_ruby/translations.json` — 翻訳

**GUI (scratch-gui):**
- `src/lib/ruby-to-blocks-converter/smalruby-ruby.js` — コンバーター register (~244行)
- `src/lib/ruby-to-blocks-converter/smalruby-ruby-definitions.js` — コンバーター定数データ (~367行)
- `src/lib/ruby-generator/smalruby-ruby.js` — ジェネレーター (~98行)
- `src/lib/ruby-to-blocks-converter/ast-handlers/expressions.js` — auto-split ロジック (70-84行)
- `src/lib/ruby-to-blocks-converter/index.js` — 裸リテラル変換 (137-170行)
- `src/lib/ruby-to-blocks-converter/ast-handlers/core.js` — イベントハンドラ内リテラル変換 (135-144行)

#### 主要な仕組み

1. **auto-split**: `say("hello".reverse)` → COMMAND(`stringMethod reverse`) + REPORTER(`returnValue`) に分割。expressions.js:70-84。bang メソッド(`!`付き)はスキップ。

2. **finishTargets インライン化**: ジェネレーター出力の後処理で `"hello".reverse\nsay(_rv_, 2)` → `say("hello".reverse, 2)` にインライン化。smalruby-ruby.js のジェネレーター内。

3. **裸リテラル変換**: `"Jimmy"` → `_lit_1_ = "Jimmy"` with `@ruby:literal:string` コメント。index.js:137-170 (トップレベル) + core.js:135-144 (イベントハンドラ内)。

4. **配列レシーバー変換**: 配列メソッド(`max`, `sort` 等)のレシーバーが list 変数の場合、`data_variable` → `data_listcontents` に変換。smalruby-ruby.js の `convertToListBlock`。

5. **ハッシュ keys/values**: ハッシュの keys/values は `__hash_X_keys__` / `__hash_X_values__` サブリストを参照。smalruby-ruby.js の `registerHashMethod`。

## 残りのタスク

### Issue #524 残り

| # | タスク | レッスン | 状態 |
|---|--------|---------|------|
| #3 | 配列リテラルのラウンドトリップ完全対応 | 110, 120 | TODO (変換はOK、RTが不完全) |

### Issue #529 残り

| # | タスク | レッスン | 難易度 | 備考 |
|---|--------|---------|--------|------|
| #11 | メソッド戻り値の boolean 条件判定 | 440 | 中 | ~~修正済み~~ `_processCondition` で returnValue → returnValueTruthy 変換 (PR #538) |
| #12 | `Hash.new(0)` | 450 | 中 | |
| #10 | `.times do \|i\|` ブロック引数付き | 300 | 中 | |
| #13 | `.each` イテレータ | 280 | 大 | SUBSTACK 制約 (拡張ブロック不可) |
| #14 | クラスの `attr_accessor` / `.new` | 470-550 | 大 | 範囲外 |

### 既知の制限/TODO

- **連続メソッド呼び出し消失**: ~~修正済み~~ `_processStatement` の linking を statement ブロックのみに限定 (PR #537)
- **非10べき乗**: `2 ** 8` はブロックに変換できない (Scratch に等価な演算子がない) — 対応不要
- **裸リテラルの順序**: ジェネレーターのブロックソートにより、裸リテラルは hat/def の後に出力される — 対応不要

### 別 Issue

- **#542**: Ruby 拡張機能ブロックのアイコンが正しくない + blockIconURI 外部ファイル化（コミット `a3f8ab1d61` で壊れた）

## Playwright テスト結果 (smalruby.app)

65件テスト実行:
- ✅ 57件 OK
- ❌ 5件 デグレ → 全修正済み (#534, #535, #536)
- ❌ 3件 既存の挙動 (括弧追加/消失 — 許容)

### テスト実行方法

```javascript
// smalruby.app で UI ベースのラウンドトリップテスト
window._batchRt = async (tests) => { /* ... */ };
// 各テストは: Ruby tab でコード設定 → Code tab クリック → Ruby tab クリック → 結果確認
```

## 注意点

1. **翻訳の仕組み**: VM の `setupTranslations` は `formatMessage.setup()` の既存翻訳に `Object.assign` でマージする (koshien パターン)。`default` 値は英語にすること。

2. **Prettier**: 新ファイル追加時は `.prettierignore` の更新が必要。ただし `ruby-to-blocks-converter/` や `smalruby_ruby/` はディレクトリ単位でホワイトリスト済み。

3. **テスト**: Docker 内で実行。`docker compose run --rm app bash -c "cd packages/scratch-gui && npm exec jest --no-coverage test/unit/lib/ruby-roundtrip/smalruby-ruby.test.js"`

4. **CI の Prettier 失敗**: scratch-vm のテストファイルは Prettier 対象。CI で失敗したら `npx prettier --write` で修正。

5. **auto-split の注意**: bang メソッド (`!` 付き) は auto-split しない (expressions.js:78 のガード)。新メソッド追加時に COMMAND/REPORTER の区別を意識すること。

6. **`_isRubyBlock` チェック**: `ruby_` prefix のブロックのみリジェクト。`smalrubyRuby_` prefix は対象外 (index.js:173)。
