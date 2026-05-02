# Mesh v2 AWS Cost Breakdown

This document details the per-operation AWS costs for the Mesh v2 infrastructure, based on the **production** configuration values.

## AWS Pricing (ap-northeast-1, Tokyo Region)

| Service | Unit | Price |
|---------|------|-------|
| AppSync Query/Mutation | per request | $0.000004 |
| AppSync Real-time Update (Subscription delivery) | per message | $0.000002 |
| AppSync Real-time Connection | per minute | $0.00000008 |
| DynamoDB Write Request Unit (WRU) | per WRU (1KB) | $0.000001425 |
| DynamoDB Read Request Unit (RRU) | per RRU (4KB) | $0.000000285 |
| DynamoDB Transactional Write | per WRU (1KB) | $0.00000285 (2x) |
| DynamoDB Transactional Read | per RRU (4KB) | $0.00000057 (2x) |
| DynamoDB Storage | per GB/month | $0.285 |
| Lambda Request | per request | $0.0000002 |
| Lambda Duration (128MB) | per ms | $0.0000000017 |

> Note: DynamoDB On-Demand pricing. Transactional operations cost 2x normal.

## Production Configuration

| Parameter | Value | Description |
|-----------|-------|-------------|
| `MESH_HOST_HEARTBEAT_INTERVAL_SECONDS` | 60 | Host heartbeat interval |
| `MESH_HOST_HEARTBEAT_TTL_SECONDS` | 150 | Host group TTL |
| `MESH_MEMBER_HEARTBEAT_INTERVAL_SECONDS` | 120 | Member heartbeat interval |
| `MESH_MEMBER_HEARTBEAT_TTL_SECONDS` | 600 | Member node TTL |
| `MESH_MAX_CONNECTION_TIME_SECONDS` | 2100 | Max group lifetime (35 min) |
| `MESH_EVENT_TTL_SECONDS` | 10 | Event auto-deletion TTL |
| `MESH_POLLING_INTERVAL_SECONDS` | 2 | Polling interval for HTTPS clients |

### Client-Side Rate Limits

| Parameter | Default | Description |
|-----------|---------|-------------|
| `MESH_DATA_UPDATE_INTERVAL_MS` | 1000ms | Sensor data send interval (with merge) |
| `MESH_EVENT_BATCH_INTERVAL_MS` | 1000ms | Event batch send interval |
| `MESH_PERIODIC_DATA_SYNC_INTERVAL_MS` | 15000ms | Periodic data sync interval (HTTPS only) |

---

## One-Time Operations

### Create Domain

User action: Click "Create Group" or "Join Group" (first time, domain not set).

| Billable Element | Count | Unit Cost | Subtotal |
|-----------------|-------|-----------|----------|
| AppSync Request | 1 | $0.000004 | $0.000004 |
| Lambda Invocation | 1 | $0.0000002 | $0.0000002 |
| Lambda Duration (~50ms) | 50ms | $0.0000000017/ms | $0.000000085 |
| DynamoDB | 0 | - | $0 |
| **Total** | | | **$0.000004285** |

> Pure computation (CRC32 hash of source IP). No DynamoDB operations.

---

### Create Group

User action: Click "Create Group" button.

Pipeline: `checkExistingGroup` (Query) -> `createGroupIfNotExists` (PutItem)

| Billable Element | Count | Unit Cost | Subtotal |
|-----------------|-------|-----------|----------|
| AppSync Request | 1 | $0.000004 | $0.000004 |
| DynamoDB Query (check existing) | 1 | $0.000000285 | $0.000000285 |
| DynamoDB Write (PutItem, ~300B) | 1 WRU | $0.000001425 | $0.000001425 |
| **Total** | | | **$0.00000571** |

> If the group already exists (idempotent retry), the PutItem becomes a GetItem (1 RRU) instead.
> Item size: ~300 bytes (group metadata with timestamps, TTL, GSI attributes).

---

### Join Group

User action: Click "Join" button on a group.

Pipeline: `checkGroupExists` (GetItem) -> `joinGroupFunction` (TransactWriteItems: 2 PutItems)

| Billable Element | Count | Unit Cost | Subtotal |
|-----------------|-------|-----------|----------|
| AppSync Request | 1 | $0.000004 | $0.000004 |
| DynamoDB Read (GetItem, group check) | 1 RRU | $0.000000285 | $0.000000285 |
| DynamoDB Transactional Write (2 PutItems, ~150B each) | 2 WRU | $0.00000285/WRU | $0.0000057 |
| **Total** | | | **$0.000009985** |

