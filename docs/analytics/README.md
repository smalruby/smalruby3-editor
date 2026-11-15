# GA の計測（GTM / GA4）

> **🔧 upstream 改良** — upstream の `lib/analytics.js`（GTM の `dataLayer` に push する）をそのまま使い、Smalruby の独自のイベント（category）と、`label` に詰めない追加の項目（データレイヤー変数）を足している。
> 改良点: 追加の項目を dataLayer に入れ、前のイベントの項目を次のイベントで `undefined` に戻す（マーカー `extra GA params`）。

エディタの使われ方を GA4 で見るための仕組みと、**GTM・GA4 の設定のいまの状態**、**新しい計測を足すときの手順**をまとめる。
イベントごとの意味（いつ送るか・項目の値）は、それぞれの機能の docs に書く（下の「category の一覧」）。このファイルは、設定の側の正（真実）を持つ。

## 全体の流れ

```
コード: analytics.event({category, action, label, ...項目})
   │  src/lib/analytics.js
   ▼
dataLayer.push({...前の項目を undefined に戻す, ...項目, event: category, action, label})
   │
   ▼  GTM（コンテナ smalruby.app / GTM-KKFVD5ZC）
トリガー「CE - smalruby custom events」 … event が正規表現に一致したら
   │
   ▼
タグ「GA4 - smalruby custom events」 … イベント名 = {{Event}}（= category）
   │                                    パラメータ = action / label / 追加の項目（{{dlv - 名前}}）
   ▼
GA4（プロパティ smalruby.app / 測定 ID G-94VC8N0J4K）
   │  カスタム ディメンション・カスタム指標に登録した項目だけが、レポート・探索で使える
   ▼
探索（ファネルなど）
```

- **GA4 のイベント名は category**（`lessons`・`classroom_student` など）。`action` はイベントのパラメータ。
- **GTM が読み込まれるのは本番（develop のビルド）だけ**。`GTM_ID` は `.github/workflows/ci-cd.yml` で develop のときだけ渡す。ブランチのプレビュー（`preview.smalruby.app`）と開発サーバーには GTM が無いので、GA4 には送られない（`docs/infra/stg-prod-differences.md`）。
- 追加の項目は、`label` に詰めずに dataLayer の項目として同じ push に入れる。GTM の data layer は前の push の値を上書きされるまで覚えているため、`analytics.js` は前のイベントで入れた項目を、それを入れないあとのイベントで `undefined` に戻す。
- category ごとに「いつも同じ項目を全部入れ、使わない項目は `undefined` にする」決まりにしている（`lessons` は 6 個、`classroom_student` は 18 個）。同じ category の中で前の値が残らないようにするため。

## いまの設定

### GTM

| 項目 | 値 |
|---|---|
| アカウント / コンテナ | smalruby / smalruby.app（`GTM-KKFVD5ZC`） |
| ワークスペース | Default Workspace（1 つだけ） |
| タグ「Google タグ」 | `G-94VC8N0J4K`。トリガー Initialization - All Pages |
| タグ「GA4 - smalruby custom events」 | GA4 イベント。イベント名 `{{Event}}`。イベントパラメータは下の「項目の一覧」の全部（**25 個 = 上限**） |
| トリガー「CE - smalruby custom events」 | カスタムイベント。イベント名が次の正規表現に一致 |
| データレイヤー変数 | `dlv - <項目名>`（データレイヤーのバージョン 2・既定値なし）。項目ごとに 1 つ |

トリガーの正規表現:

```
^(block_run|mode_switch|furigana_toggle|ruby_tab|rubytee|classroom|google_drive|mesh_v2|smalrubot_s1|lessons|classroom_student|welcome)$
```

### GA4

