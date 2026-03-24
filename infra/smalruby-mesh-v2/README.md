# Mesh v2

AWS AppSync GraphQL backend for Smalruby 3.0 Mesh extension.

## Overview

Mesh v2 is a cloud-based backend system that enables real-time data sharing and event notification between multiple clients (Nodes) within Groups. It replaces the existing Mesh extension's SkyWay-based P2P architecture with a scalable AWS AppSync GraphQL API.

## Architecture

- **AWS AppSync**: GraphQL API with real-time subscriptions
- **Amazon DynamoDB**: NoSQL database for Groups, Nodes, and NodeStatus
- **AWS Lambda**: Serverless functions for complex business logic (e.g., group dissolution)
- **TypeScript CDK**: Infrastructure as Code

## Key Concepts

- **Domain**: Scope for group discovery (auto: global IP, manual: custom string)
- **Group**: Container for Nodes with shared data
- **Node**: Abstract client (sensor, browser tab, etc.)
- **NodeStatus**: Latest data from a Node
- **Event**: Notification payload fired by Nodes

## Documentation

- **[API Reference](docs/api-reference.md)** - Complete GraphQL API reference (Queries, Mutations, Subscriptions, Error Handling)
- **[Architecture](docs/architecture.md)** - System architecture, data flows, DynamoDB table design, resolver processing
- **[Development Guide](docs/development.md)** - Local development setup, TDD workflow, testing, debugging
- **[Deployment Guide](docs/deployment.md)** - Initial deployment to production, verification procedures
- **[Operations Guide](docs/operations.md)** - Monitoring, alerting, cost management, scaling, troubleshooting
- **[JavaScript Client Example](examples/javascript-client/README.md)** - Reference implementation for client integration

## Performance Requirements

- **Max Clients**: 40 nodes/group
- **Concurrent Groups**: 10 groups
- **Data Update Rate**: 15 updates/sec/group
- **Event Rate**: 2 events/sec/group
- **Total Write Load**: 170 TPS

## Event Communication Protocols

Mesh v2 supports two protocols for event communication:

### 1. WebSocket Protocol (Primary)
- **Mechanism**: AppSync Subscriptions (WebSocket).
- **Features**: Real-time, low latency, low cost.
- **Requirement**: Network environment must allow `wss://` protocol.

### 2. Polling Protocol (Fallback)
- **Mechanism**: `recordEventsByNode` mutation (save to DynamoDB) + `getEventsSince` query (polling).
- **Features**: HTTPS only, works behind strict firewalls/filters.
- **Latency**: Up to 2 seconds (default polling interval).
- **TTL**: Events are automatically deleted after 10 seconds to minimize storage costs.

Clients automatically detect WebSocket availability during group creation and switch to the Polling protocol if necessary.

## Event Batching

Mesh v2 supports batch event sending to optimize AWS AppSync Subscription costs and preserve event timing.

### Mechanism

Instead of sending each event individually, events are queued and sent in batches every 250ms.

- **Mutation**: `fireEventsByNode(groupId, domain, nodeId, events: [EventInput!]!)`
- **Subscription**: `onMessageInGroup(groupId, domain)`

When receiving a `BatchEvent` (via the `batchEvent` field in `onMessageInGroup`), clients calculate the relative offset for each event based on its `firedAt` timestamp to reproduce the original firing interval.

### Performance Impact

- **Cost Reduction**: Multiple events (up to 1,000) are delivered in a single Subscription message. This directly reduces the number of Subscription delivery units charged by AWS AppSync.
- **Latency**: A maximum delay of 250ms is introduced on the sender side for batching.
- **Payload Limit**: AWS AppSync Subscription payload limit is 240 KB. Mesh v2 automatically splits batches larger than 1,000 events to stay within this limit.

### Usage Example (JavaScript)

