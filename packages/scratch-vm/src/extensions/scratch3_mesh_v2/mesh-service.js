/* global process */
const log = require('../../util/log');
const debugLogger = require('../../util/debug-logger');
const debug = debugLogger(process.env.DEBUG);
const {getClient} = require('./mesh-client');
const RateLimiter = require('./rate-limiter');
const BlockUtility = require('../../engine/block-utility');
const {
    LIST_GROUPS_BY_DOMAIN,
    CREATE_DOMAIN,
    CREATE_GROUP,
    JOIN_GROUP,
    LEAVE_GROUP,
    DISSOLVE_GROUP,
    FIRE_EVENTS,
    RECORD_EVENTS,
    SEARCH_GROUPS_BY_NAME_PREFIX
} = require('./gql-operations');

const {getForcePollingFromUrl} = require('./utils');

const {NetworkFilterMixin} = require('./network-filter');
const {PeriodicSyncMixin} = require('./periodic-sync');
const {PollingClientMixin} = require('./polling-client');
const {SubscriptionManagerMixin} = require('./subscription-manager');
const {HeartbeatManagerMixin} = require('./heartbeat-manager');
const {DataSenderMixin} = require('./data-sender');

/**
 * Parses an environment variable as an integer with validation.
 * @param {string} envVar - The environment variable value.
 * @param {number} defaultValue - The default value if parsing fails or is out of range.
 * @param {number} min - Minimum allowed value (inclusive).
 * @param {number} max - Maximum allowed value (inclusive).
 * @returns {number} The parsed integer or default value.
 */
const parseEnvInt = (envVar, defaultValue, min = 0, max = Infinity) => {
    if (!envVar) return defaultValue;
    const parsed = parseInt(envVar, 10);
    if (isNaN(parsed) || parsed < min || parsed > max) return defaultValue;
    return parsed;
};

// Mesh v2 configuration parameters

