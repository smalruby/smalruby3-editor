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

## Step 2: Lint

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

## Step 3: Build

```bash
docker compose run --rm app npm run build:dev
```

- **Pass**: 次へ進む
- **Fail**: エラー内容を確認して修正

---

## Step 4: Unit Tests

```bash
docker compose run --rm app npm run test:unit
```

- **Pass**: 次へ進む
- **Fail**: `reference-test-patterns.md` を参照して修正

---

## Step 5: Integration Tests

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

## Step 6: CI Status Check

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
