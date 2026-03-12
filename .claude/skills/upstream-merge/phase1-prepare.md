# Phase 1: Prepare — Prerequisites + Branch Creation + Merge Execution

## Step 1: Prerequisites Check

### 1.1 Git状態確認

```bash
git status
git branch --show-current
git remote -v | grep upstream
```

- Working directory が clean であること
- Current branch が `develop` であること
- Upstream remote が設定されていること

未設定の場合:
```bash
git remote add upstream https://github.com/scratchfoundation/scratch-editor.git
```

### 1.2 Merge履歴読み込み

`.upstream-merge-history.json` を読み込み、前回 merge の commit ID を取得する。
ファイルが存在しない場合はエラー。

### 1.3 Post-Merge Reverts 確認

`postMergeReverts` 配列が存在する場合、**revert された変更がある**ことを意味する。

ユーザーに以下を報告し、方針を確認する:

```
⚠️  前回の upstream merge 後に revert された変更があります:

  - scope: <scope>
  - reason: <reason>
  - affected: <N> ファイル (<categories>)

次回 merge ガイダンス:
  <nextMergeGuidance>

以下のどちらの方針で進めますか？
  (A) upstream の変更を受け入れて revert を解消する（upstream 側で問題が修正済みの場合）
  (B) 引き続き revert を維持する（upstream 側で問題が未解決の場合）
```

選択された方針を Phase 2 で使用する。

### 1.4 Upstream差分確認

**重要**: `git fetch upstream` は絶対に使わない（gh-pages を含む全ブランチを取得してしまう）。

```bash
git fetch -p upstream develop
git log <lastMerge.upstreamCommit>..upstream/develop --oneline --format="%h %s"
```

- 新しい commit 数を表示
- 最新10件の commit message を表示
- `postMergeReverts` がある場合、upstream の diff に revert 対象のファイル変更が含まれるか確認:
  ```bash
  git diff --name-only <lastMerge.upstreamCommit>..upstream/develop
  ```
  `affectedAreas` のファイルと重複があれば報告する

### 1.5 ユーザー確認

- "X commits を merge します。続行しますか？"
- Yes / No / View all commits の選択肢

---

## Step 2: Merge Branch Creation

```bash
DATE=$(date +%Y-%m)
git checkout -b feat/upstream-merge-$DATE
```

---

## Step 3: Merge Execution

```bash
git merge upstream/develop --no-commit --no-ff
```

### Conflict検出

```bash
git status --porcelain
```

- `UU` で始まる行 = unmerged conflicts
- conflict がある場合は **Phase 2** (`phase2-conflicts.md`) を読み込んで解決する
- conflict がない場合は **Phase 3** (`phase3-validation.md`) に進む

---

## 次のフェーズ

- コンフリクトあり → `phase2-conflicts.md` を読み込む
- コンフリクトなし → `phase3-validation.md` を読み込む
