# Phase 3: Validation — Commit + Lint + Build + Tests + CI

## Step 1: Merge Commit

**重要**: `git add .` は絶対に使わない。

```bash
# tracked files のみをステージング（.gitignore を尊重）
git add -u

# notes/ がステージングされていないことを確認
git status

# merge commit 作成
git commit -m "$(cat <<'EOF'
feat: merge upstream scratch-editor changes (X commits)

Merged X commits from upstream develop branch.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

merge commit の hash を記録しておく（Phase 4 で使用）。

---

## Step 2: Upstream Divergence Audit（取り落とし検査）

**背景**: git の 3-way merge は「過去に取り込み済みの upstream コードをローカルで変更（削除）した箇所」を尊重するため、ロールバックや restore コミットで upstream 修正を一度消すと、**以後どれだけ upstream merge を重ねても自動では戻らない**。実例: moveBlock の top-level shadow ガード（issue #710 / PR #717）は restore コミットで消えた後、upstream merge を経ても戻らず、ブロック全消失バグの根本原因になった。

マージ直後に、upstream 由来の重要ファイルが「説明のつく差分」だけを持つことを検査する:

```bash
# <upstream-ref> は今回マージした upstream コミット (例: upstream/develop の merge 時点 SHA)
bin/upstream-divergence-audit <upstream-ref>
```

- `OK` — upstream と一致。問題なし
- `DIFF` — 差分あり。**各 hunk をレビュー**する:
  ```bash
  git diff <upstream-ref> HEAD -- <file>
  ```
  すべての hunk が以下のどれかで説明できること:
  1. `=== Smalruby:` マーカーで囲まれた Smalruby 固有コード
  2. `.claude/rules/` 等に文書化された意図的な divergence（cherry-pick 済みの先行修正など）
  3. 今回のマージで意図的に解決した差分
- **説明のつかない hunk が見つかった場合**: upstream 修正の取り落とし（または upstream 領域へのローカルコードの混入）。原因を特定し、復元コミットを作成してから次へ進む

監査結果（DIFF ファイル一覧と各差分の説明）は PR 説明文に記載する。

curated リスト以外でコンフリクトが発生したファイルがあれば、それらも個別に監査する:

```bash
bin/upstream-divergence-audit <upstream-ref> <conflicted-file>...
```

---

## Step 3: Lint

```bash
docker compose run --rm app npm run lint
```

- **Pass**: 次へ進む
- **Fail**: エラー内容を確認して修正 → 再度 lint → 修正コミット

### Lint 通過後: Push 推奨

CI を並行実行するため、早めに push する:

```bash
git push -u origin feat/upstream-merge-YYYY-MM
```

PR も早めに作成すると CI が走る（Phase 4 の PR 作成を先にやってもよい）。

---

## Step 4: Build

```bash
docker compose run --rm app npm run build:dev
```

- **Pass**: 次へ進む
- **Fail**: エラー内容を確認して修正

---

## Step 5: Unit Tests

```bash
docker compose run --rm app npm run test:unit
```

- **Pass**: 次へ進む
- **Fail**: `reference-test-patterns.md` を参照して修正

---

## Step 6: Integration Tests

統合テストはタイムアウト回避のためバッチ実行する（5-6ファイルずつ）:

```bash
docker compose run --rm app bash -c "cd packages/scratch-gui && npm exec jest --no-coverage \
  test/integration/A.test.js \
  test/integration/B.test.js \
  test/integration/C.test.js"
```

全テストファイルを確認:
```bash
ls packages/scratch-gui/test/integration/*.test.js
ls packages/scratch-vm/test/integration/*.js
```

- **Pass**: 次へ進む
- **Fail**: `reference-test-patterns.md` を参照して修正

---

## Step 7: CI Status Check

push 済みなら CI の状態を確認:

```bash
gh run list --repo smalruby/smalruby3-editor --branch feat/upstream-merge-YYYY-MM
```

または: https://github.com/smalruby/smalruby3-editor/actions

- **All passing**: 次へ進む
- **Failing**: ログを確認して修正、push、再確認
- **Pending**: 待機中。次のフェーズに進んでもよい

### 既知の CI 注意点

- **"Lint commit messages" workflow**: upstream の commit message が 100 文字超えの場合に失敗する。
  これは想定内であり、ブロッカーではない。

---

## 次のフェーズ

全てのテストが通過 → `phase4-finalize.md` を読み込む
テスト修正が必要 → `reference-test-patterns.md` を読み込む
