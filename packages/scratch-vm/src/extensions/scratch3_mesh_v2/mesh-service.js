/* global process */
const log = require('../../util/log');
const debugLogger = require('../../util/debug-logger');
const debug = debugLogger(process.env.DEBUG);
const {getClient} = require('./mesh-client');
const RateLimiter = require('./rate-limiter');
const {
    LIST_GROUPS_BY_DOMAIN,
    SEARCH_GROUPS_BY_NAME_PREFIX
} = require('./gql-operations');

const {getForcePollingFromUrl} = require('./utils');

const {NetworkFilterMixin} = require('./network-filter');
const {PeriodicSyncMixin} = require('./periodic-sync');
const {PollingClientMixin} = require('./polling-client');
const {SubscriptionManagerMixin} = require('./subscription-manager');
const {HeartbeatManagerMixin} = require('./heartbeat-manager');
const {DataSenderMixin} = require('./data-sender');
const {BroadcastReceiverMixin} = require('./broadcast-receiver');
const {EventSenderMixin} = require('./event-sender');
const {GroupLifecycleMixin} = require('./group-lifecycle');

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
Object.assign(MeshV2Service.prototype, BroadcastReceiverMixin);
Object.assign(MeshV2Service.prototype, EventSenderMixin);
Object.assign(MeshV2Service.prototype, GroupLifecycleMixin);

module.exports = MeshV2Service;
