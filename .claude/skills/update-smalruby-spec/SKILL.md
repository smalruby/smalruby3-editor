---
name: update-smalruby-spec
description: smalruby言語仕様の変更を関連ファイル（language-spec、gemini-context、smalruby-mode）に反映する。新機能実装や構文変更の後に使う。
argument-hint: "[Issue番号 or ファイルパス or 更新内容の説明]"
disable-model-invocation: true
---

# /update-smalruby-spec - smalruby言語仕様の更新ワークフロー

`$ARGUMENTS` の内容に基づいて、smalruby言語仕様に関連する以下の3ファイルを更新する。

## 更新対象ファイル

| ファイル | 役割 |
|---|---|
| `packages/scratch-gui/docs/smalruby-language-spec.md` | smalruby言語の正式な仕様ドキュメント |
| `packages/scratch-gui/src/lib/gemini-context.js` | スモウルビー先生（Gemini AI）のシステムプロンプト |
| `packages/scratch-gui/src/containers/ruby-tab/smalruby-mode.js` | Monaco Editorのシンタックスハイライト・補完定義 |

## Phase 1: 情報収集

### 1-1. 更新内容の確認

- `$ARGUMENTS` が GitHub Issue 番号の場合:
  ```bash
  gh issue view <NUMBER> --repo smalruby/smalruby3-editor
  ```
- `$ARGUMENTS` がファイルパスの場合: そのファイルを読んで変更内容を把握する
- `$ARGUMENTS` がテキストの場合: それをベースにする
- `$ARGUMENTS` が空の場合は質問する:
  ```
  どのような言語仕様の変更を反映しますか？
  Issue番号、ファイルパス、または変更内容のテキストを教えてください。
  ```

### 1-2. 実装コードの確認

言語仕様の変更が実際にコードベースに実装されていることを確認する:

- `packages/scratch-gui/src/lib/ruby-to-blocks-converter/` — Ruby→ブロック変換
- `packages/scratch-gui/src/lib/ruby-generator/` — ブロック→Ruby生成
- 関連するテストファイル

Serenaの `find_symbol`、`get_symbols_overview`、`search_for_pattern` を使って効率的に調査する。

### 1-3. 現在のファイル状態の確認

3つの更新対象ファイルの現在の内容を読み、更新が必要な箇所を特定する。

---

## Phase 2: 更新計画の提示

更新内容をユーザーに提示し、承認を得る:

```
以下の更新を行います:

### smalruby-language-spec.md
- [変更点1]
- [変更点2]

### gemini-context.js
- [変更点1]
- [変更点2]

### smalruby-mode.js
- [変更点1]
- [変更点2]

この内容でよいですか？
```

ユーザーの明示的な承認を得てから Phase 3 へ進む。

---

## Phase 3: ファイルの更新

### 3-1. smalruby-language-spec.md の更新

言語仕様ドキュメントを更新する。以下の点に注意:

- **対応構文セクション**: 新しい構文やメソッドを追加、または既存の記述を修正
- **サポートされていないRuby構文セクション**: 新たにサポートした構文を削除
- **よくある間違いセクション**: 該当する場合は修正
- **メソッド一覧**: 新しいメソッドやパラメータの変更を反映
- コード例を含める

### 3-2. gemini-context.js の更新

スモウルビー先生のシステムプロンプトを更新する。以下の点に注意:

- **「Rubyとの主な違い」セクション**: 構文の制限事項の追加・削除
- **「利用可能なメソッド」セクション**: メソッドの追加・修正
- **「絶対に使ってはいけないメソッド」セクション**: 誤って禁止していたメソッドの削除、新たに禁止すべきメソッドの追加
- **サンプルプログラム**: 必要に応じて新しい構文を使ったサンプルを追加
- プロンプトは簡潔に。smalruby-language-spec.md ほど詳細でなくてよい

### 3-3. smalruby-mode.js の更新

Monaco Editorのシンタックスハイライト定義を更新する。以下の点に注意:

- **smalrubyMethods**: 実際のsmalrubyメソッド名と一致させる（ruby-to-blocks-converter と ruby-generator のコードが正）
- **smalrubyConstants**: `Keyboard`, `Mouse`, `Timer`, `Time`, `Math`, `Pen` などのクラス/定数名
- **operators**: 新しい演算子の追加
- **keywords**: Ruby キーワード（通常変更不要）
- メソッド名はカテゴリごとにコメントで整理する

---

## Phase 4: テストとリントの実行

### 4-1. リント

```bash
docker compose run --rm app bash -c "cd packages/scratch-gui && npm exec eslint src/lib/gemini-context.js src/containers/ruby-tab/smalruby-mode.js"
```

### 4-2. 関連ユニットテスト

```bash
# gemini-context のテスト
docker compose run --rm app bash -c "cd packages/scratch-gui && npm exec jest test/unit/lib/gemini-context.test.js"

# gemini-api のテスト（gemini-context を使用）
docker compose run --rm app bash -c "cd packages/scratch-gui && npm exec jest test/unit/lib/gemini-api.test.js"
```

### 4-3. 全ユニットテスト

```bash
docker compose run --rm app npm run test:unit
```

テストが失敗した場合は修正してから再実行する。

---

## Phase 5: コミットと報告

### 5-1. コミット

```bash
git add packages/scratch-gui/docs/smalruby-language-spec.md \
       packages/scratch-gui/src/lib/gemini-context.js \
       packages/scratch-gui/src/containers/ruby-tab/smalruby-mode.js

git commit -m "$(cat <<'EOF'
docs: update smalruby language spec for <変更内容の要約>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

### 5-2. 報告

更新結果を日本語で報告する:
- 変更した3ファイルの更新内容の概要
- DoD の各項目の達成状況
- テスト結果

---

## DoD（完了の定義）

- [ ] `smalruby-language-spec.md` が実装に合わせて更新されている
- [ ] `gemini-context.js` が言語仕様の変更を反映している
- [ ] `smalruby-mode.js` のメソッドリスト・演算子リストが実際のコードベースと一致している
- [ ] 「サポートされていないRuby構文」セクションに、新たにサポートした構文が残っていない
- [ ] 「絶対に使ってはいけないメソッド」セクションに、新たにサポートした構文が残っていない
- [ ] スモウルビー先生のコード生成に関するテスト（`gemini-context.test.js`、`gemini-api.test.js`）がパスする
- [ ] リントがエラーなく完了する
- [ ] 全ユニットテストがパスする

---

## 参考: 整合性チェックの方法

3つのファイル間の整合性を確認するために、以下を活用する:

1. **実装コードが正**: `ruby-to-blocks-converter/` と `ruby-generator/` のコードが、実際に対応している構文とメソッドの正確なリスト
2. **smalruby-language-spec.md**: 実装コードの内容を正式にドキュメント化したもの
3. **gemini-context.js**: smalruby-language-spec.md の要約版（Gemini AI 向け）
4. **smalruby-mode.js**: 実装コードのメソッド名リストをそのまま反映したもの