/* istanbul ignore next */
class MeshV2Service {
    constructor (blocks, meshId, domain) {
        debug(() => 'Initializing MeshV2Service (GraphQL)');
        this.blocks = blocks;
        this.runtime = blocks.runtime;
        this.meshId = meshId;
        this.domain = domain;
        this.client = getClient();
        this.groupId = null;
        this.groupName = null;
        this.expiresAt = null;
        this.isHost = false;
        this.forcePolling = getForcePollingFromUrl();
        this.useWebSocket = !this.forcePolling;
        if (this.forcePolling) {
            log.info('Mesh V2: Forced polling mode enabled via URL parameter');
        }
        this.pollingIntervalSeconds = 2;
        this.lastFetchTime = '';

        this.subscriptions = [];
        this.connectionTimer = null;
        this.heartbeatTimer = null;
        this.dataSyncTimer = null;
        this.pollingTimer = null;

        // Last data send promise to track completion of the most recent data transmission
        this.lastDataSendPromise = Promise.resolve();

        this.hostHeartbeatInterval = 60; // Default 1 min
        this.memberHeartbeatInterval = 120; // Default 2 min

        // Data from other nodes: { nodeId: { key: { value: string, timestamp: number } } }
        this.remoteData = {};

        // Rate limiters
        // Data update interval (default: 1000ms)
        const dataInterval = parseEnvInt(
            process.env.MESH_DATA_UPDATE_INTERVAL_MS,
            1000, // default
            100, // min: 100ms
            10000 // max: 10 seconds
        );
        log.info(`Mesh V2: Data update interval set to ${dataInterval}ms`);
        this.dataRateLimiter = new RateLimiter(dataInterval, {
            enableMerge: true,
            mergeKeyField: 'key'
        });

        // Event queue for batch sending: { eventName, payload, firedAt } の配列
        this.eventQueue = [];
        // Event batch interval (default: 1000ms)
        this.eventBatchInterval = parseEnvInt(
            process.env.MESH_EVENT_BATCH_INTERVAL_MS,
            1000, // default
            100, // min: 100ms
            10000 // max: 10 seconds
        );
        log.info(`Mesh V2: Event batch interval set to ${this.eventBatchInterval}ms`);
        this.eventBatchTimer = null;

        // Periodic data sync interval (default: 15000ms)
        this.periodicDataSyncInterval = parseEnvInt(
            process.env.MESH_PERIODIC_DATA_SYNC_INTERVAL_MS,
            15000, // default
            1000, // min: 1 second
            3600000 // max: 1 hour
        );
        log.info(`Mesh V2: Periodic data sync interval set to ${this.periodicDataSyncInterval}ms`);

        // Event queue limits
        this.MAX_EVENT_QUEUE_SIZE = 100; // 最大100イベント
        this.eventQueueStats = {
            duplicatesSkipped: 0,
            dropped: 0,
            lastReportTime: Date.now()
        };

        // issue #556: orderKey 生成用のシーケンスカウンタ。
        // グループ接続後の連番。`<YYYYMMDDHHMMSS>-<NNN>` 形式を構成する NNN 部分。
        // createGroup / joinGroup で 0 にリセット。
        this.eventSequence = 0;

        // Last sent data to detect changes (confirmed by server)
        this.lastSentData = {};
        // Latest data queued for sending (may not be confirmed yet)
        this.latestQueuedData = {};

        // イベントキュー: {event, offsetMs} の配列
        this.pendingBroadcasts = [];
        this.batchStartTime = null; // バッチ処理開始時刻（実時間）
        this.lastBroadcastOffset = 0; // 最後に処理したイベントのオフセット（ms）

        // runtimeのBEFORE_STEPイベントにフック
        // boundメソッドを保持（cleanup時にoff()で使用）
        this._processNextBroadcastBound = this.processNextBroadcast.bind(this);
        this.runtime.on('BEFORE_STEP', this._processNextBroadcastBound);

        /**
         * Bound reference to _reportData for RateLimiter merge comparison.
         * This ensures consistent sendFunction reference across multiple calls.
         * @private
         */
        this._reportDataBound = this._reportData.bind(this);

        this.disconnectCallback = null;

        // Store last error for network filter detection (HTTP 503 from proxy like i-Filter)
        this.lastError = null;

        // Test mode: Simulate network filter (HTTP 503) when MESH_NETWORK_FILTER=true
        this.simulateNetworkFilter = process.env.MESH_NETWORK_FILTER === 'true';
        if (this.simulateNetworkFilter) {
            log.warn('Mesh V2: Network filter test mode enabled (MESH_NETWORK_FILTER=true)');
            log.warn('Mesh V2: All GraphQL requests will return HTTP 503 for testing');
        }

        // Cost tracking
        this.costTracking = {
            connectionStartTime: null,
            queryCount: 0, // LIST_GROUPS_BY_DOMAIN, LIST_GROUP_STATUSES
            mutationCount: 0, // CREATE_DOMAIN, CREATE_GROUP, JOIN_GROUP, etc.
            heartbeatCount: 0, // RENEW_HEARTBEAT, SEND_MEMBER_HEARTBEAT
            reportDataCount: 0, // REPORT_DATA
            fireEventsCount: 0, // FIRE_EVENTS
            leaveCount: 0, // LEAVE_GROUP or DISSOLVE_GROUP
            dataUpdateReceived: 0, // ON_DATA_UPDATE
            batchEventReceived: 0, // ON_BATCH_EVENT
            dissolveReceived: 0 // ON_GROUP_DISSOLVE
        };
    }

    setDisconnectCallback (callback) {
        this.disconnectCallback = callback;
    }

    cleanupAndDisconnect (reason = 'unknown') {
        this.cleanup();
        if (this.disconnectCallback) {
            this.disconnectCallback(reason);
        }
    }

    async createDomain () {
        if (!this.client) throw new Error('Client not initialized');

        try {
            this.costTracking.mutationCount++;
            const result = await this.client.mutate({
                mutation: CREATE_DOMAIN
            });

            this.domain = result.data.createDomain;
            debug(() => `Mesh V2: Created domain ${this.domain} from source IP`);
            return this.domain;
        } catch (error) {
            log.error(`Mesh V2: Failed to create domain: ${error}`);
            throw error;
        }
    }

