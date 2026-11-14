/* global process */
const log = require('../../util/log');
const debugLogger = require('../../util/debug-logger');
const debug = debugLogger(process.env.DEBUG);
// apollo-link は aws-appsync が 1.2.5 に固定して持ち込む依存（package.json には書かず、同じ実体を使う）。
const { execute } = require('apollo-link');
const { ON_MESSAGE_IN_GROUP } = require('./gql-operations');

// aws-appsync-subscription-link の realtime link は、operation の context に
// `controlMessages: { '@@controlEvents': true }` があるときだけ、start_ack を
// `extensions.controlMsgType === 'CONNECTED'` の control message として流す
// (それ以外のときは捨てる)。issue #1859
const CONTROL_EVENTS_KEY = '@@controlEvents';
const CONTROL_MSG_CONNECTED = 'CONNECTED';

const controlMsgTypeOf = (result) =>
    result && result.extensions && typeof result.extensions.controlMsgType !== 'undefined'
        ? result.extensions.controlMsgType
        : null;

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
    /**
     * Subscribe to onMessageInGroup.
     *
     * issue #1859: 購読の準備 (AppSync の start_ack) ができる前に届いたメッセージは
     * 受け取れない。呼び出し側が「つながった」にする前に待てるよう、準備ができたら
     * true、準備の前に購読が失敗したら false で解決する Promise を返す。
     * @returns {Promise<boolean>} Resolves when the subscription is ready (or failed).
     */
    startSubscriptions() {
        if (!this.groupId || !this.client) return Promise.resolve(false);

        const variables = {
            groupId: this.groupId,
            domain: this.domain,
        };

        let settled = false;
        let resolveReady;
        const ready = new Promise((resolve) => {
            resolveReady = resolve;
        });
        const settle = (value) => {
            if (settled) return;
            settled = true;
            this._pendingReadySettles = this._pendingReadySettles.filter((fn) => fn !== settle);
            resolveReady(value);
        };
        // 待っている間に stopSubscriptions (cleanup) されると、閉じた Observable は
        // そのあとの next を捨てるので、ここで決めないと上限まで待ち続けてしまう。
        this._pendingReadySettles.push(settle);

        const { observable, reportsReady } = this._subscribeToGroup(variables);
        const messageSub = observable.subscribe({
            next: (result) => {
                const controlMsgType = controlMsgTypeOf(result);
                if (controlMsgType !== null) {
                    if (controlMsgType === CONTROL_MSG_CONNECTED) {
                        debug(() => 'Mesh V2: Subscription is ready (start_ack)');
                        settle(true);
                    }
                    return;
                }

                if (result && result.errors && result.errors.length > 0) {
                    log.error(
                        `Mesh V2: Subscription returned errors: ${result.errors.map((e) => e.message).join(', ')}`,
                    );
                }

                const message = result && result.data && result.data.onMessageInGroup;
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
            error: (err) => {
                log.error(`Mesh V2: Subscription error: ${err}`);
                settle(false);
            },
        });

        this.subscriptions.push(messageSub);

        // client.link を持たないのはテストの代役 (client.subscribe だけのモック) のため。
        // 準備の合図を出せないので、従来どおりすぐにつながったとみなす。
        if (!reportsReady) settle(true);

        return ready;
    },

    /**
     * Start the onMessageInGroup subscription with start_ack reporting enabled.
     *
     * AWSAppSyncClient の subscribe (apollo-client 2.4) は link に context を渡せない
     * ため、control message を受け取るには client.link を直接 execute する。
     * aws-appsync の link は context.cache を読むので client.cache も渡す。
     * @param {object} variables - Subscription variables.
     * @returns {{observable: object, reportsReady: boolean}} The observable and whether it reports start_ack.
     * @private
     */
    _subscribeToGroup(variables) {
        if (this.client.link) {
            return {
                observable: execute(this.client.link, {
                    query: ON_MESSAGE_IN_GROUP,
                    variables,
                    context: {
                        cache: this.client.cache,
                        controlMessages: { [CONTROL_EVENTS_KEY]: true },
                    },
                }),
                reportsReady: true,
            };
        }
        // テストの代役 (client.link の無いモック) のための分岐。本物の AWSAppSyncClient は必ず link を持つ。
        return {
            observable: this.client.subscribe({
                query: ON_MESSAGE_IN_GROUP,
                variables,
            }),
            reportsReady: false,
        };
    },

    /**
     * Wait until the subscription is ready, but not forever.
     *
     * start_ack が来ない (遅い回線など) ときに参加そのものを止めないよう、
     * subscriptionReadyTimeoutMs で打ち切って先へ進む (従来の動きと同じになる)。
     * @param {Promise<boolean>} ready - Promise returned by startSubscriptions.
     * @returns {Promise<boolean>} true when start_ack arrived in time.
     */
    async waitForSubscriptionReady(ready) {
        let timer = null;
        const timeout = new Promise((resolve) => {
            timer = setTimeout(() => resolve('timeout'), this.subscriptionReadyTimeoutMs);
        });
        const result = await Promise.race([ready, timeout]);
        clearTimeout(timer);
        if (result === 'timeout') {
            log.warn(
                `Mesh V2: Subscription was not ready within ${this.subscriptionReadyTimeoutMs}ms; ` +
                    'continuing without waiting',
            );
            return false;
        }
        if (!result) {
            log.warn('Mesh V2: Subscription failed before it became ready');
        }
        return result;
    },

    stopSubscriptions() {
        this.subscriptions.forEach((sub) => sub.unsubscribe());
        this.subscriptions = [];
        // 準備を待っている呼び出し側を、上限まで待たせずにすぐ返す。
        const pending = this._pendingReadySettles;
        this._pendingReadySettles = [];
        pending.forEach((settle) => settle(false));
    },

    handleDataUpdate(nodeStatus) {
        // Issue #707: store data from every node, including this node itself.
        // AppSync echoes the sender's own nodeStatus back; we keep it so the
        // "sensor value" block can read this node's own global variables, treating
        // self and peers uniformly (all values arrive via the network with server
        // timestamps). A one-time UI notice informs users whose project has a
        // global variable name colliding with a sensor value lookup.
        if (!nodeStatus) return;

        const nodeId = nodeStatus.nodeId;
        if (!this.remoteData[nodeId]) {
            this.remoteData[nodeId] = {};
        }

        // Use server timestamp with fallback to current time
        const serverTimestamp = nodeStatus.timestamp
            ? new Date(nodeStatus.timestamp).getTime()
            : (log.warn('Mesh V2: Missing server timestamp, using client time'), Date.now());

        nodeStatus.data.forEach((item) => {
            // Issue #713: own values always originate locally (seeded by
            // sendData with a client timestamp), so an echo can never carry
            // newer information than the local seed.
            // - Same value: store with the server timestamp, normalizing the
            //   seed's client-clock timestamp into the server time domain so
            //   cross-node comparison self-heals despite clock skew.
            // - Different value: it is the echo of an OLDER local write
            //   (rapid successive writes) — keep the seed untouched.
            if (nodeId === this.meshId) {
                const existing = this.remoteData[nodeId][item.key];
                if (existing && existing.value !== item.value) {
                    return;
                }
            }
            this.remoteData[nodeId][item.key] = {
                value: item.value,
                timestamp: serverTimestamp,
            };
        });
    },

    handleBatchEvent(batchEvent) {
        if (!batchEvent || batchEvent.firedByNodeId === this.meshId) return;

        const events = batchEvent.events
            ? batchEvent.events.filter((event) => event.firedByNodeId !== this.meshId)
            : [];
        if (events.length === 0) return;

        debug(() => `Mesh V2: Received ${events.length} events from ${batchEvent.firedByNodeId}`);

        this._queueEventsForPlayback(events);
    },
};

module.exports = { SubscriptionManagerMixin };