> TransactWriteItems atomically creates: (1) group-node mapping, (2) node-group reverse mapping.

---

### Leave Group (Member)

User action: Click "Disconnect" button (as member).

Lambda: `leaveGroup` -> TransactWriteItems (2 DeleteItems) + DeleteItem (status)

| Billable Element | Count | Unit Cost | Subtotal |
|-----------------|-------|-----------|----------|
| AppSync Request | 1 | $0.000004 | $0.000004 |
| Lambda Invocation | 1 | $0.0000002 | $0.0000002 |
| Lambda Duration (~100ms) | 100ms | $0.0000000017/ms | $0.00000017 |
| DynamoDB Transactional Write (2 DeleteItems) | 2 WRU | $0.00000285/WRU | $0.0000057 |
| DynamoDB Write (DeleteItem, status) | 1 WRU | $0.000001425 | $0.000001425 |
| **Total** | | | **$0.000011495** |

---

### Dissolve Group (Host)

User action: Click "Disconnect" button (as host).

Lambda: `dissolveGroup` -> GetItem + Query + N x DeleteItem

For a group with **M members** (each member has node record + status = 2 items, plus 1 metadata item, plus M reverse-lookup items):

- Group items to delete: 1 (metadata) + M (node records) + M (node statuses) = **1 + 2M** items
- Reverse-lookup items to delete: **M** items
- Total DeleteItems: **1 + 3M**

Example: group with **5 members**:

| Billable Element | Count | Unit Cost | Subtotal |
|-----------------|-------|-----------|----------|
| AppSync Request | 1 | $0.000004 | $0.000004 |
| Lambda Invocation | 1 | $0.0000002 | $0.0000002 |
| Lambda Duration (~200ms) | 200ms | $0.0000000017/ms | $0.00000034 |
| DynamoDB Read (GetItem, group check) | 1 RRU | $0.000000285 | $0.000000285 |
| DynamoDB Read (Query, list items) | ~11 RRU | $0.000000285 | $0.000003135 |
| DynamoDB Write (16 DeleteItems) | 16 WRU | $0.000001425 | $0.0000228 |
| **Total (5 members)** | | | **$0.00003076** |

> Cost scales linearly with member count. Formula: ~$0.000004 + $0.000004275 x M

---

## Periodic Operations (During Active Session)

### Host Heartbeat (`renewHeartbeat`)

Timing: Every **60 seconds** while group is active.

Pipeline: `checkGroupExists` (GetItem) -> `renewHeartbeatFunction` (UpdateItem)

| Billable Element | Count | Unit Cost | Subtotal |
|-----------------|-------|-----------|----------|
| AppSync Request | 1 | $0.000004 | $0.000004 |
| DynamoDB Read (GetItem, group check) | 1 RRU | $0.000000285 | $0.000000285 |
| DynamoDB Write (UpdateItem, ~50B) | 1 WRU | $0.000001425 | $0.000001425 |
| **Per heartbeat** | | | **$0.00000571** |
| **Per minute** | | | **$0.00000571** |
| **Per hour** | | | **$0.0003426** |

---

### Member Heartbeat (`sendMemberHeartbeat`)

Timing: Every **120 seconds** per member while connected.

Pipeline: `checkGroupExists` (GetItem) -> `updateNodeTTL` (UpdateItem)

| Billable Element | Count | Unit Cost | Subtotal |
|-----------------|-------|-----------|----------|
| AppSync Request | 1 | $0.000004 | $0.000004 |
| DynamoDB Read (GetItem, group check) | 1 RRU | $0.000000285 | $0.000000285 |
| DynamoDB Write (UpdateItem, ~50B) | 1 WRU | $0.000001425 | $0.000001425 |
| **Per heartbeat** | | | **$0.00000571** |
| **Per minute (per member)** | | | **$0.000002855** |
| **Per hour (per member)** | | | **$0.0001713** |

---

### Variable Update (`reportDataByNode`)

Timing: Up to every **1 second** per node (rate-limited by `dataRateLimiter`). With merge enabled, rapid updates to the same variable are batched into a single request.

Pipeline: `checkGroupExists` (GetItem) -> `reportDataByNode` (PutItem)

| Billable Element | Count | Unit Cost | Subtotal |
|-----------------|-------|-----------|----------|
| AppSync Request | 1 | $0.000004 | $0.000004 |
| DynamoDB Read (GetItem, group check) | 1 RRU | $0.000000285 | $0.000000285 |
| DynamoDB Write (PutItem, ~250-400B) | 1 WRU | $0.000001425 | $0.000001425 |
| **Per request** | | | **$0.00000571** |
| **Per second (worst case)** | | | **$0.00000571** |
| **Per minute (worst case)** | | | **$0.0003426** |
| **Per hour (worst case)** | | | **$0.020556** |

