# Mesh v2 Development Guide

このドキュメントは、Mesh v2 プロジェクトの開発者向けガイドです。開発環境のセットアップ、TDD ワークフロー、テスト実行方法、デバッグ方法などを説明します。

## プロジェクト概要

Mesh v2 は Smalruby 3.0 の Mesh 拡張のバックエンドインフラストラクチャです。複数の Scratch/Smalruby インスタンスがリアルタイムでデータ共有とイベント通知を行うことを可能にします。従来の SkyWay ベースの P2P アーキテクチャを、スケーラブルな AWS ネイティブのサーバーレスシステムに置き換えます。

### 技術スタック

- **Infrastructure**: AWS CDK (TypeScript)
- **API**: AWS AppSync (GraphQL)
- **Database**: DynamoDB (Single Table Design)
- **Compute**: AWS Lambda (Ruby 3.4) + AppSync JavaScript Resolvers (APPSYNC_JS 1.0.0)
- **Testing**: RSpec (Ruby), Jest (TypeScript)
- **Architecture**: Hexagonal Architecture (Ports & Adapters)

### 主要機能

- **Domain-based Scoping**: グループはドメイン（グローバルIPまたはカスタム文字列）でスコープされます
- **Idempotent Operations**: 同じ hostId + domain は既存グループを返します
- **Staging Environment**: タグ付けによる stg/prod 環境の分離
- **TDD Approach**: RSpec による単体テストと統合テスト

## ディレクトリ構造

```
mesh-v2/
├── bin/
│   └── mesh-v2.ts              # CDK app entry point
├── lib/
│   └── mesh-v2-stack.ts        # CDK stack definition (AppSync, DynamoDB)
├── graphql/
│   └── schema.graphql          # GraphQL schema
├── js/
│   ├── resolvers/              # AppSync JavaScript resolvers
│   │   ├── Query.listGroupsByDomain.js
│   │   └── Mutation.joinGroup.js
│   └── functions/              # AppSync Pipeline functions
│       ├── checkExistingGroup.js
│       └── createGroupIfNotExists.js
├── lambda/                     # Ruby Lambda functions (Hexagonal Architecture)
│   ├── handlers/
│   │   └── appsync_handler.rb  # Adapter: AppSync event handling
│   ├── domain/
│   │   └── group.rb            # Domain: Entities and validation
│   ├── use_cases/
│   │   └── create_group.rb     # Application: Business logic
│   └── repositories/
│       └── dynamodb_repository.rb  # Infrastructure: Data access
├── spec/
│   ├── requests/               # Integration tests (E2E)
│   │   └── group_management_spec.rb
│   ├── unit/                   # Unit tests (pure Ruby)
│   │   ├── domain/
│   │   │   └── group_spec.rb
│   │   └── use_cases/
│   │       └── create_group_spec.rb
│   ├── fixtures/
│   │   ├── queries/            # GraphQL query files
│   │   │   └── list_groups_by_domain.graphql
│   │   └── mutations/          # GraphQL mutation files
│   │       └── create_group.graphql
│   └── spec_helper.rb          # RSpec configuration and helpers
├── test/                       # Jest tests for CDK
├── docs/                       # Documentation
│   ├── deployment.md           # Deployment guide
│   ├── development.md          # This file
│   └── api-reference.md        # API reference
├── Gemfile                     # Ruby dependencies
├── .rspec                      # RSpec settings
├── cdk.json                    # CDK configuration (stage context)
├── package.json                # Node.js dependencies
├── .env.example                # Environment variables template
└── .env                        # Local environment variables (git-ignored)
```

## 開発環境セットアップ

### 前提条件

- Node.js 18+
- Ruby 3.4.1 (`.ruby-version` で管理)
- AWS CLI が設定済み
- AWS CDK CLI

### インストール

#### 1. Node.js 依存関係

```bash
npm install
```

#### 2. Ruby 依存関係

```bash
bundle install
```

#### 3. 環境変数の設定

```bash
# テンプレートからローカル .env ファイルを作成
cp .env.example .env

# .env を開発用の値で編集（デフォルトで開発用の値が設定されています）
# 開発環境では、デバッグを容易にするために高速な間隔を使用します
```

## 環境変数

Mesh v2 は環境変数を使用して設定を管理し、開発環境と本番環境で異なる設定を可能にします。

### 設定ファイル

- **`.env.example`**: 本番環境のデフォルト値を持つテンプレートファイル（git にコミット）
- **`.env`**: ローカル設定ファイル（git-ignored、`.env.example` から作成）

### 変数一覧