| 項目 | 値 |
|---|---|
| プロパティ | smalruby.app（測定 ID `G-94VC8N0J4K`） |
| カスタム ディメンション（イベント スコープ） | `action`・`label` と、下の「項目の一覧」でディメンションのもの（いま 23 個・上限 50） |
| カスタム指標（イベント スコープ） | `seconds`（単位: 秒）・`minutes`（単位: 分）（いま 2 個・上限 50） |
| 探索 | 下の「探索」 |

### category の一覧

| category | 送るところ | イベントの意味（docs） | GTM のトリガー |
|---|---|---|---|
| `block_run` | `containers/controls.jsx` | — | ✅ |
| `mode_switch` / `furigana_toggle` | `components/ruby-toolbar/ruby-toolbar.jsx` | [`ruby-editor/`](../ruby-editor/)・[`furigana/`](../furigana/) | ✅ |
| `ruby_tab` | `containers/ruby-tab.jsx` | [`ruby-editor/`](../ruby-editor/) | ✅ |
| `rubytee` | （いまのコードには無い） | [`rubytee/`](../rubytee/) | ✅ |
| `classroom` | `containers/classroom-modal.jsx`（`join` / `submit`） | [`classroom/`](../classroom/) | ✅ |
| `classroom_student` | `lib/classroom-student-analytics.js` | [`classroom/ui-ux.md`](../classroom/ui-ux.md) の「GA の計測（生徒の参加〜提出）」 | ✅ |
| `google_drive` | `containers/google-drive-saver-hoc.jsx` | [`google-drive/`](../google-drive/) | ✅ |
| `mesh_v2` / `smalrubot_s1` | `containers/connection-modal.jsx` | [`mesh-v2/`](../mesh-v2/)・[`extension-smalrubot-s1/`](../extension-smalrubot-s1/) | ✅ |
| `lessons` | `lib/lessons/lesson-analytics.js` | [`lessons/README.md`](../lessons/README.md) の「GA の計測」 | ✅ |
| `welcome` | `components/welcome-tooltip/`・`containers/welcome-modal-hoc.jsx` | [`welcome/README.md`](../welcome/README.md) の「GA4 イベント」 | ✅ |
| `extensions` / `library` / `open_debug_modal` / `close_debug_modal` / `change_topic_debug_modal` | upstream のコード | — | ❌（upstream のイベント。数えていない） |

### 項目の一覧（データレイヤー変数 = タグのパラメータ = GA4 のカスタム定義）

| 項目 | 使う category | GA4 |
|---|---|---|
| `action` | すべて | ディメンション |
| `label` | すべて（`lessons`・`welcome` などが使う。`classroom_student` は使わない） | ディメンション |
| `course_id` / `lesson_id` / `challenge_id` / `from_assignment` / `page` | `lessons` | ディメンション |
| `seconds` | `lessons`・`classroom_student` | **指標**（秒） |
| `minutes` | `classroom_student` | **指標**（分） |
| `result` / `previous_seat` / `previous_taken` / `is_previous` / `after_guide` / `main` / `others_count` / `kind` / `via` / `others_opened` / `button` / `from` / `state` / `reason` / `step` / `first` | `classroom_student` | ディメンション |

- 同じ名前の項目は category をまたいで 1 つの変数・1 つのカスタム定義を共有する（`seconds` など）。意味が同じものだけを同じ名前にする。
- 種類の少ない数（`page`・`others_count`）は、内訳に使えるようにディメンションにした。時間（`seconds`・`minutes`）は種類が多いので指標にした。

### 探索

| 探索 | タブ | ステップ（どれもイベント名 `classroom_student`） |
|---|---|---|
| 生徒の参加〜提出（classroom_student） | 参加〜提出 | `join_code`（`result=ok`）→ `seat_view` → `seat_select`（`result=ok`）→ `start_view` → `start_choose` → `submit_open` → `submit_result`（`result=done`） |
| 同上 | おかえりなさい | `welcome_view` → `welcome_action` → `submit_open` → `submit_result`（`result=done`） |

