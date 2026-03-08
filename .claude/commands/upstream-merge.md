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

---

### Phase 2: Merge Branch Creation

1. **ブランチ作成**
   ```bash
   DATE=$(date +%Y-%m)
   git checkout -b feat/upstream-merge-$DATE
   ```

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

   **blocks.jsx conflict検出時:**
   ```
   ✓ blocks.jsx conflict detected (EXPECTED)

   Resolution guide:
   1. Open: packages/scratch-gui/src/containers/blocks.jsx
   2. Keep all Smalruby additions:
      - Ruby tab logic (handleActivateRubyTab, etc.)
      - Smalruby extension integration
      - Block display modal integration
   3. Apply upstream ScratchBlocks API changes to Smalruby code too (see API Migration section)
   4. Check for new props/state destructuring patterns from upstream
   ```

   **eslint.config.mjs conflict検出時:**
   ```
   ✓ eslint.config.mjs conflict detected (EXPECTED)

   Resolution guide:
   1. Open: packages/scratch-gui/eslint.config.mjs (or root)
   2. Keep Smalruby-specific lint rules and overrides
   3. Accept upstream plugin migrations (e.g., eslint-plugin-import → import-x)
   4. Update any Smalruby rules that reference renamed plugins
      e.g., "import/core-modules" → "import-x/core-modules"
   ```

   **package.json conflict検出時:**
   ```
   ✓ package.json conflict detected (EXPECTED)

   Resolution guide:
   1. Keep @smalruby package naming (e.g., @smalruby/scratch-vm)
   2. Keep Smalruby-specific dependencies
   3. Accept upstream version bumps for shared dependencies
   4. Bump Smalruby package versions to match upstream major version
   5. Check if upstream added peer deps that Smalruby needs as direct deps
      (e.g., react, react-dom, redux may need to be added as direct dependencies)
   ```

   **package-lock.json conflict検出時:**
   ```
   ✓ package-lock.json conflict detected (EXPECTED)

   Resolution:
   1. Accept upstream package.json changes first
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

   **重要**: `git add .` は使わない。変更ファイルを明示的に指定する。
   `notes/` は `.gitignore` で除外されているが、`git add -f` や明示パス指定で
   追加されてしまうため、絶対にステージングしないこと。

   ```bash
   # conflictを解決したファイルと変更ファイルのみをadd
   # notes/ ディレクトリは絶対に含めない
   git add -u  # tracked files only (notes/ は .gitignore なので含まれない)
   git status   # notes/ が staged されていないことを確認

   git commit -m "feat: merge upstream scratch-editor changes (X commits)

   Merged X commits from upstream develop branch.

   Co-Authored-By: Claude <noreply@anthropic.com>"
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

3. **結果判定**
   - **Pass**: 次へ進む
   - **Fail**: 調査と修正 (→ 既知のパターンは後述)

#### Step 5: Integration Tests

1. **テスト選択**
   ```
   Run integration tests?
   [1] All tests in batches (recommended, ~5-10 min)
   [2] Skip (rely on CI)

   Choice:
   ```

2. **All tests (option 1)**

   統合テストはタイムアウトを避けるため、バッチで実行する:

   ```bash
   docker compose run --rm app bash -c "cd packages/scratch-gui && npm exec jest --no-coverage test/integration/A.test.js test/integration/B.test.js ..."
   ```

   5-6ファイルずつバッチに分けて実行すること。

3. **結果判定**
   - **Pass**: 次へ進む
   - **Fail**: 調査と修正 (→ 既知のパターンは後述)

#### Step 6: CI Status Check

1. **CI URL表示**
   ```
   Check CI status:
   https://github.com/smalruby/smalruby3-editor/actions

   Are all CI checks passing? [Y/n/pending]
   ```

2. **選択肢**
   - **Y**: 次へ進む
   - **n**: CI failの詳細を確認、修正が必要
   - **pending**: 待機中、後で確認

---

### Phase 5: Merge History Update

1. **`.upstream-merge-history.json` 更新**
   ```json
   {
     "lastMerge": {
       "date": "2026-XX-XX",
       "upstreamCommit": "<new_upstream_commit>",
       "smalrubyCommit": "<develop_commit_before_merge>",
       "mergeCommit": "<merge_commit_hash>",
       "notes": "X commits merged from upstream develop"
     },
     "previousMerges": [
       {
         "date": "2026-03-08",
         "upstreamCommit": "42ea882754e76aee1684a7ea2a6dcbb4b8ad1e22",
         ...
       }
     ]
   }
   ```

2. **Commit and push**

   **重要**: `.upstream-merge-history.json` のみを明示的に add する。

   ```bash
   git add .upstream-merge-history.json
   git commit -m "chore: update upstream merge history"
   git push
   ```

---

### Phase 6: PR Creation

