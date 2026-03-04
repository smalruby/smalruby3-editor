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

### Prerequisites

- Node.js 18+ and npm
- AWS CLI configured with credentials
- AWS CDK CLI: `npm install -g aws-cdk`

### Installation

```bash
npm install
```

### Build

```bash
npm run build
```

### Deploy

```bash
# Bootstrap CDK (first time only)
cdk bootstrap

# Deploy stack
cdk deploy
```

## Useful Commands

- `npm run build` - Compile TypeScript to JavaScript
- `npm run watch` - Watch for changes and compile
- `npm run test` - Perform Jest unit tests
- `npx cdk deploy` - Deploy this stack to your AWS account/region
- `npx cdk diff` - Compare deployed stack with current state
- `npx cdk synth` - Emits the synthesized CloudFormation template

## Project Structure

```
mesh-v2/
├── bin/
│   └── mesh-v2.ts          # CDK app entry point
├── lib/
│   └── mesh-v2-stack.ts    # Main stack definition
├── graphql/
│   └── schema.graphql      # GraphQL schema
├── js/
│   └── resolvers/          # AppSync JavaScript resolvers
├── lambda/
│   └── leave_group_logic/  # Lambda functions
└── test/
    └── mesh-v2.test.ts     # Unit tests
```

## Related

- EPIC Issue: [smalruby/smalruby3-gui#444](https://github.com/smalruby/smalruby3-gui/issues/444)
- Phase 1-1: [smalruby/smalruby3-gui#446](https://github.com/smalruby/smalruby3-gui/issues/446)

## License

MIT
