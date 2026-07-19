---
paths:
  - "infra/smalruby-admin/"
  - "infra/smalruby-admin/**"
  - "infra/smalruby-admin/**/*"
---

# smalruby-admin

CDK project for the Admin service (API Gateway + Lambda + DynamoDB) — 管理 SPA（`packages/admin`）のバックエンド。**最高権限の面**なので変更時は以下を厳守する。

## 不変条件（セキュリティ）

- **deny-by-default**: 認可は `SmalrubyAdmins{suffix}` テーブル（PK: `email`・RETAIN）への存在照合のみ。登録は AWS コンソール手動操作が唯一の経路 — **アプリ内に管理者管理 API/UI を作らない**（EPIC #1073 F4）
- **sub 固定**: 初回ログインで Google `sub` を行に固定（`ConditionExpression: attribute_not_exists`）。以後 email 一致でも sub 不一致は 403。この防御を外さない
- **admin 専用 Google Client ID**（`ADMIN_GOOGLE_CLIENT_ID`）で `aud` 検証。エディタの `GOOGLE_CLIENT_ID` と共用しない。**prod は未設定だと stack が throw**（このガードを外さない）
- `DEV_BYPASS_TOKEN` は stg のみ（prod 設定で throw、classroom/bug-report と同じガード）
- **全変更操作に `audit()`**（構造化ログ）。prod の LogGroup retention は **ONE_YEAR**（艦隊標準の ONE_MONTH からの意図的逸脱 — 監査記録のため）
- エラー規約は bug-report 準拠: 認証失敗 401 / 認可失敗 **403**（classroom の 401 とは異なる）

## DoS / コスト防御（ソース公開前提の脅威モデル）

ソースは公開されるため攻撃者は既知エンドポイント・ルート・env 変数名を把握している前提で設計する。

- **prod は API Gateway の JWT authorizer**（issuer `https://accounts.google.com` / audience = `ADMIN_GOOGLE_CLIENT_ID`）で、正当な署名トークンでない要求を **Lambda 到達前に 401** で弾く。認証なしフラッドで Lambda 起動・Lambda ログ ingestion 課金を発生させない。**stg は dev bypass（非 JWT）を使う E2E のため authorizer を付けない**（この stage 差を消さない）。Lambda 側の fail-closed 認可は両 stage で維持（多層）
- **スロットルは単一運用者向けに絞る**（rate 5 / burst 10）。緩めない
- **X-Ray（トレーシング）を有効化しない**・**API Gateway アクセスログを有効化しない**（コスト源。現状 Lambda は全て PassThrough）
- Lambda ログは監査行と 500 のみ。**401/403/404/400 パスにアプリログを足さない**（DoS 時のログ ingestion 課金を防ぐ）
- `dev-admin@example.com` は **stg の allowlist のみ**。prod に登録しない

## cross-service アクセス

管理対象（classroom / shared-assignments のテーブル・バケット）へは**ステージ別の名前規約**で ARN を構築して grant する。**classroom スタック側に変更を加えない**（N2）。バグ報告ドメインは既存 bug-report API を SPA から直接呼ぶ（本スタックは関与しない）。

## 運用

- 管理者登録・監査ログ検索・デプロイ手順: `docs/admin/operations.md`
- ステージ切替は `.env` symlink（`.claude/rules/infra/development.md` 共通規約）
