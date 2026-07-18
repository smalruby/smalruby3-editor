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

## cross-service アクセス

管理対象（classroom / shared-assignments のテーブル・バケット）へは**ステージ別の名前規約**で ARN を構築して grant する。**classroom スタック側に変更を加えない**（N2）。バグ報告ドメインは既存 bug-report API を SPA から直接呼ぶ（本スタックは関与しない）。

## 運用

- 管理者登録・監査ログ検索・デプロイ手順: `docs/admin/operations.md`
- ステージ切替は `.env` symlink（`.claude/rules/infra/development.md` 共通規約）
