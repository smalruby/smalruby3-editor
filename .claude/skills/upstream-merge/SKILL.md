---
name: upstream-merge
description: "/upstream:merge - Interactive Upstream Merge Workflow. upstream scratch-editor の変更を Smalruby に取り込む半自動ワークフロー。"
---

# /upstream:merge - Interactive Upstream Merge Workflow

upstream scratch-editor の変更を Smalruby fork に取り込む半自動ワークフロー。

## ワークフロー全体像

| Phase | ファイル | 内容 |
|-------|----------|------|
| 1 | `phase1-prepare.md` | Prerequisites確認 → ブランチ作成 → マージ実行 |
| 2 | `phase2-conflicts.md` | コンフリクト解決ガイド（既知パターン + ガイダンス） |
| 3 | `phase3-validation.md` | コミット → lint → build → テスト → CI |
| 4 | `phase4-finalize.md` | merge history更新 → PR作成 → 手動テスト |

リファレンス（必要時に読み込む）:

| ファイル | 内容 |
|----------|------|
| `reference-api-migration.md` | ScratchBlocks API 変更一覧 |
| `reference-test-patterns.md` | テスト修正の既知パターン集 |

## 進め方

1. Phase 1 から順番に実行する
2. 各フェーズの開始時に該当ファイルを読み込む
3. コンフリクト解決やテスト修正で詰まったら、リファレンスファイルを読み込む
4. 各フェーズが完了したら次のフェーズに進む

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
