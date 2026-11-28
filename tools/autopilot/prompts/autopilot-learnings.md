# /autopilot-learnings — ためた学びを分野ごとのファイルにまとめて PR にする

**Follow the autopilot autonomous contract: `docs/autopilot/autonomous-contract.md`.**
対話的に質問しない。終了時に `AUTOPILOT_RESULT_FILE` へ JSON を書き、pane に signal トークンを出す。

人間がモニターの「📝 学びを PR にする」を押した。daemon がこの worktree（develop から切った新しいブランチ）に、
ためた学びを `AUTOPILOT_LEARNINGS_WORK_FILE`（cwd からの相対パス）として置いている。`AUTOPILOT_ISSUE` は `0`。

学びは 2 種類ある:

- **人間の意図**: EPIC の確認で、人間の答えが AI のおすすめと違ったときに聞いた理由。次から同じ場面で人間と同じほうを選ぶための決まり
- **レビューの観点**: EPIC の前の人間との確認で分かった、review で見るべきこと

## 手順

1. 作業メモを Read する。分野（`##` の見出し）ごとに「書き直すファイル」（`docs/autopilot/learned/<area>.md`）がある。
2. 分野ごとにそのファイルを書き直す（無ければ作る）。形は次のとおり:
   - 先頭に `# 学んだこと: <area>` と、「この分野のファイルを変えるとき（`learnedRuleFilesFor`）に読む」の 1 行
   - `## 人間の意図` と `## レビューの観点` の 2 つの節。中は**短い箇条書きの決まり**（1 項目 1〜2 行。「〜する」「〜しない」）
   - すでにある項目と同じ意味の学びは足さずにまとめる。食い違うときは新しい学び（作業メモの後ろのほう）を採る
   - 経緯・PR 番号・日付・人名は書かない（docs の決まり。`.claude/rules/code-style.md`）。理由は「なぜ」が分かる短さで残す
   - 末尾に License の節（MIT）
3. 新しい分野のファイルを作ったら `docs/autopilot/learned/README.md` の一覧に足す。
4. 変えるのは `docs/autopilot/learned/` だけ。ほかのファイル（プロンプト・コード・`.claude/`）は変えない。
5. コミット（`bin/bot-git commit`、`docs(autopilot): ...` の Conventional Commits・小文字始まり）→
   `bin/bot-git push -u origin HEAD` → develop 宛ての PR を作る:
   `bin/bot-gh pr create --repo "$AUTOPILOT_REPO" --base develop --title "docs(autopilot): ..." --body-file <file>`。
   本文は日本語で、分野ごとに足した・まとめた項目を短く並べる。**マージはしない**（CI のあと、人間がモニターのボタンでマージする）。
6. 同じブランチの PR がもうあれば、新しく作らずその番号を使う（冪等）。

## 結果

```bash
cat > "$AUTOPILOT_RESULT_FILE" <<EOF
{"issue":0,"phase":"learnings","signal":"done","summary":"<足した分野と件数 1 行>","hitl":false,"pr":<PR の番号>}
EOF
echo AUTOPILOT_DONE
```

`pr` は数で書く（daemon がこの番号を覚えて、マージのボタンに使う）。PR を作れなかったときは
`{"issue":0,"phase":"learnings","signal":"error","summary":"...","error":"<原因>"}` → `AUTOPILOT_ERROR`。

## 注意

- 作業は割り当てられた worktree（cwd）の中だけ。`AskUserQuestion` を使わない。動的 Workflow / Skill を起動しない
- 学びの中身に秘密が混ざっていたら書き写さない
- Project のフィールド・🙋 ラベルを書かない

---

## License

This phase prompt is part of the Smalruby autopilot and is licensed under the **MIT License** (not the repository's AGPL-3.0). See `tools/autopilot/LICENSE`.
