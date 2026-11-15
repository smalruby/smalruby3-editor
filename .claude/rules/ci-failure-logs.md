# CI が落ちたときのログの取り方（人間への依頼）

CI（GitHub Actions）のジョブが落ちて原因を調べるとき、**コンテナからはジョブのログ本文を取れない**。
推測で直さず、下の手順でログを手に入れてから原因を決める。

## なぜコンテナから取れないか

- `gh run view --log-failed` / `gh api repos/{owner}/{repo}/actions/jobs/<id>/logs` は、ログの置き場
  （`productionresultssa<N>.blob.core.windows.net`。`<N>` は毎回変わる）へ転送される。
  この置き場は devcontainer の egress firewall の allowlist に無いので、つながらない
  （`Failed to connect to productionresultssa30.blob.core.windows.net`）。
- `gh api .../check-runs/<id>/annotations` は `Process completed with exit code 1.` しか返さない。
- 読めるのは、ジョブ・段（step）の名前と成否まで:
  `gh run view <run> --json jobs -q '.jobs[]|.name+" "+(.conclusion//"")+" "+([.steps[]|select(.conclusion=="failure")|.name]|join(","))'`
- Bot はジョブの再実行もできない（`Resource not accessible by integration`）。流し直すときは
  develop を merge して push するか、PR を閉じて開き直す。

## 人間に頼むこと（この順で）

まず段の名前まで自分で絞り、**どのジョブのどの段のログが要るか**を書いて頼む。

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
