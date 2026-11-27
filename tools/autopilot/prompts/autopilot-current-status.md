# /autopilot-current-status — 現在地の artifact を作り直す job

**Follow the autopilot autonomous contract: `docs/autopilot/autonomous-contract.md`.**
対話的に質問しない。終了時に `AUTOPILOT_RESULT_FILE` へ JSON を書き、pane に signal トークンを出す。

人間がモニタの「🧭 現在地を作る」を押したときだけ、daemon がこの job を 1 回起動する。Issue には属さない
（`AUTOPILOT_ISSUE=0`）。あなたの仕事は、daemon が出した材料から **現在地のページ（claude.ai の artifact）を
作り直し、同じ URL を更新する**ことだけ。コード・Issue・PR・Project は変えない。

| 環境変数 | 内容 |
|---|---|
| `AUTOPILOT_STATUS_JSON` | 材料（`GET /status.json` と同じ JSON）のファイル |
| `AUTOPILOT_STATUS_URL` | 同じ材料の URL（ファイルが古いと思ったら読み直してよい） |
| `AUTOPILOT_ARTIFACT_URL` | 更新する artifact の URL。**空なら初回**（新しく作る） |
| `AUTOPILOT_ARTIFACT_HTML` | 書き出す HTML のパス（毎回同じ） |
| `AUTOPILOT_TEMPLATE_DIR` | テンプレート（`template.html`・`IMPROVEMENTS.md`） |
| `AUTOPILOT_RENDER` | テンプレートに埋め込むコマンド（`node $AUTOPILOT_RENDER ...`） |
| `AUTOPILOT_REPO` / `AUTOPILOT_REPO_ROOT` | GitHub のリポジトリ / main checkout の場所（`$AUTOPILOT_REPO_ROOT/bin/bot-token`） |

## 1. 材料を読み、下書きを作る

```bash
cd "$(dirname "$AUTOPILOT_ARTIFACT_HTML")"
node "$AUTOPILOT_RENDER" --material "$AUTOPILOT_STATUS_JSON" --draft data.json
```

材料の中身: `groups`（EPIC ごと。`stage` = design / implement / topic-review / develop、`done` / `total`、
`running`、`pendingDecisions`、`eta`）、`priorities`（いま優先している順）、`running`（動いている worker）、
`waitingHuman`（人間を待っているもの）、`nextInterview`（いちばん早い次の確認の見込み）、`blocked`
（止まっている worker）、`recentHistory`（最近の実行）。`IMPROVEMENTS.md` も読み、採ったものに沿う。

## 2. ことばを足す（data.json を直す）

下書きは数だけなので、人間が上から読んで「何を待たれていて、何が進んでいて、次にいつ聞かれるか」が分かるように直す。

- `lead`: 2〜3 文。いちばん大事な変化と、人間にしてほしいことを先に書く。
- `waits[].what` / `why`: 人間がすることを動詞で書く（「#N のレビューに答える」）。`why` に理由と、答えると何が進むか。
  人間に頼むことの順に並べかえる（いちばん先のものを 1 番に）。
- `epics[].note`: 1〜2 文。いまどこで、次に何をするか。
- `nextInterview.text`: 何を聞く予定か（決定待ちの中身の要約）。
- `added`: 最近 topic / develop / 本番に入ったもの（`{what, when, where, note}`）。`recentHistory` と、必要なら
  `GH_TOKEN="$("$AUTOPILOT_REPO_ROOT/bin/bot-token")" gh pr list --repo "$AUTOPILOT_REPO" --state merged --limit 20` で拾う（読むだけ）。
- 書き方: 漢字まじりのふつうの日本語。短く。個人やクラスを特定する情報・秘密（トークン・URL のクエリ）を書かない。
- 材料に無いことを作らない。分からないところは空のままでよい。

## 3. HTML にして artifact を更新する

```bash
node "$AUTOPILOT_RENDER" --data data.json --out "$AUTOPILOT_ARTIFACT_HTML"
```

**Artifact ツール**で `$AUTOPILOT_ARTIFACT_HTML` を publish する。

- `AUTOPILOT_ARTIFACT_URL` が空でなければ、**必ず `url` にその値を渡して同じ artifact を更新する**（新しい URL を作らない）。
  まだこの会話で読んでいないと断られたら、`action: "read"` で読んでから同じ内容で publish し直す。
- 空なら新しく作る（`icon: "chart"`、`description` は「autopilot の現在地（EPIC ごとの進み具合と次の確認の見込み）」）。
- テンプレートは artifact の決まり（タイトル・色のトークン・ダークモード・スマホの幅）を満たしてある。Artifact ツールが
  design の skill を読むよう求めたら従ってよいが、**テンプレートの形は変えない**（形の改善は次の `templateNotes` へ）。

## 4. 結果を書く

```json
{
  "issue": 0,
  "phase": "current-status",
  "signal": "done",
  "summary": "現在地を更新した（EPIC 4・人間待ち 2）",
  "hitl": false,
  "artifactUrl": "https://claude.ai/artifact/…",
  "templateNotes": ["テンプレートで足りなかったこと・分かりにくかったこと（あれば。無ければ空の配列）"]
}
```

- `artifactUrl` は publish の結果に出た URL（更新でも書く）。daemon はこれを次回の `AUTOPILOT_ARTIFACT_URL` にする。
- 作れなかったら `signal: "error"` と `error`（理由）。人間の判断は要らない job なので `hitl` にしない。
- 最後に pane に `AUTOPILOT_DONE`（失敗なら `AUTOPILOT_ERROR`）を単独行で出す。

## 注意

- コード・Issue・PR・Project・🙋 ラベルを書かない。GitHub は読むだけ。
- `AskUserQuestion` を使わない。動的 Workflow / Skill を起動しない（Artifact ツールが求める design の skill を読むのは除く）。
- 冪等: artifact は同じ URL を更新するだけ。新しい artifact を増やさない。

---

## License

This phase prompt is part of the Smalruby autopilot and is licensed under the **MIT License** (not the repository's AGPL-3.0). See `tools/autopilot/LICENSE`.
