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

### 1.4 リリースバージョン特定（Safety Gate）

**目的**: upstream/develop HEAD ではなく、scratch.mit.edu で実際にリリースされているバージョンまでマージする。
未リリースの機能（例: scratch-blocks v2.0.x）を誤って取り込むことを防止する。

> ⚠️ **develop-trap（バージョン誤認の常習犯・過去2回発生）**: 差分比較の基準は必ず
> **release タグ (`TARGET_COMMIT` = `v${SCRATCH_GUI_VERSION}`)** と recorded
> `lastMerge.upstreamCommit`。**ghq ローカルの `scratch-editor` `develop` は stale で
> scratch-blocks 1.3.0（pre-spork）を指すことがあり**、これを基準にすると「smalruby は
> v1.3.0 / `colour` が正しい」と誤判定する。手動 diff は `git fetch upstream tag v${VERSION}`
> 後の **タグ ref のみ** を使う。詳細・恒久ルール: `.claude/rules/upstream-tracking.md`。

#### 1.4.1 Production デプロイのコミットを取得

GitHub Deployments API で scratch-www の production デプロイを確認する:

```bash
PROD_SHA=$(gh api "repos/scratchfoundation/scratch-www/deployments?environment=production&per_page=1" \
  --jq '.[0].sha')
PROD_DATE=$(gh api "repos/scratchfoundation/scratch-www/deployments?environment=production&per_page=1" \
  --jq '.[0].created_at')
echo "Production deploy: ${PROD_SHA} (${PROD_DATE})"
```

#### 1.4.2 Production の scratch-gui バージョンを特定

scratch-www リポジトリが clone 済みの場合（推奨）:

```bash
SCRATCH_WWW_DIR="/Users/kouji/ghq/github.com/scratchfoundation/scratch-www"
if [ -d "$SCRATCH_WWW_DIR" ]; then
  cd "$SCRATCH_WWW_DIR" && git fetch origin 2>/dev/null
  SCRATCH_GUI_VERSION=$(git show ${PROD_SHA}:package.json | grep '"@scratch/scratch-gui"' | grep -o '[0-9][0-9.]*')
else
  # Fallback: GitHub API で取得
  SCRATCH_GUI_VERSION=$(gh api "repos/scratchfoundation/scratch-www/contents/package.json?ref=${PROD_SHA}" \
    --jq '.content' | base64 -d | grep '"@scratch/scratch-gui"' | grep -o '[0-9][0-9.]*')
fi
echo "Production scratch-gui version: ${SCRATCH_GUI_VERSION}"
```

#### 1.4.3 upstream scratch-editor のリリースタグとマッチング

```bash
# タグを fetch（特定タグのみ取得）
git fetch upstream tag v${SCRATCH_GUI_VERSION} --no-tags 2>/dev/null

# タグが存在するか確認
if git rev-parse "v${SCRATCH_GUI_VERSION}" >/dev/null 2>&1; then
  TARGET_COMMIT=$(git rev-parse "v${SCRATCH_GUI_VERSION}")
  echo "Release tag v${SCRATCH_GUI_VERSION} -> ${TARGET_COMMIT}"
else
  # Fallback: npm registry の gitHead フィールドから取得
  TARGET_COMMIT=$(npm view "@scratch/scratch-gui@${SCRATCH_GUI_VERSION}" gitHead 2>/dev/null)
  echo "npm gitHead for ${SCRATCH_GUI_VERSION} -> ${TARGET_COMMIT}"
fi
```

タグも npm gitHead も見つからない場合は **エラーとしてユーザーに報告し、手動でマージ対象を指定してもらう**。

#### 1.4.4 既にマージ済みかチェック

前回マージしたコミット (`lastMerge.upstreamCommit`) とリリースタグの関係を確認する:

```bash
LAST_MERGE_COMMIT=<lastMerge.upstreamCommit>

# リリースタグが前回マージの祖先かチェック
if git merge-base --is-ancestor ${TARGET_COMMIT} ${LAST_MERGE_COMMIT}; then
  echo "✅ v${SCRATCH_GUI_VERSION} は前回マージ (${LAST_MERGE_COMMIT}) に含まれています"
  ALREADY_MERGED=true
else
  ALREADY_MERGED=false
fi
```

