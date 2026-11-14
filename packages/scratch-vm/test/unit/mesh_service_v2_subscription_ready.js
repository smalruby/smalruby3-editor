const test = require('tap').test;
const minilog = require('minilog');
// Suppress debug and info logs during tests
minilog.suggest.deny('vm', 'debug');
minilog.suggest.deny('vm', 'info');
minilog.suggest.deny('vm', 'warn');
minilog.suggest.deny('vm', 'error');

// Force network filter test mode disabled
process.env.MESH_NETWORK_FILTER = 'false';

const { Observable } = require('apollo-link');
const log = require('../../src/util/log');
const MeshV2Service = require('../../src/extensions/scratch3_mesh_v2/mesh-service');
const {
    CREATE_GROUP,
    JOIN_GROUP,
    LEAVE_GROUP,
    DISSOLVE_GROUP,
    ON_MESSAGE_IN_GROUP,
} = require('../../src/extensions/scratch3_mesh_v2/gql-operations');

// issue #1859: WebSocket モードで、購読の準備（start_ack）ができる前に
// 「つながった」にしてしまい、その間に届いたほかの人のイベントを取りこぼす。

const createMockBlocks = () => ({
    runtime: {
        sequencer: {},
        emit: () => {},
        on: () => {},
        off: () => {},
        getTargetForStage: () => ({ variables: {} }),
    },
    opcodeFunctions: { event_broadcast: () => {} },
});

// AppSync の realtime link が start_ack を受けたときに流す control message の形
// (aws-appsync-subscription-link の realtime-subscription-handshake-link.js)。
const CONNECTED_CONTROL_MESSAGE = {
    data: {},
    extensions: { controlMsgType: 'CONNECTED' },
};

const makeBatchEventMessage = (eventName, firedByNodeId = 'host1') => ({
    data: {
        onMessageInGroup: {
            groupId: 'g1',
            domain: 'domain1',
            nodeStatus: null,
            batchEvent: {
                firedByNodeId,
                groupId: 'g1',
                domain: 'domain1',
                timestamp: '2026-11-14T00:00:00.000Z',
                events: [
                    {
                        name: eventName,
                        firedByNodeId,
                        groupId: 'g1',
                        domain: 'domain1',
                        payload: '',
                        timestamp: '2026-11-14T00:00:00.000Z',
                        orderKey: '20261114000000-0000001',
                    },
                ],
            },
            groupDissolve: null,
        },
    },
});

const flush = () => new Promise((resolve) => setImmediate(resolve));

/**
 * Build a mock AWSAppSyncClient whose `link` behaves like the AppSync realtime
 * link: operations go through `link.request(operation)`, and the test decides
 * when start_ack (the CONNECTED control message) arrives.
 * @param {object} options - Mock options.
 * @param {boolean} options.groupUsesWebSocket - Value of useWebSocket returned by the server.
 * @returns {object} The mock client and a handle to drive the subscription.
 */
const createLinkClient = ({ groupUsesWebSocket = true } = {}) => {
    const handle = {
        operations: [],
        observers: [],
        observer: null,
        unsubscribed: false,
        calls: [],
        mutations: [],
    };
    const client = {
        cache: { name: 'mock-cache' },
        link: {
            // Like the real realtime link: an apollo-link Observable, so `next`
            // after unsubscribe (cleanup) is dropped.
            request: (operation) => {
                handle.operations.push(operation);
                return new Observable((observer) => {
                    handle.observer = observer;
                    handle.observers.push(observer);
                    return () => {
                        handle.unsubscribed = true;
                    };
                });
            },
        },
        subscribe: () => {
            throw new Error('client.subscribe must not be used when client.link is available');
        },
        mutate: ({ mutation }) => {
            handle.mutations.push(mutation);
            if (mutation === CREATE_GROUP) {
                return Promise.resolve({
                    data: {
                        createGroup: {
                            id: 'g1',
                            name: 'G',
                            domain: 'domain1',
                            expiresAt: '2099-01-01T00:00:00Z',
                            heartbeatIntervalSeconds: 60,
                            useWebSocket: groupUsesWebSocket,
                            pollingIntervalSeconds: 2,
                        },
                    },
                });
            }
            if (mutation === JOIN_GROUP) {
                return Promise.resolve({
                    data: {
                        joinGroup: {
                            id: 'node1',
                            groupId: 'g1',
                            domain: 'domain1',
                            expiresAt: '2099-01-01T00:00:00Z',
                            heartbeatIntervalSeconds: 120,
                            useWebSocket: groupUsesWebSocket,
                            pollingIntervalSeconds: 2,
                        },
                    },
                });
            }
            return Promise.resolve({ data: {} });
        },
        query: () => {
            handle.calls.push('query');
            return Promise.resolve({ data: { listGroupStatuses: [] } });
        },
    };
    return { client, handle };
};