    async createGroup (groupName) {
        if (!this.client) throw new Error('Client not initialized');

        try {
            // Simulate network filter (503) for testing when MESH_NETWORK_FILTER=true
            this._checkSimulateNetworkFilter();

            if (!this.domain) {
                await this.createDomain();
            }

            // Test WebSocket availability
            if (this.forcePolling) {
                this.useWebSocket = false;
            } else {
                this.useWebSocket = await this.testWebSocket();
            }
            log.info(`Mesh V2: WebSocket available: ${this.useWebSocket}`);

            this.costTracking.mutationCount++;
            this.lastFetchTime = new Date().toISOString();
            // issue #556: orderKey の連番をリセット
            this.eventSequence = 0;
            debug(() => `Mesh V2: Initialized lastFetchTime to ${this.lastFetchTime} (before createGroup)`);
            const result = await this.client.mutate({
                mutation: CREATE_GROUP,
                variables: {
                    name: groupName,
                    hostId: this.meshId,
                    domain: this.domain,
                    useWebSocket: this.useWebSocket
                }
            });

            const group = result.data.createGroup;
            this.groupId = group.id;
            this.groupName = group.name;
            this.domain = group.domain; // Update domain from server
            this.expiresAt = group.expiresAt;
            this.useWebSocket = group.useWebSocket;
            if (group.pollingIntervalSeconds) {
                this.pollingIntervalSeconds = group.pollingIntervalSeconds;
            }
            this.isHost = true;
            if (group.heartbeatIntervalSeconds) {
                this.hostHeartbeatInterval = group.heartbeatIntervalSeconds;
            }

            this.costTracking.connectionStartTime = Date.now();
            if (this.useWebSocket) {
                this.startSubscriptions();
                // WebSocket モードは subscription でデータ更新をリアルタイム取得し、
                // 念のため 15 秒ごとの fallback 同期を実行
                this.startPeriodicDataSync();
            } else {
                // Polling モードは pollGroupData が events + nodeStatuses を
                // 同時取得するため、startPeriodicDataSync は不要 (issue #554)
                this.startPolling();
            }
            this.startHeartbeat();
            this.startEventBatchTimer();
            this.startConnectionTimer();

            await this.sendAllGlobalVariables();

            log.info(`Mesh V2: Created group ${this.groupName} (${this.groupId}) in domain ${this.domain} ` +
                `(Protocol: ${this.useWebSocket ? 'WebSocket' : 'Polling'})`);
            return group;
        } catch (error) {
            log.error(`Mesh V2: Failed to create group: ${error}`);
            // Store error for network filter detection
            this.lastError = error;
            throw error;
        }
    }

    async listGroups () {
        if (!this.client) throw new Error('Client not initialized');

        try {
            // Simulate network filter (503) for testing when MESH_NETWORK_FILTER=true
            this._checkSimulateNetworkFilter();

            if (!this.domain) {
                await this.createDomain();
            }

            this.costTracking.queryCount++;
            const result = await this.client.query({
                query: LIST_GROUPS_BY_DOMAIN,
                variables: {
                    domain: this.domain
                },
                fetchPolicy: 'network-only'
            });

            const groups = result.data.listGroupsByDomain;
            return groups;
        } catch (error) {
            log.error(`Mesh V2: Failed to list groups: ${error}`);
            // Store error for network filter detection
            this.lastError = error;
            throw error;
        }
    }

    async searchGroupsByNamePrefix (namePrefix) {
        if (!this.client) throw new Error('Client not initialized');

        try {
            this.costTracking.queryCount++;
            const result = await this.client.query({
                query: SEARCH_GROUPS_BY_NAME_PREFIX,
                variables: {namePrefix, limit: 10},
                fetchPolicy: 'network-only'
            });

            return result.data.searchGroupsByNamePrefix;
        } catch (error) {
            log.error(`Mesh V2: Failed to search groups by name: ${error}`);
            throw error;
        }
    }

