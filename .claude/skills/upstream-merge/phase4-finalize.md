# Phase 4: Finalize — Merge History + PR Creation + Manual Testing

## Step 1: Merge History Update

### `.upstream-merge-history.json` 更新

```json
{
  "lastMerge": {
    "date": "YYYY-MM-DD",
    "upstreamCommit": "<upstream/develop の HEAD commit hash>",
    "smalrubyCommit": "<merge 前の develop の HEAD commit hash>",
    "mergeCommit": "<Phase 3 で作成した merge commit hash>",
    "notes": "X commits merged from upstream develop"
  },
  "previousMerges": [
    { "(前回の lastMerge をここに移動)" }
  ]
}
```

### Commit and Push

**重要**: `.upstream-merge-history.json` のみを明示的に add する。

```bash
git add .upstream-merge-history.json
git commit -m "$(cat <<'EOF'
chore: update upstream merge history

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
git push
```

---

## Step 2: PR Creation

### PR Body 作成

`/tmp/pr-body.md` に Write tool で書き出す:

```markdown
## Summary

Merged X commits from upstream scratch-editor `develop` branch.

**Upstream Commit Range**: `<prev_commit>`..`<new_commit>`

## Major Upstream Changes

[git log から主要な commit message を10件程度]

## Conflicts Resolved

### Known Conflicts
- ✅ gui.ts - Kept Smalruby registry pattern
- ✅ extension-manager.js - Kept Smalruby extension registration
- ✅ package-lock.json - Regenerated with npm install
[他の conflict も記載]

### Unexpected Conflicts
[あれば記載]

### Post-Merge Fixes
[テスト修正、lint 修正などがあれば記載]

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

### PR 作成

```bash
gh pr create \
  --repo smalruby/smalruby3-editor \
  --base develop \
  --head feat/upstream-merge-YYYY-MM \
  --title "feat: upstream merge YYYY-MM (X commits)" \
  --body-file /tmp/pr-body.md

rm /tmp/pr-body.md
```

---

## Step 3: Manual Testing (Playwright MCP)

PR の preview URL を使って手動確認する。
Playwright MCP を使うと効率的。

### Preview URL

PR にコメントされる URL、または:
```
https://smalruby.jp/smalruby3-editor/<branch-name>/
```

### 確認項目

| Feature | 確認方法 |
|---------|----------|
| ページ読み込み | console errors が 0 であること |
| ブロックカテゴリ | 日本語で全カテゴリ表示 |
| 設定メニュー | 言語、カラーモード、ルビー、ブロック表示 |
| ファイルメニュー | Google Drive 項目（読み込む、保存、コピーを保存） |
| ルビータブ | Monaco editor、ツールバー、ふりがなボタン |
| Gemini モーダル | 「スモウルビー先生」ボタン → モーダル表示 |
| 拡張機能 | 「拡張機能を追加」→ 全拡張機能（Mesh v2 含む）表示 |

### 確認完了後

PR の Manual Testing Checklist にチェックを入れ、PR 説明を更新。

---

## Step 4: Merge

全ての確認が完了したら:

```bash
gh pr merge <number> \
  --repo smalruby/smalruby3-editor \
  --merge \
  --delete-branch
```

**注意**: `--merge` フラグ必須。squash merge は禁止。

```bash
git checkout develop && git pull origin develop
```

---

## 完了

```
✅ Upstream merge completed successfully!

PR merged: https://github.com/smalruby/smalruby3-editor/pull/XXX
Merge history updated: .upstream-merge-history.json
```