| 変数 | 開発環境 | 本番環境 | 説明 |
|------|---------|---------|------|
| `MESH_SECRET_KEY` | `dev-secret-key-for-testing` | (GitHub Secrets で設定) | ドメイン検証用の秘密鍵 |
| `MESH_HOST_HEARTBEAT_INTERVAL_SECONDS` | `15` | `60` | ホストのハートビート間隔（秒） |
| `MESH_HOST_HEARTBEAT_TTL_SECONDS` | `60` | `150` | ホストグループの TTL（秒） |
| `MESH_MEMBER_HEARTBEAT_INTERVAL_SECONDS` | `15` | `120` | メンバーのハートビート間隔（秒） |
| `MESH_MEMBER_HEARTBEAT_TTL_SECONDS` | `60` | `600` | メンバーノードの TTL（秒） |
| `MESH_MAX_CONNECTION_TIME_SECONDS` | `300` | `1500` | グループの最大接続時間（秒） |

### 設定の根拠

**開発環境（高速な間隔）**:
- デバッグとテストサイクルが高速
- ハートビート失敗と TTL 期限切れを素早く確認できる
- コストが高いが、ステージング環境では許容範囲

**本番環境（遅い間隔）**:
- コスト最適化（~70% のコスト削減）
- メンバーのハートビート 120 秒により、UX を維持しつつ API 呼び出しを削減
- ホストのハートビート 60 秒により、グループ解散の検出を迅速化
- TTL を間隔の 5 倍にすることで、ネットワークの一時的な問題に対応

### 環境変数の使用方法

1. **CDK Stack** (`lib/mesh-v2-stack.ts`): env vars を読み取り、AppSync API と Lambda 関数に渡す
2. **AppSync Resolvers** (`js/functions/*.js`, `js/resolvers/*.js`): `ctx.env.*` 経由でアクセス
3. **Lambda Functions** (`lambda/**/*.rb`): `ENV['*']` 経由でアクセス

## TDD 開発フロー

### 1. Test-Driven Development サイクル

```
RED → GREEN → REFACTOR
```

#### Phase 1: RED (失敗するテストを書く)

**単体テストの例**:

```ruby
# spec/unit/use_cases/create_group_spec.rb
RSpec.describe CreateGroupUseCase do
  let(:repository) { double('Repository') }
  let(:use_case) { described_class.new(repository) }

  it '新しいグループを作成する' do
    allow(repository).to receive(:find_group_by_host_and_domain)
      .and_return(nil)
    expect(repository).to receive(:save_group)

    result = use_case.execute(
      name: 'Test Group',
      host_id: 'host-001',
      domain: 'example.com'
    )

    expect(result).to be_a(Group)
    expect(result.name).to eq('Test Group')
  end
end
```

テストを実行（失敗するはず）:
```bash
bundle exec rspec spec/unit/use_cases/create_group_spec.rb
```

#### Phase 2: GREEN (最小限のコードを実装)

```ruby
# lambda/use_cases/create_group.rb
class CreateGroupUseCase
  def initialize(repository)
    @repository = repository
  end

  def execute(name:, host_id:, domain:)
    # 冪等性: 既存のグループが見つかればそれを返す
    existing_group = @repository.find_group_by_host_and_domain(host_id, domain)
    return existing_group if existing_group

    # 新しいグループを作成
    group = Group.new(
      id: SecureRandom.uuid,
      name: name,
      host_id: host_id,
      domain: domain,
      created_at: Time.now.utc.iso8601
    )

    @repository.save_group(group)
    group
  end
end
```

テストを実行（成功するはず）:
```bash
bundle exec rspec spec/unit/use_cases/create_group_spec.rb
```

#### Phase 3: REFACTOR (コード品質の改善)

メソッドの抽出、命名の改善、コメントの追加など。

テストを実行（成功し続けるはず）:
```bash
bundle exec rspec spec/unit/
```

### 2. 統合テストフロー

単体テストが通過した後、統合テストを書きます:

```ruby
# spec/requests/group_management_spec.rb
RSpec.describe 'Group Management API', type: :request do
  it '新しいグループを作成できる' do
    query = File.read('spec/fixtures/mutations/create_group.graphql')
    variables = {
      name: 'Test Group',
      hostId: "host-#{Time.now.to_i}-001",
      domain: 'test.example.com'
    }

    response = execute_graphql(query, variables)

    expect(response['errors']).to be_nil
    expect(response['data']['createGroup']['name']).to eq('Test Group')
  end
end
```

