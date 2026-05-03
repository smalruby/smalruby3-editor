# Smalruby インフラ全体

Smalruby のバックエンドは **AWS CDK** で管理される 4 つの独立したプロジェクトから構成される。すべて **ap-northeast-1 (東京)** リージョンにデプロイされ、共通の `.env` symlink パターンで stage 切替を行う。

## プロジェクト一覧

| プロジェクト | 用途 | 主要 AWS サービス | カスタムドメイン (prod) | 統合ドキュメント |
|---|---|---|---|---|
| **`infra/smalruby-mesh-v2/`** | Mesh v2 リアルタイム通信 | AppSync (GraphQL) + DynamoDB | `graphql.api.smalruby.app` | [`docs/mesh-v2/`](../mesh-v2/) |
| **`infra/smalruby-rubytee-relay/`** | Rubytee (AI チャット) リレー | API Gateway HTTP API + Lambda + DynamoDB | `rubytee.api.smalruby.app` | [`docs/rubytee/`](../rubytee/) |
| **`infra/smalruby-classroom/`** | クラスルーム機能 | API Gateway HTTP API + Lambda + DynamoDB + S3 | `classroom.api.smalruby.app` | [`docs/classroom/`](../classroom/) |
| **`infra/smalruby-api/`** | 共通 API (CORS proxy / Mesh zone / Scratch proxy) | API Gateway HTTP API + Lambda | `api.smalruby.app` | [`smalruby-api.md`](smalruby-api.md) |

## 共通パターン

### AWS 基本

| 項目 | 値 |
|---|---|
| リージョン | `ap-northeast-1` (東京) |
| CDK バージョン | 2.232.x |
| Lambda ランタイム | Node.js 22.x（mesh-v2 のみ Ruby も使用） |
| DynamoDB 課金 | `PAY_PER_REQUEST` (オンデマンド) |
| TTL 属性 | 全テーブル `ttl` フィールドで自動削除 |
| ログ保持 | prod: 1 ヶ月 / stg: 1 週間 |
| CORS preflight キャッシュ | 24 時間 |

### Stage 管理 (.env symlink パターン)

すべての CDK プロジェクトは **`.env` symlink** で stage を切り替える：

```bash
cd infra/smalruby-mesh-v2

# stg に切り替え
rm .env && ln -s .env.stg .env

# prod に切り替え
rm .env && ln -s .env.prod .env

# stg2 (検証環境) に切り替え
rm .env && ln -s .env.stg2 .env
```

- **コマンドラインで env vars を上書きしない** (`.env` symlink を必ず使う)
- 詳細は **`.claude/rules/infra/development.md`** を参照

### Stage suffix の命名規則

CloudFormation スタック名・Lambda 関数名・DynamoDB テーブル名等に付く suffix：

```js
const stageSuffix = stage === 'prod' ? '' : `-${stage}`;
```

例: `RubyteeRelayHandler` (prod) / `RubyteeRelayHandler-stg` (stg) / `RubyteeRelayHandler-stg2` (stg2)

### カスタムドメイン

すべて **`api.smalruby.app`** を Route53 親ゾーンとして以下のサブドメインを使う：

| Stage | パターン |
|---|---|
| prod | `<service>.api.smalruby.app` |
| stg | `stg.<service>.api.smalruby.app` |
| stg2 | `stg2.<service>.api.smalruby.app` |

**例外**: `smalruby-api` は **`api.smalruby.app` 直下** (旧 SAM スタックからの移行で既存ドメインをインポート)。

### CORS

| Stage | 許可オリジン (デフォルト) |
|---|---|
| stg | `https://smalruby.app`, `https://smalruby.jp`, `http://localhost:8601` |
| prod | `https://smalruby.app`, `https://smalruby.jp` (localhost 除外) |

→ ローカル開発は **stg エンドポイント** を使う。prod は CORS で localhost を弾く。

### デプロイコマンド

```bash
# 共通: docker compose で infra service を使う
docker compose run --rm -w /app/infra/<project> infra npm install
docker compose run --rm -w /app/infra/<project> infra npx cdk synth
docker compose run --rm -w /app/infra/<project> infra npx cdk diff
docker compose run --rm -w /app/infra/<project> infra npx cdk deploy

# 例: rubytee-relay の stg デプロイ
cd infra/smalruby-rubytee-relay
rm .env && ln -s .env.stg .env
docker compose run --rm -w /app/infra/smalruby-rubytee-relay infra npx cdk deploy
```