**`ALREADY_MERGED=true` の場合**:

前回のマージで production リリースよりも先に進んでいる。以下をユーザーに報告する:

```
⚠️  リリースバージョン検証結果:
  scratch.mit.edu production: @scratch/scratch-gui v${SCRATCH_GUI_VERSION}
  前回マージ済み upstream commit: ${LAST_MERGE_COMMIT}

  Production リリース (v${SCRATCH_GUI_VERSION}) は既にマージ済みです。
  前回のマージで production より先の変更を取り込んでいます。

  upstream/develop HEAD にはさらに未リリースの変更があります:
  $(git log --oneline ${LAST_MERGE_COMMIT}..upstream/develop)

  推奨: production で新しいバージョンがリリースされるまでマージを待つ。

  (A) マージを中止する（推奨）
  (B) upstream/develop HEAD までマージする（未リリース変更を含む — 要注意）
```

選択 (A) の場合は **ワークフローを終了**する。

#### 1.4.5 develop HEAD との差分を確認

`ALREADY_MERGED=false` の場合のみ実行:

```bash
git fetch -p upstream develop
UNRELEASED_COUNT=$(git log --oneline ${TARGET_COMMIT}..upstream/develop | wc -l | tr -d ' ')
echo "upstream/develop is ${UNRELEASED_COUNT} commits ahead of release v${SCRATCH_GUI_VERSION}"
```

#### 1.4.6 ユーザーへの報告と選択

```
📋 リリースバージョン検証結果:
  scratch-www production deploy: ${PROD_SHA} (${PROD_DATE})
  Production の @scratch/scratch-gui: ${SCRATCH_GUI_VERSION}
  upstream scratch-editor タグ: v${SCRATCH_GUI_VERSION} (${TARGET_COMMIT})
  upstream/develop HEAD: $(git rev-parse --short upstream/develop) (リリースより ${UNRELEASED_COUNT} commits 先)

⚠️  upstream/develop には未リリースの変更が ${UNRELEASED_COUNT} commits あります:
$(git log --oneline ${TARGET_COMMIT}..upstream/develop)

マージ対象を選択してください:
  (A) v${SCRATCH_GUI_VERSION} までマージする（推奨 — production リリース済み）
  (B) upstream/develop HEAD までマージする（未リリース変更を含む — 要注意）
  (C) 中止する
```

選択結果を `$MERGE_TARGET` に保存する（`v${SCRATCH_GUI_VERSION}` または `upstream/develop`）。

**`$UNRELEASED_COUNT` が 0 の場合**: 選択肢を表示せず、自動的に upstream/develop をマージ対象とする。

### 1.7 Upstream差分確認

**重要**: `git fetch upstream` は絶対に使わない（gh-pages を含む全ブランチを取得してしまう）。

```bash
git log <lastMerge.upstreamCommit>..<MERGE_TARGET> --oneline --format="%h %s"
```

- 新しい commit 数を表示
- 最新10件の commit message を表示
- `postMergeReverts` がある場合、upstream の diff に revert 対象のファイル変更が含まれるか確認:
  ```bash
  git diff --name-only <lastMerge.upstreamCommit>..<MERGE_TARGET>
  ```
  `affectedAreas` のファイルと重複があれば報告する

### 1.8 ユーザー確認

- "X commits を merge します（target: `<MERGE_TARGET>`）。続行しますか？"
- Yes / No / View all commits の選択肢

---

## Step 2: Merge Branch Creation

```bash
DATE=$(date +%Y-%m)
git checkout -b feat/upstream-merge-$DATE
```

---

## Step 3: Merge Execution

`$MERGE_TARGET` は Step 1.4 で決定したマージ対象（例: `v12.7.0` または `upstream/develop`）。

```bash
git merge <MERGE_TARGET> --no-commit --no-ff
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