    async joinGroup (groupId, domain, groupName) {
        if (!this.client) throw new Error('Client not initialized');

        try {
            // Simulate network filter (503) for testing when MESH_NETWORK_FILTER=true
            this._checkSimulateNetworkFilter();

            this.costTracking.mutationCount++;
            this.lastFetchTime = new Date().toISOString();
            // issue #556: orderKey の連番をリセット
            this.eventSequence = 0;
            debug(() => `Mesh V2: Initialized lastFetchTime to ${this.lastFetchTime} (before joinGroup)`);
            const result = await this.client.mutate({
                mutation: JOIN_GROUP,
                variables: {
                    groupId: groupId,
                    domain: domain || this.domain,
                    nodeId: this.meshId,
                    useWebSocket: this.useWebSocket
                }
            });

            const node = result.data.joinGroup;
            this.groupId = groupId;
            this.groupName = groupName || groupId;
            this.domain = node.domain; // Update domain from server
            this.expiresAt = node.expiresAt;
            this.useWebSocket = this.forcePolling ? false : node.useWebSocket;
            if (node.pollingIntervalSeconds) {
                this.pollingIntervalSeconds = node.pollingIntervalSeconds;
            }
            this.isHost = false;
            if (node.heartbeatIntervalSeconds) {
                this.memberHeartbeatInterval = node.heartbeatIntervalSeconds;
            }

            this.costTracking.connectionStartTime = Date.now();
            if (this.useWebSocket) {
                this.startSubscriptions();
                // WebSocket モードは 15 秒ごとの fallback 同期を実行
                this.startPeriodicDataSync();
            } else {
                // Polling モードは pollGroupData が events + nodeStatuses を
                // 同時取得するため、startPeriodicDataSync は不要 (issue #554)
                this.startPolling();
            }
            this.startHeartbeat(); // Start heartbeat for member too
            this.startEventBatchTimer();
            this.startConnectionTimer();

            await this.sendAllGlobalVariables();
            await this.fetchAllNodesData();

            log.info(`Mesh V2: Joined group ${this.groupId} in domain ${this.domain} ` +
                `(Protocol: ${this.useWebSocket ? 'WebSocket' : 'Polling'})`);
            return node;
        } catch (error) {
            log.error(`Mesh V2: Failed to join group: ${error}`);
            // Store error for network filter detection
            this.lastError = error;
            throw error;
        }
    }

    async leaveGroup () {
        if (!this.groupId) return;

        const groupId = this.groupId;
        const domain = this.domain;
        const isHost = this.isHost;
        const hostId = this.meshId;
        const nodeId = this.meshId;

        // Count the leave/dissolve mutation before cleanup() outputs the cost summary
        this.costTracking.mutationCount++;
        this.costTracking.leaveCount++;

        this.cleanupAndDisconnect();

        if (!this.client) return;

        try {
            if (isHost) {
                await this.client.mutate({
                    mutation: DISSOLVE_GROUP,
                    variables: {
                        groupId: groupId,
                        domain: domain,
                        hostId: hostId
                    }
                });
                debug(() => `Mesh V2: Dissolved group ${groupId}`);
            } else {
                await this.client.mutate({
                    mutation: LEAVE_GROUP,
                    variables: {
                        groupId: groupId,
                        domain: domain,
                        nodeId: nodeId
                    }
                });
                debug(() => `Mesh V2: Left group ${groupId}`);
            }
        } catch (error) {
            log.error(`Mesh V2: Error during leave/dissolve (background): ${error}`);
        }
    }

