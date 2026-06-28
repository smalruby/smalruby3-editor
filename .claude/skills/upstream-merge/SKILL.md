---
name: upstream-merge
description: "/upstream:merge - Interactive Upstream Merge Workflow. upstream scratch-editor の変更を Smalruby に取り込む半自動ワークフロー。"
---

# /upstream:merge - Interactive Upstream Merge Workflow

upstream scratch-editor の変更を Smalruby fork に取り込む半自動ワークフロー。

> ⚠️ **必読・絶対ルール**: 差分比較の基準は **release タグ / recorded `lastMerge.upstreamCommit`**。
> ghq ローカルの `develop` は stale で誤判定の原因になる（develop-trap、過去2回発生）。また
> `postMergeReverts` に登録された pre-spork 残債は lost-fix ではない。詳細:
> `.claude/rules/upstream-tracking.md`。

## ワークフロー全体像

| Phase | ファイル | 内容 |
|-------|----------|------|
| 1 | `phase1-prepare.md` | Prerequisites確認 → ブランチ作成 → マージ実行 |
| 2 | `phase2-conflicts.md` | コンフリクト解決ガイド（既知パターン + ガイダンス） |
| 3 | `phase3-validation.md` | コミット → divergence 監査 → lint → build → テスト → CI |
| 4 | `phase4-finalize.md` | merge history更新 → PR作成 → 手動テスト |

リファレンス（必要時に読み込む）:

| ファイル | 内容 |
|----------|------|
| `reference-api-migration.md` | ScratchBlocks API 変更一覧 |
| `reference-test-patterns.md` | テスト修正の既知パターン集 |

## `.upstream-merge-history.json` スキーマ

```json
{
  "lastMerge": {
    "date": "YYYY-MM-DD",
    "upstreamCommit": "<upstream commit hash>",
    "targetRelease": "vX.Y.Z",
    "scratchWwwProductionSha": "<scratch-www production deploy commit>",
    "scratchGuiVersion": "X.Y.Z",
    "smalrubyCommit": "<smalruby commit hash before merge>",
    "mergeCommit": "<merge commit hash>",
    "notes": "description"
  },
  "postMergeReverts": [
    {
      "date": "YYYY-MM-DD",
      "pr": "#NNN",
      "reason": "why the revert was needed",
      "scope": "short scope label",
      "affectedAreas": [
        {
          "category": "human-readable category name",
          "files": ["path/to/file1", "path/to/file2"],
          "detail": "what was reverted and why"
        }
      ],
      "nextMergeGuidance": "instructions for how to handle these files on the next upstream merge"
    }
  ],
  "previousMerges": [
    { "...(rotated from lastMerge)" }
  ]
}
```

### `postMergeReverts` の意味

upstream merge 後に、取り込んだ変更の一部を revert した場合に記録する。

- Git 上は `lastMerge.upstreamCommit` まで取り込み済みだが、**一部のファイルは revert されている**ことを示す
- 次回の upstream merge 時、`affectedAreas` のファイルでコンフリクトが発生する可能性が高い
- `nextMergeGuidance` に従ってコンフリクトを解決する
- revert の原因が解消された場合（upstream 側で修正された等）、merge 完了後に該当エントリを削除する

## 進め方

1. Phase 1 から順番に実行する
2. 各フェーズの開始時に該当ファイルを読み込む
3. **Phase 1 で `postMergeReverts` がある場合は、Phase 2 の前にユーザーと方針を確認する**
4. コンフリクト解決やテスト修正で詰まったら、リファレンスファイルを読み込む
5. 各フェーズが完了したら次のフェーズに進む

## 絶対に守るルール

- **`git add .` は使わない** — `git add -u` (tracked files のみ) を使う
- **`notes/` は絶対にコミットしない** — `.gitignore` で除外済みだが、明示パス指定や `-f` で追加されうる
- **ファイル指定で add** — merge history 更新時は `git add .upstream-merge-history.json` のみ
- **PR マージは `--merge`** — squash merge は禁止。`gh pr merge <number> --merge --delete-branch`
- **ドキュメントはPRの説明文に記載** — リポジトリにファイルとしてコミットしない

## 開始

Phase 1 のファイルを読み込んで開始:

```
.claude/skills/upstream-merge/phase1-prepare.md
```
