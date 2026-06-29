---
name: autopilot-address-review
description: autopilot のレビュー対応フェーズ。人間が HITL を解除した PR について diff と全コメントを理解し、質問・改善依頼に対応し、再び人間に渡す。autopilot Runner から非対話で起動される。
argument-hint: "[issue number]"
disable-model-invocation: true
---

# /autopilot-address-review — Review handling phase

**Follow the autopilot autonomous contract: `docs/autopilot/autonomous-contract.md`.**
対話的に質問しない。終了時に `AUTOPILOT_RESULT_FILE` へ JSON を書き、pane に signal トークンを出す。

対象 Issue は `$ARGUMENTS` または `AUTOPILOT_ISSUE`。人間が **`🙋 HITL` を外した（差し戻した）** PR を扱う。

このフェーズは Review 解除時の**唯一の入口**（#815）。daemon は approve / changes-requested などの
構造化シグナルで分岐せず、解除されたら必ずこのスキルを起動する。**何をすべきかはここで判断する**:
PR の diff と全コメントを読んで意図を分類し、対応する／何もしない／人間に聞く、を決める。

## 前提: 既存 PR ブランチで作業する

新規ブランチではなく **既存 PR のブランチ**で作業する（daemon が `--pr` で worktree を用意する）:

```bash
PR=$(GH_TOKEN="$(bin/bot-token)" gh pr list --repo "$AUTOPILOT_REPO" --search "Closes #$AUTOPILOT_ISSUE in:body" --state open --json number -q '.[0].number')
bin/autopilot-worktree create "$AUTOPILOT_ISSUE" --pr "$PR"
```

## 手順

### 1. PR 全体を理解する（diff + 全コメント）

レビューを「未対応スレッドだけ」ではなく **PR 全体の文脈**で理解する:

```bash
# diff（何が変わったか）
GH_TOKEN="$(bin/bot-token)" gh pr diff "$PR" --repo "$AUTOPILOT_REPO"
# 会話コメント・レビュー本文・レビュースレッド
GH_TOKEN="$(bin/bot-token)" gh pr view "$PR" --repo "$AUTOPILOT_REPO" --json title,body,comments,reviews,reviewThreads
# inline（行コメント）
GH_TOKEN="$(bin/bot-token)" gh api repos/$AUTOPILOT_REPO/pulls/$PR/comments
```

bot 自身のコメント・解決済みスレッドは文脈として読むだけ（対応対象からは外す）。

### 2. 人間のフィードバックを分類する

人間（bot 以外）の各コメント・レビューを、**自由文の意図**で次のいずれかに分類する。
構造化シグナル（approve/changes-requested）だけに頼らない — approve でも本文に改善依頼が
書かれていれば対応する。逆に "changes requested" でも実質 LGTM なら対応不要なことがある。

| 種別 | 例 | 対応 |
|---|---|---|
| **LGTM / 称賛 / 単なる感想** | 「いいですね」「approve します」「OK」 | **何もしない**（コードも返信も不要） |
| **質問** | 「ここはなぜ X にした？」「Y は考慮した？」 | bot で**返信**する。コードを変える必要があれば変える |
| **改善依頼 / 変更要求** | 「Z に直して」「テストを追加して」「命名を変えて」 | worktree で**修正**する |
| **判断がつかない** | 意図が曖昧・複数解釈・前提が不明 | **人間に質問**（後述 HITL） |

### 3. 対応する

- **改善依頼**: worktree 内で修正 → 関連テスト/lint → `bin/bot-git` でコミット・push。
- **質問**: PR に bot で返信。コード変更を伴うならあわせて push。
- 対応の有無が辿れるよう、**まとめコメントを 1 件**残す（「指摘 N 件: 対応 a 件 / 返信 b 件 / 対応不要 c 件」）。
- LGTM など対応不要のみで、コードに触る必要が無ければコミットしない（冪等・無駄 push をしない）。

### 4. 終了する（3 つの出口）

**(a) 質問・改善依頼に対応した → 再び人間レビューへ**（再レビュー/マージ判断を仰ぐ）:

```bash
cat > "$AUTOPILOT_RESULT_FILE" <<EOF
{"issue":$AUTOPILOT_ISSUE,"phase":"address-review","signal":"done","summary":"指摘 <N> 件対応（修正 <a>/返信 <b>）。再レビューへ。",
"nextStatus":"Review","nextAiStatus":null,"hitl":true,"size":null,"kind":null,"createdSubIssues":[],"prUrl":"<PR URL>"}
EOF
echo AUTOPILOT_DONE
```

**(b) LGTM のみ・対応不要 → 人間のマージ待ち**（こちらからは何もしない。Review のまま人間に戻す）:

```bash
cat > "$AUTOPILOT_RESULT_FILE" <<EOF
{"issue":$AUTOPILOT_ISSUE,"phase":"address-review","signal":"done","summary":"対応不要（LGTM）。人間のマージ待ち。",
"nextStatus":"Review","nextAiStatus":null,"hitl":true,"size":null,"kind":null,"createdSubIssues":[],"prUrl":"<PR URL>"}
EOF
echo AUTOPILOT_DONE
```

**(c) 判断がつかない → 人間に質問**（論点を整理してコメント済み）:

```bash
cat > "$AUTOPILOT_RESULT_FILE" <<EOF
{"issue":$AUTOPILOT_ISSUE,"phase":"address-review","signal":"hitl","summary":"指摘の意図が不明。確認待ち。",
"reason":"<何を判断してほしいか>","commentUrl":"<投稿コメント URL>","nextStatus":"Review"}
EOF
echo AUTOPILOT_HITL
```

> (a)(b) はどちらも `hitl:true` で人間の番に戻す。違いは「コードを変えたか」だけ。
> 人間は再び 🙋 を外せば、また本スキルが起動して続きを判断する。

## 注意

- **既存 PR ブランチで作業**（新ブランチを切らない）。1 Issue = 1 PR。
- **コンフリクトは autopilot で解消しない。** rebase/merge コンフリクトに遭遇したら解消を試みず、
  論点を整理した**コメント + `AUTOPILOT_HITL`** で人間に渡す（コンフリクト解消は人間の役割）。
- 冪等: 同じ指摘に二重対応・二重コメントしない。既存の bot まとめコメントがあれば編集して使う。
- `AskUserQuestion` を使わない。Project/PR の状態反映は daemon（単一ライター）。
- bot 認証（`bin/bot-git` / `bin/bot-token`）。
