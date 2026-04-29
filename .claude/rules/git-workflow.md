# Git Workflow and Version Control

## Branching Strategy

- **Default branch**: `develop` (NOT `main`)
- **NEVER commit directly to `develop`**
- Create feature branches from `develop`:
  - `feature/descriptive-name` - for new features
  - `fix/issue-description` - for bug fixes
  - `refactor/component-name` - for refactoring
  - `docs/update-readme` - for documentation updates
  - `test/add-coverage` - for test additions
- All Pull Requests must target `develop` branch

## Git Worktree Setup

Sibling worktrees (e.g. `~/work/smalruby/smalruby3-editor-<feature>/`) are
recommended for parallel development. The compose project name is pinned to
`smalruby3-editor`, so `docker compose run` and `bin/dx` from a worktree share
the main checkout's image and `node_modules` named volume — no rebuild needed.

### Creating a worktree

**推奨**: `bin/setup-worktree` を一度実行するだけで、env ファイルのコピー、
node_modules のセットアップ、ワークスペースパッケージのビルドまで一括で
完了する。

```bash
git worktree add ../smalruby3-editor-<feature> -b <type>/<branch-name> develop
cd ../smalruby3-editor-<feature>
bin/setup-worktree   # all-in-one setup: env + node_modules + dist/
```

**最小限のセットアップだけしたい場合**（lint だけ走らせたい、テストは
動かさないなど）は `bin/sync-worktree-env` を直接呼んでも良い。

### Why setup is required beyond `git worktree add`

`git worktree add` は **gitignore された / build artifact なファイルを
コピーしない**。以下が手動で必要になる:

| 何が無い | 必要になる場面 | 解決方法 |
|---------|-------------|---------|
| `.env`, `infra/*/.env.*` | webpack build / CDK deploy / mesh v2 integration test | `bin/sync-worktree-env` |
| host 側 `node_modules` symlink | husky の commit-msg hook（`npx --no-install commitlint`） | `bin/sync-worktree-env` |
| `packages/*/node_modules` (per-package) | jest の workspace 依存解決（例: `scratch-blocks` は scratch-gui の local node_modules にある） | `npm install`（docker 経由） |
| `packages/scratch-vm/dist/`, `packages/scratch-svg-renderer/dist/`, `packages/scratch-render/dist/` | jest が `@smalruby/scratch-vm` 等の bare package import を解決するときに `package.json` の `"main"` / `"exports"` が指す `dist/...` を読む | `npm run build:dev`（docker 経由） |

`bin/setup-worktree` は上記 4 ステップを順に実行する。

### What `bin/sync-worktree-env` does (低レベル)

`bin/sync-worktree-env` だけを使う場合は以下のみ実行される:

- 以下の gitignored env ファイルを main checkout からコピー:
  - `.env` (root, used by webpack at build time)
  - `infra/smalruby-mesh-v2/.env.{stg,stg2,production}`
  - `infra/smalruby-rubytee-relay/.env.{stg,stg2,production}`
  - `infra/smalruby-classroom/.env.{stg,stg2,production}`
- worktree の host 側 `node_modules` を main checkout のものに symlink
  （host 側 husky hook が `node_modules/.bin` を必要とするため。docker named
  volume には影響しない）

idempotent — 何度実行しても安全。`--force` で既存ファイルを上書き。

`.env` symlink（stage 切り替え用）は手動で:

```bash
(cd infra/smalruby-mesh-v2 && ln -sf .env.stg .env)
```

### When to re-sync

- `.env.<stage>` が main checkout で更新された場合（稀、新しい env var が
  追加されたなど）: `bin/sync-worktree-env --force` を再実行
- npm の依存が変わった場合: `docker compose run --rm app npm install` を実行
- workspace package のソースが変わって他 package のテストが影響を受ける場合:
  `docker compose run --rm app npm run build:dev` で `dist/` を更新

### Cleaning up a worktree

```bash
cd <main-checkout>
git worktree remove ../smalruby3-editor-<feature>
git branch -d <type>/<branch-name>  # if branch is merged
```

## Commit Message Format

**Enforce Conventional Commits**. All commit messages must follow this format:

```
<type>: <short description>

<optional body with details>

<optional footer>
```

### Commit Types

- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code refactoring without changing behavior
- `chore:` - Maintenance tasks (dependencies, build config)
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, whitespace)
- `test:` - Adding or modifying tests
- `perf:` - Performance improvements
- `build:` - Build system changes
- `ci:` - CI/CD changes
- `revert:` - Revert a previous commit

