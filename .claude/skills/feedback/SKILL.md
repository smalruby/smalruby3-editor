---
name: feedback
description: Google Form のフィードバック（Google Spreadsheet からコピー）を GitHub Discussions の Feedback カテゴリに転記する。
argument-hint: "<TSV形式のフィードバックデータ（スプレッドシートからコピー）>"
---

# /feedback - フィードバック転記ワークフロー

Google Form 経由で収集されたユーザーフィードバックを、GitHub Discussions の Feedback カテゴリに転記する。

## 入力データ形式

`$ARGUMENTS` には Google Spreadsheet からコピーした TSV（タブ区切り）データを受け取る。

各行は以下の4カラム（タブ区切り）:

```
タイムスタンプ<TAB>メールアドレス<TAB>お問い合わせの種類<TAB>お問い合わせの内容
```

例:
```
2026/02/26 11:53:55	example@example.ed.jp	機能要望	｛なにかと言っているとき｝というブロックが欲しいです。
```

複数行の場合はバッチ処理する。

---

## Phase 1: データのパースと検証

1. `$ARGUMENTS` をタブ文字で分割してパースする
2. 各行が4カラム（タイムスタンプ、メールアドレス、種類、内容）であることを検証する
3. パースに失敗した場合はエラーを表示し、正しい形式を案内する:
   ```
   データの形式が正しくありません。Google Spreadsheet の行をそのままコピー＆ペーストしてください。
   形式: タイムスタンプ<TAB>メールアドレス<TAB>お問い合わせの種類<TAB>お問い合わせの内容
   ```

---

## Phase 2: 重複チェック

転記済みのフィードバックを二重に作成しないよう、既存の Discussion を確認する。

```bash
gh api graphql -f query='
  query {
    repository(owner: "smalruby", name: "smalruby3-develop") {
      discussions(categoryId: "DIC_kwDOFahn7M4C36ax", first: 50, orderBy: {field: CREATED_AT, direction: DESC}) {
        nodes {
          title
        }
      }
    }
  }
'
```

各行のタイムスタンプ（`YYYY/MM/DD HH:MM` 部分）が既存 Discussion のタイトルに含まれている場合はスキップ候補とする。

---

## Phase 3: Discussion の内容生成

各フィードバック行について以下を生成する。

### メールアドレスのマスク処理

- ローカルパート（`@` の前）: 先頭3文字を残して `***` に置換
- ドメイン（`@` の後）: 最後のドット以降（TLD）を残して `***` に置換
- 例: `example@example.ed.jp` → `exa***@***.ed.jp`
- 例: `tanaka123@gmail.com` → `tan***@***.com`
- ローカルパートが3文字以下の場合: 先頭1文字を残して `***` に置換

### タイトル生成

```
YYYY/MM/DD HH:MM [お問い合わせの種類] お問い合わせの内容（50文字以内）
```

- タイムスタンプから秒を除去（`HH:MM` まで）
- お問い合わせの内容が50文字以内の場合はそのまま使用
- 50文字を超える場合は、内容を読んで50文字以内に要約する

### 本文生成

```markdown
YYYY/MM/DD HH:MM:SS に <マスク済みメール> からの smalruby.app への<お問い合わせの種類（ひらがな表記）>をいただきました。

\```text
<お問い合わせの内容（原文そのまま）>
\```

開発チームからの回答をお待ち下さい。
```

**お問い合わせの種類の表記変換（タイトル→本文）:**
- 機能要望 → 機能要望
- バグ報告 → バグ報告
- 質問 → 質問
- その他 → お問い合わせ
- 上記以外 → そのまま使用

---

## Phase 4: ユーザー確認

生成した Discussion のタイトルと本文をユーザーに提示し、承認を求める。

複数行の場合は全件をまとめて表示する。

```
以下の Discussion を作成します。よろしいですか？

---
### Discussion 1
**title:** 2026/02/26 11:53 [機能要望] ｛なにかと言っているとき｝というブロックが欲しいです。

**body:**
2026/02/26 11:53:55 に exa***@***.ed.jp からの smalruby.app への機能要望をいただきました。

(内容省略)
---

「OK」「はい」などで承認してください。修正が必要な場合はお知らせください。
```

