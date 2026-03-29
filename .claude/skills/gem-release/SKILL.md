---
name: gem-release
description: "Build and release the smalruby3 gem to RubyGems. Handles version bump, gem build, and push."
argument-hint: "[version e.g. 26.31.291]"
---

# /gem-release - smalruby3 gem リリース

smalruby3 gem をビルドして RubyGems に公開する。

## 引数

- `$ARGUMENTS` — リリースバージョン（例: `26.31.291`）

バージョン未指定の場合は `ruby/smalruby3/lib/smalruby3/version.rb` の現在のバージョンを使用する。

## バージョニング: YY.MR.DDR

| フィールド | 意味 | 例 |
|-----------|------|-----|
| YY (MAJOR) | 年の下2桁 | 26 = 2026 |
| MR (MINOR) | 月 × 10 + 月内リリース番号 | 31 = 3月1回目 |
| DDR (PATCH) | 日 × 10 + 日内リリース番号 | 291 = 29日1回目 |

## 手順

### Step 1: バージョン確認・更新

1. `ruby/smalruby3/lib/smalruby3/version.rb` の現在のバージョンを読む
2. 引数でバージョンが指定されている場合:
   - `version.rb` を更新する
   - YY.MR.DDR 形式であることを検証する
3. 引数がない場合:
   - 現在のバージョンをそのまま使用する
   - ユーザーに確認: 「バージョン X.XX.XXX でリリースしますか？」

### Step 2: テスト・lint

```bash
docker compose run --rm smalruby3 bash -c "bundle exec standardrb && bundle exec rake test"
```

テストが失敗した場合はリリースを中止する。

### Step 3: gem ビルド

```bash
cd ruby/smalruby3
gem build smalruby3.gemspec
```

ビルド成功を確認し、`gem specification smalruby3-VERSION.gem` で metadata を表示する。

### Step 4: ユーザーに最終確認

以下を表示してユーザーに確認を求める:
- バージョン
- gem ファイル名
- gem に含まれるファイル数
- 依存関係

「`gem push` を実行してよいですか？」と確認する。

### Step 5: gem push

**IMPORTANT**: この手順はユーザーの明示的な承認後のみ実行する。

```bash
cd ruby/smalruby3
gem push smalruby3-VERSION.gem
```

初回は認証情報の入力が必要。ユーザーに `! gem push smalruby3-VERSION.gem` の実行を案内する（インタラクティブ認証が必要なため）。

### Step 6: タグ付け・コミット・プッシュ

1. バージョン更新がある場合はコミット:
   ```bash
   git add ruby/smalruby3/lib/smalruby3/version.rb
   git commit -m "release: smalruby3 vVERSION"
   ```

2. タグを作成:
   ```bash
   git tag smalruby3-vVERSION
   ```

3. プッシュ:
   ```bash
   git push origin HEAD
   git push origin smalruby3-vVERSION
   ```

### Step 7: 完了報告

- RubyGems の URL: https://rubygems.org/gems/smalruby3/versions/VERSION
- タグ: `smalruby3-vVERSION`
- 次回リリース時のバージョン例を提示