- どちらもオープンファネル（途中のステップから入った人も数える）で、経過時間を出す。内訳は「デバイス カテゴリ」。
- ステップの条件は「イベント名」AND「カスタム ディメンション `action` が完全一致」（必要なら AND `result`）。

## 新しい計測を足すとき

### コード

1. category を決める（既存と重ならない小文字の英字と `_`）。判断（イベントの形・項目・値）は純粋関数にし、送るのはコンテナにする（`lib/lessons/lesson-analytics.js`・`lib/classroom-student-analytics.js` の形）。
2. **category の中では、いつも同じ項目を全部入れ、使わない項目は `undefined` にする**。決めた項目のほかは送る前に落とす。
3. **個人やクラスを特定する値を送らない**（クラス・課題・席番号・ニックネーム・参加コード・セッション・id・入力した文字）。文字列の値は決めた値だけを通す。
4. 計測の失敗は握りつぶし、エディタの動きを止めない。授業の準備でゆがむもの（先生のログイン中など）は送らない。
5. 機能の docs にイベントの表を書き、**このファイルの「category の一覧」「項目の一覧」を更新する**。

### GTM・GA4（人間の作業として PR に書く）

PR の本文の「人間の作業」に、次のうち要るものを書く。GTM・GA4 は develop へのマージより先に済ませてよい（まだ来ないイベントは数えられないだけ）。

- [ ] **新しい category** → トリガー「CE - smalruby custom events」の正規表現に足す（**これを忘れると何も届かない**）
- [ ] **新しい項目** → データレイヤー変数 `dlv - <項目名>` を作る（データレイヤーのバージョン 2・既定値なし）
- [ ] タグ「GA4 - smalruby custom events」のイベントパラメータに足す（名前 = 項目名、値 = `{{dlv - <項目名>}}`）。**いま 25 個で上限**なので、下の「上限」を先に読む
- [ ] GTM のプレビューで発火と値を確かめる（下の「確かめ方」）
- [ ] GTM を公開する（バージョン名と説明を付ける）
- [ ] GA4 のカスタム ディメンション（イベント スコープ・パラメータ名 = 項目名）か、カスタム指標（数で集計するもの・単位を付ける）を登録する
- [ ] 要るなら探索を作る
- [ ] このファイルの「いまの設定」を更新する

### 確かめ方（GTM のプレビュー）

1. GTM の［プレビュー］→ Tag Assistant に `https://smalruby.app/?no_beforeunload=1` を入れてつなぐ（プレビュー環境には GTM が無いので本番につなぐ）。
2. まだ本番に出ていないイベントは、開いた smalruby.app のコンソールから、`analytics.js` と同じ形で push する。前の項目を `undefined` に戻す形にする。
   ```js
   window.dataLayer.push({ event: 'classroom_student', action: 'gtm_test_seat_select', label: undefined, result: 'ok', seconds: 12 });
   ```
3. ネットワークの `https://www.google-analytics.com/g/collect?...` で、`en=<category>` と `ep.<項目>`（文字列・真偽）/ `epn.<項目>`（数）が付いていることを見る。
4. テストのイベントも本物の GA4 に入る（デバッグのヒット）。`action` を `gtm_test_` で始めて、本物と見分けられるようにする。

## 上限と注意

- **GA4 のイベントのパラメータは 1 イベントあたり 25 個まで**。タグ「GA4 - smalruby custom events」はすべての category で共有していて、いま 25 個ちょうど。値が `undefined` の項目は送られないが、タグに書けるのは 25 個まで。次に項目を足すときは、新しい category 用に**タグを分ける**（タグ「GA4 - <category>」を作り、トリガーをその category だけに一致させ、共通のトリガーの正規表現からその category を外す）。
- **カスタム ディメンションは 50 個、カスタム指標は 50 個まで**（標準のプロパティ）。
- **カスタム定義は、登録したあとに届いたデータにしか付かない**。過去のデータにはさかのぼらない。
- **登録していない項目は、探索で使えない**（GA4 には届いていても、ディメンションとして選べない）。
- **指標は、探索では合計・平均で見る**。中央値は出せない。分布を見たいときは、秒をバケット（例: `0-10` / `10-30` / `30-60` / `60+`）にした別の項目をディメンションとして送る。
- 種類の多い値（id・時刻・自由な文字）をディメンションにしない（GA4 の「(other)」行にまとめられ、レポートが壊れる）。

