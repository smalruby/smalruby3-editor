/* global process */
const log = require('../../util/log');
const debugLogger = require('../../util/debug-logger');
const debug = debugLogger(process.env.DEBUG);
const { POLL_GROUP_DATA } = require('./gql-operations');

/**
 * Polling client. WebSocket が使えない環境向けに、`pollGroupData` (issue #554)
 * を 2 秒周期で呼び、events と nodeStatuses を一括取得する。
 *
 * Mixed into MeshV2Service.prototype.
 */
const PollingClientMixin = {
    /**
     * Start polling for events when WebSocket is not available.
     */
    startPolling() {
        this.stopPolling();
        if (!this.groupId) return;

        debug(() => `Mesh V2: Starting event polling (Interval: ${this.pollingIntervalSeconds}s)`);

        this.pollingTimer = setInterval(() => {
            this.pollEvents();
        }, this.pollingIntervalSeconds * 1000);
    },

    /**
     * Stop event polling.
     */
    stopPolling() {
        if (this.pollingTimer) {
            debug(() => 'Mesh V2: Stopping event polling');
            clearInterval(this.pollingTimer);
            this.pollingTimer = null;
        }
        this.lastFetchTime = '';
    },

    /**
     * Fetch new events and node statuses from the server since the last fetch time.
     *
     * issue #554: ポーリングモードでは pollGroupData クエリを使い、
     * イベントとノードステータスを 1 リクエストで取得する。これにより:
     *   - 旧: getEventsSince (2s) + listGroupStatuses (15s, startPeriodicDataSync)
     *         → 34 query/min (events 30 + status 4)
     *   - 新: pollGroupData (2s)
     *         → 30 query/min (12% 削減 + データ同期遅延 15s → 2s に短縮)
     * AppSync の課金単位は 1 リクエスト = 1 op なので、Pipeline Resolver
     * 内で複数 DynamoDB アクセスをしても 1 op として課金される。
     */
    async pollEvents() {
        if (!this.groupId || !this.client || this.useWebSocket) return;

        if (!this.lastFetchTime) {
            log.warn('Mesh V2: pollEvents called but lastFetchTime is empty. Falling back to current time.');
            this.lastFetchTime = new Date().toISOString();
        }

        debug(() => `Mesh V2: pollGroupData for group ${this.groupId}. since=${this.lastFetchTime}`);

        try {
            this.costTracking.queryCount++;
            const result = await this.client.query({
                query: POLL_GROUP_DATA,
                variables: {
                    groupId: this.groupId,
                    domain: this.domain,
                    since: this.lastFetchTime,
                },
                fetchPolicy: 'network-only',
            });

            if (result.data && result.data.pollGroupData) {
                const { events, nodeStatuses } = result.data.pollGroupData;

                // ノードステータスは fetchAllNodesData と同じ処理に流す
                if (nodeStatuses && nodeStatuses.length > 0) {
                    nodeStatuses.forEach(status => this.handleDataUpdate(status));
                }

                if (events && events.length > 0) {
                    debug(() => `Mesh V2: Polled ${events.length} events`);

                    // Filter out events from self and sort by timestamp to preserve order
                    const otherEvents = events.filter(event => event.firedByNodeId !== this.meshId);

                    if (otherEvents.length > 0) {
                        this._queueEventsForPlayback(otherEvents);
                    }

                    // ALWAYS update lastFetchTime from the LAST event in the result (including our own)
                    // to ensure we don't fetch the same events again.
                    const lastEvent = events[events.length - 1];
                    if (lastEvent.cursor) {
                        this.lastFetchTime = lastEvent.cursor;
                    }
                }
            }
        } catch (error) {
            log.error(`Mesh V2: Event polling failed: ${error}`);
        }
    },
};

module.exports = { PollingClientMixin };
