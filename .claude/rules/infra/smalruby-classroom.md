---
paths:
  - "infra/smalruby-classroom/"
  - "infra/smalruby-classroom/**"
  - "infra/smalruby-classroom/**/*"
---

# smalruby-classroom

CDK project for the Classroom service (API Gateway + Lambda + DynamoDB + S3).
先生がクラスを作成し、生徒が参加コードで参加して作品を提出する機能のバックエンド。

## ドキュメント

クラス機能の仕様は `docs/classroom/` 以下のドキュメントに詳しく記載されている:

| ドキュメント | 参照すべき場面 |
|-------------|-------------|
| `docs/classroom/architecture.md` | **API ルート、データモデル、認証フロー、CORS、レート制限** |
| `docs/classroom/cost-estimate.md` | AWS/GCP 費用見積もり |
| `docs/classroom/source-code.md` | Lambda ハンドラーの関数一覧、CDK コマンド |
| `docs/classroom/testing.md` | 結合テストの実行方法 |

## Architecture

- **API Gateway HTTP API v2**: 全ルートのエンドポイント（built-in CORS。許可ヘッダに
  `X-Google-Access-Token` を含む）。stage スロットリングに加え、`/classrooms/join` と
  `/classrooms/lookup` はルート個別に厳しめのスロットリングを設定
- **Lambda (Node.js 22)**: 単一ハンドラー (`lambda/handler.ts`) に全ビジネスロジック
- **DynamoDB (9 テーブル)**:
  - `Classrooms{suffix}` — GSI `joinCode-index` / `teacherSub-index` / `groupId-index`（クラスに属する課題。#1146 で `groupId IN (...)` の Scan を置換）
  - `ClassroomMemberships{suffix}` — GSI `sessionToken-index`
  - `ClassroomSubmissions{suffix}` — GSI `classroomId-memberId-index`
  - `ClassroomKickRequests{suffix}` — GSI `classroomId-seatNumber-index`（退室依頼 #692）
  - `ClassroomGroups{suffix}` — GSI `teacherSub-index`（クラス=学級、長期 TTL 400日）
  - `SharedAssignments{suffix}` — GSI `status-createdAt-index` / `authorSub-createdAt-index` / `passcode-index`（みんなの課題 #1066。**TTL なし・prod RETAIN + PITR**）
  - `SharedAssignmentReports{suffix}` — 通報（TTL 90日）
  - `ClassroomCoTeacherIndex{suffix}` — 共同管理者の逆引き索引 #1146（PK `coTeacherEmail` / SK `resourceKey` = `assignment#<id>` \| `group#<id>`）。`coTeacherEmails` はリスト属性で GSI にできないため別テーブル。**認可はこの索引を見ない**（真実は item 上のリスト）。既存データは `bin/backfill-coteacher-index.ts` で流し込む
  - `ClassroomNotifications{suffix}` — お知らせ #1111（PK teacherSub / SK notificationId。**書き手は admin スタックのみ**・この Lambda は Query/UpdateItem だけ grant）
  - 上記注記のないものは TTL `ttl`・**RemovalPolicy: DESTROY**
- **S3** `smalruby-classroom-submissions{suffix}`: 提出ファイル (project.sb3, thumbnail.png,
  screenshots)。lifecycle 期限 = `CLASSROOM_TTL_DAYS`
- **認証**: Google / Microsoft ID Token（`iss` 自動判別 + JWKS 検証。bug-report と同型）。
  生徒は参加時に発行される **sessionToken** で認可
- **Google Classroom API**: コース一覧取得、課題投稿

## 認可モデル（実装事実）

- 先生側の操作は `canManageClassroom` = **クラス所有者（`teacherSub`）または
  co-teacher（`coTeacherEmails` に verified email が含まれる）**。
- 認可失敗は `AuthError` → **401**（bug-report の 403 と非対称）。他人のリソースは
  存在秘匿の **404**、kick された生徒は `KickedError` → **410**（`reason:'kicked'`）。
- `audit()` 構造化ログは**無い**（bug-report のみの機構）。
- **`DEV_BYPASS_TOKEN`**: stg 等でのみ有効（自動テスト用に認証をスキップ、
  `?devlogin=<token>` で教師ログイン）。**prod に設定すると stack が throw して deploy が
  落ちる**（このガードを外さない）。

## Commands

```bash
# Install dependencies
docker compose run --rm -w /app/infra/smalruby-classroom infra npm install

# Synthesize CloudFormation template
docker compose run --rm -w /app/infra/smalruby-classroom infra npx cdk synth

# Show diff against deployed stack
docker compose run --rm -w /app/infra/smalruby-classroom infra npx cdk diff

# Deploy (uses STAGE from .env symlink)
docker compose run --rm -w /app/infra/smalruby-classroom infra npx cdk deploy

# Run integration tests
docker compose run --rm -w /app/infra/smalruby-classroom infra npm run test:integration
```

## Stage Switching

```bash
cd infra/smalruby-classroom

# staging
rm .env && ln -s .env.stg .env

# production
rm .env && ln -s .env.prod .env
```

## Custom Domains

| Stage | Domain |
|-------|--------|
| stg | `stg.classroom.api.smalruby.app` |
| prod | `classroom.api.smalruby.app` |

## Environment Variables

See `.env.stg` / `.env.prod` for stage-specific configuration. Key variables:
- `STAGE` — Deployment stage
- `GOOGLE_CLIENT_ID` / `MICROSOFT_CLIENT_ID` — ID Token 検証（bug-report と同値）
- `DEV_BYPASS_TOKEN` — **stg のみ**（prod 設定時は deploy が落ちる）
- `CORS_ALLOWED_ORIGINS` — Comma-separated allowed origins
- `CLASSROOM_TTL_DAYS` — Auto-delete period (30 days prod, 1 day stg)
- `CLASSROOM_CUSTOM_DOMAIN` — カスタムドメイン上書き（`false` で無効化）
- `MAX_STUDENT_COUNT`（既定 50）/ `SESSION_ACTIVE_TTL_SECONDS`（既定 3600）
- `PRESIGNED_URL_UPLOAD_EXPIRY`（既定 900）/ `PRESIGNED_URL_DOWNLOAD_EXPIRY`（既定 3600）
- `JOIN_RATE_LIMIT_WINDOW_SECONDS`（既定 60）/ `JOIN_RATE_LIMIT_MAX_ATTEMPTS`（既定 50）
- `CLASSROOM_API_ENDPOINT` — For integration tests
