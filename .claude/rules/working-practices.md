# 作業のしかた

## 共有の /app のブランチを切りかえない

- `/app`（人間と共有の main checkout）のブランチを `git checkout` / `git switch` で切りかえない。
- ブランチが要る作業（docs の PR・調べもの用のブランチを含む）は、worktree で行う（`bin/autopilot-worktree` や `git worktree add`）。
- `/app` では、読み取り（`git fetch` / `git show origin/...` / `git log`）と `bin/` のスクリプトの実行だけにする。
  サブエージェントにも同じことを伝える。
- なぜ: 同じ checkout で動くほかのセッションや人間の作業ツリーが、知らないうちに別のブランチに乗ってしまう。

## 確認中に infra の不具合を見つけたら

- プレビューや stg での確認（DoD）の途中で `infra/**` の不具合を見つけたら、報告だけで止めない。
  **🧱 infra の sub-issue を作り、AI が直して develop 宛ての PR（本文は `Refs #N`）まで出す**。
- 後方互換な変更だけにする。`cdk deploy` は AI が行わない（stg は `deploy-stg` ラベル、prod は develop へのマージで出る）。
- GUI の Issue が infra の直しを待つなら、`autopilot-after: #<infra>` を足す。手順の正は `.claude/rules/infra/development.md`。

## 本番ビルドだけで起きる不具合

- terser の名前の縮め（`node.constructor.name` が使えないなど）のように、本番ビルドだけで起きる不具合は、
  PR の CI が出すブランチのプレビュー `https://preview.smalruby.app/<slug>/` で確かめる。
- unit テスト（縮めていないコード）では見つからない疑いがあるときは、headless chromium でプレビューを開いて確かめる。

## 「Simulate した」モバイルの不具合報告

- 再現の手順に「Simulate a iPad mini」のようなシミュレータや devtools のエミュレーションが出てくる報告は、
  コードを調べる前に次を確かめる。
    1. 実機で再現するか（できなければ、報告者に端末・OS の版・実機かシミュレータかを聞く）。
    2. upstream（scratch.mit.edu）でも同じ症状が出るか。出るなら Smalruby だけの問題ではない。
- headless の Playwright のスクリーンショットは、描画の合成で起きる劣化を写せない。実機の Safari で確かめる。

## upstream への追従を軽く保つ

- upstream の Scratch を定期的に取り込むので、upstream のファイルとぶつかりやすい直しは、あとの手間を大きくする。
- 同じ使い心地にできる道がいくつかあるときは、**upstream のファイルの変更が少ない道**を選ぶ。
- upstream のファイルに大きく手を入れる前に、Smalruby マーカーで囲んだ独立の部品に切り出せないかを考える。
- やむを得ず大きく変えるときは、理由を ADR に残す（マーカーの決まりは `.claude/rules/code-style.md`）。
