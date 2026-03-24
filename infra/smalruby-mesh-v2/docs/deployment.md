# Mesh v2 デプロイメントガイド

このドキュメントでは、Mesh v2インフラストラクチャのデプロイと動作確認の手順を説明します。

## 前提条件

- Docker および Docker Compose がインストール済み
- AWS CLI の認証情報がホスト上で設定済み（Docker に渡される）
- [smalruby3-editor](https://github.com/smalruby/smalruby3-editor) モノレポがクローン済み

## 1. AWS認証情報の確認

デプロイ前に、AWS CLIが正しく設定されているか確認します。

```bash
aws sts get-caller-identity
```

出力例:
```json
{
    "UserId": "AIDAXXXXXXXXXXXXXXXXX",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/your-username"
}
```

### 認証情報の設定（未設定の場合）

```bash
# AWS認証情報の設定
aws configure

# 入力項目:
# - AWS Access Key ID
# - AWS Secret Access Key
# - Default region name (例: ap-northeast-1)
# - Default output format (例: json)
```

## 2. 依存関係のインストール

モノレポのルートディレクトリから実行します:

```bash
# npm依存関係のインストール
docker compose run --rm infra npm install

# Ruby依存関係のインストール（テスト実行に必要）
docker compose run --rm infra bundle install

# TypeScriptのビルド
docker compose run --rm infra npm run build
```

## 3. ステージの選択（`.env` Symlink）

Mesh v2では、ステージごとに環境変数ファイルが用意されています。`.env` シンボリックリンクを切り替えることでデプロイ先を制御します。

### ステージ一覧

| ステージ | `.env` ファイル | 用途 |
|---------|---------------|------|
| `stg` | `.env.stg` | ステージング（開発用、高速な間隔） |
| `stg2` | `.env.stg2` | ステージング2（並行テスト用） |
| `prod` | `.env.production` | 本番環境（コスト最適化） |

### ステージの切り替え

```bash
cd infra/smalruby-mesh-v2

# ステージングに切り替え
rm .env && ln -s .env.stg .env

# 本番環境に切り替え
rm .env && ln -s .env.production .env

# 現在のステージを確認
ls -la .env
```

**CRITICAL**: 常に `.env` シンボリックリンクの切り替えでステージを指定してください。コマンドラインで環境変数を直接上書きすると、カスタムドメインなどの重要なリソースが削除される可能性があります。

### 環境変数の説明

| 変数名 | 開発環境推奨値 | 本番環境推奨値 | 説明 |
|--------|--------------|--------------|------|
| `STAGE` | `stg` | `prod` | デプロイステージ |
| `MESH_SECRET_KEY` | `dev-secret-key-for-testing` | （GitHub Secretsで設定） | ドメイン検証用の秘密鍵 |
| `MESH_HOST_HEARTBEAT_INTERVAL_SECONDS` | `15` | `60` | ホストのハートビート送信間隔（秒） |
| `MESH_HOST_HEARTBEAT_TTL_SECONDS` | `60` | `150` | ホストグループの有効期限（秒） |
| `MESH_MEMBER_HEARTBEAT_INTERVAL_SECONDS` | `15` | `120` | メンバーのハートビート送信間隔（秒） |
| `MESH_MEMBER_HEARTBEAT_TTL_SECONDS` | `60` | `600` | メンバーノードの有効期限（秒） |
| `MESH_MAX_CONNECTION_TIME_SECONDS` | `300` | `1500` | グループの最大接続時間（秒） |

**重要**:
- TTLはハートビート間隔の約5倍に設定することで、ネットワーク遅延やタイムアウトに対する耐性を確保
- 開発環境では15秒間隔で素早くテスト可能
- 本番環境では120秒間隔でコスト削減とUXのバランスを実現

## 4. CDK Bootstrap（初回のみ）

AWS環境でCDKを初めて使用する場合、bootstrapが必要です。

```bash
docker compose run --rm infra npx cdk bootstrap
```

Bootstrap完了後の出力例:
```
 ✅  Environment aws://123456789012/ap-northeast-1 bootstrapped.
```

### Bootstrap済みか確認する方法

```bash
aws cloudformation describe-stacks --stack-name CDKToolkit
```

スタックが存在すればbootstrap済みです。

## 5. デプロイ前の確認

CloudFormationテンプレートを生成して、デプロイ内容を確認します。

```bash
# CloudFormationテンプレートの生成
docker compose run --rm infra npx cdk synth

# デプロイ差分の確認
docker compose run --rm infra npx cdk diff
```

## 6. デプロイ実行

`.env` シンボリックリンクが正しいステージを指していることを確認してからデプロイします:

```bash
# 現在のステージを確認
ls -la infra/smalruby-mesh-v2/.env

# デプロイ（STAGE は .env symlink から読み取られる）
docker compose run --rm infra npx cdk deploy
```

### 6.1 デプロイされるリソース名

| Stage | Stack名 | DynamoDB Table名 | AppSync API名 |
|-------|---------|------------------|---------------|
| stg | MeshV2Stack-stg | MeshV2Table-stg | MeshV2Api-stg |
| prod | MeshV2Stack | MeshV2Table | MeshV2Api |

### 6.2 リソースタグ

すべてのリソースには以下のタグが自動的に付与されます:

| タグキー | 値（stg） | 値（prod） |
|---------|----------|-----------|
| Project | MeshV2 | MeshV2 |
| Stage | stg | prod |
| Service | AppSync | AppSync |
| ManagedBy | CDK | CDK |
| ResourceType | GraphQLAPI / DynamoDB | GraphQLAPI / DynamoDB |

これらのタグは、AWS Cost Explorer でのコスト分析やリソースグルーピングに使用できます。

デプロイには数分かかります。進行状況がリアルタイムで表示されます。

### デプロイ成功時の出力

デプロイが完了すると、以下のような出力が表示されます:

```
 ✅  MeshV2Stack

✨  Deployment time: 120.5s

Outputs:
MeshV2Stack.GraphQLApiEndpoint = https://xxxxxxxxxxxxxxxxxx.appsync-api.ap-northeast-1.amazonaws.com/graphql
MeshV2Stack.GraphQLApiId = xxxxxxxxxxxxxxxxxxxx
MeshV2Stack.GraphQLApiKey = da2-xxxxxxxxxxxxxxxxxxxxxxxxxx
MeshV2Stack.TableArn = arn:aws:dynamodb:ap-northeast-1:123456789012:table/MeshV2Table
MeshV2Stack.TableName = MeshV2Table

Stack ARN:
arn:aws:cloudformation:ap-northeast-1:123456789012:stack/MeshV2Stack/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**重要**: `GraphQLApiEndpoint` と `GraphQLApiKey` の値を控えてください。動作確認で使用します。

### 6.3 デプロイ後のカスタムドメイン確認

デプロイ後、カスタムドメインが正しく設定されていることを確認します:

```bash
# すべてのAppSyncカスタムドメインを確認
aws appsync list-domain-names --query "domainNameConfigs[].domainName" --output table

# 期待されるドメイン:
#   graphql.api.smalruby.app        (prod)
#   stg.graphql.api.smalruby.app    (stg)
#   stg2.graphql.api.smalruby.app   (stg2)

# DNS解決の確認
dig stg.graphql.api.smalruby.app A +short
dig graphql.api.smalruby.app A +short
```

カスタムドメインが欠けている場合は、正しい `.env` シンボリックリンクで再デプロイしてください。

## 7. 動作確認

### 7.1 AWS Management Consoleでの確認

#### AppSync API の確認

1. AWS Management Console にログイン
2. **AppSync** サービスに移動
3. **MeshV2Api** を選択
4. **Schema** タブでGraphQLスキーマを確認

#### DynamoDB Table の確認

1. AWS Management Console で **DynamoDB** サービスに移動
2. **Tables** から **MeshV2Table** を選択
3. **Indexes** タブで **GroupIdIndex** GSIを確認

### 7.2 GraphQL API のテスト

AppSync Consoleの **Queries** タブで、以下のクエリをテストできます。

#### テスト1: グループの作成 (createGroup)

```graphql
mutation CreateGroup {
  createGroup(
    name: "テストグループ1"
    hostId: "host-001"
    domain: "test-domain"
    useWebSocket: true
  ) {
    id
    domain
    fullId
    name
    hostId
    expiresAt
    useWebSocket
  }
}
```

#### テスト2: グループ一覧の取得 (listGroupsByDomain)

```graphql
query ListGroups {
  listGroupsByDomain(domain: "test-domain") {
    id
    domain
    fullId
    name
    hostId
    expiresAt
  }
}
```

#### テスト3: スキーマのイントロスペクション

GraphQL APIが正しく動作しているか確認:

```graphql
query IntrospectionQuery {
  __schema {
    queryType {
      name
    }
    mutationType {
      name
    }
    subscriptionType {
      name
    }
  }
}
```

期待される出力:
```json
{
  "data": {
    "__schema": {
      "queryType": {
        "name": "Query"
      },
      "mutationType": {
        "name": "Mutation"
      },
      "subscriptionType": {
        "name": "Subscription"
      }
    }
  }
}
```

#### テスト4: 統合された Subscription の購読 (onMessageInGroup)

`wscat` または AppSync Console の **Queries** タブで、統合された Subscription が正しく動作することを確認します。

```graphql
subscription OnMessageInGroup {
  onMessageInGroup(groupId: "test-group", domain: "test-domain") {
    groupId
    domain
    nodeStatus {
      nodeId
      data {
        key
        value
      }
    }
    batchEvent {
      events {
        name
      }
    }
    groupDissolve {
      message
    }
  }
}
```

購読した状態で、別のタブから `reportDataByNode` mutation を実行し、データがリアルタイムで届くことを確認してください。

### 7.3 CLIからのテスト

`curl` コマンドでAPIをテストすることもできます。

```bash
# 環境変数の設定
export APPSYNC_ENDPOINT="<GraphQLApiEndpoint の値>"
export API_KEY="<GraphQLApiKey の値>"

# イントロスペクションクエリの実行
curl -X POST "$APPSYNC_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "query": "query { __schema { queryType { name } mutationType { name } subscriptionType { name } } }"
  }' | jq
