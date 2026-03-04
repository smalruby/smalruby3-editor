# CLAUDE.md - Mesh v2 Development Guide

This file provides guidance to Claude Code when working with the Mesh v2 infrastructure project.

**Target Recognition**: When you receive the instruction "target is infra/mesh-v2", treat this file as additional context for all subsequent operations.

## Project Overview

Mesh v2 is a serverless mesh network infrastructure for Smalruby3, enabling multiple Scratch/Smalruby instances to communicate and synchronize in real-time.

### Technology Stack

- **Infrastructure**: AWS CDK (TypeScript)
- **API**: AWS AppSync GraphQL API
- **Database**: DynamoDB (Single Table Design)
- **Resolvers**: AppSync JavaScript (APPSYNC_JS 1.0.0) + Ruby Lambda (future)
- **Testing**: RSpec (Ruby)
- **Architecture**: Hexagonal Architecture (Ports & Adapters)

### Key Features

- **Domain-based Scoping**: Groups are scoped by domain (global IP or custom string)
- **Idempotent Operations**: Same hostId + domain returns existing group
- **Staging Environment**: Separate stg/prod environments with tagging
- **TDD Approach**: Unit tests and integration tests with RSpec

## Directory Structure

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
├── Gemfile                     # Ruby dependencies
├── .rspec                      # RSpec settings
├── cdk.json                    # CDK configuration (stage context)
├── package.json                # Node.js dependencies
├── .env.example                # Environment variables template
├── .env                        # Local environment variables (git-ignored)
├── DEPLOYMENT.md               # Deployment guide
└── CLAUDE.md                   # This file
```

## Environment Variables

Mesh v2 uses environment variables for configuration, allowing different settings for development and production environments.

### Configuration Files

**`.env.example`**: Template file with production defaults (committed to git)
**`.env`**: Local configuration file (git-ignored, created from `.env.example`)

### Variables

| Variable | Development | Production | Description |
|----------|-------------|------------|-------------|
| `MESH_SECRET_KEY` | `dev-secret-key-for-testing` | (set in GitHub Secrets) | Secret key for domain validation |
| `MESH_HOST_HEARTBEAT_INTERVAL_SECONDS` | `15` | `60` | Host heartbeat interval in seconds |
| `MESH_HOST_HEARTBEAT_TTL_SECONDS` | `60` | `150` | Host group TTL in seconds |
| `MESH_MEMBER_HEARTBEAT_INTERVAL_SECONDS` | `15` | `120` | Member heartbeat interval in seconds |
| `MESH_MEMBER_HEARTBEAT_TTL_SECONDS` | `60` | `600` | Member node TTL in seconds |
| `MESH_MAX_CONNECTION_TIME_MINUTES` | `5` | `25` | Maximum connection time for a group (minutes) |

### Setup for Local Development

```bash
# Copy template to create local .env file
cp .env.example .env

# Edit .env with development values (already set by default)
# Development values use faster intervals for easier debugging

# Deploy with local .env
npx cdk deploy --context stage=stg
```

### Setup for Production Deployment

**GitHub Actions**: Set repository secrets for production deployment
- `MESH_SECRET_KEY`
- `MESH_HOST_HEARTBEAT_INTERVAL_SECONDS`
- `MESH_HOST_HEARTBEAT_TTL_SECONDS`
- `MESH_MEMBER_HEARTBEAT_INTERVAL_SECONDS`
- `MESH_MEMBER_HEARTBEAT_TTL_SECONDS`

**Command Line Override**:
```bash
MESH_HOST_HEARTBEAT_INTERVAL_SECONDS=60 \
MESH_MEMBER_HEARTBEAT_INTERVAL_SECONDS=120 \
npx cdk deploy --context stage=prod
```

### Rationale for Different Configurations

**Development (Fast intervals)**:
- Faster debugging and testing cycles
- Quickly see heartbeat failures and TTL expirations
- Higher cost but acceptable for staging environment

**Production (Slower intervals)**:
- Cost optimization (~70% cost reduction)
- Member heartbeat at 120s reduces API calls while maintaining UX
- Host heartbeat at 30s ensures quick group dissolution detection
- TTL at 5× interval tolerates network hiccups

### How Environment Variables are Used

1. **CDK Stack** (`lib/mesh-v2-stack.ts`): Reads env vars and passes to AppSync API and Lambda functions
2. **AppSync Resolvers** (`js/functions/*.js`, `js/resolvers/*.js`): Access via `ctx.env.*`
3. **Lambda Functions** (`lambda/**/*.rb`): Access via `ENV['*']`

## TDD Development Flow

### 1. Test-Driven Development Cycle

```
RED → GREEN → REFACTOR
```

#### Phase 1: RED (Write Failing Test)

**Unit Test Example:**

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

Run test (should fail):
```bash
bundle exec rspec spec/unit/use_cases/create_group_spec.rb
```

#### Phase 2: GREEN (Implement Minimum Code)

```ruby
# lambda/use_cases/create_group.rb
class CreateGroupUseCase
  def initialize(repository)
    @repository = repository
  end

  def execute(name:, host_id:, domain:)
    existing_group = @repository.find_group_by_host_and_domain(host_id, domain)
    return existing_group if existing_group

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