```javascript
// Sending multiple events
const events = [
  { eventName: 'e1', payload: 'p1', firedAt: new Date().toISOString() },
  { eventName: 'e2', payload: 'p2', firedAt: new Date().toISOString() }
];

await client.mutate({
  mutation: FIRE_EVENTS,
  variables: { groupId, domain, nodeId, events }
});

// Receiving batch events
subscription.subscribe({
  next: (data) => {
    const batch = data.onMessageInGroup.batchEvent;
    if (!batch) return;
    
    const sorted = batch.events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const baseTime = new Date(sorted[0].timestamp).getTime();
    
    sorted.forEach(event => {
      const offset = new Date(event.timestamp).getTime() - baseTime;
      setTimeout(() => broadcast(event), offset);
    });
  }
});
```

### Best Practices

1. **Use Batching for Events**: Use `fireEventsByNode` for all event communications to optimize subscription costs and ensure timing accuracy.
2. **Include Timestamps**: Always provide accurate `firedAt` timestamps to ensure correct timing reproduction on the receiver side.
3. **Payload Size**: Keep individual event payloads small. Although the batch limit is 1,000 events, large payloads might hit the 240 KB limit sooner.

## Setup

This project is part of the [smalruby3-editor](https://github.com/smalruby/smalruby3-editor) monorepo. All commands run inside the `infra` Docker service.

### Prerequisites

- Docker and Docker Compose
- AWS CLI credentials configured on the host (passed through to Docker)

### Installation

```bash
# Install Node.js dependencies
docker compose run --rm infra npm install

# Install Ruby dependencies (for RSpec tests)
docker compose run --rm infra bundle install
```

### Stage Switching via `.env` Symlink

Per-stage `.env` files (`.env.stg`, `.env.stg2`, `.env.production`) are provided. The `.env` symlink points to the active stage:

```bash
cd infra/smalruby-mesh-v2

# Switch to staging
rm .env && ln -s .env.stg .env

# Switch to production
rm .env && ln -s .env.production .env

# Verify current stage
ls -la .env
```

**CRITICAL**: Always use `.env` symlink switching for deployments. Never override environment variables directly on the command line — this can delete custom domains or other critical resources from the stack.

### Build & Deploy

```bash
# Compile TypeScript
docker compose run --rm infra npm run build

# Bootstrap CDK (first time only)
docker compose run --rm infra npx cdk bootstrap

# Synthesize CloudFormation template
docker compose run --rm infra npx cdk synth

# Show diff against deployed stack
docker compose run --rm infra npx cdk diff

# Deploy (uses STAGE from .env symlink)
docker compose run --rm infra npx cdk deploy
```

## Project Structure

```
smalruby-mesh-v2/
├── bin/
│   └── mesh-v2.ts              # CDK app entry point
├── lib/
│   └── mesh-v2-stack.ts        # CDK stack definition (AppSync, DynamoDB)
├── graphql/
│   └── schema.graphql          # GraphQL schema
├── js/
│   ├── resolvers/              # AppSync JavaScript resolvers (Query/Mutation)
│   └── functions/              # AppSync Pipeline functions
├── lambda/                     # Ruby Lambda functions (Hexagonal Architecture)
│   ├── handlers/               # Adapter: AppSync event handling
│   ├── domain/                 # Domain: Entities and validation
│   ├── use_cases/              # Application: Business logic
│   └── repositories/           # Infrastructure: Data access
├── spec/
│   ├── unit/                   # RSpec unit tests (pure Ruby)
│   ├── requests/               # RSpec integration tests (E2E against AppSync)
│   └── fixtures/               # GraphQL query/mutation files for tests
├── test/
│   └── mesh-v2.test.ts         # Jest CDK infrastructure tests
├── docs/                       # Documentation
├── examples/                   # JavaScript client example
├── .env.stg                    # Staging environment variables
├── .env.stg2                   # Staging 2 environment variables
├── .env.production             # Production environment variables
├── .env.example                # Environment variables template
├── .env -> .env.production     # Symlink to active stage
├── Gemfile                     # Ruby dependencies
└── package.json                # Node.js dependencies
```

## Related

- Repository: [smalruby/smalruby3-editor](https://github.com/smalruby/smalruby3-editor) (monorepo)
- Client extension: `packages/scratch-vm/src/extensions/scratch3_mesh_v2/`

## License

MIT