> "Worst case" = continuous updates every second (e.g., a forever block setting a variable).
> With merge, if the same variable is updated multiple times within 1 second, only 1 request is sent.

#### WebSocket Subscription Delivery (Receiver Side)

Each `reportDataByNode` triggers a subscription message to all subscribed nodes in the group.

| Billable Element | Count | Unit Cost | Subtotal |
|-----------------|-------|-----------|----------|
| AppSync Subscription message | 1 per subscriber | $0.000002 | $0.000002 |
| **Per request (N subscribers)** | | | **$0.000002 x N** |

---

### Polling Sync (HTTPS Polling Mode) — issue #554 で統合

Timing: Every **2 seconds** (`MESH_POLLING_INTERVAL_SECONDS`) per polling client.
Uses the `pollGroupData` Pipeline Resolver which performs **2 DynamoDB Query
operations internally** (events + node statuses) but is billed as **1 AppSync
request**.

| Billable Element | Count | Unit Cost | Subtotal |
|-----------------|-------|-----------|----------|
| AppSync Request | 1 | $0.000004 | $0.000004 |
| DynamoDB Read (events Query, limit 100) | 1-3 RRU | $0.000000285 | $0.000000855 |
| DynamoDB Read (nodeStatuses Query) | 1-10 RRU | $0.000000285 | $0.00000285 |
| **Per poll** | | | **$0.0000077** |
| **Per minute (30 polls)** | | | **$0.000231** |
| **Per hour** | | | **$0.01386** |

> WebSocket mode does not use this polling. WebSocket receives subscription
> messages instead and uses `Periodic Data Sync` (below) as a 15-second
> fallback to refresh node statuses.

#### Why a single Pipeline Resolver

Issue #554 で `getEventsSince` (2s) と `listGroupStatuses` (15s,
`startPeriodicDataSync` 経由) を `pollGroupData` Pipeline Resolver に統合。
AppSync は Pipeline 内の Function 数に関係なく **1 リクエスト = 1 op**
として課金されるため、AppSync コスト観点では **約 12% 削減**:

- Old: getEventsSince (30/min) + listGroupStatuses (4/min) = **34 ops/min**
- New: pollGroupData (30/min) = **30 ops/min**

DynamoDB の RCU 消費はノードステータス取得頻度が **15s → 2s** に増えるため
わずかに増加 (per-poll で +0.5x の RRU)。ただしリアルタイム性向上のメリット
(同期遅延 15s → 2s) で相殺される設計。

#### Periodic Data Sync (WebSocket Mode のみ)

Timing: Every **15 seconds** per WebSocket client. Uses `listGroupStatuses`
to refresh node statuses (subscription の取りこぼし時のフォールバック)。

| Billable Element | Count | Unit Cost | Subtotal |
|-----------------|-------|-----------|----------|
| AppSync Request | 1 | $0.000004 | $0.000004 |
| DynamoDB Read (Query) | 1-10 RRU | $0.000000285 | $0.00000285 |
| **Per sync** | | | **$0.00000685** |
| **Per minute (4 syncs)** | | | **$0.0000274** |
| **Per hour** | | | **$0.001644** |