Run test (should pass):
```bash
bundle exec rspec spec/unit/use_cases/create_group_spec.rb
```

#### Phase 3: REFACTOR (Improve Code Quality)

Extract methods, improve naming, add comments, etc.

Run test (should still pass):
```bash
bundle exec rspec spec/unit/
```

### 2. Integration Test Flow

After unit tests pass, write integration tests:

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

Run integration tests:
```bash
# Set environment variables
export APPSYNC_ENDPOINT=$(aws cloudformation describe-stacks --stack-name MeshV2Stack-stg --query 'Stacks[0].Outputs[?OutputKey==`GraphQLApiEndpoint`].OutputValue' --output text)
export APPSYNC_API_KEY=$(aws cloudformation describe-stacks --stack-name MeshV2Stack-stg --query 'Stacks[0].Outputs[?OutputKey==`GraphQLApiKey`].OutputValue' --output text)

# Run integration tests
bundle exec rspec spec/requests/
```

### 3. Complete TDD Workflow

```
1. Write unit test (RED)
   ↓
2. Implement minimum code (GREEN)
   ↓
3. Refactor (GREEN)
   ↓
4. Deploy to stg
   npx cdk deploy --context stage=stg
   ↓
5. Run integration tests
   bundle exec rspec spec/requests/
   ↓
6. If tests pass → commit & push
   If tests fail → fix & repeat from step 4
```

## Test Structure

### Unit Tests (spec/unit/)

**Purpose**: Test business logic in isolation using mocks/doubles

**Characteristics**:
- Fast execution
- No external dependencies (no DB, no API)
- Tests pure Ruby classes
- Uses RSpec doubles for dependencies

**Layers to Test**:

1. **Domain Layer** (`spec/unit/domain/`)
   - Entity validation
   - Business rules
   - Example: `group_spec.rb`

2. **Use Case Layer** (`spec/unit/use_cases/`)
   - Business logic flow
   - Idempotency
   - Example: `create_group_spec.rb`

**Run Command**:
```bash
bundle exec rspec spec/unit/
```

### Integration Tests (spec/requests/)

**Purpose**: Test end-to-end API functionality against real AppSync API

**Characteristics**:
- Slower execution
- Requires deployed infrastructure (stg)
- Tests GraphQL API responses
- Uses real DynamoDB

**What to Test**:
- GraphQL query/mutation success
- Error handling
- Response format
- Idempotency in real environment

**Run Command**:
```bash
# Set environment variables first
export APPSYNC_ENDPOINT=$(aws cloudformation describe-stacks --stack-name MeshV2Stack-stg --query 'Stacks[0].Outputs[?OutputKey==`GraphQLApiEndpoint`].OutputValue' --output text)
export APPSYNC_API_KEY=$(aws cloudformation describe-stacks --stack-name MeshV2Stack-stg --query 'Stacks[0].Outputs[?OutputKey==`GraphQLApiKey`].OutputValue' --output text)

bundle exec rspec spec/requests/
```

### Test Fixtures (spec/fixtures/)

GraphQL query/mutation files for reusability:

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

## Hexagonal Architecture

### Architecture Layers

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

### Layer Responsibilities

#### 1. Domain Layer (`lambda/domain/`)

**Responsibility**: Core business entities and validation

**Example**:
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