    cleanup () {
        // コスト計算とログ出力
        if (this.costTracking.connectionStartTime) {
            const connectionDurationSeconds = (Date.now() - this.costTracking.connectionStartTime) / 1000;
            const connectionDurationMinutes = connectionDurationSeconds / 60;

            // Query/Mutation costs
            const queryCost = this.costTracking.queryCount * 0.000004;
            const mutationCost = this.costTracking.mutationCount * 0.000004;

            // Subscription message costs
            const dataUpdateCost = this.costTracking.dataUpdateReceived * 0.000002;
            const batchEventCost = this.costTracking.batchEventReceived * 0.000002;
            const dissolveCost = this.costTracking.dissolveReceived * 0.000002;

            // Subscription connection cost: $0.00000008 per connection-minute (1 subscription)
            const connectionCost = connectionDurationMinutes * 0.00000008;

            const totalCost = queryCost + mutationCost + dataUpdateCost + batchEventCost +
                dissolveCost + connectionCost;

            log.info(`Mesh V2: Cost Summary for ${connectionDurationMinutes.toFixed(2)} minutes connection`);
            log.info(`  Role: ${this.isHost ? 'Host' : 'Member'}`);
            log.info(`  Queries: ${this.costTracking.queryCount} ops = $${queryCost.toFixed(8)}`);
            log.info(`  Mutations: ${this.costTracking.mutationCount} ops = $${mutationCost.toFixed(8)}`);
            log.info(`    - Heartbeats: ${this.costTracking.heartbeatCount}`);
            log.info(`    - REPORT_DATA: ${this.costTracking.reportDataCount}`);
            log.info(`    - FIRE_EVENTS: ${this.costTracking.fireEventsCount}`);
            log.info(`    - LEAVE/DISSOLVE: ${this.costTracking.leaveCount}`);
            log.info(`  Subscription Messages:`);
            log.info(`    - Data Updates: ${this.costTracking.dataUpdateReceived} msgs = ` +
                `$${dataUpdateCost.toFixed(8)}`);
            log.info(`    - Batch Events: ${this.costTracking.batchEventReceived} msgs = ` +
                `$${batchEventCost.toFixed(8)}`);
            log.info(`    - Dissolve: ${this.costTracking.dissolveReceived} msgs = ` +
                `$${dissolveCost.toFixed(8)}`);
            log.info(`  Subscription Connection: ${connectionDurationMinutes.toFixed(2)} min × 1 = ` +
                `$${connectionCost.toFixed(8)}`);
            log.info(`  TOTAL ESTIMATED COST: $${totalCost.toFixed(8)} ` +
                `(${(totalCost * 1000000).toFixed(2)} per million operations equivalent)`);
            log.info(`  Average cost per second: $${(totalCost / connectionDurationSeconds).toFixed(10)}`);
            this.costTracking.connectionStartTime = null;
        }

        // 統計情報を出力
        if (this.eventQueueStats &&
            (this.eventQueueStats.duplicatesSkipped > 0 || this.eventQueueStats.dropped > 0)) {
            debug(() => `Mesh V2: Final Event Queue Stats: ` +
                `duplicates skipped=${this.eventQueueStats.duplicatesSkipped}, ` +
                `dropped=${this.eventQueueStats.dropped}`);
        }

        // キューをクリア
        this.pendingBroadcasts = [];
        this.batchStartTime = null;
        this.lastBroadcastOffset = 0;

        this.stopSubscriptions();
        this.stopPolling();
        this.stopHeartbeat();
        this.stopEventBatchTimer();
        this.stopConnectionTimer();
        this.stopPeriodicDataSync();
        this.groupId = null;
        this.groupName = null;
        this.expiresAt = null;
        this.isHost = false;
        this.remoteData = {};
        this.lastSentData = {};
        this.latestQueuedData = {};
    }

