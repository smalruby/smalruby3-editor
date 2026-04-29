/* global process */
const log = require('../../util/log');
const debugLogger = require('../../util/debug-logger');
const debug = debugLogger(process.env.DEBUG);
const { LIST_GROUP_STATUSES } = require('./gql-operations');

/**
 * Periodic data sync. WebSocket モードで subscription の取りこぼしを補う
 * ためのフォールバック (15 秒周期で全ノードのステータスをフェッチ)。
 *
 * Polling モードでは pollGroupData が events と nodeStatuses を一括で取る
 * ため、こちらは起動しない (issue #554 参照)。
 *
 * Mixed into MeshV2Service.prototype.
 */
const PeriodicSyncMixin = {
    /**
     * Fetch data from all nodes in the group.
     * @returns {Promise<void>} A promise that resolves when data is fetched and updated.
     */
    async fetchAllNodesData() {
        if (!this.groupId || !this.client) return;

        try {
            this.costTracking.queryCount++;
            const result = await this.client.query({
                query: LIST_GROUP_STATUSES,
                variables: {
                    groupId: this.groupId,
                    domain: this.domain,
                },
                fetchPolicy: 'network-only',
            });

            const nodeStatuses = result.data.listGroupStatuses;

            // Reuse handleDataUpdate so polling/subscription/periodic-sync
            // share a single ingestion path.
            nodeStatuses.forEach(status => this.handleDataUpdate(status));

            debug(() => `Mesh V2: Fetched data from ${nodeStatuses.length} nodes`);
        } catch (error) {
            log.error(`Mesh V2: Failed to fetch group data: ${error}`);
        }
    },

    /**
     * Start periodic data synchronization to ensure data consistency.
     */
    startPeriodicDataSync() {
        this.stopPeriodicDataSync();

        const interval = this.periodicDataSyncInterval;
        debug(() => `Mesh V2: Starting periodic data sync timer (Interval: ${interval / 1000}s)`);
        this.dataSyncTimer = setInterval(() => {
            debug(() => 'Mesh V2: Periodic data sync');
            this.fetchAllNodesData();
        }, interval);
    },

    /**
     * Stop periodic data synchronization.
     */
    stopPeriodicDataSync() {
        if (this.dataSyncTimer) {
            debug(() => 'Mesh V2: Stopping periodic data sync timer');
            clearInterval(this.dataSyncTimer);
            this.dataSyncTimer = null;
        }
    },
};

module.exports = { PeriodicSyncMixin };
