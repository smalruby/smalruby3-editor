/* global process */
const log = require('../../util/log');
const debugLogger = require('../../util/debug-logger');
const debug = debugLogger(process.env.DEBUG);
const { ON_MESSAGE_IN_GROUP } = require('./gql-operations');

/**
 * WebSocket subscription manager. AppSync の onMessageInGroup を購読し、
 * 受信した nodeStatus / batchEvent / groupDissolve をディスパッチする。
 *
 * `handleDataUpdate` は subscription / pollGroupData / fetchAllNodesData の
 * 3 経路から呼ばれる共通の取り込み口。
 *
 * Mixed into MeshV2Service.prototype.
 */
const SubscriptionManagerMixin = {
    startSubscriptions() {
        if (!this.groupId || !this.client) return;

        const variables = {
            groupId: this.groupId,
            domain: this.domain,
        };

        const messageSub = this.client
            .subscribe({
                query: ON_MESSAGE_IN_GROUP,
                variables,
            })
            .subscribe({
                next: result => {
                    const message = result.data.onMessageInGroup;
                    if (!message) return;

                    // MeshMessage has three fields: nodeStatus, batchEvent, groupDissolve
                    // Only one field will be non-null per message
                    // Count all received messages for accurate cost estimation (AppSync delivers to sender too)
                    if (message.nodeStatus) {
                        this.costTracking.dataUpdateReceived++;
                        this.handleDataUpdate(message.nodeStatus);
                    } else if (message.batchEvent) {
                        this.costTracking.batchEventReceived++;
                        this.handleBatchEvent(message.batchEvent);
                    } else if (message.groupDissolve) {
                        this.costTracking.dissolveReceived++;
                        debug(() => 'Mesh V2: Group dissolved by host');
                        this.cleanupAndDisconnect();
                    } else {
                        log.warn('Mesh V2: Received message with all fields null');
                    }
                },
                error: err => log.error(`Mesh V2: Subscription error: ${err}`),
            });

        this.subscriptions.push(messageSub);
    },

    stopSubscriptions() {
        this.subscriptions.forEach(sub => sub.unsubscribe());
        this.subscriptions = [];
    },

    handleDataUpdate(nodeStatus) {
        if (!nodeStatus || nodeStatus.nodeId === this.meshId) return;

        const nodeId = nodeStatus.nodeId;
        if (!this.remoteData[nodeId]) {
            this.remoteData[nodeId] = {};
        }

        // Use server timestamp with fallback to current time
        const serverTimestamp = nodeStatus.timestamp
            ? new Date(nodeStatus.timestamp).getTime()
            : (log.warn('Mesh V2: Missing server timestamp, using client time'), Date.now());

        nodeStatus.data.forEach(item => {
            this.remoteData[nodeId][item.key] = {
                value: item.value,
                timestamp: serverTimestamp,
            };
        });
    },

    handleBatchEvent(batchEvent) {
        if (!batchEvent || batchEvent.firedByNodeId === this.meshId) return;

        const events = batchEvent.events
            ? batchEvent.events.filter(event => event.firedByNodeId !== this.meshId)
            : [];
        if (events.length === 0) return;

        debug(() => `Mesh V2: Received ${events.length} events from ${batchEvent.firedByNodeId}`);

        this._queueEventsForPlayback(events);
    },
};

module.exports = { SubscriptionManagerMixin };
