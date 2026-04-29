/* global process */
const log = require('../../util/log');
const debugLogger = require('../../util/debug-logger');
const debug = debugLogger(process.env.DEBUG);
const { FIRE_EVENTS, RECORD_EVENTS } = require('./gql-operations');

/**
 * Outgoing event sender. Scratch の broadcast を mesh 経由で他ノードへ送る。
 * fireEvent でキューイングし、eventBatchTimer (デフォルト 1 秒) ごとに
 * 1 mutation でまとめて送信する。
 *
 * 重複/オーバーフロー保護:
 *   - 同じ eventName + payload はキュー内に重複させない
 *   - キューが MAX_EVENT_QUEUE_SIZE (100) に達したら FIFO で古い方を破棄
 *
 * issue #556: orderKey を `YYYYMMDDHHMMSS-<7桁連番>` で付与し、サーバー側 SK
 * の安定ソートに使う。同一クライアントが連続送信した複数イベントの順序を
 * 受信側でも保証する。
 *
 * Mixed into MeshV2Service.prototype.
 */
const EventSenderMixin = {
    startEventBatchTimer() {
        this.stopEventBatchTimer();
        debug(() => `Mesh V2: Starting event batch timer (Interval: ${this.eventBatchInterval}ms)`);
        this.eventBatchTimer = setInterval(() => {
            this.processBatchEvents();
        }, this.eventBatchInterval);
    },

    stopEventBatchTimer() {
        if (this.eventBatchTimer) {
            clearInterval(this.eventBatchTimer);
            this.eventBatchTimer = null;
        }
    },

    async processBatchEvents() {
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
    },

    async fireEventsBatch(events) {
        if (!this.groupId || !this.client || events.length === 0) return;

        try {
            // Wait for last data send to complete
            await this.lastDataSendPromise;

            this.costTracking.mutationCount++;
            this.costTracking.fireEventsCount++;
            log.info(
                `Mesh V2: Sending batch of ${events.length} events to group ${this.groupId} ` +
                    `(Protocol: ${this.useWebSocket ? 'WebSocket' : 'Polling'})`,
            );

            if (this.useWebSocket) {
                await this.client.mutate({
                    mutation: FIRE_EVENTS,
                    variables: {
                        groupId: this.groupId,
                        domain: this.domain,
                        nodeId: this.meshId,
                        events: events,
                    },
                });
            } else {
                const result = await this.client.mutate({
                    mutation: RECORD_EVENTS,
                    variables: {
                        groupId: this.groupId,
                        domain: this.domain,
                        nodeId: this.meshId,
                        events: events,
                    },
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
    },

    fireEvent(eventName, payload = '') {
        if (!this.groupId || !this.client) {
            if (this.groupId) {
                log.warn(`Mesh V2: Cannot fire event ${eventName} - client not available`);
            } else {
                debug(() => `Mesh V2: Cannot fire event ${eventName} - not connected`);
            }
            return;
        }

        // ステップ1: 重複チェック
        const isDuplicate = this.eventQueue.some(
            item => item.eventName === eventName && item.payload === payload,
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

            if (this.eventQueueStats.dropped % 10 === 1) {
                // 10イベントごとに警告
                log.warn(
                    `Mesh V2: Event queue full (${this.MAX_EVENT_QUEUE_SIZE}). ` +
                        `Dropped ${this.eventQueueStats.dropped} events. ` +
                        `Latest: ${dropped.eventName}`,
                );
            }
        }

        debug(
            () =>
                `Mesh V2: Queuing event for sending: ${eventName} ` +
                `(queue size: ${this.eventQueue.length})`,
        );

        // キューに追加（発火日時と orderKey を記録）
        const firedAt = new Date();
        this.eventQueue.push({
            eventName: eventName,
            payload: payload,
            firedAt: firedAt.toISOString(),
            // issue #556: 同一バッチ内のイベント順序保証用
            orderKey: this._generateOrderKey(firedAt),
        });
    },

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
    _generateOrderKey(firedAt) {
        const yyyy = firedAt.getFullYear().toString();
        const mm = String(firedAt.getMonth() + 1).padStart(2, '0');
        const dd = String(firedAt.getDate()).padStart(2, '0');
        const hh = String(firedAt.getHours()).padStart(2, '0');
        const mi = String(firedAt.getMinutes()).padStart(2, '0');
        const ss = String(firedAt.getSeconds()).padStart(2, '0');
        this.eventSequence += 1;
        const seq = String(this.eventSequence).padStart(7, '0');
        return `${yyyy}${mm}${dd}${hh}${mi}${ss}-${seq}`;
    },

    /**
     * Report event queue statistics if needed (every 10 seconds).
     */
    reportEventStatsIfNeeded() {
        const now = Date.now();
        const elapsed = now - this.eventQueueStats.lastReportTime;

        if (
            elapsed >= 10000 &&
            (this.eventQueueStats.duplicatesSkipped > 0 || this.eventQueueStats.dropped > 0)
        ) {
            debug(
                () =>
                    `Mesh V2: Event Queue Stats (last ${(elapsed / 1000).toFixed(1)}s): ` +
                    `duplicates skipped=${this.eventQueueStats.duplicatesSkipped}, ` +
                    `dropped=${this.eventQueueStats.dropped}, ` +
                    `current queue size=${this.eventQueue.length}`,
            );

            this.eventQueueStats.duplicatesSkipped = 0;
            this.eventQueueStats.dropped = 0;
            this.eventQueueStats.lastReportTime = now;
        }
    },
};

module.exports = { EventSenderMixin };