統合テストを実行:
```bash
# 環境変数を設定
export APPSYNC_ENDPOINT=$(aws cloudformation describe-stacks --stack-name MeshV2Stack-stg --query 'Stacks[0].Outputs[?OutputKey==`GraphQLApiEndpoint`].OutputValue' --output text)
export APPSYNC_API_KEY=$(aws cloudformation describe-stacks --stack-name MeshV2Stack-stg --query 'Stacks[0].Outputs[?OutputKey==`GraphQLApiKey`].OutputValue' --output text)

# 統合テストを実行
bundle exec rspec spec/requests/
```

### 3. 完全な TDD ワークフロー

```
1. 単体テストを書く (RED)
   ↓
2. 最小限のコードを実装 (GREEN)
   ↓
3. リファクタリング (GREEN)
   ↓
4. stg にデプロイ
   npx cdk deploy --context stage=stg
   ↓
5. 統合テストを実行
   bundle exec rspec spec/requests/
   ↓
6. テストが通過 → commit & push
   テストが失敗 → 修正して step 4 から繰り返し
```

## テスト構造

### 単体テスト (spec/unit/)

**目的**: モック/ダブルを使用してビジネスロジックを分離してテスト

**特徴**:
- 高速実行
- 外部依存なし（DB なし、API なし）
- 純粋な Ruby クラスをテスト
- RSpec ダブルを使用して依存関係をモック

**テスト対象のレイヤー**:

1. **Domain Layer** (`spec/unit/domain/`)
   - エンティティの検証
   - ビジネスルール
   - 例: `group_spec.rb`

2. **Use Case Layer** (`spec/unit/use_cases/`)
   - ビジネスロジックのフロー
   - 冪等性
   - 例: `create_group_spec.rb`

**実行コマンド**:
```bash
bundle exec rspec spec/unit/
```

### 統合テスト (spec/requests/)

**目的**: 実際の AppSync API に対してエンドツーエンドの API 機能をテスト

**特徴**:
- 実行が遅い
- デプロイされたインフラストラクチャ（stg）が必要
- GraphQL API レスポンスをテスト
- 実際の DynamoDB を使用

**テスト対象**:
- GraphQL query/mutation の成功
- エラーハンドリング
- レスポンスフォーマット
- 実環境での冪等性

**実行コマンド**:
```bash
# 最初に環境変数を設定
export APPSYNC_ENDPOINT=$(aws cloudformation describe-stacks --stack-name MeshV2Stack-stg --query 'Stacks[0].Outputs[?OutputKey==`GraphQLApiEndpoint`].OutputValue' --output text)
export APPSYNC_API_KEY=$(aws cloudformation describe-stacks --stack-name MeshV2Stack-stg --query 'Stacks[0].Outputs[?OutputKey==`GraphQLApiKey`].OutputValue' --output text)

bundle exec rspec spec/requests/
```

### インフラストラクチャテスト (test/)

**目的**: CDK インフラストラクチャ定義をテスト

**特徴**:
- Jest を使用
- CDK スタック構成を検証
- リソースの存在確認

**実行コマンド**:
```bash
npm test
```

### テストフィクスチャ (spec/fixtures/)

再利用可能な GraphQL query/mutation ファイル:

```graphql
# spec/fixtures/mutations/create_group.graphql
mutation CreateGroup($name: String!, $hostId: ID!, $domain: String!) {
  createGroup(name: $name, hostId: $hostId, domain: $domain) {
    id
    domain
    fullId
    name
    hostId
    createdAt
  }
}
```

## ヘキサゴナルアーキテクチャ

### アーキテクチャレイヤー

```
┌─────────────────────────────────────┐
│  Adapter Layer (handlers/)          │ ← AppSync events, HTTP requests
├─────────────────────────────────────┤
│  Application Layer (use_cases/)     │ ← Business logic, orchestration
├─────────────────────────────────────┤
│  Domain Layer (domain/)             │ ← Entities, validation, rules
├─────────────────────────────────────┤
│  Infrastructure Layer (repositories/)│ ← DynamoDB, external services
└─────────────────────────────────────┘
```

### レイヤーの責務

#### 1. Domain Layer (`lambda/domain/`)

**責務**: コアビジネスエンティティと検証

**例**:
```ruby
class Group
  attr_reader :id, :name, :host_id, :domain, :created_at

  def initialize(id:, name:, host_id:, domain:, created_at:)
    @id = id
    @name = name
    @host_id = host_id
    @domain = domain
    @created_at = created_at
    validate!
  end

  def full_id
    "#{@id}@#{@domain}"
  end

  private

  def validate!
    raise ArgumentError, 'name is required' if @name.nil? || @name.empty?
    raise ArgumentError, 'domain must be 256 characters or less' if @domain.length > 256
  end
end
```