### Examples

```bash
# Simple commit
git commit -m "feat: add Ruby code export functionality"

# Detailed commit
git commit -m "fix: resolve prism parser error for nested blocks

The @ruby/prism parser was failing when encountering deeply nested blocks.
This commit updates the converter to handle nesting correctly.

Fixes #123"

# Breaking change
git commit -m "feat!: change API endpoint structure

BREAKING CHANGE: The /api/projects endpoint now returns a different
response format. Update client code to handle the new structure."
```

## Pull Request Workflow

### Creating Pull Requests

1. **Create feature branch**:
   ```bash
   git checkout -b feature/descriptive-name
   ```

2. **Make changes and commit** (using conventional commits)

3. **Push to remote**:
   ```bash
   git push origin feature/descriptive-name
   ```

4. **Create PR using `gh` CLI**:

   Use the **Write tool** to write the PR body to `/tmp/pr-body.md`:

   ```markdown
   ## Summary
   Brief description of changes.

   ## Changes Made
   - List of changes
   - Another change

   ## Test Coverage
   - Added integration tests for X
   - Updated unit tests for Y

   ## Related Issues
   Fixes #123
   ```

   Then run:

   ```bash
   gh pr create \
     --repo smalruby/smalruby3-editor \
     --base develop \
     --head feature/descriptive-name \
     --title "feat: descriptive title" \
     --body-file /tmp/pr-body.md

   rm /tmp/pr-body.md
   ```

### Merging Pull Requests

**IMPORTANT**: Squash merges are NOT allowed on this repository. Always use `--merge`:

```bash
gh pr merge <number> \
  --repo smalruby/smalruby3-editor \
  --merge \
  --delete-branch
```

After merging, update the local develop branch:

```bash
git checkout develop && git pull origin develop
```

### PR Requirements

Before creating a PR, ensure:

1. ✅ All tests pass (unit + integration)
2. ✅ Linting passes (`npm run lint`)
3. ✅ Build succeeds (`npm run build`)
4. ✅ Code follows existing patterns
5. ✅ Documentation is updated (if needed)
6. ✅ Commit messages follow Conventional Commits

## GitHub Operations

**CRITICAL**: All GitHub operations (issues, PRs) must target **Smalruby organization repositories**, NOT upstream Scratch Foundation repos.

### Using `gh` CLI

- Repository: `smalruby/smalruby3-editor`
- Base branch: `develop`

### Issue Management

```bash
# List issues
gh issue list --repo smalruby/smalruby3-editor

# View specific issue
gh issue view 123 --repo smalruby/smalruby3-editor
```

Use the **Write tool** to write the issue body to `/tmp/issue-body.md`:

```markdown
## Description
Issue description here.

## Steps to Reproduce
1. Step one
2. Step two

## Expected Behavior
What should happen.

## Actual Behavior
What actually happens.
```

Then run:

```bash
gh issue create \
  --repo smalruby/smalruby3-editor \
  --title "bug: descriptive title" \
  --body-file /tmp/issue-body.md

rm /tmp/issue-body.md
```

### Avoiding Shell Escaping Issues

**ALWAYS use temporary files with `-F` or `--body-file`** for complex messages containing:
- Code blocks with backticks
- Special characters ($, ", ', \, etc.)
- Multi-line text

❌ **Don't do this**:
```bash
gh issue create --body "Description with \`code\` and \"quotes\""
```

✅ **Do this instead**:

Use the **Write tool** to write the content to `/tmp/body.md`:

```markdown
Description with `code` and "quotes"
```

Then run:

```bash
gh issue create --body-file /tmp/body.md
rm /tmp/body.md
```

## Git Commands

Common git operations:

```bash
# Check status
git status

# View diff
git diff
git diff --staged

# Stage changes
git add path/to/file

# Commit
git commit -m "feat: description"

# Push
git push origin branch-name

# Pull latest from develop
git checkout develop
git pull origin develop

# Rebase feature branch on develop
git checkout feature/branch-name
git rebase develop

# View commit history
git log --oneline
git log --oneline --graph
```

## Package Lock File

- `package-lock.json` is maintained at the **monorepo root level**
- Always commit changes to `package-lock.json` when dependencies change
- Dependencies are managed via npm workspaces
