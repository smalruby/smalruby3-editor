/* global process */
const log = require('../../util/log');
const debugLogger = require('../../util/debug-logger');
const debug = debugLogger(process.env.DEBUG);
const {
    CREATE_DOMAIN,
    CREATE_GROUP,
    JOIN_GROUP,
    LEAVE_GROUP,
    DISSOLVE_GROUP,
} = require('./gql-operations');

/**
 * Group lifecycle. グループの作成 (host) / 参加 (member) / 解散 (host) /
 * 離脱 (member) を扱う。プロトコル選択 (WebSocket / Polling)、各種タイマー
 * の起動、初期データ送信もここでオーケストレーションする。
 *
 * `createDomain` は IP ベースのドメイン文字列を AppSync 側で生成し、その後の
 * 全 mutation/query 呼び出しの分離キーとして使う。
 *
 * Mixed into MeshV2Service.prototype.
 */
const GroupLifecycleMixin = {
    async createDomain() {
        if (!this.client) throw new Error('Client not initialized');

        try {
            this.costTracking.mutationCount++;
            const result = await this.client.mutate({
                mutation: CREATE_DOMAIN,
            });

            this.domain = result.data.createDomain;
            debug(() => `Mesh V2: Created domain ${this.domain} from source IP`);
            return this.domain;
        } catch (error) {
            log.error(`Mesh V2: Failed to create domain: ${error}`);
            throw error;
        }
    },

    async createGroup(groupName) {
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
                    useWebSocket: this.useWebSocket,
                },
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

            log.info(
                `Mesh V2: Created group ${this.groupName} (${this.groupId}) in domain ${this.domain} ` +
                    `(Protocol: ${this.useWebSocket ? 'WebSocket' : 'Polling'})`,
            );
            return group;
        } catch (error) {
            log.error(`Mesh V2: Failed to create group: ${error}`);
            // Store error for network filter detection
            this.lastError = error;
            throw error;
        }
    },

    async joinGroup(groupId, domain, groupName) {
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
                    useWebSocket: this.useWebSocket,
                },
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

            log.info(
                `Mesh V2: Joined group ${this.groupId} in domain ${this.domain} ` +
                    `(Protocol: ${this.useWebSocket ? 'WebSocket' : 'Polling'})`,
            );
            return node;
        } catch (error) {
            log.error(`Mesh V2: Failed to join group: ${error}`);
            // Store error for network filter detection
            this.lastError = error;
            throw error;
        }
    },

    async leaveGroup() {
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
                        hostId: hostId,
                    },
                });
                debug(() => `Mesh V2: Dissolved group ${groupId}`);
            } else {
                await this.client.mutate({
                    mutation: LEAVE_GROUP,
                    variables: {
                        groupId: groupId,
                        domain: domain,
                        nodeId: nodeId,
                    },
                });
                debug(() => `Mesh V2: Left group ${groupId}`);
            }
        } catch (error) {
            log.error(`Mesh V2: Error during leave/dissolve (background): ${error}`);
        }
    },
};

module.exports = { GroupLifecycleMixin };
