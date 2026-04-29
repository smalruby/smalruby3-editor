/* global process */
const log = require('../../util/log');
const debugLogger = require('../../util/debug-logger');
const debug = debugLogger(process.env.DEBUG);
const BlockUtility = require('../../engine/block-utility');

/**
 * Incoming broadcast playback. 受信した batchEvent / pollGroupData の events を
 * タイムスタンプ順 (同一タイムスタンプ内では orderKey 順, issue #556) にソート
 * して `pendingBroadcasts` にキューイングし、フレームごとに 33ms ウィンドウで
 * Scratch の `event_broadcast` ハンドラに渡す。
 *
 * `processNextBroadcast` は constructor で runtime の `BEFORE_STEP` にバインド
 * されており、毎フレーム呼ばれる。
 *
 * Mixed into MeshV2Service.prototype.
 */
const BroadcastReceiverMixin = {
    /**
     * Internal method to queue events for playback with relative timing.
     * @param {Array} events - Array of events to queue.
     * @private
     */
    _queueEventsForPlayback(events) {
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
                offsetMs: offsetMs,
            });
            debug(
                () =>
                    `Mesh V2: Queued event: ${event.name} ` +
                    `(offset: ${offsetMs}ms, original timestamp: ${event.timestamp})`,
            );
        });

        // バッチ処理開始時刻を記録（未開始の場合のみ）
        if (this.batchStartTime === null && this.pendingBroadcasts.length > 0) {
            this.batchStartTime = Date.now();
            this.lastBroadcastOffset = 0;
        }

        debug(() => `Mesh V2: Total pending broadcasts: ${this.pendingBroadcasts.length}`);
    },

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
    processNextBroadcast() {
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
            const { event, offsetMs } = this.pendingBroadcasts[0];

            // まだタイミングが来ていない場合は待機
            if (offsetMs > elapsedMs) {
                debug(
                    () =>
                        `Mesh V2: Waiting for event ${event.name} ` +
                        `(needs ${offsetMs}ms, elapsed ${elapsedMs}ms)`,
                );
                break;
            }

            // 1フレーム(33ms)のウィンドウ制限を適用
            // （バックログがある場合でも1フレームで大量のブロードキャストを避ける）
            if (windowBase === null) {
                windowBase = offsetMs;
            } else if (offsetMs >= windowBase + 33) {
                debug(
                    () =>
                        `Mesh V2: Window limit reached (33ms). ` +
                        `Remaining events will be processed in next frames.`,
                );
                break;
            }

            // タイミングが来たイベントをキューから取り出し
            const item = this.pendingBroadcasts.shift();
            eventsToProcess.push(item);
        }

        // 収集したイベントを処理
        if (eventsToProcess.length > 0) {
            debug(
                () =>
                    `Mesh V2: Broadcasting ${eventsToProcess.length} events ` +
                    `(${this.pendingBroadcasts.length} remaining in queue)`,
            );

            eventsToProcess.forEach(({ event, offsetMs }) => {
                debug(
                    () =>
                        `Mesh V2: Broadcasting event: ${event.name} ` +
                        `(offset: ${offsetMs}ms, elapsed: ${elapsedMs}ms)`,
                );

                this.broadcastEvent(event);
                this.lastBroadcastOffset = offsetMs;
            });
        }
    },

    broadcastEvent(event) {
        debug(() => `Mesh V2: Executing broadcastEvent for: ${event.name}`);
        try {
            const args = {
                BROADCAST_OPTION: {
                    id: null,
                    name: event.name,
                },
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
    },
};

module.exports = { BroadcastReceiverMixin };