ユーザーの明示的な承認を得てから Phase 5 へ進む。

---

## Phase 5: Discussion の作成

承認後、`gh api graphql` で Discussion を作成する。

**重要**: `-f body="$BODY"` は本文中の `%` や `!` が zsh でエスケープ問題を起こすため、必ず `-F` オプションでファイルから直接読み込む。

1. GraphQL クエリを `/tmp/feedback-graphql-query.txt` に書き出す（初回のみ）:

```
mutation($title: String!, $body: String!) { createDiscussion(input: { repositoryId: "R_kgDOFahn7A", categoryId: "DIC_kwDOFahn7M4C36ax", title: $title, body: $body }) { discussion { url } } }
```

2. 各 Discussion の本文を Write ツールで `/tmp/feedback-discussion-body-N.md` に書き出す

3. `-F` オプションでファイルを直接参照して API を呼び出す:

```bash
gh api graphql \
  -F query=@/tmp/feedback-graphql-query.txt \
  -F title='<タイトル>' \
  -F body=@/tmp/feedback-discussion-body-N.md

rm /tmp/feedback-discussion-body-N.md
```

4. 全件完了後にクエリファイルを削除:

```bash
rm /tmp/feedback-graphql-query.txt
```

複数行の場合は1件ずつ作成し、各 Discussion の URL を記録する。独立した API 呼び出しは並列実行してよい。

---

## Phase 6: 結果報告

作成した Discussion の URL をまとめてユーザーに報告する。

```
以下の Discussion を作成しました:

1. [2026/02/26 11:53 [機能要望] ブロックが欲しい](URL)
2. ...

スキップした行（重複）:
- (該当行があれば表示)
```

---

## 回答コメントの投稿（転記後の運用）

作成済みの Discussion に開発チームの回答を投稿する場合（`$ARGUMENTS` に Discussion URL と回答方針が渡される場合）は、以下のルールに従う。

### 回答の言語

フィードバック原文が英語の場合は英語で回答する（指示があればそれに従う）。

### 対応するもの

1. `smalruby/smalruby3-editor` に Issue を作成する（Feedback の Discussion URL を「関連」として本文に記載）
2. Discussion へのコメントに Issue URL を含める

### 対応しないもの（「対応しません」「予定はありません」と回答するもの）

回答コメントの投稿に加えて、**必ず以下の 2 つを行う**:

1. **タイトルに「【回答済み】」prefix を付与する**（既存タイトルの先頭にそのまま付ける）:

   ```bash
   gh api graphql -f query='mutation { updateDiscussion(input: { discussionId: "<discussion-node-id>", title: "【回答済み】<元のタイトル>" }) { discussion { title } } }'
   ```

2. **`close` ラベルを付与する**（label ID: `LA_kwDOFahn7M8AAAACakeKNg`）:

   ```bash
   gh api graphql -f query='mutation { addLabelsToLabelable(input: { labelableId: "<discussion-node-id>", labelIds: ["LA_kwDOFahn7M8AAAACakeKNg"] }) { clientMutationId } }'
   ```

### コメント投稿方法

本文は Write ツールで `/tmp/comment-N.md` に書き出し、`-F body=@` で投稿する（Phase 5 と同じ理由）:

```bash
gh api graphql \
  -F query='mutation($discussionId: ID!, $body: String!) { addDiscussionComment(input: { discussionId: $discussionId, body: $body }) { comment { url } } }' \
  -F discussionId='<discussion-node-id>' \
  -F body=@/tmp/comment-N.md
```

discussion の node ID は以下で取得できる:

```bash
gh api graphql -f query='query { repository(owner: "smalruby", name: "smalruby3-develop") { discussion(number: <N>) { id title body url } } }'
```

投稿前に、全コメント・Issue の内容をユーザーに提示して承認を得ること（Phase 4 と同様）。

---

## エラーハンドリング

- GraphQL API エラーが発生した場合はエラー内容を表示し、リトライするか確認する
- 認証エラーの場合は `gh auth status` の実行を案内する