const createService = (client) => {
    const service = new MeshV2Service(createMockBlocks(), 'node1', 'domain1');
    service.client = client;
    service.testWebSocket = () => Promise.resolve(true);
    return service;
};

test('issue #1859: wait for subscription start_ack before "connected"', (t) => {
    t.test('startSubscriptions asks the AppSync link for control messages', async (st) => {
        const { client, handle } = createLinkClient();
        const service = createService(client);
        service.groupId = 'g1';

        service.startSubscriptions();

        st.equal(handle.operations.length, 1, 'subscribes through client.link');
        const operation = handle.operations[0];
        st.equal(operation.query, ON_MESSAGE_IN_GROUP);
        st.same(operation.variables, { groupId: 'g1', domain: 'domain1' });
        const context = operation.getContext();
        st.equal(context.controlMessages['@@controlEvents'], true, 'requests control events');
        st.equal(context.cache, client.cache, 'passes the client cache to the link chain');
        service.cleanup();
        st.end();
    });

    t.test('startSubscriptions resolves only after the CONNECTED control message', async (st) => {
        const { client, handle } = createLinkClient();
        const service = createService(client);
        service.groupId = 'g1';

        let ready = null;
        service.startSubscriptions().then((value) => {
            ready = value;
        });
        await flush();
        st.equal(ready, null, 'not ready before start_ack');

        handle.observer.next(CONNECTED_CONTROL_MESSAGE);
        await flush();
        st.equal(ready, true, 'ready after start_ack');
        service.cleanup();
        st.end();
    });

    t.test('control messages are not treated as mesh messages', async (st) => {
        const { client, handle } = createLinkClient();
        const service = createService(client);
        service.groupId = 'g1';
        let dataUpdates = 0;
        let batchEvents = 0;
        service.handleDataUpdate = () => dataUpdates++;
        service.handleBatchEvent = () => batchEvents++;

        service.startSubscriptions();
        st.doesNotThrow(() => handle.observer.next(CONNECTED_CONTROL_MESSAGE));
        st.doesNotThrow(() => handle.observer.next({ data: null, extensions: { controlMsgType: 'CONNECTED' } }));
        st.equal(dataUpdates, 0);
        st.equal(batchEvents, 0);
        service.cleanup();
        st.end();
    });

    t.test('startSubscriptions resolves false when the subscription errors before start_ack', async (st) => {
        const { client, handle } = createLinkClient();
        const service = createService(client);
        service.groupId = 'g1';

        const readyPromise = service.startSubscriptions();
        handle.observer.error(new Error('Connection failed'));
        st.equal(await readyPromise, false);
        service.cleanup();
        st.end();
    });

    t.test('joinGroup (WebSocket) does not finish before start_ack', async (st) => {
        const { client, handle } = createLinkClient();
        const service = createService(client);
        service.forcePolling = false;
        service.useWebSocket = true;

        let joined = false;
        const joinPromise = service.joinGroup('g1', 'domain1', 'G').then(() => {
            joined = true;
        });
        await flush();
        await flush();
        st.ok(handle.observer, 'subscription has been started');
        st.equal(joined, false, 'joinGroup is still waiting for start_ack');
        st.equal(handle.calls.length, 0, 'fetchAllNodesData waits for start_ack too');

        handle.observer.next(CONNECTED_CONTROL_MESSAGE);
        await joinPromise;
        st.equal(joined, true, 'joinGroup finishes after start_ack');
        st.ok(handle.calls.length >= 1, 'fetchAllNodesData runs after the subscription is ready');
        service.cleanup();
        st.end();
    });

    t.test('events delivered right after joinGroup finishes are queued for playback', async (st) => {
        const { client, handle } = createLinkClient();
        const service = createService(client);
        service.forcePolling = false;
        service.useWebSocket = true;

        const joinPromise = service.joinGroup('g1', 'domain1', 'G');
        await flush();
        await flush();
        handle.observer.next(CONNECTED_CONTROL_MESSAGE);
        await joinPromise;

        handle.observer.next(makeBatchEventMessage('hello'));
        st.equal(service.pendingBroadcasts.length, 1, 'the event is queued exactly once');
        st.equal(service.pendingBroadcasts[0].event.name, 'hello');
        service.cleanup();
        st.end();
    });

    t.test('createGroup (WebSocket) does not finish before start_ack', async (st) => {
        const { client, handle } = createLinkClient();
        const service = createService(client);
        service.forcePolling = false;

        let created = false;
        const createPromise = service.createGroup('G').then(() => {
            created = true;
        });
        for (let i = 0; i < 5; i++) await flush();
        st.ok(handle.observer, 'subscription has been started');
        st.equal(created, false, 'createGroup is still waiting for start_ack');

        handle.observer.next(CONNECTED_CONTROL_MESSAGE);
        await createPromise;
        st.equal(created, true);
        service.cleanup();
        st.end();
    });

    t.test('joinGroup retries the subscription once when start_ack does not arrive in time', async (st) => {
        const { client, handle } = createLinkClient();
        const service = createService(client);
        service.forcePolling = false;
        service.useWebSocket = true;
        service.subscriptionReadyTimeoutMs = 20;

        const joinPromise = service.joinGroup('g1', 'domain1', 'G');
        // wait for the first attempt to time out and the retry to start
        for (let i = 0; i < 50 && handle.operations.length < 2; i++) {
            await new Promise((resolve) => setTimeout(resolve, 5));
        }
        st.equal(handle.operations.length, 2, 'subscribed again');
        handle.observer.next(CONNECTED_CONTROL_MESSAGE);
        await joinPromise;
        st.equal(service.groupId, 'g1', 'joined after the retry succeeded');
        st.equal(service.subscriptions.length, 1, 'the timed-out subscription was stopped');
        st.ok(service.heartbeatTimer, 'heartbeat started');
        service.cleanup();
        st.end();
    });

    t.test('joinGroup retries once after a subscription error, then succeeds', async (st) => {
        const { client, handle } = createLinkClient();
        const service = createService(client);
        service.forcePolling = false;
        service.useWebSocket = true;

        const joinPromise = service.joinGroup('g1', 'domain1', 'G');
        await flush();
        await flush();
        handle.observer.error(new Error('GQL_ERROR'));
        for (let i = 0; i < 10 && handle.operations.length < 2; i++) await flush();
        st.equal(handle.operations.length, 2, 'subscribed again');
        handle.observer.next(CONNECTED_CONTROL_MESSAGE);
        await joinPromise;
        st.equal(service.groupId, 'g1');
        service.cleanup();
        st.end();
    });

    t.test('joinGroup disconnects (subscriptionFailed) when the retry also fails', async (st) => {
        const { client, handle } = createLinkClient();
        const service = createService(client);
        service.forcePolling = false;
        service.useWebSocket = true;
        service.subscriptionReadyTimeoutMs = 20;
        const reasons = [];
        service.setDisconnectCallback((reason) => reasons.push(reason));

        await st.rejects(service.joinGroup('g1', 'domain1', 'G'), /subscription/i);
        st.equal(handle.operations.length, 2, 'tried twice');
        st.same(reasons, ['subscriptionFailed']);
        st.equal(service.groupId, null, 'not joined');
        st.ok(handle.mutations.includes(LEAVE_GROUP), 'left the group on the server');
        st.notOk(service.heartbeatTimer, 'no heartbeat');
        st.notOk(service.dataSyncTimer, 'no periodic sync');
        st.notOk(service.eventBatchTimer, 'no event batch timer');
        st.end();
    });

    t.test('createGroup dissolves the group when the subscription cannot start', async (st) => {
        const { client, handle } = createLinkClient();
        const service = createService(client);
        service.forcePolling = false;
        service.subscriptionReadyTimeoutMs = 20;
        const reasons = [];
        service.setDisconnectCallback((reason) => reasons.push(reason));

        await st.rejects(service.createGroup('G'), /subscription/i);
        st.same(reasons, ['subscriptionFailed']);
        st.ok(handle.mutations.includes(DISSOLVE_GROUP), 'dissolved the group on the server');
        st.equal(service.groupId, null);
        st.end();
    });

    t.test('joinGroup rejects right away when disconnected while waiting for start_ack', async (st) => {
        const { client, handle } = createLinkClient();
        const service = createService(client);
        service.forcePolling = false;
        service.useWebSocket = true;
        service.subscriptionReadyTimeoutMs = 60000;

        const joinPromise = service.joinGroup('g1', 'domain1', 'G');
        await flush();
        await flush();
        const started = Date.now();
        service.cleanup();
        // dropped by the closed Observable, like the real link
        handle.observer.next(CONNECTED_CONTROL_MESSAGE);

        await st.rejects(joinPromise, /disconnected/i);
        st.ok(Date.now() - started < 1000, 'does not wait for the timeout');
        st.equal(handle.operations.length, 1, 'does not retry after a disconnect');
        st.notOk(service.heartbeatTimer, 'no heartbeat after disconnect');
        st.notOk(service.dataSyncTimer, 'no periodic sync after disconnect');
        st.notOk(service.eventBatchTimer, 'no event batch timer after disconnect');
        st.end();
    });

    t.test('an old join does not continue after reconnecting to the same group', async (st) => {
        const { client, handle } = createLinkClient();
        const service = createService(client);
        service.forcePolling = false;
        service.useWebSocket = true;
        service.subscriptionReadyTimeoutMs = 60000;

        const firstJoin = service.joinGroup('g1', 'domain1', 'G');
        await flush();
        await flush();
        const firstObserver = handle.observer;
        service.cleanup();
        const secondJoin = service.joinGroup('g1', 'domain1', 'G');
        await st.rejects(firstJoin, /disconnected/i);
        await flush();
        await flush();
        st.not(handle.observer, firstObserver, 'the second join has its own subscription');
        handle.observer.next(CONNECTED_CONTROL_MESSAGE);
        await secondJoin;
        st.equal(service.groupId, 'g1');
        st.equal(service.subscriptions.length, 1);
        service.cleanup();
        st.end();
    });

    t.test('GraphQL errors in subscription results are logged', async (st) => {
        const { client, handle } = createLinkClient();
        const service = createService(client);
        service.groupId = 'g1';
        const errors = [];
        const originalError = log.error;
        log.error = (message) => errors.push(String(message));
        try {
            service.startSubscriptions();
            handle.observer.next({ data: null, errors: [{ message: 'Unauthorized' }] });
        } finally {
            log.error = originalError;
        }
        st.equal(errors.length, 1);
        st.match(errors[0], /Unauthorized/);
        service.cleanup();
        st.end();
    });

    t.test('polling mode does not subscribe nor wait', async (st) => {
        const { client, handle } = createLinkClient({ groupUsesWebSocket: false });
        const service = createService(client);
        service.forcePolling = true;
        service.useWebSocket = false;

        await service.joinGroup('g1', 'domain1', 'G');
        st.equal(handle.operations.length, 0, 'no subscription in polling mode');
        st.ok(service.pollingTimer, 'polling started');
        service.cleanup();
        st.end();
    });

    t.test('clients without a link (legacy client.subscribe) are treated as ready', async (st) => {
        const service = new MeshV2Service(createMockBlocks(), 'node1', 'domain1');
        service.groupId = 'g1';
        let subscribedQuery = null;
        service.client = {
            subscribe: ({ query }) => {
                subscribedQuery = query;
                return { subscribe: () => ({ unsubscribe: () => {} }) };
            },
        };

        st.equal(await service.startSubscriptions(), true);
        st.equal(subscribedQuery, ON_MESSAGE_IN_GROUP);
        service.cleanup();
        st.end();
    });

    t.end();
});