```

### 7.4 リソースタグの確認

デプロイされたリソースにタグが正しく付与されているか確認します。

**AppSync APIのタグ確認:**

```bash
# ステージング環境
API_ARN=$(aws appsync list-graphql-apis --query "graphqlApis[?name=='MeshV2Api-stg'].arn" --output text)
aws appsync list-tags-for-resource --resource-arn $API_ARN

# 本番環境
API_ARN=$(aws appsync list-graphql-apis --query "graphqlApis[?name=='MeshV2Api'].arn" --output text)
aws appsync list-tags-for-resource --resource-arn $API_ARN
```

期待される出力:
```json
{
    "tags": {
        "Project": "MeshV2",
        "Service": "AppSync",
        "Stage": "stg",
        "ResourceType": "GraphQLAPI",
        "ManagedBy": "CDK"
    }
}
```

**DynamoDB Tableのタグ確認:**

```bash
# ステージング環境
TABLE_ARN=$(aws dynamodb describe-table --table-name MeshV2Table-stg --query 'Table.TableArn' --output text)
aws dynamodb list-tags-of-resource --resource-arn $TABLE_ARN

# 本番環境
TABLE_ARN=$(aws dynamodb describe-table --table-name MeshV2Table --query 'Table.TableArn' --output text)
aws dynamodb list-tags-of-resource --resource-arn $TABLE_ARN
```

期待される出力:
```json
{
    "Tags": [
        {
            "Key": "Project",
            "Value": "MeshV2"
        },
        {
            "Key": "Stage",
            "Value": "stg"
        },
        {
            "Key": "Service",
            "Value": "AppSync"
        },
        {
            "Key": "ResourceType",
            "Value": "DynamoDB"
        },
        {
            "Key": "ManagedBy",
            "Value": "CDK"
        }
    ]
}
```

### 7.5 DynamoDB Tableの確認

```bash
# ステージング環境のテーブル詳細を確認
aws dynamodb describe-table --table-name MeshV2Table-stg

