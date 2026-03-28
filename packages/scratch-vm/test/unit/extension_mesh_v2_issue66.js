const test = require('tap').test;
const minilog = require('minilog');
// Suppress debug and info logs during tests
minilog.suggest.deny('vm', 'debug');
minilog.suggest.deny('vm', 'info');

const URLSearchParams = require('url').URLSearchParams;
const MeshV2Blocks = require('../../src/extensions/scratch3_mesh_v2/index.js');
const Variable = require('../../src/engine/variable');

const createMockRuntime = () => {
    const runtime = {
        registerPeripheralExtension: () => {},
        on: () => {},
        emit: (event, data) => {
            if (!runtime.emittedEvents) runtime.emittedEvents = [];
            runtime.emittedEvents.push({ event, data });
            runtime.lastEmittedEvent = event;
            runtime.lastEmittedData = data;
        },
        getOpcodeFunction: () => () => {},
        createNewGlobalVariable: name => ({ type: Variable.SCALAR_TYPE, name: name || 'var1', value: 0 }),
        _primitives: {},
        extensionManager: {
            isExtensionLoaded: () => false,
        },
        constructor: {
            PERIPHERAL_LIST_UPDATE: 'PERIPHERAL_LIST_UPDATE',
            PERIPHERAL_CONNECTED: 'PERIPHERAL_CONNECTED',
            PERIPHERAL_DISCONNECTED: 'PERIPHERAL_DISCONNECTED',
            PERIPHERAL_CONNECTION_ERROR_ID: 'PERIPHERAL_CONNECTION_ERROR_ID',
            PERIPHERAL_CONNECTION_LOST_ERROR: 'PERIPHERAL_CONNECTION_LOST_ERROR',
            PERIPHERAL_REQUEST_ERROR: 'PERIPHERAL_REQUEST_ERROR',
        },
    };
    const stage = {
        variables: {},
        getCustomVars: () => [],
        lookupVariableById: id =>
            stage.variables[id] || { id: id, name: 'var1', value: 0, type: Variable.SCALAR_TYPE },
        lookupVariableByNameAndType: () => null,
        lookupOrCreateVariable: () => ({}),
        createVariable: () => {},
        setVariableValue: () => {},
        renameVariable: () => {},
    };
    runtime.getTargetForStage = () => stage;
    return runtime;
};

test('Mesh V2 Issue #66: Improved error handling for expired groups', t => {
    // Set up global window for utils
    global.window = {
        location: {
            search: '?mesh=test-domain',
        },
    };
    global.URLSearchParams = URLSearchParams;

    t.test('connect to expired group (client-side validation)', st => {
        const mockRuntime = createMockRuntime();
        const blocks = new MeshV2Blocks(mockRuntime);
        const now = Date.now();

        // Mock a group that just expired
        const expiredGroup = {
            id: 'expired-id',
            name: 'Expired Group',
            domain: 'test-domain',
            expiresAt: new Date(now - 1000).toISOString(),
        };
        blocks.discoveredGroups = [expiredGroup];

        blocks.connect('expired-id');

        st.equal(blocks.connectionState, 'error');
        st.equal(mockRuntime.lastEmittedEvent, 'PERIPHERAL_DISCONNECTED');
        st.same(mockRuntime.lastEmittedData, { extensionId: 'meshV2' });
        st.end();
    });

    t.test('disconnect when group expires during operation', st => {
        const mockRuntime = createMockRuntime();
        const blocks = new MeshV2Blocks(mockRuntime);

        // Simulate being connected
        blocks.connectionState = 'connected';
        blocks.meshService.groupId = 'active-group';

        // Trigger disconnect callback with 'GroupNotFound' reason (expired)
        blocks.meshService.disconnectCallback('GroupNotFound');

        st.equal(blocks.connectionState, 'error');
        st.equal(mockRuntime.lastEmittedEvent, 'PERIPHERAL_DISCONNECTED');
        st.end();
    });

    t.test('disconnect when unauthorized', st => {
        const mockRuntime = createMockRuntime();
        const blocks = new MeshV2Blocks(mockRuntime);
        const events = [];

        // Track all emitted events
        const originalEmit = mockRuntime.emit;
        mockRuntime.emit = (event, data) => {
            events.push({ event, data });
            return originalEmit(event, data);
        };

        // Simulate being connected
        blocks.setConnectionState('connected');
        blocks.meshService.groupId = 'active-group';
        events.length = 0; // Clear events

        // Trigger disconnect callback with 'Unauthorized' reason
        blocks.meshService.disconnectCallback('Unauthorized');

        st.equal(blocks.connectionState, 'disconnected'); // Only GroupNotFound/expired currently map to error

        // Verify PERIPHERAL_CONNECTION_LOST_ERROR and PERIPHERAL_DISCONNECTED were emitted
        st.equal(events.length, 2);
        st.equal(events[0].event, 'PERIPHERAL_CONNECTION_LOST_ERROR');
        st.equal(events[1].event, 'PERIPHERAL_DISCONNECTED');
        st.end();
    });

    t.test('meshService.shouldDisconnectOnError returns reason', st => {
        const mockRuntime = createMockRuntime();
        const blocks = new MeshV2Blocks(mockRuntime);

        const error = {
            graphQLErrors: [
                {
                    errorType: 'GroupNotFound',
                },
            ],
        };

        const reason = blocks.meshService.shouldDisconnectOnError(error);
        st.equal(reason, 'GroupNotFound');
        st.end();
    });

    t.test('meshService.cleanupAndDisconnect passes reason to callback', st => {
        const mockRuntime = createMockRuntime();
        const blocks = new MeshV2Blocks(mockRuntime);

        let capturedReason = null;
        blocks.meshService.setDisconnectCallback(reason => {
            capturedReason = reason;
        });

        blocks.meshService.cleanupAndDisconnect('test-reason');
        st.equal(capturedReason, 'test-reason');
        st.end();
    });

    t.end();
});
