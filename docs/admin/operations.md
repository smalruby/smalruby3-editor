# 管理 SPA（Admin）運用手順書

> **🆕 Smalruby 独自** — 管理 SPA（EPIC #1073）の運用者向け手順。設計は EPIC #1073 / スパイク #1074 の Decision Log（A〜F）。

## 管理者の登録（唯一の方法 = AWS コンソール手動操作）

アプリ内に管理者管理 UI は**存在しない**（F4・deny-by-default）。登録・削除は AWS コンソールでの DynamoDB 直接操作のみ:

1. AWS コンソール → DynamoDB → テーブル `SmalrubyAdmins`（prod）/ `SmalrubyAdmins-stg`（stg）
2. 「項目を作成」で以下を登録:
   - `email`（パーティションキー・文字列）: 管理者の **Google アカウントの verified email**（小文字）
   - 他の属性は不要（`sub` は**初回ログイン時に自動で固定**される）
3. 削除 = 項目の削除（即時に全アクセスが 403 になる）

### sub 固定（email 再利用防御）の仕組み

- 初回ログイン成功時に Google の `sub` が項目へ自動追記される（`firstLoginAt` も記録）
- 以後、**同じ email でも sub が異なる Google アカウントは 403**
- 管理者が正当に Google アカウントを作り直した場合は、コンソールで項目の `sub` 属性を削除すれば次回ログインで再固定される

## 認証構成

- **admin 専用 Google OAuth Client ID**（決定 B）: エディタの `GOOGLE_CLIENT_ID` とは別に GCP コンソールで作成し、`.env.prod` / `.env.stg` の `ADMIN_GOOGLE_CLIENT_ID` に設定する（**prod は未設定だとデプロイが落ちる**ガードあり）
  - 承認済み JavaScript 生成元: `https://smalruby.app`（+ stg 用に `http://localhost:8602`）
- stg のみ `DEV_BYPASS_TOKEN` による自動テスト用バイパスあり（prod 設定はデプロイ時に throw。バイパス identity `dev-admin@example.com` も **allowlist 登録が必要**）

## 監査ログ

- すべての管理操作は構造化ログ（`{"audit":true,"action":...,"adminEmail":...}`）として CloudWatch `/aws/lambda/SmalrubyAdminHandler{-stage}` に記録
- **prod の保持期間は 1 年**（通常の 1 ヶ月より長い。管理操作は監査対象のため）
- 検索例: CloudWatch Logs Insights で `filter audit = 1 | sort @timestamp desc`

## デプロイ

```bash
cd infra/smalruby-admin
ls -la .env                     # symlink でステージ選択（.env.stg / .env.prod）
eval "$(aws configure export-credentials --profile smalruby --format env)"
AWS_ACCOUNT_ID=007325983811 AWS_REGION=ap-northeast-1 npx cdk deploy --require-approval never
```

カスタムドメイン: `admin.api.smalruby.app`（prod）/ `stg.admin.api.smalruby.app`（stg）
