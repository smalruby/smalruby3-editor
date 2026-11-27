# CI が落ちたときのログの取り方（人間への依頼）

CI（GitHub Actions）のジョブが落ちて原因を調べるとき、**コンテナからはジョブのログ本文を取れない**。
推測で直さず、下の手順でログを手に入れてから原因を決める。

## CI は気軽に流し直す

- 公開リポジトリの GitHub Actions は無料。**費用を気にせず流し直してよい**（人間・AI・autopilot の worker 共通）。
- Bot は落ちたジョブを流し直せる（GitHub App の Actions は Read and write）:
  `bin/bot-gh run rerun <run> --failed --repo smalruby/smalruby3-editor`。
- 流し直してよい場面: 一時的な失敗が疑わしいとき、権限や設定を確かめたいとき、最新の結果が欲しいとき。
  「古い run を流すのは無駄」と避けたり、安い run を選んだりしなくてよい。
- ローカルで重いテスト全体を流す前に、まず CI の流し直しと、落ちた段の名前・注釈を見る
  （ローカルの全体実行はコンテナを重くする。`.claude/rules/parallel-work.md`）。

## なぜコンテナから取れないか

- `gh run view --log-failed` / `gh api repos/{owner}/{repo}/actions/jobs/<id>/logs` は、ログの置き場
  （`productionresultssa<N>.blob.core.windows.net`。`<N>` は毎回変わる）へ転送される。
  この置き場は devcontainer の egress firewall の allowlist に無いので、つながらない
  （`Failed to connect to productionresultssa30.blob.core.windows.net`）。
- `gh api .../check-runs/<id>/annotations` は、注釈を出すようにした段（下の scratch-gui の jest）のほかは
  `Process completed with exit code 1.` しか返さない。
- 読めるのは、ジョブ・段（step）の名前と成否まで:
  `gh run view <run> --json jobs -q '.jobs[]|.name+" "+(.conclusion//"")+" "+([.steps[]|select(.conclusion=="failure")|.name]|join(","))'`

## まず check-run の注釈を読む（scratch-gui の jest）

scratch-gui の unit / integration テストは、jest の `github-actions` reporter で、落ちたテストを
check-run の注釈（annotation）に出している（`.github/workflows/ci-cd.yml`）。注釈は api.github.com から
読めるので、**ログを人間に頼む前に注釈を読む**。

```bash
# 1. 落ちたジョブ（= check-run）の id
bin/bot-gh run view <run> --repo smalruby/smalruby3-editor --json jobs \
  -q '.jobs[]|select(.conclusion=="failure")|"\(.databaseId) \(.name)"'
# 2. そのジョブの注釈（テストの名前・ファイルと行・期待値と実際の値の差）
bin/bot-gh api repos/smalruby/smalruby3-editor/check-runs/<job id>/annotations \
  -q '.[]|"\(.path):\(.start_line) \(.title)\n\(.message)\n"'
```

- 落ちたテスト 1 件ごとに、`title` にテストの名前（`describe › test`）、`message` に失敗の中身
  （`expect` の差・スタック）が入る。
- GitHub は 1 つの段で error の注釈を 10 件まで（1 つのジョブで 50 件まで）しか残さず、読み込みで
  落ちたテストファイル（構文の誤り・モジュールが無い）には注釈が付かない。そのため、続く段
  「List failed scratch-gui ... Tests」が、落ちたテストとテストファイルを全部並べた注釈を 1 件足す
  （`title` が `jest: N failed (jest-results.json)`。`scripts/jest-failures-annotation.mjs`）。
  11 件目からは名前だけが分かる。
- 注釈が `Process completed with exit code 1.` だけのときは、jest より前の段で落ちているか、
  jest 以外のジョブ（scratch-vm の tap・lint・ビルド）。そのときは下の手順でログを頼む。

## 人間に頼むこと（この順で）

注釈で分からないときだけ頼む。まず段の名前まで自分で絞り、**どのジョブのどの段のログが要るか**を書いて頼む。

### A（既定）: ブラウザでログを取ってファイルで渡してもらう

firewall を変えなくてよいので、これを先に頼む。

1. 落ちたジョブのページの URL を渡す（`https://github.com/<owner>/<repo>/actions/runs/<run>/job/<job>`。
   `gh run view <run> --json jobs -q '.jobs[]|select(.conclusion=="failure")|.url'` で取れる）。
2. 右上の歯車（⚙）→「Download log archive」、または落ちた段を開いて中身をコピーしてもらう。
3. ホストの `tmp/to-ai-files/`（コンテナでは `/app/tmp/to-ai-files/`）に置いてもらう。
4. zip は scratchpad の空のディレクトリで展開して読む（`tmp/to-ai-files/` の中では展開しない）。

### B（A が難しいときだけ）: firewall を一時的に開けてもらう

- `.devcontainer/firewall-allow.local` に `productionresultssa<N>.blob.core.windows.net` を足して
  `init-firewall.sh` を流し直す、という手順を示す。`<N>` は毎回変わり上限も分からないので、
  確実には通らない（`productionresultssa30` は開けた後もつながらなかった例がある）。
- 置き場は Azure の共有 IP なので、開けると外へ持ち出す道が広がる。**用が済んだらすぐ閉じてもらう**
  よう、終わった時点で人間に知らせる。

## 取れたあと

- 原因の行（エラーのメッセージ）を Issue か PR 本文に数行引用する。秘密（トークン・URL のクエリ）は載せない。
- 同じ型の失敗を繰り返さないよう、分かった原因はこのファイルの下に短く足してよい。

## これまでに分かった原因

- **lock を変えた PR だけ「Install Dependencies」で全ジョブが落ちる**: キャッシュの無い `npm ci` で
  `playwright-chromium` の postinstall がブラウザを落とし、Playwright が runner の OS（ubuntu-26.04）に
  対応していないと `Playwright does not support chromium on ubuntu26.04-x64` で落ちる。
  `.github/actions/install-dependencies` で `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` を付けて回避。
- **apt の取得の一時的な失敗**（libpango など）: 流し直すと通る。
