---
name: review-feature
description: 機能開発完了後の総合レビュー。機能面・UI/UX・セキュリティの3観点で、ドキュメントに基づくPlaywright MCP動作確認とAPIセキュリティテストを実施する。
argument-hint: "[機能名 or docsパス（例: classroom, docs/classroom）]"
---

# /review-feature - 機能レビュースキル

機能開発完了後に実施する総合レビュー。以下の3観点からレビューを行う:

- **機能面**: docs に定義された仕様通りに動作するか
- **UI/UX**: 初心者が迷わないか、経験者に邪魔にならないか
- **セキュリティ**: API レベルの情報漏洩、認可チェック

---

## Phase 0: 対象機能の特定とドキュメント確認

### 0a. 対象機能の特定

`$ARGUMENTS` から対象機能を特定する。

- `classroom` → `docs/classroom/`
- `docs/classroom` → `docs/classroom/`
- 引数なし → ユーザーに確認

### 0b. ドキュメントの存在確認

対象機能の `docs/<feature>/` ディレクトリを確認する。

**ドキュメントが存在しない場合:**

1. ユーザーに報告し、まずドキュメントを作成することを提案する:

   ```
   docs/<feature>/ にドキュメントが見つかりません。
   レビューにはドキュメントが前提条件です。

   以下の手順で進めることを提案します:
   1. 機能のドキュメントを作成する（README.md, user-stories.md, ui-ux.md, architecture.md）
   2. ドキュメントのみの PR を作成し、内容が期待通りかをレビューしていただく
   3. PR マージ後に、あらためて /review-feature を実行する

   ドキュメントの作成を開始しますか？
   ```

2. ユーザーが承認したら、コードベースを調査してドキュメントを作成する
3. ドキュメント PR を作成してマージを依頼する
4. **レビューは実施しない** — マージ後にあらためて `/review-feature` を実行してもらう

**ドキュメントが存在する場合:** Phase 1 へ進む。

### 0c. ペルソナの確認

`docs/<feature>/` 内に personas（ペルソナ）の定義があるか確認する。

**ペルソナが定義されていない場合:**

ユーザーにインタビューする:

```
この機能の主なユーザーは誰ですか？ペルソナを定義してレビューの基準にします。

例（classroom の場合）:
- 先生: Google Classroom は使えるが Smalruby ははじめて
- 生徒: Smalruby は使えるがクラス機能ははじめて

各ペルソナについて以下を教えてください:
1. ロール（先生、生徒、管理者など）
2. 前提知識（何は使えて、何がはじめてか）
3. 主な利用シナリオ
```

インタビュー結果を `docs/<feature>/` に追記し、コミットする（レビューブランチに含める）。

**ペルソナが定義されている場合:** そのまま使用する。

---

## Phase 1: ユーザーインタビュー

以下の項目をユーザーに確認する。すべてを一度に聞く（1回のメッセージにまとめる）。

### 1a. レビュー観点の選択

```
どの観点でレビューしますか？（複数選択可、おすすめは「すべて」）

A. 機能面 — docs の仕様通りに動作するかを確認
B. UI/UX — ペルソナの視点で使いやすさを確認（Playwright MCP で実際に操作）
C. セキュリティ — API の認可チェック、情報漏洩テスト

選択肢: A / B / C / すべて
```

### 1b. テスト環境

```
テスト環境はどちらを使いますか？

a) 本番 (https://smalruby.app) — ログインが必要な場面で依頼します
b) ローカル (http://localhost:8601) — DEV_BYPASS_TOKEN で認証をスキップします

選択肢: a / b
```

### 1c. 結果の出力形式

```
レビュー結果をどの形式で出力しますか？（おすすめは「両方」）

a) GitHub Issue に起票する
b) Markdown ファイルとして出力する（docs/reviews/<feature>-<date>.md）
c) 両方

選択肢: a / b / c
```

### 1d. 重点的に確認したい箇所（任意）

```
特に重点的に確認したい箇所はありますか？（任意、なければ Enter）

例: 「提出フローが心配」「セッション切れの挙動」「新しく追加した課題配信」
```

---

## Phase 2: コンテキストの読み込み

Phase 1 の回答に基づいて、必要なコンテキストファイルを読み込む。

| 選択 | 読み込むファイル |
|------|--------------|
| A (機能面) | `.claude/skills/review-feature/context-functional.md` |
| B (UI/UX) | `.claude/skills/review-feature/context-ui-ux.md` |
| C (セキュリティ) | `.claude/skills/review-feature/context-security.md` |
| すべて | 上記3つすべて |

各コンテキストファイルを読み込み、その指示に従ってレビューを実行する。

対象機能のドキュメントも読み込む:
- `docs/<feature>/README.md`
- `docs/<feature>/user-stories.md`
- `docs/<feature>/ui-ux.md`
- `docs/<feature>/architecture.md`
- `docs/<feature>/source-code.md`
- `docs/<feature>/testing.md`
- その他 `docs/<feature>/` 内のファイル