**Testing**: Pure unit tests with no dependencies

#### 2. Application Layer (`lambda/use_cases/`)

**Responsibility**: Business logic orchestration

**Example**:
```ruby
class CreateGroupUseCase
  def initialize(repository)
    @repository = repository
  end

  def execute(name:, host_id:, domain:)
    # Idempotency: return existing group if found
    existing_group = @repository.find_group_by_host_and_domain(host_id, domain)
    return existing_group if existing_group

    # Create new group
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

**Testing**: Unit tests with mocked repository

#### 3. Infrastructure Layer (`lambda/repositories/`)

**Responsibility**: Data persistence and external service integration

**Example**:
```ruby
class DynamoDBRepository
  def initialize(dynamodb_client = nil, table_name = nil)
    @dynamodb = dynamodb_client
    @table_name = table_name || ENV['DYNAMODB_TABLE_NAME']
  end

  def find_group_by_host_and_domain(host_id, domain)
    result = @dynamodb.query(
      table_name: @table_name,
      key_condition_expression: 'pk = :pk AND begins_with(sk, :sk_prefix)',
      expression_attribute_values: {
        ':pk' => "DOMAIN##{domain}",
        ':sk_prefix' => 'GROUP#',
        ':hostId' => host_id
      },
      filter_expression: 'hostId = :hostId'
    )
    # ... convert to Group entity
  end

  def save_group(group)
    @dynamodb.put_item(
      table_name: @table_name,
      item: {
        'pk' => "DOMAIN##{group.domain}",
        'sk' => "GROUP##{group.id}#METADATA",
        # ...
      }
    )
  end
end
```

**Testing**: Integration tests or mocked AWS SDK

#### 4. Adapter Layer (`lambda/handlers/`)

**Responsibility**: Event handling and response formatting (thin layer)

**Example**:
```ruby
def lambda_handler(event:, context:)
  field_name = event['info']['fieldName']
  arguments = event['arguments']

  case field_name
  when 'createGroup'
    repository = DynamoDBRepository.new(Aws::DynamoDB::Client.new)
    use_case = CreateGroupUseCase.new(repository)

    group = use_case.execute(
      name: arguments['name'],
      host_id: arguments['hostId'],
      domain: arguments['domain']
    )

    format_group_response(group)
  end
end
```

**Testing**: Integration tests with real AppSync events

**IMPORTANT - Error Handling**:
- **DO NOT** use `rescue` to catch exceptions in the Lambda handler
- Let exceptions propagate to AppSync naturally
- AppSync will automatically convert Ruby exceptions to GraphQL errors
- If you catch exceptions and return a hash with `statusCode`/`body`, AppSync will try to parse it as a valid response and fail with type mismatch errors

**Example (CORRECT)**:
```ruby
def lambda_handler(event:, context:)
  field_name = event['info']['fieldName']
  arguments = event['arguments']

  case field_name
  when 'dissolveGroup'
    handle_dissolve_group(arguments)  # May raise StandardError
  else
    raise StandardError, "Unknown field: #{field_name}"
  end
  # No rescue block - let errors propagate to AppSync
end
```

**Example (INCORRECT)**:
```ruby
def lambda_handler(event:, context:)
  # ... code ...
rescue StandardError => e
  # This will cause AppSync type mismatch errors!
  {
    statusCode: 500,
    body: JSON.generate({ error: e.message })
  }
end
```

### Benefits of Hexagonal Architecture

1. **Testability**: Pure business logic without infrastructure dependencies
2. **Flexibility**: Easy to swap data sources (DynamoDB → S3, etc.)
3. **Maintainability**: Clear separation of concerns
4. **Portability**: Business logic is framework-agnostic

## Staging Environment

### Environment Configuration

**cdk.json**:
```json
{
  "context": {
    "stage": "stg"
  }
}
```

### Resource Naming

| Stage | Stack Name | DynamoDB Table | AppSync API |
|-------|-----------|----------------|-------------|
| stg   | MeshV2Stack-stg | MeshV2Table-stg | MeshV2Api-stg |
| prod  | MeshV2Stack | MeshV2Table | MeshV2Api |

### Deployment Commands

**Deploy to staging**:
```bash
npx cdk deploy --context stage=stg
```

**Deploy to production**:
```bash
npx cdk deploy --context stage=prod
```

**Destroy staging**:
```bash
npx cdk destroy --context stage=stg
```

### Resource Tags

All resources are automatically tagged:

| Tag Key | stg | prod | Purpose |
|---------|-----|------|---------|
| Project | MeshV2 | MeshV2 | Project identification |
| Stage | stg | prod | Environment identification |
| Service | AppSync | AppSync | Service type |
| ManagedBy | CDK | CDK | Management method |
| ResourceType | GraphQLAPI / DynamoDB | GraphQLAPI / DynamoDB | Resource type |

**Verify tags**:
```bash
# AppSync API tags
API_ARN=$(aws appsync list-graphql-apis --query "graphqlApis[?name=='MeshV2Api-stg'].arn" --output text)
aws appsync list-tags-for-resource --resource-arn $API_ARN