> Polling モードでは pollGroupData が同じ役割を果たすため、`startPeriodicDataSync`
> はスキップされる (issue #554)。

---

### Event Send (`fireEventsByNode` / `recordEventsByNode`)

Timing: Batched every **1 second** (`eventBatchInterval`). Max 100 events per queue.

#### WebSocket Mode: `fireEventsByNode`

Uses None DataSource (pass-through). No DynamoDB operations.

| Billable Element | Count | Unit Cost | Subtotal |
|-----------------|-------|-----------|----------|
| AppSync Request | 1 | $0.000004 | $0.000004 |
| DynamoDB | 0 | - | $0 |
| **Per batch** | | | **$0.000004** |
| **Per second (worst case)** | | | **$0.000004** |
| **Per minute (worst case)** | | | **$0.00024** |
| **Per hour (worst case)** | | | **$0.0144** |

#### HTTPS (Polling) Mode: `recordEventsByNode`

Uses Lambda + DynamoDB BatchWriteItem. Events are stored temporarily (TTL = 10 seconds).

For a batch of **E events**:

| Billable Element | Count | Unit Cost | Subtotal |
|-----------------|-------|-----------|----------|
| AppSync Request | 1 | $0.000004 | $0.000004 |
| Lambda Invocation | 1 | $0.0000002 | $0.0000002 |
| Lambda Duration (~100ms) | 100ms | $0.0000000017/ms | $0.00000017 |
| DynamoDB Read (GetItem, group check) | 1 RRU | $0.000000285 | $0.000000285 |
| DynamoDB Write (BatchWriteItem) | E WRU | $0.000001425 | $0.000001425 x E |
| **Per batch (E events)** | | | **$0.000004655 + $0.000001425 x E** |

Example: 5 events per batch = $0.00001178

#### Subscription Delivery (Receiver Side)

| Billable Element | Count | Unit Cost | Subtotal |
|-----------------|-------|-----------|----------|
| AppSync Subscription message | 1 per subscriber | $0.000002 | $0.000002 |
| **Per event batch (N subscribers)** | | | **$0.000002 x N** |

---

### Event Receive (HTTPS Polling Mode)

> Same as `Polling Sync (HTTPS Polling Mode)` above — the unified
> `pollGroupData` query (issue #554) fetches both events and nodeStatuses
> per poll. See the table in that section for billing.

---

### WebSocket Connection

Timing: Continuous while connected to subscription.

| Billable Element | Count | Unit Cost | Subtotal |
|-----------------|-------|-----------|----------|
| AppSync Connection | per minute | $0.00000008 | $0.00000008 |
| **Per hour** | | | **$0.0000048** |
| **Per 35-min session** | | | **$0.0000028** |

---

## DynamoDB Storage

Items are automatically deleted by DynamoDB TTL. Active storage is minimal.

| Item Type | Size | TTL | Count (per group) |
|-----------|------|-----|-------------------|
| Group metadata | ~300B | Host heartbeat TTL (150s) | 1 |
| Node record | ~150B | Member heartbeat TTL (600s) | M (members) |
| Node status (sensor data) | ~250-400B | Member heartbeat TTL (600s) | M (members) |
| Node reverse-lookup | ~150B | Member heartbeat TTL (600s) | M (members) |
| Event record | ~150B | Event TTL (10s) | transient |

For a group with 5 members: ~1 + 5 x 3 = 16 items, ~3.5KB total.

DynamoDB storage cost: $0.285/GB/month. Even 10,000 concurrent groups (~35MB) = **$0.01/month**.

---

## Scenario Cost Estimates

### Scenario: 1 Group, 5 Members, WebSocket Mode, 35-min Session

Assumptions:
- Host sends heartbeat every 60s (35 heartbeats)
- 5 members send heartbeat every 120s (5 x 17 = 85 heartbeats)
- 3 nodes actively updating variables every 1s for 10 min (3 x 600 = 1800 reportData)
- 50 event batches total (10 per node average)
- All 5 members subscribed to messages

| Operation | Count | Unit Cost | Subtotal |
|-----------|-------|-----------|----------|
| **Setup** | | | |
| createDomain | 1 | $0.000004285 | $0.000004 |
| createGroup | 1 | $0.00000571 | $0.000006 |
| joinGroup | 5 | $0.000009985 | $0.000050 |
| **Heartbeats** | | | |
| renewHeartbeat (host) | 35 | $0.00000571 | $0.000200 |
| sendMemberHeartbeat | 85 | $0.00000571 | $0.000485 |
| **Data** | | | |
| reportDataByNode | 1800 | $0.00000571 | $0.010278 |
| Subscription delivery | 1800 x 4 | $0.000002 | $0.014400 |
| **Events** | | | |
| fireEventsByNode | 50 | $0.000004 | $0.000200 |
| Subscription delivery | 50 x 4 | $0.000002 | $0.000400 |
| **Teardown** | | | |
| dissolveGroup (5 members) | 1 | $0.00003076 | $0.000031 |
| **WebSocket Connection** | | | |
| 6 connections x 35 min | 210 min | $0.00000008 | $0.000017 |
| **Total** | | | **$0.026071** |

### Scenario: 1 Group, 5 Members, HTTPS Polling Mode, 35-min Session (issue #554 後)

Same assumptions, but using HTTPS polling instead of WebSocket.
`pollGroupData` (issue #554) で events と nodeStatuses を 1 リクエストに統合。

| Operation | Count | Unit Cost | Subtotal |
|-----------|-------|-----------|----------|
| **Setup** | | | |
| createDomain | 1 | $0.000004285 | $0.000004 |
| createGroup | 1 | $0.00000571 | $0.000006 |
| joinGroup | 5 | $0.000009985 | $0.000050 |
| **Heartbeats** | | | |
| renewHeartbeat (host) | 35 | $0.00000571 | $0.000200 |
| sendMemberHeartbeat | 85 | $0.00000571 | $0.000485 |
| **Data** | | | |
| reportDataByNode | 1800 | $0.00000571 | $0.010278 |
| **Events** | | | |
| recordEventsByNode (5 events/batch) | 50 | $0.00001178 | $0.000589 |
| **Polling** | | | |
| pollGroupData (5 clients x 30/min x 35 min) | 5250 | $0.0000077 | $0.040425 |
| **Teardown** | | | |
| dissolveGroup (5 members) | 1 | $0.00003076 | $0.000031 |
| **Total** | | | **$0.052068** |

#### issue #554 前後の比較

| | Old (`getEventsSince` + `listGroupStatuses`) | New (`pollGroupData`) | 変化 |
|---|---:|---:|---:|
| AppSync requests / poll cycle | 2 (events 30/min + status 4/min) | 1 (30/min) | **-12%** |
| Data sync 遅延 | 最大 15s | 最大 2s | **-87%** |
| Polling 行 (5 clients × 35min) cost | $0.025489 + $0.004795 = **$0.030284** | **$0.040425** | +33% (DynamoDB RRU 増) |
| **35min session total** | $0.041927 | $0.052068 | +24% |

> リアルタイム性 (15s → 2s) を取った分 DynamoDB の RRU が増加するが、
> AppSync request 数自体は減っている。WebSocket モードと比較すると依然
> 60% 程度高い。WebSocket が使える環境では引き続き WebSocket を優先する。

---

## Cost Summary by Billing Component

### Per Group Per Hour (WebSocket, 5 Members, Active Use)

| Component | Cost/hour | Percentage |
|-----------|-----------|------------|
| AppSync Requests (mutations) | $0.0154 | 21% |
| AppSync Subscriptions (delivery) | $0.0259 | 36% |
| AppSync Connections | $0.0000288 | 0% |
| DynamoDB Writes | $0.0148 | 20% |
| DynamoDB Reads | $0.0017 | 2% |
| Lambda | $0.00015 | 0% |
| **Total** | **~$0.058/hour** | 100% |

### Key Cost Drivers

1. **Variable updates (`reportDataByNode`)** - Dominant cost when nodes actively update variables. Each update costs $0.00000571 (AppSync + DynamoDB). With 5 members continuously updating: ~$0.03/hour.

2. **Subscription delivery** - Each mutation triggers delivery to N-1 other subscribers at $0.000002 each. For frequent updates, this becomes significant.

3. **HTTPS Polling** - If using polling instead of WebSocket, the `getEventsSince` query every 2 seconds per client adds ~$0.009/hour per client.

4. **Heartbeats** - Minimal cost. Host heartbeat: $0.00034/hour. Member heartbeat: $0.00017/hour per member.

---

## Appendix: GraphQL Operations Reference

| Operation | Type | Resolver | DynamoDB Operations | Lambda |
|-----------|------|----------|---------------------|--------|
| `createDomain` | Mutation | Lambda | None | Yes |
| `createGroup` | Mutation | Pipeline (JS) | 1 Query + 1 PutItem | No |
| `joinGroup` | Mutation | Pipeline (JS) | 1 GetItem + 1 TransactWrite (2 PutItems) | No |
| `leaveGroup` | Mutation | Lambda | 1 TransactWrite (2 Deletes) + 1 DeleteItem | Yes |
| `dissolveGroup` | Mutation | Lambda | 1 GetItem + 1 Query + (1+3M) DeleteItems | Yes |
| `renewHeartbeat` | Mutation | Pipeline (JS) | 1 GetItem + 1 UpdateItem | No |
| `sendMemberHeartbeat` | Mutation | Pipeline (JS) | 1 GetItem + 1 UpdateItem | No |
| `reportDataByNode` | Mutation | Pipeline (JS) | 1 GetItem + 1 PutItem | No |
| `fireEventsByNode` | Mutation | Pipeline (JS) | 1 GetItem + None (pass-through) | No |
| `recordEventsByNode` | Mutation | Lambda | 1 GetItem + BatchWrite (E items) | Yes |
| `listGroupsByDomain` | Query | Direct (JS) | 1 Query | No |
| `listGroupStatuses` | Query | Direct (JS) | 1 Query | No |
| `listNodesInGroup` | Query | Direct (JS) | 1 Query | No |
| `searchGroupsByNamePrefix` | Query | Direct (JS) | 1 Query (GSI) | No |
| `getEventsSince` | Query | Direct (JS) | 1 Query | No |
| `getNodeStatus` | Query | Pipeline (JS) | 2 GetItems | No |
