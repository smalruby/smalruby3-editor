# /upstream:merge - Interactive Upstream Merge Workflow

半自動化されたupstream scratch-editor mergeワークフローを提供します。

## 使い方

```
/upstream:merge
```

対話型で段階的にmerge作業を進めます。

---

## Workflow

### Phase 1: Prerequisites Check

1. **Git状態確認**
   - Working directoryがcleanか確認
   - Current branchが`develop`か確認
   - Upstream remoteが設定されているか確認

2. **Merge履歴読み込み**
   - `.upstream-merge-history.json`を読み込み
   - 前回mergeのcommit IDを取得
   - ファイルが存在しない場合はエラー

3. **Upstream差分確認**
   ```bash
   git fetch -p upstream develop
   git log <lastMerge.upstreamCommit>..upstream/develop --oneline --format="%h %s"
   ```
   - 新しいcommit数を表示
   - 最新10件のcommit messageを表示

4. **ユーザー確認**
   - "X commits を merge します。続行しますか？"
   - Yes/No/View all commits の選択肢

5. **ドキュメント保存先確認**
   - デフォルト: `notes/upstream/merge-YYYY-MM/`
   - ユーザーにパスを確認・変更可能
   - ディレクトリ作成

---

### Phase 2: Merge Branch Creation

1. **ブランチ作成**
   ```bash
   DATE=$(date +%Y-%m)
   git checkout -b feat/upstream-merge-$DATE
   ```

2. **進捗管理ファイル初期化**
   - `<docs-dir>/progress.md` 作成
   - Timestamp, commit count, branch nameを記録

---

### Phase 3: Merge Execution

1. **Merge実行**
   ```bash
   git merge upstream/develop --no-commit --no-ff
   ```

2. **Conflict検出**
   ```bash
   git status --porcelain
   ```
   - `UU` で始まる行 = unmerged conflicts

3. **Known Conflicts ガイダンス表示**

   **gui.ts conflict検出時:**
   ```
   ✓ gui.ts conflict detected (EXPECTED)

   Resolution guide:
   1. Open: packages/scratch-gui/src/reducers/gui.ts
   2. Look for these markers:
      // === Smalruby: Start of Redux state registry ===
      import {smalrubyReducers, smalrubyInitialState} from './smalruby-registry';
      // === Smalruby: End of Redux state registry ===

   3. In buildInitialState(), keep:
      // === Smalruby: Start of initial state ===
      ...smalrubyInitialState,
      // === Smalruby: End of initial state ===

   4. In combineReducers(), keep:
      // === Smalruby: Start of reducers ===
      ...smalrubyReducers,
      // === Smalruby: End of reducers ===

   5. Accept all other upstream changes

   Reference: packages/scratch-gui/src/reducers/smalruby-registry.ts
   ```

   **extension-manager.js conflict検出時:**
   ```
   ✓ extension-manager.js conflict detected (EXPECTED)

   Resolution guide:
   1. Open: packages/scratch-vm/src/extension-support/extension-manager.js
   2. Look for these markers:
      // === Smalruby: Start of extension registration ===
      const registerSmalrubyExtensions = require('./smalruby-extensions');
      registerSmalrubyExtensions(builtinExtensions);
      // === Smalruby: End of extension registration ===

   3. Keep the Smalruby registration block
   4. Accept upstream changes for builtinExtensions object

   Reference: packages/scratch-vm/src/extension-support/smalruby-extensions.js
   ```

   **package-lock.json conflict検出時:**
   ```
   ✓ package-lock.json conflict detected (EXPECTED)

   Resolution:
   1. Accept upstream package.json completely
   2. Regenerate lock file:
      docker compose run --rm app npm install

   This will merge dependency trees correctly.
   ```

4. **Unexpected Conflicts警告**
   - Known conflicts以外が見つかった場合、**WARNING**表示
   - ファイルリストを表示
   - ユーザーに手動解決を促す

5. **Conflict解決待機**
   ```
   Conflicts to resolve:
   - [EXPECTED] packages/scratch-gui/src/reducers/gui.ts
   - [EXPECTED] packages/scratch-vm/src/extension-support/extension-manager.js
   - [WARNING]  packages/scratch-gui/src/components/unknown-file.jsx

   Resolve conflicts manually, then press Enter to continue...
   ```

6. **解決確認**
   - Enterキー押下後、`git status`で確認
   - まだconflictが残っている場合は警告

---

### Phase 4: Post-Merge Validation

#### Step 1: Commit Merge