    /**
     * Internal method to queue events for playback with relative timing.
     * @param {Array} events - Array of events to queue.
     * @private
     */
    _queueEventsForPlayback (events) {
        if (!events || events.length === 0) return;

        // タイムスタンプでソート（副作用を避けるためコピーを作成）。
        // issue #556: 同一タイムスタンプ内では orderKey の辞書順で安定ソートする。
        // どちらか一方でも orderKey がない場合は元の順序を維持（タイムスタンプ比較のみ）。
        const sortedEvents = [...events].sort((a, b) => {
            const tDiff = new Date(a.timestamp) - new Date(b.timestamp);
            if (tDiff !== 0) return tDiff;
            if (a.orderKey && b.orderKey) {
                if (a.orderKey < b.orderKey) return -1;
                if (a.orderKey > b.orderKey) return 1;
            }
            return 0;
        });

        // 最初のイベントを基準にオフセットを計算
        const baseTime = new Date(sortedEvents[0].timestamp).getTime();

        // キューに追加
        sortedEvents.forEach(event => {
            const eventTime = new Date(event.timestamp).getTime();
            const offsetMs = eventTime - baseTime;

            this.pendingBroadcasts.push({
                event: event,
                offsetMs: offsetMs
            });
            debug(() => `Mesh V2: Queued event: ${event.name} ` +
                `(offset: ${offsetMs}ms, original timestamp: ${event.timestamp})`);
        });

        // バッチ処理開始時刻を記録（未開始の場合のみ）
        if (this.batchStartTime === null && this.pendingBroadcasts.length > 0) {
            this.batchStartTime = Date.now();
            this.lastBroadcastOffset = 0;
        }

        debug(() => `Mesh V2: Total pending broadcasts: ${this.pendingBroadcasts.length}`);
    }

    /**
     * Process pending broadcast events that should fire based on elapsed real time.
     * Called once per frame via BEFORE_STEP event.
     *
     * Strategy:
     * - Process events whose timing has arrived (offsetMs <= elapsedMs)
     * - Limit processing to a 33ms window of event time per frame to avoid spikes
     * - Execute them in order (maintains event sequence)
     * - Different event types don't cause RESTART (different handlers)
     */
    processNextBroadcast () {
        if (!this.groupId) {
            // 切断されている場合はなにもしない
            return;
        }

        if (this.pendingBroadcasts.length === 0) {
            // キューが空になったらリセット
            this.batchStartTime = null;
            this.lastBroadcastOffset = 0;
            return;
        }

        const now = Date.now();
        const elapsedMs = this.batchStartTime ? now - this.batchStartTime : 0;

        // 処理すべきイベントを収集（タイミングが来ているもの）
        const eventsToProcess = [];
        let windowBase = null;

        while (this.pendingBroadcasts.length > 0) {
            const {event, offsetMs} = this.pendingBroadcasts[0];

            // まだタイミングが来ていない場合は待機
            if (offsetMs > elapsedMs) {
                debug(() => `Mesh V2: Waiting for event ${event.name} ` +
                    `(needs ${offsetMs}ms, elapsed ${elapsedMs}ms)`);
                break;
            }

            // 1フレーム(33ms)のウィンドウ制限を適用
            // （バックログがある場合でも1フレームで大量のブロードキャストを避ける）
            if (windowBase === null) {
                windowBase = offsetMs;
            } else if (offsetMs >= windowBase + 33) {
                debug(() => `Mesh V2: Window limit reached (33ms). ` +
                    `Remaining events will be processed in next frames.`);
                break;
            }

            // タイミングが来たイベントをキューから取り出し
            const item = this.pendingBroadcasts.shift();
            eventsToProcess.push(item);
        }

        // 収集したイベントを処理
        if (eventsToProcess.length > 0) {
            debug(() => `Mesh V2: Broadcasting ${eventsToProcess.length} events ` +
                `(${this.pendingBroadcasts.length} remaining in queue)`);

            eventsToProcess.forEach(({event, offsetMs}) => {
                debug(() => `Mesh V2: Broadcasting event: ${event.name} ` +
                    `(offset: ${offsetMs}ms, elapsed: ${elapsedMs}ms)`);

                this.broadcastEvent(event);
                this.lastBroadcastOffset = offsetMs;
            });
        }
    }

