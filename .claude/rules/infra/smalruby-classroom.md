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

- **API Gateway HTTP API**: 全ルートのエンドポイント
- **Lambda (Node.js 20)**: 単一ハンドラーに全ビジネスロジック
- **DynamoDB**: Classrooms, ClassroomMemberships, ClassroomSubmissions (3 テーブル)
- **S3**: 提出ファイル (project.sb3, thumbnail.png, screenshots)
- **Google OAuth 2.0**: 先生の認証 (ID Token 検証)
- **Google Classroom API**: コース一覧取得、課題投稿

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
- `GOOGLE_CLIENT_ID` — Google OAuth client ID
- `CORS_ALLOWED_ORIGINS` — Comma-separated allowed origins
- `CLASSROOM_TTL_DAYS` — Auto-delete period (30 days prod, 1 day stg)
- `CLASSROOM_API_ENDPOINT` — For integration tests