1. **Merge commit作成**
   ```bash
   git add .
   git commit -m "feat: merge upstream scratch-editor changes (X commits)

   Merged X commits from upstream develop branch.

   Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
   ```

2. **Merge commit hash取得**
   - 後で`.upstream-merge-history.json`更新に使用

#### Step 2: Lint Check

1. **実行**
   ```bash
   docker compose run --rm app npm run lint
   ```

2. **結果判定**
   - **Pass**: 次へ進む
   - **Fail**: エラー内容表示 → ユーザーに修正を促す → 修正後Enter

3. **Lint通過後、Push推奨**
   ```
   ✓ Linting passed

   💡 Recommended: Push now to start CI in parallel

   Suggested command:
   git push -u origin feat/upstream-merge-YYYY-MM

   Push now? [Y/n]
   ```

   - Yesの場合: git pushを実行
   - Noの場合: 次へ進む（後でpush可能）

#### Step 3: Build Check

1. **実行**
   ```bash
   docker compose run --rm app npm run build:dev
   ```

2. **結果判定**
   - **Pass**: 次へ進む
   - **Fail**: エラー表示 → 修正待機

#### Step 4: Unit Tests

1. **実行確認**
   ```
   Run unit tests? (This may take 1-2 minutes)
   [Y/n/skip]
   ```

2. **実行**
   ```bash
   docker compose run --rm app npm run test:unit
   ```

3. **結果記録**
   - Pass/failをprogress.mdに記録
   - Failの場合は詳細をtest-results.mdに記録

#### Step 5: Integration Tests

1. **テスト選択**
   ```
   Run integration tests?
   [1] Smalruby-specific only (fast, ~30 sec) - RECOMMENDED
   [2] All tests (slow, ~5-10 min)
   [3] Skip (rely on CI)

   Choice:
   ```

2. **Smalruby-specific tests (option 1)**
   ```bash
   cd packages/scratch-gui
   npm exec jest test/integration/smalruby-tutorials.test.js
   npm exec jest test/integration/block-display-modal.test.js
   ```

3. **All tests (option 2)**
   ```bash
   docker compose run --rm app npm run test:integration
   ```

4. **結果記録**
   - progress.mdとtest-results.mdに記録

#### Step 6: CI Status Check

1. **CI URL表示**
   ```
   Check CI status:
   https://github.com/smalruby/smalruby3-editor/actions

   Are all CI checks passing? [Y/n/pending]
   ```

2. **選択肢**
   - **Y**: 次へ進む
   - **n**: CI failの詳細を記録、修正が必要
   - **pending**: 待機中、後で確認

---

### Phase 5: Documentation Generation

1. **conflict-resolutions.md 生成**
   ```markdown
   # Conflict Resolutions - YYYY-MM Upstream Merge

   ## Files with Conflicts

   ### Known Conflicts (Resolved)
   - [x] packages/scratch-gui/src/reducers/gui.ts
     - Resolution: Kept Smalruby registry pattern
   - [x] packages/scratch-vm/src/extension-support/extension-manager.js
     - Resolution: Kept Smalruby extension registration

   ### Unexpected Conflicts (Manual Resolution Required)
   - [x] packages/scratch-gui/src/components/unknown-file.jsx
     - Resolution: [User will describe]
   ```

   **ユーザーに確認:**
   - Unexpected conflictがあった場合、解決方法を入力してもらう

2. **test-results.md 生成**
   ```markdown
   # Test Results - YYYY-MM Upstream Merge

   ## Lint
   ✅ Passed

   ## Build
   ✅ Passed

   ## Unit Tests
   ✅ Passed (X tests, Y warnings)

   Warnings:
   - smalrubot_s1: unused variable 'e' (pre-existing)

   ## Integration Tests
   ✅ Passed (Smalruby-specific: 3/3)

   - smalruby-tutorials.test.js: 3/3 ✅
   - block-display-modal.test.js: 7/7 ✅

   ## CI Status
   ✅ All checks passed
   ```

3. **progress.md 更新**
   - 各ステップの完了時刻を記録
   - 最終status = "Completed"

---

### Phase 6: Merge History Update

1. **`.upstream-merge-history.json` 更新**
   ```json
   {
     "lastMerge": {
       "date": "2026-02-XX",
       "upstreamCommit": "<new_upstream_commit>",
       "smalrubyCommit": "<develop_commit_before_merge>",
       "mergeCommit": "<merge_commit_hash>",
       "notes": "X commits merged from upstream develop"
     },
     "previousMerges": [
       {
         "date": "2026-02-14",
         "upstreamCommit": "5f063605b67927f01647f56a8abf28b972a292bd",
         ...
       }
     ]
   }
   ```