## AI（Playwright）が設定するとき

ホストの Chrome を Playwright MCP で headful に操作する（構成は `.claude/rules/scratch-gui/e2e-test.md` の Playwright MCP の節）。**ログインは人間**、それ以外は人間に確かめながら AI が操作する。**GTM の公開の前**には人間に確認する。

- **使うアカウント**: GTM・GA4 の権限があるアカウント（smalruby.jp）。松江市の教育アカウントでは GTM・GA が使えない（「サービスが許可されていません」になる）。
- **ファイルの受け渡しは人間経由**: Playwright から、ホストの Chrome がダウンロードしたファイルの中身は読めず、ファイルの選択もできない。
  - 人間 → AI: リポジトリの `tmp/to-ai-files/` に置いてもらう（コンテナからは `/app/tmp/to-ai-files/`）。
  - AI → 人間: `tmp/from-ai-files/` に置き、人間に（必要なら別のブラウザで）アップロードしてもらう。
- **変数・パラメータをまとめて足す**: 画面で 1 つずつ作るより、JSON で足すほうが速く、打ちまちがいもない。
  1. 管理 →［コンテナをエクスポート］→ Default Workspace →［エクスポート］。人間がファイルを `tmp/to-ai-files/` に置く。
  2. AI が JSON に変数（既存の `dlv - action` をひな形に、`variableId` を新しい番号に）・タグのパラメータ（`eventSettingsTable`）・トリガーの正規表現を足し、`tmp/from-ai-files/` に置く。元との差分を人間に見せる。
  3. 人間が管理 →［コンテナをインポート］で選ぶ。ワークスペースは**既存**の Default Workspace、オプションは**統合** →**矛盾するタグ、トリガー、変数を上書きする**。
  4. AI がワークスペースの変更数と、タグ・トリガー・変数の中身を読んで確かめる。
- **GA4 のカスタム定義の作成フォーム**:［カスタム ディメンションを作成］→ ディメンション名・説明・イベント パラメータ（自由に入力できる）→［保存］。**`Escape` を押すとフォームごと閉じて保存されない**。入力欄から抜けるときは見出しを押す。
- **GA4 のファネルの条件**:
  - まだデータの無いイベント名は、候補に出ない。検索して「イベントを作成: "<名前>"」を選ぶ（探索の条件に名前を使うだけで、GA4 にイベントは作られない）。
  - イベントの「パラメータを追加」には、データのある項目しか出ない。「新しい定義を登録」は押さない（カスタム定義が二重になる）。代わりに［AND］→ 登録済みのカスタム ディメンション（`action` など）→［フィルタを追加］→「完全一致（=）」にする。
  - テンプレートのステップ（`first_open` など）は、ステップの「︙」→ 削除で消す。

## 主要ファイル

| ファイル | 説明 |
|---|---|
| `packages/scratch-gui/src/lib/analytics.js` | GA4 のラッパー。dataLayer に push する（マーカー `extra GA params`） |
| `packages/scratch-gui/src/playground/index.ejs` | GTM のスニペット（`GTM_ID` / `GTM_ENV_AUTH`） |
| `packages/scratch-gui/webpack.config.js` | `GTM_ID` / `GTM_ENV_AUTH` をビルドに入れる |
| `.github/workflows/ci-cd.yml` | 本番のビルドにだけ `GTM_ID` を渡す |
| `packages/scratch-gui/src/lib/lessons/lesson-analytics.js` | `lessons` のイベント |
| `packages/scratch-gui/src/lib/classroom-student-analytics.js` | `classroom_student` のイベント |
