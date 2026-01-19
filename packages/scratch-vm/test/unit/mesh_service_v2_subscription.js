const test = require('tap').test;
const minilog = require('minilog');
// Suppress debug and info logs during tests
minilog.suggest.deny('vm', 'debug');
minilog.suggest.deny('vm', 'info');

const MeshV2Service = require('../../src/extensions/scratch3_mesh_v2/mesh-service');
const {ON_MESSAGE_IN_GROUP} = require('../../src/extensions/scratch3_mesh_v2/gql-operations');

const createMockBlocks = () => ({
    runtime: {
        sequencer: {},
        emit: () => {},
        on: () => {},
        off: () => {}
    },
    opcodeFunctions: {
        event_broadcast: () => {}
    }
});

test('MeshV2Service Subscription Integration', t => {
    t.test('startSubscriptions subscribes to ON_MESSAGE_IN_GROUP', st => {
        const blocks = createMockBlocks();
        const service = new MeshV2Service(blocks, 'node1', 'domain1');
        service.groupId = 'group1';

        let subscribedQuery = null;
        let subscriptionObserver = null;

        service.client = {
            subscribe: ({query}) => {
                subscribedQuery = query;
                return {
                    subscribe: observer => {
                        subscriptionObserver = observer;
                        return {unsubscribe: () => {}};
                    }
                };
            }
        };

        service.startSubscriptions();

        st.equal(subscribedQuery, ON_MESSAGE_IN_GROUP, 'Should subscribe to ON_MESSAGE_IN_GROUP');
        st.ok(subscriptionObserver, 'Should verify observer is attached');
        st.end();
    });

    t.test('Routes NodeStatus to handleDataUpdate', st => {
        const blocks = createMockBlocks();
        const service = new MeshV2Service(blocks, 'node1', 'domain1');
        service.groupId = 'group1';

        let subscriptionObserver = null;
        service.client = {
            subscribe: () => ({
                subscribe: observer => {
                    subscriptionObserver = observer;
                    return {unsubscribe: () => {}};
                }
            })
        };

        service.startSubscriptions();

        // Spy on handleDataUpdate
        let handleDataUpdateCalled = false;
        service.handleDataUpdate = payload => {
            handleDataUpdateCalled = true;
            st.equal(payload.__typename, 'NodeStatus');
            st.equal(payload.nodeId, 'node2');
        };

        // Simulate incoming message
        subscriptionObserver.next({
            data: {
                onMessageInGroup: {
                    nodeStatus: {
                        __typename: 'NodeStatus',
                        nodeId: 'node2',
                        data: []
                    }
                }
            }
        });

        st.ok(handleDataUpdateCalled, 'Should call handleDataUpdate');
        st.end();
    });

    t.test('Routes BatchEvent to handleBatchEvent', st => {
        const blocks = createMockBlocks();
        const service = new MeshV2Service(blocks, 'node1', 'domain1');
        service.groupId = 'group1';

        let subscriptionObserver = null;
        service.client = {
            subscribe: () => ({
                subscribe: observer => {
                    subscriptionObserver = observer;
                    return {unsubscribe: () => {}};
                }
            })
        };

        service.startSubscriptions();

        // Spy on handleBatchEvent
        let handleBatchEventCalled = false;
        service.handleBatchEvent = payload => {
            handleBatchEventCalled = true;
            st.equal(payload.__typename, 'BatchEvent');
            st.equal(payload.firedByNodeId, 'node2');
        };

        // Simulate incoming message
        subscriptionObserver.next({
            data: {
                onMessageInGroup: {
                    batchEvent: {
                        __typename: 'BatchEvent',
                        firedByNodeId: 'node2',
                        events: []
                    }
                }
            }
        });

        st.ok(handleBatchEventCalled, 'Should call handleBatchEvent');
        st.end();
    });

    t.test('Routes GroupDissolvePayload to cleanupAndDisconnect', st => {
        const blocks = createMockBlocks();
        const service = new MeshV2Service(blocks, 'node1', 'domain1');
        service.groupId = 'group1';

        let subscriptionObserver = null;
        service.client = {
            subscribe: () => ({
                subscribe: observer => {
                    subscriptionObserver = observer;
                    return {unsubscribe: () => {}};
                }
            })
        };

        service.startSubscriptions();

        // Spy on cleanupAndDisconnect
        let cleanupCalled = false;
        service.cleanupAndDisconnect = () => {
            cleanupCalled = true;
        };

        // Simulate incoming message
        subscriptionObserver.next({
            data: {
                onMessageInGroup: {
                    groupDissolve: {
                        __typename: 'GroupDissolvePayload',
                        message: 'Bye'
                    }
                }
            }
        });

        st.ok(cleanupCalled, 'Should call cleanupAndDisconnect');
        st.equal(service.costTracking.dissolveReceived, 1, 'Should increment dissolve tracking');
        st.end();
    });

    t.test('Ignores unknown types', st => {
        const blocks = createMockBlocks();
        const service = new MeshV2Service(blocks, 'node1', 'domain1');
        service.groupId = 'group1';

        let subscriptionObserver = null;
        service.client = {
            subscribe: () => ({
                subscribe: observer => {
                    subscriptionObserver = observer;
                    return {unsubscribe: () => {}};
                }
            })
        };

        service.startSubscriptions();

        // Spies
        let anyCalled = false;
        service.handleDataUpdate = () => {
            anyCalled = true;
        };
        service.handleBatchEvent = () => {
            anyCalled = true;
        };
        service.cleanupAndDisconnect = () => {
            anyCalled = true;
        };

        // Simulate unknown message
        subscriptionObserver.next({
            data: {
                onMessageInGroup: {
                    __typename: 'UnknownType'
                }
            }
        });

        st.notOk(anyCalled, 'Should not call any handler for unknown type');
        st.end();
    });

    t.end();
});