# 本番環境のテーブル詳細を確認
aws dynamodb describe-table --table-name MeshV2Table

# GSIの確認（JSON形式で詳細表示）
aws dynamodb describe-table --table-name MeshV2Table-stg \
  --query 'Table.GlobalSecondaryIndexes[*].{IndexName:IndexName,KeySchema:KeySchema}' \
  --output json
```

期待される出力:
```json
[
  {
    "IndexName": "GroupIdIndex",
    "KeySchema": [
      {
        "AttributeName": "gsi_pk",
        "KeyType": "HASH"
      },
      {
        "AttributeName": "gsi_sk",
        "KeyType": "RANGE"
      }
    ]
  }
]
```

### 7.6 Integration Tests の実行

デプロイ後、integration testsを実行して動作を検証します。

```bash
docker compose run --rm infra bash -c "
  export APPSYNC_ENDPOINT=\$(aws cloudformation describe-stacks \
    --stack-name MeshV2Stack-stg \
    --query 'Stacks[0].Outputs[?OutputKey==\`GraphQLApiEndpoint\`].OutputValue' \
    --output text)
  export APPSYNC_API_KEY=\$(aws cloudformation describe-stacks \
    --stack-name MeshV2Stack-stg \
    --query 'Stacks[0].Outputs[?OutputKey==\`GraphQLApiKey\`].OutputValue' \
    --output text)
  echo \"APPSYNC_ENDPOINT: \$APPSYNC_ENDPOINT\"
  echo \"APPSYNC_API_KEY: \$APPSYNC_API_KEY\"
  bundle exec rspec spec/requests/ --format documentation
