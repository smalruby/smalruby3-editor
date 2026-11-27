# develop へのマージと本番

develop へのマージは、CI/CD（`.github/workflows/ci-cd.yml` の `build-and-deploy`）で smalruby.app に出る。
授業で使っている最中に画面が変わると困るので、次を守る。

## 平日のマージの時間

- 平日の develop へのマージは **12:50〜13:15**（昼休み）に行う。
- **16:15 以降**は、昼に入りきらなかったときの予備。使う前に人間の意向を確かめる。
- 人間が承認した PR でも、この時間まで待ってからマージし、待っていることを報告に書く。
- topic ブランチへのマージは時間を問わない（`.claude/rules/topic-branches.md`）。

## メッシュ

- メッシュ（scratch-vm の `scratch3_mesh_v2`・GUI のメッシュの画面）に関わるものは、優先度を高くする。
- 直しは慎重に行い、デグレが 0 であることと実際に動くことを確かめる（`.claude/rules/scratch-gui/mesh.md` のデグレ確認手順）。
- **平日の日中は develop へマージしない**。土日か、平日の授業時間外（夜）にする。
- なぜ: メッシュは授業で使う最も大事な機能。

## EPIC は人間のレビューのあとで

- EPIC の機能（topic → develop、EPIC の sub-issue の PR）は、**必ず人間がレビューしてから** develop へマージする。
  AI のレビューだけではマージしない。
- CI と AI のレビューまで済んだら「人間のレビュー待ち」として止め、プレビューの URL と見てほしい点を渡す。
- 例外: 変換器（`ruby-to-blocks-converter` / `ruby-generator` まわり）は授業で使っていないので、AI のレビューでマージしてよい。
- 単発の小さな不具合の直しは、これまでどおり。

## autopilot の改良は AI のレビューでマージする

autopilot（`tools/autopilot/`）の改良は、速いサイクルで回したい。そこで、autopilot の PR が
人間のレビュー待ち（Status=Review・🙋）になったら、**人間を待たずに、セッションの AI が評価して develop へマージしてよい**。
`tools/**`・`bin/**`・`docs/**`・`.claude/**` は CI/CD の `paths-ignore` にあり、マージしても smalruby.app には出ないので、
**時間帯の決まりはない**。

- **対象**: 変えたファイルが次だけの、develop 宛ての PR。
  - `tools/autopilot/**`
  - `bin/autopilot-*`
  - `docs/autopilot/**`
  - `.claude/rules/autopilot/**`
  - `.claude/skills/autopilot/**`・`.claude/skills/check-autopilot/**`
- **対象外**（これまでどおり人間がレビューする）:
  - ほかのパスが 1 つでも入っている PR。`.github/**`・`bin/bot-*`・`packages/**`・`infra/**` など。
  - `👥 human-review-required` の付いた PR。
  - topic 宛ての PR。topic の決まりに従う（`.claude/rules/topic-branches.md`）。
- **マージしてよいのは、次を全部満たすとき**:
  1. CI（`Test autopilot` など、PR に付いたチェック）がすべて通っている。コンフリクトが無い。
  2. autopilot のレビューのまとめコメント（`<!-- autopilot-review-findings round=N -->`）を読み、
     **Must がすべて直っている**。Question・FYI には、扱い（直した・見送りの理由・follow-up の Issue）が書いてある。
  3. AI が差分を自分でも読み、レビューに漏れが無いかを確かめる。見る点は次の 3 つ。
     - 正確性。
     - `.claude/rules/autopilot/` への準拠。レイヤリング・単一ライター・状態を変えたときの 3 点セット・依存を足さないこと。
     - テストと docs の更新。
  4. 人間の判断が要る点が残っていない。仕様の選択・人間が未回答の質問・未対応の Request changes がある場合は、マージしない。
- **満たさないとき**は、理由を PR にコメントして人間のレビューに残す。直せば済むものは、address-review に回してよい。
- マージは `bin/bot-gh pr merge <n> --merge --delete-branch`。Issue は daemon がマージを見て閉じる。
- **マージのあとは daemon を再起動する**。そうしないと変更が効かない（`.claude/rules/autopilot/development.md`）。
  - worker が走っていなければ、すぐ再起動する。
  - 走っていれば、終わるのを待つ。または、中断してよいかを人間に聞く。
- 人間への報告には、マージした PR と、評価の要点（Must の数と直したこと、見送ったもの）を書く。

## マージのあと

- このリポジトリは「マージしたら head ブランチを自動で消す」が有効。topic ブランチも develop へのマージで消える。
  残すか消すかを人間に聞かない。続きの作業は develop から新しく切る。

## Bot ができないこと

- Bot（GitHub App）は `gh workflow run`（workflow_dispatch）ができない（`HTTP 403: Resource not accessible by integration`）。
  `Deploy Infra` などを手で起動するときは、人間に plain `gh workflow run ...` かブラウザの Actions → Run workflow を頼む。
  AI は起動のあとの見守り（`gh run watch`）だけを行う。
