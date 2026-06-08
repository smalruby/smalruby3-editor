---
name: bug-report
description: プログラム不具合報告 (smalruby-bug-report) を DynamoDB から取得し、添付作品を S3 からダウンロードして GitHub Issue 化し、対応後に状態・返信を報告者へ書き戻す。管理者の追加/削除も行う。
argument-hint: "[サブコマンド: list | show <reportId> | issue <reportId> | reply <reportId> | admins | add-admin <email> | remove-admin <email>] [stg|prod（デフォルト: prod）]"
---

# /bug-report - 不具合報告トリアージワークフロー

`infra/smalruby-bug-report` に届いたプログラム不具合報告を、開発者 (管理者) が
処理するためのワークフロー。**AWS クレデンシャル必須**（DynamoDB / S3 を直接操作する）。
報告者のアプリ内「私の不具合報告」には、ここで書き戻した `status` / `developerReply`
がそのまま表示される。

> 機能全体の設計は `docs/bug-report/README.md`、バックエンド詳細は
> `.claude/rules/infra/smalruby-bug-report.md` を参照。
> 関連 Issue: #731。

## 前提

- AWS クレデンシャル (devpod ワークフローでは **ホスト側**で実行する)
- リージョン: `ap-northeast-1`
- テーブル名 / バケット名はステージで変わる:
  | リソース | prod | stg |
  |----------|------|-----|
  | 報告テーブル | `BugReports` | `BugReports-stg` |
  | 管理者テーブル | `BugReportAdmins` | `BugReportAdmins-stg` |
  | 作品バケット | `smalruby-bug-report` | `smalruby-bug-report-stg` |

以下では `$T` = 報告テーブル, `$A` = 管理者テーブル, `$B` = バケット, `$R` = `ap-northeast-1` とする。
prod がデフォルト。`stg` が引数で指定されたら `-stg` サフィックス付きを使う。

## 個人情報の取り扱い (重要)

- 報告には `ownerEmail`（報告者のメール）が含まれる。**GitHub Issue 本文にメールアドレスをそのまま書かない**。`/feedback` スキルと同様にマスキングする（例 `exa***@***.jp`）。
- 添付作品 (sb3) や説明文に個人情報が含まれうる。Issue には作品を直接添付せず、ローカルにダウンロードして開発者が手元で確認する。
- 報告者への返信 (`developerReply`) は子どもが読む前提でやさしい日本語にする。

---

## Phase 1: 未対応の報告を一覧する (`list`)

`open` / `in_progress` の報告を新しい順に表示する。

```bash
aws dynamodb query \
  --region ap-northeast-1 \
  --table-name BugReports \
  --index-name entityType-createdAt-index \
  --key-condition-expression "entityType = :e" \
  --expression-attribute-values '{":e":{"S":"bugReport"}}' \
  --scan-index-forward false \
  --output json
```

各報告について以下を表で示す: `reportId`(先頭8桁) / `status` / `createdAt` / `ownerProvider` /
`projectName` / 説明文の先頭60字 / `developerReply` の有無。`ownerEmail` はマスクして表示。

`status` でフィルタしたい場合はクライアント側で絞る (open のみ等)。

---

## Phase 2: 1 件の詳細表示と作品ダウンロード (`show <reportId>`)

```bash
# メタデータ
aws dynamodb get-item --region ap-northeast-1 --table-name BugReports \
  --key '{"reportId":{"S":"<reportId>"}}' --output json

# 作品とスクショをローカル (tmp/bug-report/<reportId>/) にダウンロード
mkdir -p tmp/bug-report/<reportId>
aws s3 cp s3://smalruby-bug-report/<reportId>/project.sb3 tmp/bug-report/<reportId>/ --region ap-northeast-1
aws s3 cp s3://smalruby-bug-report/<reportId>/thumbnail.png tmp/bug-report/<reportId>/ --region ap-northeast-1
# screenshotCount 個のスクショ
aws s3 cp s3://smalruby-bug-report/<reportId>/ tmp/bug-report/<reportId>/ --recursive --exclude "*" --include "screenshot-*.png" --region ap-northeast-1
```

- `tmp/` 配下に保存する（`.gitignore` 済み）。
- 説明文・`appContext`（rubyVersion, url 等）・`userAgent` を整形して表示し、再現の手がかりにする。
- ダウンロードした `project.sb3` は smalruby エディタにドラッグ&ドロップ、または
  `http://localhost:8601` で開いて再現確認する。

---

## Phase 3: GitHub Issue 化する (`issue <reportId>`)

報告を smalruby/smalruby3-editor の Issue にする。本文は **Write ツールで一時ファイル**に
書いてから `gh issue create --body-file` で作成する（シェルエスケープ回避。git-workflow.md 参照）。