    broadcastEvent (event) {
        debug(() => `Mesh V2: Executing broadcastEvent for: ${event.name}`);
        try {
            const args = {
                BROADCAST_OPTION: {
                    id: null,
                    name: event.name
                }
            };
            const util = BlockUtility.lastInstance();
            if (util) {
                if (!util.sequencer) {
                    util.sequencer = this.runtime.sequencer;
                }
                debug(() => `Mesh V2: Triggering event_broadcast: ${event.name}`);
                this.blocks.opcodeFunctions.event_broadcast(args, util);
            } else {
                log.warn(`Mesh V2: No BlockUtility instance available for broadcast: ${event.name}`);
            }
        } catch (error) {
            log.error(`Mesh V2: Failed to broadcast event: ${error}`);
        }
    }

    startEventBatchTimer () {
        this.stopEventBatchTimer();
        debug(() => `Mesh V2: Starting event batch timer (Interval: ${this.eventBatchInterval}ms)`);
        this.eventBatchTimer = setInterval(() => {
            this.processBatchEvents();
        }, this.eventBatchInterval);
    }

    stopEventBatchTimer () {
        if (this.eventBatchTimer) {
            clearInterval(this.eventBatchTimer);
            this.eventBatchTimer = null;
        }
    }

    async processBatchEvents () {
        if (this.eventQueue.length === 0) return;

        // キューから全イベントを取り出す
        const events = this.eventQueue.splice(0);
        debug(() => `Mesh V2: Processing ${events.length} queued events for sending`);

        try {
            // ペイロードサイズ制限を考慮して分割送信（約1,000イベントごと）
            const MAX_BATCH_SIZE = 1000;
            while (events.length > 0) {
                const batch = events.splice(0, MAX_BATCH_SIZE);
                await this.fireEventsBatch(batch);
            }
        } catch (error) {
            log.error(`Mesh V2: Failed to process batch events: ${error}`);
        }
    }

    async fireEventsBatch (events) {
        if (!this.groupId || !this.client || events.length === 0) return;

        try {
            // Wait for last data send to complete
            await this.lastDataSendPromise;

            this.costTracking.mutationCount++;
            this.costTracking.fireEventsCount++;
            log.info(`Mesh V2: Sending batch of ${events.length} events to group ${this.groupId} ` +
                `(Protocol: ${this.useWebSocket ? 'WebSocket' : 'Polling'})`);

            if (this.useWebSocket) {
                await this.client.mutate({
                    mutation: FIRE_EVENTS,
                    variables: {
                        groupId: this.groupId,
                        domain: this.domain,
                        nodeId: this.meshId,
                        events: events
                    }
                });
            } else {
                const result = await this.client.mutate({
                    mutation: RECORD_EVENTS,
                    variables: {
                        groupId: this.groupId,
                        domain: this.domain,
                        nodeId: this.meshId,
                        events: events
                    }
                });
                if (result.data && result.data.recordEventsByNode && result.data.recordEventsByNode.nextSince) {
                    this.lastFetchTime = result.data.recordEventsByNode.nextSince;
                }
            }
        } catch (error) {
            log.error(`Mesh V2: Failed to fire batch events: ${error}`);
            const reason = this.shouldDisconnectOnError(error);
            if (reason) {
                this.cleanupAndDisconnect(reason);
            }
        }
    }

    fireEvent (eventName, payload = '') {
        if (!this.groupId || !this.client) {
            if (this.groupId) {
                log.warn(`Mesh V2: Cannot fire event ${eventName} - client not available`);
            } else {
                debug(() => `Mesh V2: Cannot fire event ${eventName} - not connected`);
            }
            return;
        }

        // ステップ1: 重複チェック
        const isDuplicate = this.eventQueue.some(item =>
            item.eventName === eventName && item.payload === payload
        );

        if (isDuplicate) {
            this.eventQueueStats.duplicatesSkipped++;
            this.reportEventStatsIfNeeded();

            debug(() => `Mesh V2: Event already in queue, skipping: ${eventName}`);
            return;
        }

        // ステップ2: サイズ制限チェック（保険）
        if (this.eventQueue.length >= this.MAX_EVENT_QUEUE_SIZE) {
            const dropped = this.eventQueue.shift(); // 古いイベントを破棄（FIFO）
            this.eventQueueStats.dropped++;

            if (this.eventQueueStats.dropped % 10 === 1) { // 10イベントごとに警告
                log.warn(`Mesh V2: Event queue full (${this.MAX_EVENT_QUEUE_SIZE}). ` +
                    `Dropped ${this.eventQueueStats.dropped} events. ` +
                    `Latest: ${dropped.eventName}`);
            }
        }

        debug(() => `Mesh V2: Queuing event for sending: ${eventName} ` +
            `(queue size: ${this.eventQueue.length})`);

        // キューに追加（発火日時と orderKey を記録）
        const firedAt = new Date();
        this.eventQueue.push({
            eventName: eventName,
            payload: payload,
            firedAt: firedAt.toISOString(),
            // issue #556: 同一バッチ内のイベント順序保証用
            orderKey: this._generateOrderKey(firedAt)
        });
    }