# DynamoDB table tags
TABLE_ARN=$(aws dynamodb describe-table --table-name MeshV2Table-stg --query 'Table.TableArn' --output text)
aws dynamodb list-tags-of-resource --resource-arn $TABLE_ARN
```

### Cost Management with Tags

**Create resource group**:
```bash
aws resource-groups create-group \
  --name "MeshV2-stg" \
  --resource-query '{
    "Type": "TAG_FILTERS_1_0",
    "Query": "{\"ResourceTypeFilters\":[\"AWS::AllSupported\"],\"TagFilters\":[{\"Key\":\"Project\",\"Values\":[\"MeshV2\"]},{\"Key\":\"Stage\",\"Values\":[\"stg\"]}]}"
  }' \
  --tags Project=MeshV2,Stage=stg
```

**Get cost by stage**:
```bash
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

## Common Commands

### Development Workflow

```bash
# 1. Install dependencies
npm install
bundle install

# 2. Run unit tests (fast)
bundle exec rspec spec/unit/

# 3. Compile CDK
npm run build

# 4. Deploy to staging
npx cdk deploy --context stage=stg

# 5. Set environment variables for integration tests
export APPSYNC_ENDPOINT=$(aws cloudformation describe-stacks --stack-name MeshV2Stack-stg --query 'Stacks[0].Outputs[?OutputKey==`GraphQLApiEndpoint`].OutputValue' --output text)
export APPSYNC_API_KEY=$(aws cloudformation describe-stacks --stack-name MeshV2Stack-stg --query 'Stacks[0].Outputs[?OutputKey==`GraphQLApiKey`].OutputValue' --output text)

# 6. Run integration tests
bundle exec rspec spec/requests/

# 7. Run all tests
bundle exec rspec

# 8. Commit and push
git add .
git commit -m "feat: add new feature"
git push origin main
```

### CDK Commands

```bash
# Synthesize CloudFormation template
npx cdk synth

# Show deployment diff
npx cdk diff --context stage=stg

# Deploy
npx cdk deploy --context stage=stg

# Destroy
npx cdk destroy --context stage=stg

# List stacks
npx cdk list
```

### Test Commands

```bash
# Run all tests
bundle exec rspec

# Run unit tests only
bundle exec rspec spec/unit/

# Run integration tests only
bundle exec rspec spec/requests/

# Run specific test file
bundle exec rspec spec/unit/domain/group_spec.rb

# Run specific test case (by line number)
bundle exec rspec spec/unit/domain/group_spec.rb:10

# Run with documentation format
bundle exec rspec --format documentation
```

### AWS Commands

```bash
# Get stack outputs
aws cloudformation describe-stacks --stack-name MeshV2Stack-stg

# Get API endpoint
aws cloudformation describe-stacks --stack-name MeshV2Stack-stg \
  --query 'Stacks[0].Outputs[?OutputKey==`GraphQLApiEndpoint`].OutputValue' \
  --output text

# Get API key
aws cloudformation describe-stacks --stack-name MeshV2Stack-stg \
  --query 'Stacks[0].Outputs[?OutputKey==`GraphQLApiKey`].OutputValue' \
  --output text

# List DynamoDB items
aws dynamodb scan --table-name MeshV2Table-stg

# Query DynamoDB by domain
aws dynamodb query --table-name MeshV2Table-stg \
  --key-condition-expression 'pk = :pk' \
  --expression-attribute-values '{":pk":{"S":"DOMAIN#test.example.com"}}'
```