Issue 本文テンプレート:

```markdown
## 不具合報告 (bug-report #<reportId 先頭8桁>)

報告者: <ownerProvider> / <マスク済み email>
報告日時: <createdAt>
Rubyバージョン: <appContext.rubyVersion>
環境: <userAgent>

## 内容（報告者の説明）

> <description>

## 添付

- 作品 / サムネ / スクショは bug-report ストレージに保管（管理者のみアクセス可）。
  ローカル確認: `tmp/bug-report/<reportId>/`
- reportId: `<reportId>`（フル）

## 再現確認

- [ ] 作品を開いて再現した
- [ ] 原因を特定した
```

作成後、Issue 番号を報告に紐づけたい場合は `developerReply` の下書きに含めず、対応完了時に
Phase 4 で報告者向けのやさしい返信を書く（Issue URL は内部管理用、報告者には出さない）。

---

## Phase 4: 状態と返信を書き戻す (`reply <reportId>`)

報告者のアプリ内「私の不具合報告」に反映される。`status` を `resolved` / `wont_fix` に
すると **対応完了後 N 日 (RESOLVED_TTL_DAYS) で自動削除** される（TTL が付く）。

```bash
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
TTL=$(( $(date +%s) + 30*24*60*60 ))   # resolved/wont_fix のときだけ付与

# resolved にして返信を書き戻す例
aws dynamodb update-item --region ap-northeast-1 --table-name BugReports \
  --key '{"reportId":{"S":"<reportId>"}}' \
  --update-expression "SET #st = :st, developerReply = :dr, updatedAt = :ua, #ttl = :ttl" \
  --expression-attribute-names '{"#st":"status","#ttl":"ttl"}' \
  --expression-attribute-values "{
    \":st\":{\"S\":\"resolved\"},
    \":dr\":{\"S\":\"<やさしい日本語の返信>\"},
    \":ua\":{\"S\":\"$NOW\"},
    \":ttl\":{\"N\":\"$TTL\"}
  }"
```

- `in_progress` にするだけ（返信なし）なら `developerReply` と `#ttl` を省く。
- `status` は `open` / `in_progress` / `resolved` / `wont_fix` のいずれか。
- 返信文は子ども向け。例:「ほうこくありがとう！◯◯がなおりました。さいしんよみこみでつかえます。」

書き戻し後、報告者が同じ Google/Microsoft アカウントでログインして「私の不具合報告」を
開くと、新しい状態と返信が表示されることを確認する（任意。Playwright で stg 検証可能）。

---

## Phase 5: 管理者の管理 (`admins` / `add-admin <email>` / `remove-admin <email>`)

複数管理者の基盤。管理者は **verified email** で照合される（`BugReportAdmins` テーブル +
`BOOTSTRAP_ADMIN_EMAILS` env）。ブートストラップ管理者はテーブルに行が無くても管理者。

```bash
# 一覧
aws dynamodb scan --region ap-northeast-1 --table-name BugReportAdmins --output json

# 追加（email は小文字に正規化して保存）
aws dynamodb put-item --region ap-northeast-1 --table-name BugReportAdmins \
  --item "{\"email\":{\"S\":\"$(echo '<email>' | tr '[:upper:]' '[:lower:]')\"},\"addedBy\":{\"S\":\"<自分のemail>\"},\"addedAt\":{\"S\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}}"

# 削除（ブートストラップ管理者は env 由来なのでテーブル削除しても管理者のまま）
aws dynamodb delete-item --region ap-northeast-1 --table-name BugReportAdmins \
  --key "{\"email\":{\"S\":\"$(echo '<email>' | tr '[:upper:]' '[:lower:]')\"}}"
```

将来 in-app 管理ダッシュボード UI が入ると、これらは管理者本人が GUI から実行できる
ようになる（本スキルは当面の運用手段）。

---

## 注意・ハマりどころ

- **メールのマスキングを忘れない**: Issue・ログに生のメールを残さない。
- **TTL は terminal status のときだけ**: `open`/`in_progress` に戻すと TTL を REMOVE する
  （API の PATCH は自動でそうするが、CLI で直接触るときは手動で消す: `REMOVE #ttl`）。
- **prod / stg の取り違え注意**: デフォルト prod。stg を触るときは必ず `-stg` サフィックス。
- **S3 は presigned のみ公開**: バケットは Block Public Access 全 ON。`aws s3 cp` は
  クレデンシャル経由でアクセスする（presigned URL は不要）。
- **ダウンロードファイルは `tmp/` 配下**に置く（リポジトリを汚さない）。
