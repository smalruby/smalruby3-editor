# /autopilot-resolve-conflict — Merge conflict resolution phase

**Follow the autopilot autonomous contract: `docs/autopilot/autonomous-contract.md`.**
対話的に質問しない。終了時に `AUTOPILOT_RESULT_FILE` へ JSON を書き、pane に signal トークンを出す。

対象 Issue は環境変数 `AUTOPILOT_ISSUE`。作業ブランチに最新の base（`AUTOPILOT_BASE_REF`。例 `origin/develop`）を
merge したところ**コンフリクトした状態のまま**、daemon がこの worktree（cwd）を渡している。
あなたの仕事は**コンフリクトを解消して merge を完了させることだけ**。機能の追加・リファクタ・レビュー指摘への
対応はしない（それは別のフェーズの仕事）。

このフェーズは次の 2 つから起動する。どちらでも手順は同じ:

- 人間がモニタの「🔀 解消」ボタンを押した（PR はレビュー待ちなどの人間ゲートのまま）
- 別のフェーズ（implement / review / address-review / verify）の着手時に、base 追従がコンフリクトした
  （解消できたら daemon がそのフェーズを続ける）

| 環境変数 | 内容 |
|---|---|
| `AUTOPILOT_BASE_REF` | merge しようとした base（例 `origin/develop`） |
| `AUTOPILOT_CONFLICT_FILES` | コンフリクトしたファイル（改行区切り） |
| `AUTOPILOT_PR` | 連携 PR の番号。空なら PR はまだ無い（push しない） |

**Project のフィールド・🙋 ラベルは書かない**（daemon の単一ライター）。Status は変わらない。

## 1. 状況を確かめる

```bash
git status
git diff --name-only --diff-filter=U        # 未解消のファイル
git log --oneline -1 MERGE_HEAD             # 取り込もうとしている base の先頭
```

`MERGE_HEAD` が無い（merge 途中でない）なら、何もせず `signal:"error"` で終える（daemon の想定外）。

各ファイルについて、**両側が何をしたか**を確かめてから直す。片側の変更を捨てない:

```bash
MB=$(git merge-base HEAD MERGE_HEAD)
git log --oneline "$MB..MERGE_HEAD" -- <file>   # base 側の変更
git log --oneline "$MB..HEAD" -- <file>         # この PR 側の変更
git diff "$MB" MERGE_HEAD -- <file>
git diff "$MB" HEAD -- <file>
```

## 2. 解消する

### lock ファイル（`package-lock.json`）

手で編集しない。`package.json` 側のコンフリクトを先に解消してから、PR 側の lock を採って作り直す
（3 日ルール: `--before` に 3 日前の日付を渡す。`.claude/rules/supply-chain-security.md`）:

```bash
git checkout --ours package-lock.json
npm install --package-lock-only --ignore-scripts --no-audit --no-fund \
  --before "$(date -u -d '3 days ago' +%Y-%m-%d)"
```

作り直したら、**base 側が消した / 足したパッケージと同じ変化が lock にも入ったか**を確かめる。
base 側の lock の変化（`git diff "$MB" MERGE_HEAD -- package-lock.json` のパッケージキー）と、作り直しで
起きた変化を比べ、食い違えば理由を確かめる。`npm ls --package-lock-only --all` の問題が merge 前より
増えていないことも確かめる。

### ソースコード・ドキュメント

- 両側の意図を両方残す形にする。どちらかを丸ごと採る（`--ours` / `--theirs`）のは、もう片側の変更が
  不要になったと**確かめられたときだけ**（例: base 側でファイルごと削除された機能への変更）
- 削除と変更の衝突（modify/delete）は、削除した側の意図（PR や commit メッセージ）を読んでから判断する
- コンフリクトマーカーが残っていないことを確かめる: `git diff --check` と
  `grep -rn '^<<<<<<<\|^>>>>>>>' -- $(git diff --name-only HEAD)`

### 確かめる

- 変更したパッケージの lint（`npm run lint` は重いので、触ったパッケージ単位で）
- コンフリクトしたファイルに関係する unit テスト（全件は CI に任せる（`CLAUDE.md` の「ローカルで流すテストの範囲」。全体実行は PR の CI で。どうしても全体の結果が要るときだけ例外で、理由を書く））
- `tools/autopilot/` を触ったら `cd tools/autopilot && node --test`

## 3. 自信が持てないときは中断する

次のどれかに当たるなら、**解消しない**。`git merge --abort` で元に戻し、PR（無ければ Issue）に
論点を整理したコメントを 1 つ書いて、`signal:"hitl"` で終える:

- 両側の意図がぶつかっていて、どちらを残すかが仕様の判断になる
- 解消後に lint / テストが通らず、原因がコンフリクトの解消にあるのか分からない
- コンフリクトしたファイルが多く（目安 10 ファイル超）、確かめきれない

コメントには、コンフリクトしたファイル・それぞれの両側の変更・どう直すのがよいかの案を書く。

## 4. commit して push する

```bash
git add <解消したファイル>
bin/bot-git commit --no-edit        # merge commit（Bot 名義）
```

`AUTOPILOT_PR` が空でなければ push する（Bot 権限外のパスを含むと自動で個人経路になる）:

```bash
bin/autopilot-push
```

daemon は、merge が完了して base を取り込んだこと・PR ブランチのリモートが手元と同じ commit で
あることを確かめる。push を忘れると失敗扱いになる。

PR があれば、何をどう直したかを PR に短くコメントする（例: 「`package-lock.json` のコンフリクトを解消:
develop が外した skyway-js 系 43 パッケージを lock から外し、PR 側の更新はそのまま」）。

## 5. 結果を書く

解消できた:

```bash
cat > "$AUTOPILOT_RESULT_FILE" <<EOF
{"issue":$AUTOPILOT_ISSUE,"phase":"resolve-conflict","signal":"done","summary":"<何をどう解消したか 1 行>",
"nextStatus":null,"nextAiStatus":null,"hitl":false,"size":null,"kind":null,"createdSubIssues":[],"prUrl":null}
EOF
echo AUTOPILOT_DONE
```

中断した（手順 3）:

```bash
cat > "$AUTOPILOT_RESULT_FILE" <<EOF
{"issue":$AUTOPILOT_ISSUE,"phase":"resolve-conflict","signal":"hitl","summary":"<解消しなかった理由 1 行>","reason":"<人間に判断してほしいこと 1 行>",
"nextStatus":null,"nextAiStatus":null,"hitl":true,"size":null,"kind":null,"createdSubIssues":[],"prUrl":null}
EOF
echo AUTOPILOT_HITL
```

`nextStatus` / `nextAiStatus` は書かない（null）。このフェーズは Status を動かさず、AI Status は daemon が
元に戻す。

## 注意

- 作業は割り当てられた worktree（cwd）の、この 1 Issue / PR だけ。新しいブランチを切らない
- rebase しない・force push しない（merge で追従する。PR の履歴を書き換えない）
- 冪等: 同じ内容のコメントを二重に書かない
- `AskUserQuestion` を使わない。動的 Workflow / Skill を起動しない
- コミットは `bin/bot-git`、push は `bin/autopilot-push`、gh は `GH_TOKEN="$(bin/bot-token)" gh ...`

---

## License

This phase prompt is part of the Smalruby autopilot and is licensed under the **MIT License** (not the repository's AGPL-3.0). See `tools/autopilot/LICENSE`.