## Troubleshooting

### Test Failures

**Problem**: SSL certificate verification failed

**Solution**: Already fixed in `spec/spec_helper.rb`:
```ruby
http.verify_mode = OpenSSL::SSL::VERIFY_NONE
```

**Problem**: Environment variables not set

**Solution**: Run before integration tests:
```bash
export APPSYNC_ENDPOINT=$(aws cloudformation describe-stacks --stack-name MeshV2Stack-stg --query 'Stacks[0].Outputs[?OutputKey==`GraphQLApiEndpoint`].OutputValue' --output text)
export APPSYNC_API_KEY=$(aws cloudformation describe-stacks --stack-name MeshV2Stack-stg --query 'Stacks[0].Outputs[?OutputKey==`GraphQLApiKey`].OutputValue' --output text)
```

**Problem**: GraphQL type mismatch (String! vs ID!)

**Solution**: Check `graphql/schema.graphql` for correct types. Use `ID!` for `hostId`.

### CDK Deployment Failures

**Problem**: Stack already exists

**Solution**: Use `cdk deploy` without `cdk init`. The stack is already initialized.

**Problem**: Bootstrap required

**Solution**:
```bash
cdk bootstrap
```

**Problem**: Resource name conflict

**Solution**: Use different stage or destroy old stack:
```bash
npx cdk destroy --context stage=old-stage
```

### Common Errors

**Error**: `undefined method 'iso8601' for Time`

**Solution**: Add `require 'time'` in Ruby files using `Time#iso8601`.

**Error**: `APPSYNC_ENDPOINT is not set` in unit tests

**Solution**: Already fixed - unit tests skip environment variable check.

## Best Practices

### 1. Always Write Tests First (TDD)

- Write failing test (RED)
- Implement minimum code (GREEN)
- Refactor (GREEN)

### 2. Use Staging Environment

- Deploy to `stg` first
- Run integration tests
- Only deploy to `prod` after confirmation

### 3. Keep Business Logic Pure

- Domain and use case layers should have no AWS dependencies
- Use dependency injection for repositories
- Easy to test with mocks

### 4. Use Descriptive Test Names

```ruby
# Good
it '同じhostId + domainで2回呼び出すと既存グループを返す（冪等性）'

# Bad
it 'works'
```

### 5. Commit Messages

Follow conventional commits:
```
feat: add new feature
fix: fix bug
test: add tests
refactor: refactor code
docs: update documentation
```

### 6. Tag Resources Properly

All resources are automatically tagged. Use tags for:
- Cost analysis
- Resource grouping
- Environment identification

### 7. Ruby String Literals

Always use double-quoted strings in Ruby code to maintain consistency with StandardRB style:

```ruby
# Good
require "json"
require "aws-sdk-dynamodb"

message = "Hello, world!"
interpolation = "Value: #{variable}"
symbol = :"my-symbol"

# Bad
require 'json'
require 'aws-sdk-dynamodb'

message = 'Hello, world!'
interpolation = 'Value: #{variable}'
symbol = :'my-symbol'
```

**Rationale**:
- Consistent with StandardRB linter rules
- Double quotes support interpolation without changes
- Reduces cognitive overhead in code reviews
- Aligns with Ruby community best practices

Run `bundle exec standardrb` to check for violations and `bundle exec standardrb --fix` to auto-fix.

## GraphQL Schema Notes

### Key Types

```graphql
type Group {
  id: ID!           # group_id only
  domain: String!   # global IP or custom string (max 256 chars)
  fullId: String!   # {id}@{domain}
  name: String!
  hostId: ID!       # creator node ID
  createdAt: AWSDateTime!
}
```

### Mutations

- `createGroup`: Idempotent (returns existing group if hostId + domain match)
- `joinGroup`: Node joins a group
- `leaveGroup`: Node leaves a group

### Queries

- `listGroupsByDomain`: List all groups in a domain

## Future Improvements

- [ ] Add Lambda resolver implementation (replace JS resolvers)
- [ ] Add subscription support
- [ ] Add monitoring with CloudWatch
- [ ] Add X-Ray tracing analysis
- [ ] Add CI/CD pipeline
- [ ] Add load testing

---

**Last Updated**: 2025-12-21

**Maintained by**: Claude Code + Human developers
