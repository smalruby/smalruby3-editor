/* global process */
const log = require('../../util/log');
const debugLogger = require('../../util/debug-logger');
const debug = debugLogger(process.env.DEBUG);
const { CREATE_DOMAIN, CREATE_GROUP, JOIN_GROUP, LEAVE_GROUP, DISSOLVE_GROUP } = require('./gql-operations');

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
            // issue #1859: この参加の世代番号。待つ間に切断・繋ぎ直しがあれば変わる。
            const connectionSeq = ++this._connectionSeq;

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
            // 新しいグループでは履歴を始めからにする (#1844)
            this.clearMessageHistory();
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
            // 状態と履歴のウィンドウ (#1844): listNodesInGroup はホストを返さないので覚えておく
            this.groupHostId = this.meshId;
            if (group.heartbeatIntervalSeconds) {
                this.hostHeartbeatInterval = group.heartbeatIntervalSeconds;
            }

            this.costTracking.connectionStartTime = Date.now();
            if (this.useWebSocket) {
                // issue #1859: 購読の準備ができる前に「つながった」にすると、その間に
                // 届いたほかの人のメッセージを取りこぼす。準備 (start_ack) を待つ。
                await this._startSubscriptionsAndWaitReady(connectionSeq);
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

    /**
     * Join a group as a member.
     * @param {string} groupId - group id.
     * @param {?string} domain - domain of the group.
     * @param {?string} groupName - group name.
     * @param {?string} [hostId] - host node id recorded by the server (listGroupsByDomain),
     *   for the status window (#1844); listNodesInGroup does not return the host.
     * @returns {Promise<object>} the joined node.
     */
    async joinGroup(groupId, domain, groupName, hostId = null) {
        if (!this.client) throw new Error('Client not initialized');

        try {
            // issue #1859: この参加の世代番号。待つ間に切断・繋ぎ直しがあれば変わる。
            const connectionSeq = ++this._connectionSeq;

            // Simulate network filter (503) for testing when MESH_NETWORK_FILTER=true
            this._checkSimulateNetworkFilter();

            this.costTracking.mutationCount++;
            this.lastFetchTime = new Date().toISOString();
            // issue #556: orderKey の連番をリセット
            this.eventSequence = 0;
            // 新しいグループでは履歴を始めからにする (#1844)
            this.clearMessageHistory();
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
            this.groupHostId = hostId || null;
            if (node.heartbeatIntervalSeconds) {
                this.memberHeartbeatInterval = node.heartbeatIntervalSeconds;
            }

            this.costTracking.connectionStartTime = Date.now();
            if (this.useWebSocket) {
                // issue #1859: 購読の準備 (start_ack) を待ってから先へ進む。
                // fetchAllNodesData もこの後なので、待つ間の変数の更新も取り直せる。
                await this._startSubscriptionsAndWaitReady(connectionSeq);
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

    /**
     * Start the subscription and wait for start_ack, retrying once.
     *
     * issue #1859: start_ack が来ない (上限切れ) か購読がエラーのまま「つながった」に
     * すると、realtime link の start_ack 待ち (15 秒) で購読が死に、つながった表示なのに
     * メッセージが来なくなる。1 回だけ張り直し、それでもだめなら切断して参加を失敗させる。
     * @param {number} connectionSeq - Generation number of this create/join.
     * @returns {Promise<void>} Resolves when the subscription is ready.
     * @private
     */
    async _startSubscriptionsAndWaitReady(connectionSeq) {
        const maxAttempts = 2;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const ready = await this.waitForSubscriptionReady(this.startSubscriptions());
            this._ensureStillInGroup(connectionSeq);
            if (ready) return;
            // 上限切れ・エラーの購読を閉じてから張り直す (二重に購読しない)。
            this.stopSubscriptions();
            if (attempt < maxAttempts) {
                log.warn('Mesh V2: Retrying the subscription');
            }
        }
        log.error('Mesh V2: Subscription could not be started; disconnecting');
        await this.leaveGroup('subscriptionFailed');
        throw new Error('Mesh V2: Subscription could not be started');
    },

    /**
     * Throw when this create/join is no longer the current connection.
     * 待つ間に切断 (cleanup) や繋ぎ直しがあったら、タイマーを動かさずに参加を失敗させる。
     * groupId ではなく世代番号で比べるのは、同じグループへすぐ繋ぎ直したときに
     * 古い参加が続かないようにするため。
     * @param {number} connectionSeq - Generation number of this create/join.
     * @private
     */
    _ensureStillInGroup(connectionSeq) {
        if (this._connectionSeq !== connectionSeq || !this.groupId) {
            throw new Error('Mesh V2: Disconnected while waiting for the subscription');
        }
    },

    /**
     * Leave (member) or dissolve (host) the current group.
     * @param {string} reason - Disconnect reason passed to the disconnect callback.
     * @returns {Promise<void>} Resolves after the leave/dissolve request.
     */
    async leaveGroup(reason = 'unknown') {
        if (!this.groupId) return;

        const groupId = this.groupId;
        const domain = this.domain;
        const isHost = this.isHost;
        const hostId = this.meshId;
        const nodeId = this.meshId;

        // Count the leave/dissolve mutation before cleanup() outputs the cost summary
        this.costTracking.mutationCount++;
        this.costTracking.leaveCount++;

        this.cleanupAndDisconnect(reason);

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
