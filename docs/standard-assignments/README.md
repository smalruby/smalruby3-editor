# 標準課題（assignments/）

> **🆕 Smalruby 独自** — upstream に存在しない、Smalruby のために新規追加された機能

クラス管理で先生が使える「標準課題」を、エディタと一緒に `https://smalruby.app/assignments/` で公開する。
授業 1 時間を 1 つの課題とし、単元は課題の並び（シリーズ）にする。ワークシートは課題の資料の 1 つ。

いまあるシリーズ:

| シリーズ | 内容 | 合わせて使うレッスン |
|---|---|---|
| `es-pg-kyou-kara-programmer` | 小学 4〜6 年のプログラミングの時間。1 つめの課題「はじめの一歩」は、スモウルビーの地図（`map.pdf`）と最初の 5 分の台本（先生用・`script.pdf`） | 「きょうからプログラマー」（`docs/lessons/design.md` の「はじめの一歩」） |
| `jhs-tech-d2-chat` | 中学校 技術・家庭科〈技術分野〉D(2)「双方向性のあるコンテンツ」8 時間 | 「チャットをつくろう」（対応は `docs/lessons/design.md` の「ワークシートとのリンク」） |

「はじめの一歩」は単元ではないが、レッスン「きょうからプログラマー」を使う小学校の授業の 1 時間めなので、そのレッスンに合わせたシリーズの 1 つめの課題にした（あとの時間の課題を同じシリーズに足せる）。小学校のプログラミングは決まった教科の単元ではないので、ID の教科と単元の部分は `pg`（プログラミング）とコースの名前（`kyou-kara-programmer`）にした。

## 決まりごと

| 項目 | 決まり |
|---|---|
| 置くもの | **成果物だけ**（課題の説明の JSON・PDF・sb3）。原本（ワークシートの HTML）と生成スクリプトはリポジトリの外に置く |
| ライセンス | **CC0 1.0**（`assignments/LICENSE`）。リポジトリのほかの部分のライセンスとは別。CC0 にできない素材（Scratch のライブラリの絵など）は入れない |
| 単位 | 1 時間 = 1 課題（`hours: 1`）。単元はシリーズ（`series.json` の `assignments` の順） |
| 学校の種類 | `es`（小学校）・`jhs`（中学校）。小学校のように教科の単元が決まっていないときは、ID の教科を `pg`、単元をレッスンのコースの名前にする |
| ID | `<学校の種類>-<教科>-<学習指導要領の単元>-<題材>-<番号>-<内容>`（例: `jhs-tech-d2-chat-01-intro`）。シリーズの ID は課題の ID の先頭（`jhs-tech-d2-chat`） |
| URL | `/assignments/<ID>/` が最新、`/assignments/<ID>/<版>/` が版を固定した URL |
| 版 | `x.y.z`。**一度置いた版のディレクトリは変えない**。直すときは新しい版のディレクトリを足し、`<ID>/` をその版と同じ中身にする |
| 公開するもの・しないもの | ワークシート（生徒用・先生用）と評価規準・ルーブリックは公開する。期末試験の問題は公開しない |
| スターター（sb3） | いまは全部なし（`starter: null`） |

## ディレクトリ

```
assignments/
  index.html            課題の一覧のページ（smalruby.app/assignments/）
  index.json            シリーズと課題の一覧
  LICENSE               CC0 1.0
  README.md             リポジトリを読む人向け（公開しない）
  <シリーズの ID>/
    series.json  rubric.pdf          最新
    <版>/series.json  <版>/rubric.pdf  版を固定
  <課題の ID>/
    assignment.json  worksheet.pdf  worksheet-teacher.pdf          最新
    <版>/assignment.json  <版>/worksheet.pdf  <版>/worksheet-teacher.pdf
```

資料のファイル名は課題ごとに `assignment.json` の `files` に書く（「はじめの一歩」は `map.pdf`・`script.pdf`）。

同じ PDF が最新と版の 2 か所にあるが、Git は同じ中身を 1 つとして持つので、リポジトリの大きさは増えない。

## assignment.json

| 項目 | 内容 |
|---|---|
| `schemaVersion` | この形の版（いまは `1`） |
| `id` / `version` | 課題の ID と版 |
| `series` / `number` | シリーズの ID と、シリーズの中の順番（1 から） |
| `title` / `goal` | 課題の名前とめあて |
| `schoolType` / `subject` / `curriculum` / `grade` / `hours` | 学校の種類（`jhs` など）・教科・学習指導要領の単元・学年・時間数 |
| `worksheetPages` | ワークシート全体の中のページ（0 から） |
| `lessons` | 合わせて使うスモウルビーのレッスン（`course` = コースの ID、`lessons` / `challenges` = レッスン・チャレンジの ID。`src/lib/lessons/courses.js`） |
| `submit` | 提出するもの（`project` = 作品の名前の例、`worksheet` = ワークシートを提出するか） |
| `files` | 資料（`file` = ファイル名、`kind` = 種類〔`worksheet` / `rubric` / `map`（スモウルビーの地図）/ `script`（授業の台本）〕、`audience` = `student` / `teacher`） |
| `starter` | スターターの sb3（いまは `null`） |
| `license` | `CC0-1.0` |

`series.json` は `id` / `version` / `title` / `description` / `assignments`（課題の ID の並び）/ `files`（評価規準など。無ければ空の配列）を持つ。

課題テンプレート（クラス管理で標準課題から課題を作る機能）は、これらの JSON を読む形にする（まだ無い）。

## 公開のしかた

- ビルドで `assignments/` をそのまま `build/assignments/`（本番は `dist/assignments/`）へコピーする
  （`packages/scratch-gui/webpack.config.js` の CopyWebpackPlugin。マーカー `standard assignments`）。`README.md` はコピーしない。
- PWA の precache には入れない（PDF は授業で印刷するもので、エディタを使うのに要らないため）。
- ブランチのプレビュー（`preview.smalruby.app/<slug>/assignments/`）でも見られる。

## 課題を足す・直す

1. 原本（リポジトリの外）を直し、PDF を作り直す。公開版では、CC0 にできない素材と、公開しない資料への参照を外す。
2. 新しい版のディレクトリ `<ID>/<新しい版>/` に置き、`<ID>/` をその版と同じ中身にする。`index.json` の版も上げる。
3. 新しい課題・シリーズは `index.json` と `index.html` に足す。
4. `packages/scratch-gui/test/unit/standard-assignments.test.js` を流す（最新と版の中身が同じか、ID・版・レッスンの ID が正しいか、一覧のページから全部の資料にリンクしているか）。

## 主要ファイル

| ファイル | 役割 |
|---|---|
| `assignments/` | 標準課題の成果物 |
| `packages/scratch-gui/webpack.config.js` | `assignments/` のコピーと precache からの除外 |
| `packages/scratch-gui/test/unit/standard-assignments.test.js` | 決まりごとのテスト |