"
```

## 8. CloudWatch Logsの確認

AppSync APIのログはCloudWatch Logsに出力されます。

```bash
# ロググループ一覧の確認
aws logs describe-log-groups --log-group-name-prefix /aws/appsync/apis

# 最新のログストリームを確認
LOG_GROUP_NAME=$(aws logs describe-log-groups \
  --log-group-name-prefix /aws/appsync/apis \
  --query 'logGroups[0].logGroupName' \
  --output text)

echo "Log Group: $LOG_GROUP_NAME"

# 最新ログの取得
aws logs tail "$LOG_GROUP_NAME" --follow
```

## 9. X-Ray トレースの確認

X-Rayトレーシングが有効になっているため、リクエストのトレース情報を確認できます。

1. AWS Management Console で **X-Ray** サービスに移動
2. **Service map** でMeshV2Apiを確認
3. **Traces** でリクエストの詳細を確認

## 10. AWS Resource Groups でのリソース管理

タグを使ってリソースをグルーピングし、一元管理できます。

### 10.1 リソースグループの作成

**ステージング環境のリソースグループ:**

```bash
aws resource-groups create-group \
  --name "MeshV2-stg" \
  --resource-query '{
    "Type": "TAG_FILTERS_1_0",
    "Query": "{\"ResourceTypeFilters\":[\"AWS::AllSupported\"],\"TagFilters\":[{\"Key\":\"Project\",\"Values\":[\"MeshV2\"]},{\"Key\":\"Stage\",\"Values\":[\"stg\"]}]}"
  }' \
  --tags Project=MeshV2,Stage=stg
```

**本番環境のリソースグループ:**

```bash
aws resource-groups create-group \
  --name "MeshV2-prod" \
  --resource-query '{
    "Type": "TAG_FILTERS_1_0",
    "Query": "{\"ResourceTypeFilters\":[\"AWS::AllSupported\"],\"TagFilters\":[{\"Key\":\"Project\",\"Values\":[\"MeshV2\"]},{\"Key\":\"Stage\",\"Values\":[\"prod\"]}]}"
  }' \
  --tags Project=MeshV2,Stage=prod
```

### 10.2 リソースグループの確認

```bash
# グループ一覧
aws resource-groups list-groups

# グループ内のリソース確認
aws resource-groups list-group-resources --group-name MeshV2-stg
```

### 10.3 コスト分析

AWS Cost Explorerでタグを使ったコスト分析が可能です。

```bash
# ステージング環境のコスト
aws ce get-cost-and-usage \
  --time-period Start=2025-01-01,End=2025-01-31 \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --filter '{
    "Tags": {
      "Key": "Stage",
      "Values": ["stg"]
    }
  }'
```

## 11. リソースの削除（必要な場合）

開発環境のリソースを削除する場合:

```bash
# .env symlink が正しいステージを指していることを確認
ls -la infra/smalruby-mesh-v2/.env

# スタック削除
docker compose run --rm infra npx cdk destroy
```

**警告**: この操作でDynamoDBテーブルとデータが完全に削除されます（`RemovalPolicy: DESTROY`設定のため）。

## トラブルシューティング

### デプロイが失敗する場合

#### 1. 認証エラー

```
Error: Need to perform AWS calls for account XXX, but no credentials found
```

**解決策**: AWS認証情報を設定してください。
```bash
aws configure
```

#### 2. Bootstrapエラー

```
Error: This stack uses assets, so the toolkit stack must be deployed to the environment
```

**解決策**: CDK Bootstrapを実行してください。
```bash
docker compose run --rm infra npx cdk bootstrap
```

#### 3. リソース名の競合

```
Error: MeshV2Table already exists
```

**解決策**: 既存のスタックを削除するか、テーブル名を変更してください。

### APIが応答しない場合

1. CloudWatch Logsでエラーメッセージを確認
2. API Keyが正しいか確認
3. エンドポイントURLが正しいか確認
4. IAM権限が正しく設定されているか確認

## 参考リンク

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [AWS AppSync Developer Guide](https://docs.aws.amazon.com/appsync/)
- [DynamoDB Developer Guide](https://docs.aws.amazon.com/dynamodb/)