**テスト**: 依存関係なしの純粋な単体テスト

#### 2. Application Layer (`lambda/use_cases/`)

**責務**: ビジネスロジックのオーケストレーション

**テスト**: モックされたリポジトリを使用した単体テスト

#### 3. Infrastructure Layer (`lambda/repositories/`)

**責務**: データ永続化と外部サービス統合

**テスト**: 統合テストまたはモックされた AWS SDK

#### 4. Adapter Layer (`lambda/handlers/`)

**責務**: イベントハンドリングとレスポンスフォーマット（薄いレイヤー）

**テスト**: 実際の AppSync イベントを使用した統合テスト

**重要 - エラーハンドリング**:
- Lambda ハンドラーで例外をキャッチするために `rescue` を使用**しないでください**
- 例外を AppSync に自然に伝播させる
- AppSync は Ruby の例外を自動的に GraphQL エラーに変換します
- 例外をキャッチして `statusCode`/`body` を持つハッシュを返すと、AppSync は有効なレスポンスとして解析しようとして型の不一致エラーで失敗します

**正しい例**:
```ruby
def lambda_handler(event:, context:)
  field_name = event['info']['fieldName']
  arguments = event['arguments']

  case field_name
  when 'dissolveGroup'
    handle_dissolve_group(arguments)  # StandardError を raise する可能性がある
  else
    raise StandardError, "Unknown field: #{field_name}"
  end
  # rescue ブロックなし - エラーを AppSync に伝播させる
end
```

**間違った例**:
```ruby
def lambda_handler(event:, context:)
  # ... code ...
rescue StandardError => e
  # これは AppSync の型不一致エラーを引き起こします！
  {
    statusCode: 500,
    body: JSON.generate({ error: e.message })
  }
end
```

### ヘキサゴナルアーキテクチャの利点

1. **テスト可能性**: インフラストラクチャ依存なしの純粋なビジネスロジック
2. **柔軟性**: データソースの交換が容易（DynamoDB → S3 など）
3. **保守性**: 関心事の明確な分離
4. **移植性**: ビジネスロジックはフレームワークに依存しない

## コマンドリファレンス

### ビルド

TypeScript を JavaScript にコンパイル:
```bash
npm run build
```

### テスト

```bash
# すべてのテストを実行
bundle exec rspec

# 単体テストのみ
bundle exec rspec spec/unit/

# 統合テストのみ
bundle exec rspec spec/requests/

# 特定のテストファイル
bundle exec rspec spec/unit/domain/group_spec.rb

# 特定のテストケース（行番号で指定）
bundle exec rspec spec/unit/domain/group_spec.rb:10

# ドキュメントフォーマットで実行
bundle exec rspec --format documentation

# インフラストラクチャテスト (Jest)
npm test

# Linting (StandardRB)
bundle exec standardrb

# Linting 自動修正
bundle exec standardrb --fix
```

### CDK コマンド

```bash
# CloudFormation テンプレートを生成
npx cdk synth

# デプロイの差分を表示
npx cdk diff --context stage=stg

# デプロイ（ステージング）
npx cdk deploy --context stage=stg

# デプロイ（本番）
npx cdk deploy --context stage=prod

# 破棄
npx cdk destroy --context stage=stg

# スタック一覧
npx cdk list
```

### AWS コマンド

```bash
# スタック出力を取得
aws cloudformation describe-stacks --stack-name MeshV2Stack-stg

# API エンドポイントを取得
aws cloudformation describe-stacks --stack-name MeshV2Stack-stg \
  --query 'Stacks[0].Outputs[?OutputKey==`GraphQLApiEndpoint`].OutputValue' \
  --output text

# API キーを取得
aws cloudformation describe-stacks --stack-name MeshV2Stack-stg \
  --query 'Stacks[0].Outputs[?OutputKey==`GraphQLApiKey`].OutputValue' \
  --output text

# DynamoDB アイテム一覧
aws dynamodb scan --table-name MeshV2Table-stg

# ドメインで DynamoDB をクエリ
aws dynamodb query --table-name MeshV2Table-stg \
  --key-condition-expression 'pk = :pk' \
  --expression-attribute-values '{":pk":{"S":"DOMAIN#test.example.com"}}'
```

## デプロイワークフロー

詳細なデプロイ手順は `docs/deployment.md` を参照してください。

基本的なワークフロー:

```bash
# 1. 依存関係をインストール
npm install
bundle install

# 2. 単体テストを実行（高速）
bundle exec rspec spec/unit/

# 3. CDK をコンパイル
npm run build

# 4. ステージングにデプロイ
npx cdk deploy --context stage=stg

# 5. 統合テスト用の環境変数を設定
export APPSYNC_ENDPOINT=$(aws cloudformation describe-stacks --stack-name MeshV2Stack-stg --query 'Stacks[0].Outputs[?OutputKey==`GraphQLApiEndpoint`].OutputValue' --output text)
export APPSYNC_API_KEY=$(aws cloudformation describe-stacks --stack-name MeshV2Stack-stg --query 'Stacks[0].Outputs[?OutputKey==`GraphQLApiKey`].OutputValue' --output text)

# 6. 統合テストを実行
bundle exec rspec spec/requests/

# 7. すべてのテストを実行
bundle exec rspec

# 8. コミットしてプッシュ
git add .
git commit -m "feat: add new feature"
git push origin main
```

## トラブルシューティング

### テスト失敗

**問題**: SSL 証明書検証失敗

**解決策**: `spec/spec_helper.rb` で既に修正済み:
```ruby
http.verify_mode = OpenSSL::SSL::VERIFY_NONE
```

**問題**: 環境変数が設定されていない

**解決策**: 統合テスト前に実行:
```bash
export APPSYNC_ENDPOINT=$(aws cloudformation describe-stacks --stack-name MeshV2Stack-stg --query 'Stacks[0].Outputs[?OutputKey==`GraphQLApiEndpoint`].OutputValue' --output text)
export APPSYNC_API_KEY=$(aws cloudformation describe-stacks --stack-name MeshV2Stack-stg --query 'Stacks[0].Outputs[?OutputKey==`GraphQLApiKey`].OutputValue' --output text)
```

**問題**: GraphQL 型の不一致（String! vs ID!）

**解決策**: `graphql/schema.graphql` で正しい型を確認。`hostId` には `ID!` を使用。

### CDK デプロイ失敗

**問題**: スタックが既に存在する

**解決策**: `cdk init` なしで `cdk deploy` を使用。スタックは既に初期化されています。

**問題**: Bootstrap が必要

**解決策**:
```bash
cdk bootstrap
```

**問題**: リソース名の競合

**解決策**: 異なるステージを使用するか、古いスタックを破棄:
```bash
npx cdk destroy --context stage=old-stage
```

### よくあるエラー

**エラー**: `undefined method 'iso8601' for Time`

**解決策**: `Time#iso8601` を使用する Ruby ファイルに `require 'time'` を追加。

**エラー**: 単体テストで `APPSYNC_ENDPOINT is not set`

**解決策**: 既に修正済み - 単体テストは環境変数チェックをスキップします。

## ベストプラクティス

### 1. 常にテストファーストで書く（TDD）

- 失敗するテストを書く（RED）
- 最小限のコードを実装（GREEN）
- リファクタリング（GREEN）

### 2. ステージング環境を使用

- まず `stg` にデプロイ
- 統合テストを実行
- 確認後のみ `prod` にデプロイ

### 3. ビジネスロジックを純粋に保つ

- ドメインとユースケースレイヤーは AWS 依存を持たない
- リポジトリには依存性注入を使用
- モックでテストが容易

### 4. わかりやすいテスト名を使用

```ruby
# 良い例
it '同じhostId + domainで2回呼び出すと既存グループを返す（冪等性）'

# 悪い例
it 'works'
```

### 5. コミットメッセージ

Conventional Commits に従う:
```
feat: add new feature
fix: fix bug
test: add tests
refactor: refactor code
docs: update documentation
```

### 6. Ruby 文字列リテラル

StandardRB スタイルとの一貫性を保つため、Ruby コードでは常にダブルクォート文字列を使用:

```ruby
# 良い例
require "json"
require "aws-sdk-dynamodb"

message = "Hello, world!"
interpolation = "Value: #{variable}"

# 悪い例
require 'json'
message = 'Hello, world!'
```

**理由**:
- StandardRB linter ルールとの一貫性
- ダブルクォートは変更なしで補間をサポート
- コードレビューでの認知的オーバーヘッドを削減
- Ruby コミュニティのベストプラクティスに準拠

`bundle exec standardrb` を実行して違反をチェック、`bundle exec standardrb --fix` で自動修正。

## 関連ドキュメント

- [デプロイ手順](deployment.md) - 初回デプロイから運用まで
- [API リファレンス](api-reference.md) - GraphQL API の完全リファレンス
- [README.md](../README.md) - プロジェクト概要

---

**Last Updated**: 2026-01-01
**Phase**: 3 - Documentation Consolidation