---

## Phase 3: レビュー実行

選択された各観点のコンテキストファイルの指示に従い、順番にレビューを実行する。

**実行順序:** 機能面 → UI/UX → セキュリティ

各観点のレビューが完了したら、発見事項を蓄積する。

### テスト環境の設定

**本番環境 (smalruby.app) の場合:**
- Playwright MCP で `https://smalruby.app?no_beforeunload=1` を使用
- ログインが必要な場面ではユーザーに依頼する:
  ```
  Google ログインが必要です。ブラウザで以下の操作をお願いします:
  1. [具体的な操作手順]
  完了したら「OK」と入力してください。
  ```
- ユーザーの操作完了を待ってからテストを続行する

**ローカル環境 (localhost:8601) の場合:**
- `docker compose up app` が起動していることを確認（起動していなければ起動を依頼）
- `http://localhost:8601?no_beforeunload=1` を使用
- 先生ログインは `?classrole=teacher&devlogin=<DEV_BYPASS_TOKEN>` でバイパス
- DEV_BYPASS_TOKEN は `infra/smalruby-classroom/.env.stg` から読み取る

---

## Phase 4: レビュー結果のまとめ

### レビューレポートのテンプレート

```markdown
# 機能レビュー: <機能名>

**レビュー日**: YYYY-MM-DD
**レビュー観点**: 機能面 / UI/UX / セキュリティ
**テスト環境**: 本番 (smalruby.app) / ローカル (localhost:8601)
**ペルソナ**: <ペルソナ一覧>

## サマリー

| 観点 | 発見数 | Critical | Warning | Info |
|------|--------|----------|---------|------|
| 機能面 | N | N | N | N |
| UI/UX | N | N | N | N |
| セキュリティ | N | N | N | N |

## 発見事項

### 機能面

#### [Critical/Warning/Info] <タイトル>
- **場所**: <画面名 or API エンドポイント>
- **期待**: <docs に書かれた期待動作>
- **実際**: <実際の動作>
- **スクリーンショット**: (あれば)
- **再現手順**: <手順>

### UI/UX

#### [Critical/Warning/Info] <タイトル>
- **ペルソナ**: <影響を受けるペルソナ>
- **場所**: <画面名>
- **問題**: <具体的な問題>
- **改善案**: <提案>

### セキュリティ

#### [Critical/Warning/Info] <タイトル>
- **カテゴリ**: 認可 / 情報漏洩 / 入力検証 / CORS / レート制限
- **場所**: <API エンドポイント or コード箇所>
- **問題**: <具体的な問題>
- **再現手順**: <curl コマンド等>
- **修正案**: <提案>

## 推奨アクション

1. [Critical] ...
2. [Warning] ...
3. [Info] ...
```

### 重要度の定義

| レベル | 定義 |
|--------|------|
| **Critical** | リリースブロッカー。セキュリティ脆弱性、データ漏洩、主要フローが動かない |
| **Warning** | リリース前に対応すべき。UX の問題、仕様との不一致、エッジケース |
| **Info** | 改善提案。あると良い改善、ベストプラクティスからの逸脱 |

---

## Phase 5: 結果の出力

Phase 1c の回答に基づいて出力する。

### a) GitHub Issue の場合

レビューレポートを `/tmp/review-body.md` に書き出し、Issue を作成する:

```bash
gh issue create \
  --repo smalruby/smalruby3-editor \
  --title "review: <機能名> 機能レビュー (<date>)" \
  --body-file /tmp/review-body.md \
  --label "review"

rm /tmp/review-body.md
```

`review` ラベルが存在しない場合は先に作成する:

```bash
gh label create review --repo smalruby/smalruby3-editor --description "Feature review" --color "7057ff" 2>/dev/null || true
```

### b) Markdown ファイルの場合

```bash
mkdir -p docs/reviews
```

`docs/reviews/<feature>-<YYYY-MM-DD>.md` にレビューレポートを書き出す。

### c) 両方の場合

a) と b) の両方を実行する。

---

## Phase 6: 最終報告

ユーザーに日本語でレビュー結果を報告する:

```
## レビュー完了: <機能名>

### サマリー
- Critical: N件
- Warning: N件
- Info: N件

### 主な発見事項
1. [Critical] ...
2. [Warning] ...

### 出力
- GitHub Issue: <URL>
- レビューファイル: docs/reviews/<feature>-<date>.md

Critical の発見事項がある場合は、優先的に対応することをおすすめします。
```

---

## エラーハンドリング

- **Playwright MCP 接続エラー**: ブラウザが起動しているか確認を促す
- **API 接続エラー**: 環境変数やサービスの起動状態を確認する
- **ドキュメント不足**: Phase 0b のフローに従う
- **テスト中のエラー**: エラーの内容を記録し、レビュー項目として報告する（レビュー自体は続行）
