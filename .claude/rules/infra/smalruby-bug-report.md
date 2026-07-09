---
paths:
  - "infra/smalruby-bug-report/"
  - "infra/smalruby-bug-report/**"
  - "infra/smalruby-bug-report/**/*"
---

# smalruby-bug-report

CDK project for the **program bug report** service (API Gateway HTTP API v2 + Lambda + DynamoDB + S3).

ユーザーが「プログラムの不具合」を、編集中の作品 (sb3 + サムネ + ブロックスクショ) を
添付して報告する機能のバックエンド。報告者は Google / Microsoft アカウントでログインし、
開発者 (管理者) は対応後に状態と返信を書き戻す。報告者はアプリ内「私の不具合報告」で
状態と返信をプル確認する。機能要望など不具合以外は従来どおり Google フォーム
(本サービスの対象外)。

> 関連 Issue: #731。フロントは `packages/scratch-gui/src/components/bug-report-modal/` 他。
> 機能全体のドキュメントは `docs/bug-report/README.md`。

## Architecture

- **API Gateway HTTP API v2**: built-in CORS、全ルートのエンドポイント
- **Lambda (Node.js 22)**: 単一ハンドラー (`lambda/handler.ts`)
- **DynamoDB**:
  - `BugReports{suffix}` — PK `reportId`(UUID)、GSI `ownerSub-createdAt-index`
    (本人の報告一覧)、GSI `entityType-createdAt-index` (管理者の全報告一覧)。
    TTL `ttl` は **resolved / wont_fix になった時のみ** 付与 (open は無期限保持)。
  - `BugReportAdmins{suffix}` — PK `email`。管理者レジストリ。**RemovalPolicy: RETAIN**。
- **S3** `smalruby-bug-report{suffix}`: Block Public Access 全 ON + enforceSSL。
  作品は **presigned URL 経由のみ**。download は **管理者にのみ発行**、報告者には発行しない。
  lifecycle は一律 TTL ではなく **`max(RESOLVED_TTL_DAYS * 6, 180)` 日**の孤児掃除のみ
  （open の報告の作品を消さないための意図的設計）。
- **認証**: Google / Microsoft ID Token (classroom と同じ `iss` 自動判別 + JWKS 検証)。
  **任意の認証済みユーザー** が報告できる (事前登録不要)。

## 認可モデル (重要)

| 操作 | 認可 |
|------|------|
| `POST /bug-reports` (作成) | 任意の認証済みユーザー (ID Token)。ルート個別スロットリングあり |
| `GET /bug-reports` (自分の一覧) | 任意の認証済みユーザー。`ownerSub` で絞る。**S3 キー/DL URL は返さない**。`hiddenByOwner === true` の報告は除外 |
| `PATCH /bug-reports/{id}` (本人の hide/unhide) | **報告者本人のみ**。`hiddenByOwner` フラグを立てる/外すだけで**削除はしない**。他人・存在しない report は 404（存在秘匿） |
| `GET /admin/bug-reports` (全一覧) | **管理者のみ** (403 if not) |
| `GET /admin/bug-reports/{id}` (詳細 + 作品 DL) | **管理者のみ** |
| `PATCH /admin/bug-reports/{id}` (status / developerReply) | **管理者のみ**。更新時に `hiddenByOwner` を false に戻す（返信を報告者に見せるため）。terminal status (resolved/wont_fix) で TTL 付与、再オープンで TTL 除去 |
| `GET/POST /admin/admins`, `DELETE /admin/admins/{email}` | **管理者のみ** |

管理者の判定 (`isAdminIdentity`):
1. verified email が `BOOTSTRAP_ADMIN_EMAILS` (env) に含まれる → 管理者
2. または `BugReportAdmins` テーブルに該当 email の行がある → 管理者
3. email が無いユーザーは管理者になれない

→ classroom の co-teacher (email マッチ) と同型。最初の管理者は env でブートストラップ、
以降は既存管理者が `POST /admin/admins` で追加。ブートストラップ管理者は API で削除不可。

管理者アクション (閲覧/DL/更新/管理者追加削除) は `audit()` で構造化ログを CloudWatch に出力。

## Commands

```bash
# Install dependencies
docker compose run --rm -w /app/infra/smalruby-bug-report infra npm install

# Unit + authz tests (mocked DynamoDB/S3, fast)
docker compose run --rm -w /app/infra/smalruby-bug-report infra npm test

# Synth / diff / deploy (requires AWS creds — run on host per devpod workflow)
docker compose run --rm -w /app/infra/smalruby-bug-report infra npx cdk synth
docker compose run --rm -w /app/infra/smalruby-bug-report infra npx cdk diff
docker compose run --rm -w /app/infra/smalruby-bug-report infra npx cdk deploy

# Integration tests (実 stg エンドポイントへ HTTP 送信、BUG_REPORT_API_ENDPOINT 必須)
docker compose run --rm -w /app/infra/smalruby-bug-report infra npm run test:integration
```

クレデンシャルなしの環境では `cdk synth` の `HostedZone.fromLookup` が
`account/region not specified` で失敗する。コンストラクトツリーだけ検証したい場合は
`BUG_REPORT_CUSTOM_DOMAIN=false CDK_DEFAULT_ACCOUNT=<dummy> npx cdk synth` でドメイン
ルックアップをスキップできる (synth スモークテスト用途のみ。deploy では使わない)。

## Stage Switching

```bash
cd infra/smalruby-bug-report
rm .env && ln -s .env.stg .env    # → stg
rm .env && ln -s .env.prod .env   # → prod
```

## Custom Domains

| Stage | Domain |
|-------|--------|
| stg | `stg.bug-report.api.smalruby.app` |
| prod | `bug-report.api.smalruby.app` |

## Environment Variables

`.env.stg` / `.env.prod` 参照。主な変数:

| Variable | Description |
|----------|-------------|
| `STAGE` | Deployment stage (`stg`, `prod`) |
| `GOOGLE_CLIENT_ID` / `MICROSOFT_CLIENT_ID` | ID Token 検証 (classroom と同値) |
| `BOOTSTRAP_ADMIN_EMAILS` | 常に管理者扱いする email (カンマ区切り)。最初の管理者 |
| `CORS_ALLOWED_ORIGINS` | 許可 origin (カンマ区切り)。localhost は stg のみ |
| `RESOLVED_TTL_DAYS` | resolved/wont_fix 後の自動削除日数 (stg 1, prod 30) |
| `PRESIGNED_URL_UPLOAD_EXPIRY` / `_DOWNLOAD_EXPIRY` | presigned 有効期限 (秒) |
| `DEV_BYPASS_TOKEN` | **stg のみ**。Google/MS 認証をスキップ (自動テスト用)。prod に設定すると deploy が落ちる |
| `BUG_REPORT_API_ENDPOINT` | integration テスト用 (deploy 後に記入) |

## Deploy 後の手順

1. `cdk deploy` 後、出力の `ApiEndpoint` / `CustomDomainUrl` を `.env.stg` の
   `BUG_REPORT_API_ENDPOINT` に記入
2. `npm run test:integration` で認可マトリクス (401/403/200) を確認
3. フロントの `.env` (monorepo root) に `BUG_REPORT_API_ENDPOINT` を設定し直す
   (webpack が埋め込む。`.github/workflows/ci-cd.yml` にも追加)

## Source

実装場所: `lambda/handler.ts`, `lib/smalruby-bug-report-stack.ts`, `bin/smalruby-bug-report.ts`
ユニット/認可テスト: `lambda/tests/handler.test.ts`, `lambda/tests/handler-authz.test.ts`