    /**
     * Generate a sortable order key for an event.
     * Format: `<YYYYMMDDHHMMSS>-<NNNNNNN>` where NNNNNNN is a 7-digit
     * 0-padded sequence counter incremented per call (resets on group
     * create/join).
     *
     * Same client guarantees lexicographic order = send order across batches.
     * Cross-client collisions are possible but extremely unlikely; the server
     * appends a short UUID to the SK to ensure uniqueness.
     *
     * Why 7 digits: connection cap is 35 min = 2100s. Worst-case throughput
     * is bounded by MAX_EVENT_QUEUE_SIZE (100) draining every
     * eventBatchInterval (min 100ms) → 1000 events/s max → ~2.1M per
     * session. 7 digits (max 9,999,999) gives ~4.7x margin even at the
     * minimum interval. 3 digits would overflow at the 1000th event,
     * silently breaking lexicographic order ("1000" < "999").
     * @param {Date} firedAt - The event fire time.
     * @returns {string} Sortable order key.
     * @private
     */
    _generateOrderKey (firedAt) {
        const yyyy = firedAt.getFullYear().toString();
        const mm = String(firedAt.getMonth() + 1).padStart(2, '0');
        const dd = String(firedAt.getDate()).padStart(2, '0');
        const hh = String(firedAt.getHours()).padStart(2, '0');
        const mi = String(firedAt.getMinutes()).padStart(2, '0');
        const ss = String(firedAt.getSeconds()).padStart(2, '0');
        this.eventSequence += 1;
        const seq = String(this.eventSequence).padStart(7, '0');
        return `${yyyy}${mm}${dd}${hh}${mi}${ss}-${seq}`;
    }

    /**
     * Report event queue statistics if needed (every 10 seconds).
     */
    reportEventStatsIfNeeded () {
        const now = Date.now();
        const elapsed = now - this.eventQueueStats.lastReportTime;

        if (elapsed >= 10000 &&
            (this.eventQueueStats.duplicatesSkipped > 0 || this.eventQueueStats.dropped > 0)) {
            debug(() => `Mesh V2: Event Queue Stats (last ${(elapsed / 1000).toFixed(1)}s): ` +
                `duplicates skipped=${this.eventQueueStats.duplicatesSkipped}, ` +
                `dropped=${this.eventQueueStats.dropped}, ` +
                `current queue size=${this.eventQueue.length}`);

            this.eventQueueStats.duplicatesSkipped = 0;
            this.eventQueueStats.dropped = 0;
            this.eventQueueStats.lastReportTime = now;
        }
    }

}

// Mixins: split responsibilities into separate files for maintainability.
// Each mixin attaches its methods to MeshV2Service.prototype so `this`
// references continue to work unchanged.
Object.assign(MeshV2Service.prototype, NetworkFilterMixin);
Object.assign(MeshV2Service.prototype, PeriodicSyncMixin);
Object.assign(MeshV2Service.prototype, PollingClientMixin);
Object.assign(MeshV2Service.prototype, SubscriptionManagerMixin);
Object.assign(MeshV2Service.prototype, HeartbeatManagerMixin);
Object.assign(MeshV2Service.prototype, DataSenderMixin);

module.exports = MeshV2Service;
