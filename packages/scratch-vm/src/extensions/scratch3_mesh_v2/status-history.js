const log = require('../../util/log');

/**
 * メッシュの「状態と履歴」ポップアップ (#1844) のための読み取り専用の記録。
 *
 * - 送った・受け取ったメッセージを新しい順に、メモリに最大 MAX_MESSAGE_HISTORY 件だけ残す
 *   （見るのは生徒。ふだんは 1〜3 件、開くと 50 件まで）。作品にもサーバーにも残さない。
 * - グループのノード一覧（人数）は `listNodesInGroup` で知る。サーバーへの問い合わせを
 *   増やさないため、NODE_LIST_MIN_INTERVAL_MS に 1 回までにする（何回呼ばれても）。
 *
 * Mixed into MeshV2Service.prototype.
 */
const MAX_MESSAGE_HISTORY = 50;
const NODE_LIST_MIN_INTERVAL_MS = 30000;

const toTime = (value, fallback) => {
    const ms = typeof value === 'number' ? value : Date.parse(value);
    return Number.isFinite(ms) ? ms : fallback;
};

const StatusHistoryMixin = {
    /**
     * Record one sent or received message (newest first, at most 50).
     * @param {{direction: string, name: string, value: ?string, nodeId: string, at: number}} entry - message.
     */
    recordMessage(entry) {
        if (!this.messageHistory) this.messageHistory = [];
        this.messageHistory.unshift(
            Object.freeze({
                direction: entry.direction,
                name: String(entry.name || ''),
                value: entry.value === null || typeof entry.value === 'undefined' ? '' : String(entry.value),
                nodeId: entry.nodeId || '',
                at: toTime(entry.at, Date.now()),
            }),
        );
        if (this.messageHistory.length > MAX_MESSAGE_HISTORY) {
            this.messageHistory.length = MAX_MESSAGE_HISTORY;
        }
    },

    /**
     * Record events received from other nodes.
     * @param {Array<object>} events - events sorted oldest first.
     */
    recordReceivedEvents(events) {
        events.forEach((event) => {
            this.recordMessage({
                direction: 'received',
                name: event.name,
                value: event.payload,
                nodeId: event.firedByNodeId,
                at: toTime(event.timestamp, Date.now()),
            });
        });
    },

    /**
     * Record events this node has sent to the group.
     * @param {Array<object>} events - queued events ({eventName, payload, firedAt}) in send order.
     */
    recordSentEvents(events) {
        events.forEach((event) => {
            this.recordMessage({
                direction: 'sent',
                name: event.eventName,
                value: event.payload,
                nodeId: this.meshId,
                at: toTime(event.firedAt, Date.now()),
            });
        });
    },

    /**
     * @returns {Array<object>} a copy of the history, newest first (items are frozen).
     */
    getMessageHistory() {
        return (this.messageHistory || []).slice();
    },

    clearMessageHistory() {
        this.messageHistory = [];
    },

    /**
     * Ask the server for the node ids in the joined group, at most once per 30 seconds.
     * A failure keeps the previous list. Concurrent calls share one request.
     * @param {number} [now] - current time in ms.
     * @returns {Promise<?Array<string>>} node ids, or null when unknown / not connected.
     */
    refreshGroupNodes(now = Date.now()) {
        if (!this.groupId) return Promise.resolve(null);
        if (this._groupNodesRequest) return this._groupNodesRequest;
        if (this.groupNodesFetchedAt && now - this.groupNodesFetchedAt < NODE_LIST_MIN_INTERVAL_MS) {
            return Promise.resolve(this.getGroupNodeIds());
        }
        this.groupNodesFetchedAt = now;
        const groupId = this.groupId;
        this._groupNodesRequest = this.listNodesInGroup()
            .then((nodes) => {
                if (this.groupId === groupId) {
                    this.groupNodeIds = (nodes || []).map((node) => node && node.id).filter(Boolean);
                }
            })
            .catch((error) => {
                log.warn(`Mesh V2: Failed to refresh group nodes: ${error}`);
            })
            .then(() => {
                this._groupNodesRequest = null;
                return this.getGroupNodeIds();
            });
        return this._groupNodesRequest;
    },

    /**
     * @returns {?Array<string>} the last known node ids of the group, or null.
     */
    getGroupNodeIds() {
        return this.groupNodeIds ? this.groupNodeIds.slice() : null;
    },

    forgetGroupNodes() {
        this.groupNodeIds = null;
        this.groupNodesFetchedAt = 0;
    },
};

module.exports = {
    MAX_MESSAGE_HISTORY,
    NODE_LIST_MIN_INTERVAL_MS,
    StatusHistoryMixin,
};