1. **PR body自動生成**

   `/tmp/pr-body.md` に書き出す（Write toolを使用）:

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
   [他のconflictも記載]

   ### Unexpected Conflicts
   [List if any]

   ### Post-Merge Fixes
   [テスト修正、lint修正などがあれば記載]

   ## Test Results

   - ✅ Linting passed
   - ✅ Build succeeded
   - ✅ Unit tests passed
   - ✅ Integration tests passed
   - ✅ CI: All checks passing

   ## Manual Testing Checklist

   Before merging this PR, verify:
   - [ ] Ruby code editor loads correctly
   - [ ] Ruby-to-blocks conversion works
   - [ ] Google Drive integration works
   - [ ] Custom extensions load (microbitMore, Koshien, Mesh v2)
   - [ ] Gemini modal works
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

   rm /tmp/pr-body.md
   ```

4. **完了メッセージ**
   ```
   ✅ Upstream merge completed successfully!

   PR created: https://github.com/smalruby/smalruby3-editor/pull/XXX

   Next steps:
   1. Monitor CI: https://github.com/smalruby/smalruby3-editor/actions
   2. Review changes in PR
   3. Complete manual testing checklist (Playwright MCP recommended)
   4. Merge when ready (use --merge flag, NOT squash)

   Merge history updated: .upstream-merge-history.json
   ```

---

## ScratchBlocks API Migration Guide

upstream が scratch-blocks のメジャーバージョンを上げた場合、以下の API 変更が必要になることがある。
Smalruby のカスタムコード (blocks.jsx 等) にも同じ変更を適用すること。

### scratch-blocks v2.0.0 (spork) での変更例

| Before | After |
|--------|-------|
| `ScratchBlocks.prompt` | `ScratchBlocks.dialog.setPrompt()` |
| `ScratchBlocks.statusButtonCallback` | `ScratchBlocks.StatusIndicatorLabel.statusButtonCallback` |
| `ScratchBlocks.Xml.textToDom` | `ScratchBlocks.utils.xml.textToDom` |
| `ScratchBlocks.Xml.clearWorkspaceAndLoadFromXml` | `ScratchBlocks.clearWorkspaceAndLoadFromXml` |
| `this.workspace.reportValue()` | `this.ScratchBlocks.reportValue()` |

### CSS クラス名の変更

| Before | After |
|--------|-------|
| `.blocklyToolboxDiv` | `.blocklyToolbox` |

テストで CSS セレクタを使っている場合は更新が必要。

### DOM 構造の変更

scratch-blocks v2 ではブロックカテゴリのクリックターゲットが変わる場合がある。
テストで `clickText('カテゴリ名')` が失敗する場合は `clickBlocksCategory('カテゴリ名')` を使用する。

`clickBlocksCategory` は `test/helpers/selenium-helper.js` で定義されているヘルパー関数。

---

## Known Test Fix Patterns

upstream merge 後に頻出するテスト修正パターン。

### Integration Tests (scratch-gui)

1. **カテゴリクリックの失敗** (element click intercepted)
   - 原因: scratch-blocks v2 の DOM 構造変更
   - 修正: `clickText('カテゴリ名')` → `clickBlocksCategory('カテゴリ名')`

2. **CSS セレクタの不一致**
   - 原因: scratch-blocks v2 のクラス名変更
   - 修正: セレクタを新しいクラス名に更新 (例: `.blocklyToolboxDiv` → `.blocklyToolbox`)

3. **新しいヘルパー関数の import 不足**
   - 原因: upstream が selenium-helper に新しい関数を追加
   - 修正: テストファイルの import を更新

### Unit Tests (scratch-vm)

1. **タイミング依存テストの flakiness**
   - 原因: `setTimeout` や `Date.now()` に依存するテストが CI で不安定
   - 修正: `Date.now` と `Date` コンストラクタの両方をモックして決定的にする
   - 注意: `new Date().toISOString()` を使うコードでは `Date.now` だけでなく
     `Date` コンストラクタ自体もモックが必要

   ```javascript
   const realDateNow = Date.now;
   const RealDate = Date;
   let currentTime = realDateNow();
   Date.now = () => currentTime;
   Date = class extends RealDate {
       constructor (...args) {
           if (args.length === 0) {
               super(currentTime);
           } else {
               super(...args);
           }
       }
       static now () { return currentTime; }
   };
   try {
       // ... test code with controlled time ...
   } finally {
       Date = RealDate;
       Date.now = realDateNow;
   }
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
  git add <resolved-files>
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
- **notes/ は絶対にコミットしない**: `.gitignore` で除外済み。`git add .` や `git add -f` で追加しないこと
- **git add -u を使う**: `git add .` ではなく `git add -u` で tracked files のみをステージング
- **ファイル指定で add する**: merge history 更新時は `git add .upstream-merge-history.json` のみ
- **CI-parallel**: Recommended to push after lint to run CI in parallel
- **No auto-resolve**: Conflicts must be resolved manually following guidance
- **Revert-friendly**: All steps can be reverted with `git reset` or `git revert`
- **PRマージは --merge**: squash merge は禁止。`gh pr merge <number> --merge --delete-branch`

---

## Command Implementation

This command guides the user through the entire upstream merge workflow interactively,
providing clear instructions at each step and automatically generating documentation.

**注意**: ドキュメント (conflict-resolutions, test-results, progress) はPRの説明文に
直接記載する。リポジトリにファイルとしてコミットしない。