### 環境変数の `.env.example`

各プロジェクトに `.env.example` がある。新しい stage を作るときは：

```bash
cp .env.example .env.<stage>
# シークレット (ANTHROPIC_API_KEY, MESH_SECRET_KEY 等) を埋める
ln -sf .env.<stage> .env
```

## プロジェクト相関図

```
                          ┌───────────────────────┐
                          │  smalruby-gui (web)    │
                          │  smalruby.app          │
                          └──────────┬─────────────┘
                                     │
                ┌──────────┬─────────┼─────────┬──────────┐
                ▼          ▼         ▼         ▼          ▼
        smalruby-api  rubytee-   classroom  mesh-v2  (Google Drive,
        (api)         relay      (classroom (graphql  各種 OAuth)
        - cors-proxy  (rubytee)  .api)      .api)
        - mesh-zone               POST /...  AppSync
        - scratch-                                    subscription
        api-proxy                                     + polling
```

各 infra プロジェクトは独立して deploy される。スタック間に CFN export/import の依存はない (環境変数や Route53 経由でのみ繋がる)。

## per-project ドキュメント

### mesh-v2 (最も詳細)

充実したドキュメント群あり：

- **[`docs/mesh-v2/`](../mesh-v2/)** — クライアント + サーバ統合
- **[`infra/smalruby-mesh-v2/docs/architecture.md`](../../infra/smalruby-mesh-v2/docs/architecture.md)** — システムアーキテクチャ
- **[`infra/smalruby-mesh-v2/docs/api-reference.md`](../../infra/smalruby-mesh-v2/docs/api-reference.md)** — GraphQL スキーマ
- **[`infra/smalruby-mesh-v2/docs/deployment.md`](../../infra/smalruby-mesh-v2/docs/deployment.md)** — デプロイ手順
- **[`infra/smalruby-mesh-v2/docs/development.md`](../../infra/smalruby-mesh-v2/docs/development.md)** — 開発ガイド
- **[`infra/smalruby-mesh-v2/docs/operations.md`](../../infra/smalruby-mesh-v2/docs/operations.md)** — モニタリング・コスト
- `.claude/rules/infra/smalruby-mesh-v2.md` — 開発ルール

### rubytee-relay

Rubytee の統合ドキュメントは [`docs/rubytee/`](../rubytee/) を参照。インフラ実装の詳細は `.claude/rules/infra/smalruby-rubytee-relay.md` を参照。

主要構成:
- Lambda (Node.js 22, `lambda/handler.ts`) が Anthropic Claude API を中継
- DynamoDB (`RubyteeRelayRateLimit`) で IP ベースのレート制限 (デフォルト 35 分窓 40 リクエスト)
- Prompt caching (`cache_control: ephemeral`) でコスト削減
- 子供向けの安全策 (年齢チェック、メッセージ長制限、CORS)

### classroom

クラスルーム機能の統合ドキュメントは [`docs/classroom/architecture.md`](../classroom/architecture.md) を参照。

主要構成:
- Lambda (Node.js 22, `lambda/handler.ts`) で 13+ エンドポイント
- 3 テーブル: `Classrooms`, `ClassroomMemberships`, `ClassroomSubmissions`
- S3 (`smalruby-classroom-submissions`) で `.sb3` 提出物保管 (presigned URL)
- Google Classroom 連携 (Course / Assignment import)
- 認証: Google OAuth + Microsoft Entra ID
- レート制限: 200 req/s (prod) / `/classrooms/join` `/classrooms/lookup` のみ 10 req/s

### smalruby-api

→ **[`smalruby-api.md`](smalruby-api.md)** を参照（本 docs/infra/ の専用ファイル）。

## 関連ドキュメント

- `.claude/rules/infra/` 配下の各プロジェクトルール
- `CLAUDE.md` の "infra/" セクション
- [`docs/_template.md`](../_template.md) — 機能 docs テンプレート
- [`docs/scratch-vm/`](../scratch-vm/) — VM 内部仕様 (クライアント側)
