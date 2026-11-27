# /autopilot-task — タスク（1 回・定期）の実行

**Follow the autopilot autonomous contract: `docs/autopilot/autonomous-contract.md`.**
対話的に質問しない。終了時に `AUTOPILOT_RESULT_FILE` へ JSON を書き、pane に signal トークンを出す。

このフェーズは **Issue に結びつかない「タスク」**を 1 回実行する（例: 毎朝の不具合報告の確認）。
daemon が予定の時刻か、モニターの「▶ いま実行」で起動した。`AUTOPILOT_ISSUE` は `0`（Issue は無い）。

| 環境変数 | 内容 |
|---|---|
| `AUTOPILOT_TASK_ID` | タスクの id（`tools/autopilot/tasks.json` か `tmp/autopilot-tasks.local.json` の定義） |
| `AUTOPILOT_TASK_PROMPT_FILE` | させることを書いたファイル（cwd からの相対パス） |

## 手順

1. `AUTOPILOT_TASK_PROMPT_FILE` を Read し、そこに書かれたことを行う。書かれていないことはしない。
2. 結果を人間に知らせる必要があるときは、タスクのプロンプトに書かれた場所（Issue へのコメントなど）に書く。
   場所が書かれていなければ、結果の `summary` に 1〜3 行でまとめるだけにする（モニターに出る）。
3. 変更を残すときは、新しいブランチを切ってコミットし（`bin/bot-git`）、PR を作る（`GH_TOKEN="$(bin/bot-token)" gh ...`）。
   **マージはしない**。cwd は次の実行で develop にそろえ直されるので、コミットしない変更は消える。
4. 人間の判断が要る・手順が分からないときは、推測で進めず `signal=hitl` で終える。

## 結果

```bash
cat > "$AUTOPILOT_RESULT_FILE" <<EOF
{"issue":0,"phase":"task","signal":"done","summary":"<したことと結果 1〜3 行>","hitl":false}
EOF
echo AUTOPILOT_DONE
```

判断が要るとき: `{"issue":0,"phase":"task","signal":"hitl","summary":"...","reason":"<人間に聞きたいこと>"}` → `AUTOPILOT_HITL`。
失敗したとき: `{"issue":0,"phase":"task","signal":"error","summary":"...","error":"<原因>"}` → `AUTOPILOT_ERROR`。
タスクは Project に載っていないので、`nextStatus` / `nextAiStatus` は書かない。

## 注意

- 作業は割り当てられた worktree（cwd）の中だけ。`/app` の main checkout のブランチを切りかえない
- 秘密（トークン・`.env` の値）を GitHub や summary に書かない
- `AskUserQuestion` を使わない。動的 Workflow / Skill を起動しない
- Project のフィールド・🙋 ラベルを書かない（daemon の単一ライター）

---

## License

This phase prompt is part of the Smalruby autopilot and is licensed under the **MIT License** (not the repository's AGPL-3.0). See `tools/autopilot/LICENSE`.
