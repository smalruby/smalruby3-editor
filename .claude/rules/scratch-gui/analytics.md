# GA の計測（GTM / GA4）

`analytics.event(...)` を足す・変える・消すとき、またはそのための GTM・GA4 の設定をするときのルール。
仕組み・**GTM と GA4 のいまの設定**・手順の正は **`docs/analytics/README.md`**。このファイルは守ることだけを書く。

## コードを変えたら、対で更新する

- 新しい category・新しい項目・項目の名前の変更・category の削除をしたら、**`docs/analytics/README.md` の「category の一覧」「項目の一覧」を同じ PR で更新**し、**PR 本文の「人間の作業」に GTM・GA4 の作業を書く**（docs の「GTM・GA4」のチェックリストから要るものを貼る）。
  - コードだけ足して GTM を直さないと、イベントは **GA4 に届かない**（トリガーの正規表現に category が無いと発火しない）。実際に `lessons` / `classroom_student` / `welcome` で起き、GA4 に届いていなかった。
- イベントの意味（いつ送るか・値）は、その機能の docs に表で書く（`docs/lessons/README.md` の「GA の計測」が手本）。

## コードの決まり

- 追加の項目は `label` に詰めず、dataLayer の項目として `analytics.event({category, action, label, ...項目})` で送る（`lib/analytics.js` のマーカー `extra GA params`）。
- **category の中では、いつも同じ項目を全部入れ、使わない項目は `undefined` にする**（GTM の data layer が前の値を覚えているため）。
- **個人・クラスを特定する値を送らない**（クラス・課題・席番号・ニックネーム・参加コード・セッション・id・入力した文字）。文字列の値は決めた値だけを通す。
- 判断は純粋関数、送るのはコンテナ。計測の失敗は握りつぶす。先生のログイン中など、数がゆがむときは送らない。

## 上限

- **GA4 のイベントのパラメータは 1 イベント 25 個まで。共通のタグ「GA4 - smalruby custom events」はもう 25 個**。項目を足すときは、そのタグに足さず、category 用にタグを分ける（手順は docs の「上限と注意」）。
- 名前を新しく作る前に、既存の項目（`seconds` など）で意味が同じものが無いか見る。同じ意味なら同じ名前を使う（変数・カスタム定義を共有できる）。
- 種類の多い値（id・時刻・自由な文字）を GA4 のカスタム ディメンションにしない。

## AI が GTM・GA4 を操作するとき

- **ログインは人間**。GTM の**公開**と、GA4 の設定を変える前に、何を変えるかを人間に見せて確かめる。
- ファイル（エクスポート・インポートの JSON）は**人間経由で受け渡す**: 人間 → AI は `tmp/to-ai-files/`、AI → 人間は `tmp/from-ai-files/`。Playwright（ホストの Chrome）ではダウンロードの中身もファイルの選択も扱えない。
- 公開の前に GTM のプレビューで、GA4 への送信（`g/collect` の `en=` / `ep.` / `epn.`）を確かめる。テストで送るイベントの `action` は `gtm_test_` で始める。
- 設定を変えたら、**`docs/analytics/README.md` の「いまの設定」を更新する**（GTM・GA4 の状態の正はこのファイル）。
