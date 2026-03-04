# Mesh v2 JavaScript Client Prototype

A vanilla JavaScript prototype demonstrating Mesh v2 client integration with AWS AppSync GraphQL API.

## Overview

This prototype serves as a reference implementation for integrating Mesh v2 functionality into Smalruby3-gui. It demonstrates:

- Domain-based group management (up to 256 characters)
- Mandatory domain for all operations
- Domain generation from source IP via `createDomain` mutation
- Real-time sensor data transmission with rate limiting
- Event system with pub/sub capabilities
- 10-minute session management
- Pure JavaScript implementation (no TypeScript, no build tools)

**Related Issues:**
- [smalruby/smalruby3-gui#453](https://github.com/smalruby/smalruby3-gui/issues/453) - Phase 3: Mesh v2 Frontend Extension
- [smalruby/mesh-v2#6](https://github.com/smalruby/mesh-v2/issues/6) - Prototype specification

## Quick Start

### 1. Install Dependencies

```bash
cd examples/javascript-client
npm install
```

### 2. Configure API Credentials

Get your AppSync API endpoint and API key from the staging deployment:

```bash
# From mesh-v2 root directory
aws cloudformation describe-stacks --stack-name MeshV2Stack-stg \
  --query 'Stacks[0].Outputs' --output table
```

You'll need:
- **GraphQL API Endpoint**: `https://....appsync-api....amazonaws.com/graphql`
- **API Key**: `da2-...`

### 3. Build and Start the Server

```bash
npm start
```

This will:
1. Build the mesh-client bundle with esbuild (includes AWS Amplify)
2. Start the server on `http://localhost:3000`

**Note**: The `npm start` command automatically runs `npm run build` first.

### 4. Open in Browser

```bash
# Domain will be auto-generated from your IP upon connection if not specified
open http://localhost:3000

# Or with custom domain
open "http://localhost:3000?mesh=my-test-domain"
```

## Features

### 1. Domain Management

**URL Parameter:**
```
http://localhost:3000?mesh=custom-domain
```

- Domain can be up to 256 characters
- Domain is required for all Mesh operations
- If no domain specified, the client calls `createDomain` to generate one from your source IP
- Domain persists in UI for the session

### 2. Group Operations

#### Create Group
1. Enter AppSync endpoint and API key
2. (Optional) Set custom domain
3. Click "Connect to Mesh v2"
4. Enter group name
5. Click "Create Group"

You automatically become the **host** of the created group.

#### List Groups
- Click "Refresh Group List" to see all groups in your domain
- Groups display: name, ID, and host ID

#### Join Group
1. Click on a group from the list to select it
2. Click "Join Selected Group"
3. You become a **member** of the group

#### Dissolve Group
- Click "Dissolve Group" to exit and dissolve the group (host only)
- Only the group host can dissolve groups
- Dissolving removes all members and deletes the group
- **Group Dissolution Detection**: When a host dissolves a group, all member nodes automatically detect the dissolution via WebSocket subscription and are disconnected from the group

### 3. Sensor Data

**Available Sensors:**
- Temperature (-20°C to 50°C)
- Brightness (0% to 100%)
- Distance (0cm to 300cm)

**Features:**
- **Change Detection**: Only transmits when values change
- **Rate Limiting**: Maximum 4 sends per second (250ms intervals)
- **Real-time Display**: Shows current values
- **Rate Status**: Displays current usage (e.g., "2/4 per second")

**How it works:**
1. Adjust sensor sliders
2. Values are automatically sent to the group (if changed)
3. Other nodes in the group will receive updates in real-time via the unified subscription

### 4. Event System

**Send Events:**
1. Enter event name (e.g., "button-click")
2. (Optional) Add payload (JSON or text)
3. Click "Send Event"

**Features:**
- **Rate Limiting**: Maximum 2 events per second (500ms intervals)
- **Event History**: Displays last 20 events
- **Payload Support**: Can send JSON or plain text data

**Event History:**
- Shows event name, sender, payload, and timestamp
- Auto-updates as events are received
- Click "Clear History" to reset

### 5. Session Management

**10-Minute Timeout:**
- Session timer counts down from 10 minutes
- Warning displayed when 5 minutes remaining (red text)
- Automatic logout at session end
- Auto-leaves group before disconnect

**Connection Status:**
- Green "Connected" when active
- Shows current domain
- Displays generated node ID

## Architecture

### File Structure

```
javascript-client/
├── index.html          # UI layout and styling
├── mesh-client.js      # GraphQL client library
├── app.js              # Application logic and state
├── server.js           # Express static file server
├── package.json        # Node.js dependencies
└── README.md           # This file
```

### Core Components

#### MeshClient (mesh-client.js)

GraphQL client for AWS AppSync with methods:

```javascript
// Mutations
await client.createGroup(name, hostId, domain)
await client.joinGroup(groupId, nodeId, domain)
await client.dissolveGroup(groupId, hostId, domain)  // Host only
await client.reportDataByNode(nodeId, groupId, domain, data)
await client.fireEventsByNode(nodeId, groupId, domain, events)

// Queries
await client.listGroupsByDomain(domain)

// Subscriptions (WebSocket via AppSync)
client.subscribeToMessageInGroup(groupId, domain, {
  onDataUpdate: (statuses) => { /* handle sensor updates */ },
  onBatchEvent: (batchEvent) => { /* handle events */ },
  onGroupDissolve: (dissolveData) => { /* handle dissolution */ }
})
```

#### RateLimiter (mesh-client.js)

Enforces rate limits:

```javascript
const limiter = new RateLimiter(4, 1000); // 4 calls per 1000ms

if (limiter.canMakeCall()) {
  // Make API call
}
```

#### ChangeDetector (mesh-client.js)

Detects value changes:

```javascript
const detector = new ChangeDetector();

if (detector.hasChanged('temperature', 25)) {
  // Value changed, transmit data
}
```

## Testing

### Test with Two Browser Windows

1. **Window 1** (Host):
   ```
   http://localhost:3000?mesh=test-domain
   ```
   - Connect with API credentials
   - Create group "Test Group"
   - Adjust sensors
   - Send events

2. **Window 2** (Member):
   ```
   http://localhost:3000?mesh=test-domain
   ```
   - Connect with same API credentials
   - Click "Refresh Group List"
   - Join "Test Group"
   - Observe sensor data and events from Window 1 in real-time
   - **Test Dissolution Detection**: When Window 1 dissolves the group, Window 2 should automatically detect and show error message

### Test Scenarios

#### Domain Handling
- [ ] URL parameter `?mesh=testdomain` sets domain correctly
- [ ] No parameter shows "auto-detect (sourceIp)"
- [ ] 256-character domain accepted
- [ ] Domain displays in UI

#### Group Operations
- [ ] Create group succeeds
- [ ] Created group appears in list
- [ ] Join group from list works
- [ ] Dissolve button only enabled when user is host
- [ ] Dissolve group removes group from list
- [ ] Host/Member role displays correctly
- [ ] Member nodes automatically detect and exit when host dissolves group
- [ ] Dissolution notification displays correct error message

#### Sensor Data
- [ ] Slider changes update display values
- [ ] Unchanged sensors don't send data
- [ ] Changed sensors send data
- [ ] Rate limit prevents >4 sends/sec
- [ ] Rate status displays current usage

#### Events
- [ ] Event with name only sends
- [ ] Event with payload sends
- [ ] Events appear in history
- [ ] Rate limit prevents >2 events/sec
- [ ] Clear history works

#### Session Management
- [ ] Timer counts down from 10 minutes
- [ ] Warning appears at 5 minutes
- [ ] Logout occurs at timeout

## Known Limitations

### Current Implementation Status

The prototype has the following implementation status:

1. **Implemented WebSocket Subscriptions**
   - ✅ `subscribeToMessageInGroup()` - Unified subscription for all group messages (data, events, dissolution)

2. **Backend API Status**
   - ✅ `createGroup` - Fully implemented and working
   - ✅ `joinGroup` - Fully implemented and working
   - ✅ `dissolveGroup` - Fully implemented with automatic member notification
   - ✅ `reportDataByNode` - Fully implemented with group existence validation
   - ✅ `fireEventsByNode` - Fully implemented with group existence validation

3. **Display Features**
   - ✅ "Other Nodes Data" panel displays real-time sensor data from group members
   - ✅ Event history shows received events from other nodes
   - ✅ Group dissolution automatically clears UI and shows notification

### Future Enhancements

- [ ] Show group members list
- [ ] Add reconnection logic for network failures
- [ ] Persist group membership across page refresh
- [ ] Add visual notifications for events
- [ ] Implement proper error retry logic

## Troubleshooting

### Connection Errors

**"Connection failed"**
- Verify AppSync endpoint URL is correct
- Check API key is valid
- Ensure internet connection
- Check browser console for CORS errors

**"Failed to create group"**
- Verify you're connected first
- Check domain length (max 256 chars)
- See browser console for GraphQL errors

### Rate Limit Errors

**"Sensor data rate limit exceeded"**
- Slow down slider adjustments
- Current limit: 4 sends per second
- Wait for rate status to reset

**"Event rate limit exceeded"**
- Wait 500ms between events
- Current limit: 2 events per second

### Session Issues

**"Session timeout"**
- Sessions last 10 minutes maximum
- Reconnect to start new session
- Groups are automatically left before timeout

## Development

### Local Development

```bash
# Install dependencies
npm install

# Build mesh-client bundle (includes AWS Amplify)
npm run build

# Start server (automatically runs build first)
npm start

# Server runs on http://localhost:3000
```

**Build Process:**
- Uses esbuild to bundle mesh-client.js with AWS Amplify dependencies
- Output: `mesh-client.bundle.js` (~461KB)
- Build artifacts are git-ignored (.gitignore)

### Code Structure

**State Management (app.js):**
```javascript
const state = {
  client: null,           // MeshClient instance
  connected: false,       // Connection status
  currentGroup: null,     // Current group object
  currentNodeId: null,    // Generated node ID
  selectedGroupId: null,  // UI selected group
  sessionStartTime: null, // For 10-min timer
  sensorData: {},         // Current sensor values
  eventHistory: []        // Last 20 events
};
```

### Adding New Sensors

1. Add HTML range input to `index.html`
2. Add sensor to `state.sensorData` in `app.js`
3. Add event listener in `setupSensorListeners()`
4. Data will auto-transmit on change

### Adding New Events

Events are user-defined and require no code changes. Just enter:
- Event name in UI
- Payload (optional)
- Click "Send Event"

## API Reference

### GraphQL Mutations

```graphql
# Create Group
mutation CreateGroup($name: String!, $hostId: ID!, $domain: String!) {
  createGroup(name: $name, hostId: $hostId, domain: $domain) {
    id domain fullId name hostId createdAt expiresAt
  }
}

# Join Group
mutation JoinGroup($groupId: ID!, $domain: String!, $nodeId: ID!) {
  joinGroup(groupId: $groupId, domain: $domain, nodeId: $nodeId) {
    id name groupId domain
  }
}

# Report Sensor Data
mutation ReportDataByNode(
  $nodeId: ID!
  $groupId: ID!
  $domain: String!
  $data: [SensorDataInput!]!
) {
  reportDataByNode(nodeId: $nodeId, groupId: $groupId, domain: $domain, data: $data) {
    groupId
    domain
    nodeStatus {
      nodeId
      groupId
      domain
      data { key value }
      timestamp
    }
  }
}

# Fire Events
mutation FireEventsByNode(
  $nodeId: ID!
  $groupId: ID!
  $domain: String!
  $events: [EventInput!]!
) {
  fireEventsByNode(nodeId: $nodeId, groupId: $groupId, domain: $domain, events: $events) {
    groupId
    domain
    batchEvent {
      events {
        name
        firedByNodeId
        payload
        timestamp
      }
      firedByNodeId
      timestamp
    }
  }
}
```

### GraphQL Queries

```graphql
# List Groups by Domain
query ListGroupsByDomain($domain: String!) {
  listGroupsByDomain(domain: $domain) {
    id domain fullId name hostId createdAt
  }
}
```

### GraphQL Subscriptions

```graphql
# Subscribe to all messages in a group
subscription OnMessageInGroup($groupId: ID!, $domain: String!) {
  onMessageInGroup(groupId: $groupId, domain: $domain) {
    groupId
    domain
    nodeStatus {
      nodeId
      groupId
      domain
      data { key value }
      timestamp
    }
    batchEvent {
      events {
        name
        firedByNodeId
        groupId
        domain
        payload
        timestamp
      }
      firedByNodeId
      groupId
      domain
      timestamp
    }
    groupDissolve {
      groupId
      domain
      message
    }
  }
}
```

## Contributing

This prototype is part of the Mesh v2 project. See:
- [Issue #6](https://github.com/smalruby/mesh-v2/issues/6) for prototype tasks
- [Issue #453](https://github.com/smalruby/smalruby3-gui/issues/453) for frontend integration

## License

MIT License - See main project LICENSE file

---

**Generated with [Claude Code](https://claude.com/claude-code)**

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