2. **Commit and push**
   ```bash
   git add .upstream-merge-history.json
   git commit -m "chore: update upstream merge history"
   git push
   ```

---

### Phase 7: PR Creation

1. **PR body自動生成**
   ```markdown
   ## Summary

   Merged X commits from upstream scratch-editor `develop` branch.

   **Upstream Commit Range**: <prev_commit>..<new_commit>

   ## Major Upstream Changes

   [Top 10 commit messages from git log]

   ## Conflicts Resolved

   ### Known Conflicts
   - ✅ gui.ts - Kept Smalruby registry pattern
   - ✅ extension-manager.js - Kept Smalruby extension registration
   - ✅ package-lock.json - Regenerated with npm install

   ### Unexpected Conflicts
   [List if any]

   ## Test Results

   - ✅ Linting passed
   - ✅ Build succeeded
   - ✅ Unit tests: X/Y passed
   - ✅ Integration tests: Smalruby-specific (3/3 passed)
   - ✅ CI: All checks passing

   ## Documentation

   Merge documentation: `notes/upstream/merge-YYYY-MM/`

   ## Manual Testing Checklist

   Before merging this PR, verify:
   - [ ] Ruby code editor loads correctly
   - [ ] Ruby-to-blocks conversion works
   - [ ] Google Drive integration works
   - [ ] Custom extensions load (microbitMore, Koshien)
   - [ ] Block Display modal filters correctly
   - [ ] No console errors or warnings

   ---

   🤖 Generated with `/upstream:merge` command
   ```

2. **PR作成確認**
   ```
   Create PR now? [Y/n]

   Title: feat: upstream merge YYYY-MM (X commits)
   Base: develop
   Head: feat/upstream-merge-YYYY-MM
   ```

3. **PR作成**
   ```bash
   gh pr create \
     --repo smalruby/smalruby3-editor \
     --base develop \
     --head feat/upstream-merge-YYYY-MM \
     --title "feat: upstream merge YYYY-MM (X commits)" \
     --body-file /tmp/pr-body.md
   ```

4. **完了メッセージ**
   ```
   ✅ Upstream merge completed successfully!

   PR created: https://github.com/smalruby/smalruby3-editor/pull/XXX

   Next steps:
   1. Monitor CI: https://github.com/smalruby/smalruby3-editor/actions
   2. Review changes in PR
   3. Complete manual testing checklist
   4. Merge when ready

   Documentation: notes/upstream/merge-YYYY-MM/
   - progress.md
   - conflict-resolutions.md
   - test-results.md

   Merge history updated: .upstream-merge-history.json
   ```

---

## Error Handling

### Prerequisites Failure

```
✗ Prerequisites check failed

Issues:
- Working directory is not clean (3 modified files)
- Current branch is 'feature-branch' (expected: develop)

Fix these issues and run /upstream:merge again.
```

### Unresolved Conflicts

```
⚠ Conflicts still exist after resolution attempt

Files with unresolved conflicts:
- packages/scratch-gui/src/components/new-file.jsx

Run `git status` to see details.
Resolve manually, then run:
  git add .
  /upstream:merge --continue

(Note: --continue not implemented yet, just continue the workflow)
```

### Test Failure

```
✗ Integration tests failed

Failed tests:
- block-display-modal.test.js: "should filter blocks correctly" (timeout)

Options:
[1] View test output
[2] Skip and document (not recommended)
[3] Fix and re-run

Choice:
```

### CI Failure

```
⚠ CI checks are failing

Failed checks:
- Integration Tests (chromium): 2 tests failed
- Build (production): Webpack error

View logs: https://github.com/smalruby/smalruby3-editor/actions/runs/XXXXX

Continue with PR creation anyway? [y/N]
```

---

## Important Notes

- **Half-automated**: User intervention required for conflict resolution
- **Progress tracking**: All actions logged in notes/upstream/merge-YYYY-MM/
- **CI-parallel**: Recommended to push after lint to run CI in parallel
- **No auto-resolve**: Conflicts must be resolved manually following guidance
- **Revert-friendly**: All steps can be reverted with `git reset` or `git revert`

---

## Command Implementation

This command guides the user through the entire upstream merge workflow interactively,
providing clear instructions at each step and automatically generating documentation.
