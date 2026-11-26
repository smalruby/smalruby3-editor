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

## マージのあと

- このリポジトリは「マージしたら head ブランチを自動で消す」が有効。topic ブランチも develop へのマージで消える。
  残すか消すかを人間に聞かない。続きの作業は develop から新しく切る。

## Bot ができないこと

- Bot（GitHub App）は `gh workflow run`（workflow_dispatch）ができない（`HTTP 403: Resource not accessible by integration`）。
  `Deploy Infra` などを手で起動するときは、人間に plain `gh workflow run ...` かブラウザの Actions → Run workflow を頼む。
  AI は起動のあとの見守り（`gh run watch`）だけを行う。
