const test = require('tap').test;
const minilog = require('minilog');
// Suppress debug and info logs during tests
minilog.suggest.deny('vm', 'debug');
minilog.suggest.deny('vm', 'info');

// Force network filter test mode to be disabled in unit tests
process.env.MESH_NETWORK_FILTER = 'false';

const URLSearchParams = require('url').URLSearchParams;
const MeshV2Blocks = require('../../src/extensions/scratch3_mesh_v2/index.js');
const Variable = require('../../src/engine/variable');

const createMockRuntime = () => {
    const runtime = {
        registerPeripheralExtension: () => {},
        on: () => {},
        emit: (event, data) => {
            runtime.lastEmittedEvent = event;
            runtime.lastEmittedData = data;
        },
        getOpcodeFunction: () => () => {},
        createNewGlobalVariable: (name) => ({ type: Variable.SCALAR_TYPE, name: name || 'var1', value: 0 }),
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
        lookupVariableById: (id) =>
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

test('Mesh V2 Blocks', (t) => {
    // Set up global window for utils
    global.window = {
        location: {
            search: '?mesh=test-domain',
        },
    };
    global.URLSearchParams = URLSearchParams;

    t.test('constructor', (st) => {
        const mockRuntime = createMockRuntime();
        const blocks = new MeshV2Blocks(mockRuntime);
        st.type(blocks, MeshV2Blocks);
        st.equal(blocks.domain, 'test-domain');
        st.ok(blocks.nodeId);
        st.ok(blocks.meshService);
        st.end();
    });

    t.test('getInfo', (st) => {
        const mockRuntime = createMockRuntime();
        const blocks = new MeshV2Blocks(mockRuntime);
        const info = blocks.getInfo();
        st.equal(info.id, 'meshV2');
        st.ok(info.blocks.length > 0);
        st.ok(info.menus.variableNames);
        st.end();
    });

    t.test('scan', (st) => {
        const mockRuntime = createMockRuntime();
        const blocks = new MeshV2Blocks(mockRuntime);
        const now = Date.now();
        const mockGroups = [
            {
                id: 'group1',
                name: 'Group 1',
                domain: 'test-domain',
                expiresAt: new Date(now + 100000).toISOString(),
            },
            {
                id: 'expired-group',
                name: 'Expired',
                domain: 'test-domain',
                expiresAt: new Date(now - 100000).toISOString(),
            },
        ];

        // Mock service method
        blocks.meshService.listGroups = () => Promise.resolve(mockGroups);

        blocks.scan();

        // Since it's async, we need to wait
        setImmediate(() => {
            st.equal(mockRuntime.lastEmittedEvent, 'PERIPHERAL_LIST_UPDATE');
            st.equal(mockRuntime.lastEmittedData.length, 1); // 1 valid group (Host option removed)
            st.equal(mockRuntime.lastEmittedData[0].peripheralId, 'group1');
            st.same(blocks.discoveredGroups, mockGroups);
            st.end();
        });
    });

    t.test('connect as host', (st) => {
        const mockRuntime = createMockRuntime();
        const blocks = new MeshV2Blocks(mockRuntime);
        blocks.domain = null;
        blocks.meshService.domain = null;

        // Mock service methods
        blocks.meshService.createGroup = (name) => {
            st.equal(name, blocks.nodeId);
            // Simulate server returning auto-generated domain
            blocks.meshService.domain = 'auto-domain';
            return Promise.resolve({ id: 'new-group-id', domain: 'auto-domain' });
        };

        blocks.connect('meshV2_host');

        setImmediate(() => {
            st.equal(mockRuntime.lastEmittedEvent, 'PERIPHERAL_CONNECTED');
            st.equal(blocks.meshService.domain, 'auto-domain');
            st.ok(mockRuntime._primitives.event_broadcast);
            st.end();
        });
    });

    t.test('connect as peer', (st) => {
        const mockRuntime = createMockRuntime();
        const blocks = new MeshV2Blocks(mockRuntime);
        blocks.domain = null;
        blocks.meshService.domain = null;
        blocks.discoveredGroups = [{ id: 'group1', name: 'Group 1', domain: 'scanned-domain' }];

        // Mock service methods
        blocks.meshService.joinGroup = (id, domain, groupName) => {
            st.equal(id, 'group1');
            st.equal(domain, 'scanned-domain');
            st.equal(groupName, 'Group 1');
            blocks.meshService.domain = domain;
            return Promise.resolve({ id: 'node1', domain: domain });
        };

        blocks.connect('group1');

        setImmediate(() => {
            st.equal(mockRuntime.lastEmittedEvent, 'PERIPHERAL_CONNECTED');
            st.equal(blocks.meshService.domain, 'scanned-domain');
            st.end();
        });
    });

    t.test('connect as host failure', (st) => {
        const mockRuntime = createMockRuntime();
        const blocks = new MeshV2Blocks(mockRuntime);

        // Mock service method to fail
        blocks.meshService.createGroup = () => Promise.reject(new Error('Connection failed'));

        blocks.connect('meshV2_host');

        setImmediate(() => {
            st.equal(mockRuntime.lastEmittedEvent, 'PERIPHERAL_DISCONNECTED');
            st.same(mockRuntime.lastEmittedData, { extensionId: 'meshV2' });
            st.equal(blocks.connectionState, 'error');
            st.end();
        });
    });

    t.test('connect as peer failure', (st) => {
        const mockRuntime = createMockRuntime();
        const blocks = new MeshV2Blocks(mockRuntime);
        blocks.discoveredGroups = [{ id: 'group1', name: 'Group 1', domain: 'scanned-domain' }];

        // Mock service method to fail
        blocks.meshService.joinGroup = () => Promise.reject(new Error('Connection failed'));

        blocks.connect('group1');

        setImmediate(() => {
            st.equal(mockRuntime.lastEmittedEvent, 'PERIPHERAL_DISCONNECTED');
            st.same(mockRuntime.lastEmittedData, { extensionId: 'meshV2' });
            st.equal(blocks.connectionState, 'error');
            st.end();
        });
    });

    t.test('connection state transitions', (st) => {
        const mockRuntime = createMockRuntime();
        const blocks = new MeshV2Blocks(mockRuntime);

        // Initial state
        st.equal(blocks.connectionState, 'disconnected');

        // Test error state transition
        blocks.setConnectionState('error');
        st.equal(blocks.connectionState, 'error');
        // Now it emits both PERIPHERAL_REQUEST_ERROR and PERIPHERAL_DISCONNECTED
        st.equal(mockRuntime.lastEmittedEvent, 'PERIPHERAL_DISCONNECTED');
        st.same(mockRuntime.lastEmittedData, { extensionId: 'meshV2' });

        // Test connected state transition
        blocks.setConnectionState('connected');
        st.equal(blocks.connectionState, 'connected');
        st.equal(mockRuntime.lastEmittedEvent, 'PERIPHERAL_CONNECTED');

        // Test disconnected state transition
        blocks.setConnectionState('disconnected');
        st.equal(blocks.connectionState, 'disconnected');
        st.equal(mockRuntime.lastEmittedEvent, 'PERIPHERAL_DISCONNECTED');

        st.end();
    });

    t.test('connection state: error emits PERIPHERAL_DISCONNECTED', (st) => {
        const mockRuntime = createMockRuntime();
        const blocks = new MeshV2Blocks(mockRuntime);
        const events = [];

        // Track all emitted events
        const originalEmit = mockRuntime.emit;
        mockRuntime.emit = (event, data) => {
            events.push({ event, data });
            return originalEmit(event, data);
        };

        // Transition to error state
        blocks.setConnectionState('error');

        // Verify both PERIPHERAL_REQUEST_ERROR and PERIPHERAL_DISCONNECTED were emitted
        st.equal(events.length, 2);
        st.equal(events[0].event, 'PERIPHERAL_REQUEST_ERROR');
        st.equal(events[1].event, 'PERIPHERAL_DISCONNECTED');
        st.same(events[0].data, { extensionId: 'meshV2', errorType: null });
        st.same(events[1].data, { extensionId: 'meshV2' });

        st.end();
    });

    t.test('connection state: connected to error emits PERIPHERAL_CONNECTION_LOST_ERROR', (st) => {
        const mockRuntime = createMockRuntime();
        const blocks = new MeshV2Blocks(mockRuntime);
        const events = [];

        // Track all emitted events
        const originalEmit = mockRuntime.emit;
        mockRuntime.emit = (event, data) => {
            events.push({ event, data });
            return originalEmit(event, data);
        };

        // Transition to connected state first
        blocks.setConnectionState('connected');
        events.length = 0; // Clear events

        // Transition to error state
        blocks.setConnectionState('error');

        // Verify PERIPHERAL_REQUEST_ERROR, PERIPHERAL_CONNECTION_LOST_ERROR, and PERIPHERAL_DISCONNECTED were emitted
        st.equal(events.length, 3);
        st.equal(events[0].event, 'PERIPHERAL_REQUEST_ERROR');
        st.equal(events[1].event, 'PERIPHERAL_CONNECTION_LOST_ERROR');
        st.equal(events[2].event, 'PERIPHERAL_DISCONNECTED');

        st.end();
    });

    t.test(
        'connection state: connected to disconnected (unexpected) emits PERIPHERAL_CONNECTION_LOST_ERROR',
        (st) => {
            const mockRuntime = createMockRuntime();
            const blocks = new MeshV2Blocks(mockRuntime);
            const events = [];

            // Track all emitted events
            const originalEmit = mockRuntime.emit;
            mockRuntime.emit = (event, data) => {
                events.push({ event, data });
                return originalEmit(event, data);
            };

            // Transition to connected state first
            blocks.setConnectionState('connected');
            events.length = 0; // Clear events

            // Transition to disconnected state unexpectedly (e.g. from service callback)
            blocks.setConnectionState('disconnected');

            // Verify PERIPHERAL_CONNECTION_LOST_ERROR and PERIPHERAL_DISCONNECTED were emitted
            st.equal(events.length, 2);
            st.equal(events[0].event, 'PERIPHERAL_CONNECTION_LOST_ERROR');
            st.equal(events[1].event, 'PERIPHERAL_DISCONNECTED');

            st.end();
        },
    );

    t.test('connection state: connected to disconnected (explicit) NO connection lost error', (st) => {
        const mockRuntime = createMockRuntime();
        const blocks = new MeshV2Blocks(mockRuntime);
        const events = [];

        // Track all emitted events
        const originalEmit = mockRuntime.emit;
        mockRuntime.emit = (event, data) => {
            events.push({ event, data });
            return originalEmit(event, data);
        };

        // Transition to connected state first
        blocks.setConnectionState('connected');
        events.length = 0; // Clear events

        // Explicit disconnect
        blocks.disconnect();

        // Verify ONLY PERIPHERAL_DISCONNECTED was emitted
        st.equal(events.length, 1);
        st.equal(events[0].event, 'PERIPHERAL_DISCONNECTED');

        st.end();
    });

    t.test('disconnect from error state', (st) => {
        const mockRuntime = createMockRuntime();
        const blocks = new MeshV2Blocks(mockRuntime);

        // Set to error state
        blocks.setConnectionState('error');
        st.equal(blocks.connectionState, 'error');

        // Mock leaveGroup
        blocks.meshService.leaveGroup = () => {};

        // Disconnect
        blocks.disconnect();

        st.equal(blocks.connectionState, 'disconnected');
        st.equal(mockRuntime.lastEmittedEvent, 'PERIPHERAL_DISCONNECTED');

        st.end();
    });

    t.test('getSensorValue', (st) => {
        const mockRuntime = createMockRuntime();
        const blocks = new MeshV2Blocks(mockRuntime);
        blocks.meshService.getRemoteVariable = (name) => {
            if (name === 'var1') return 'val1';
            return null;
        };

        st.equal(blocks.getSensorValue({ NAME: 'var1' }), 'val1');
        st.equal(blocks.getSensorValue({ NAME: 'var2' }), '');
        st.end();
    });

    t.test('variable synchronization', (st) => {
        const mockRuntime = createMockRuntime();
        const blocks = new MeshV2Blocks(mockRuntime);
        const stage = mockRuntime.getTargetForStage();

        // Mock service methods to avoid network calls during connect
        blocks.meshService.joinGroup = () => Promise.resolve({ id: 'node1' });

        // Setup HOCs
        blocks.connect('some-group');

        let dataSent = null;
        blocks.meshService.sendData = (data) => {
            dataSent = data;
            return Promise.resolve();
        };

        // Test createNewGlobalVariable intercept
        mockRuntime.createNewGlobalVariable('newVar');
        st.ok(dataSent);
        st.equal(dataSent[0].key, 'newVar');

        // Reset dataSent
        dataSent = null;

        // Mock variable existence in stage
        stage.variables.id1 = { id: 'id1', name: 'var1', value: 0, type: Variable.SCALAR_TYPE };

        // Test setVariableValue intercept
        stage.setVariableValue('id1', 100);
        st.ok(dataSent);
        st.equal(dataSent[0].key, 'var1');
        st.equal(dataSent[0].value, '100');

        st.end();
    });

    t.test('calculateRssi', (st) => {
        const mockRuntime = createMockRuntime();
        const blocks = new MeshV2Blocks(mockRuntime);
        const now = Date.now();

        // strongest: 3000s remaining, max is 3000s
        const strongest = {
            createdAt: new Date(now).toISOString(),
            expiresAt: new Date(now + 3000 * 1000).toISOString(),
        };
        st.equal(blocks.calculateRssi(strongest), 0);

        // medium: 1500s remaining, max is 3000s
        const medium = {
            createdAt: new Date(now - 1500 * 1000).toISOString(),
            expiresAt: new Date(now + 1500 * 1000).toISOString(),
        };
        st.equal(blocks.calculateRssi(medium), -50);

        // weakest: 0s remaining, max is 3000s
        const weakest = {
            createdAt: new Date(now - 3000 * 1000).toISOString(),
            expiresAt: new Date(now).toISOString(),
        };
        st.equal(blocks.calculateRssi(weakest), -100);

        // expired: -10s remaining, max is 3000s
        const expired = {
            createdAt: new Date(now - 3010 * 1000).toISOString(),
            expiresAt: new Date(now - 10 * 1000).toISOString(),
        };
        st.equal(blocks.calculateRssi(expired), -100);

        // null/incomplete object handling
        st.equal(blocks.calculateRssi(null), 0);
        st.equal(blocks.calculateRssi({}), 0);
        st.equal(blocks.calculateRssi({ createdAt: new Date().toISOString() }), 0);
        st.equal(blocks.calculateRssi({ expiresAt: new Date().toISOString() }), 0);

        st.end();
    });

    t.test('shouldDisconnectOnError', (st) => {
        const mockRuntime = createMockRuntime();
        const blocks = new MeshV2Blocks(mockRuntime);

        // GraphQL errorType: GroupNotFound
        const groupNotFoundError = {
            graphQLErrors: [
                {
                    message: 'Group expired: xxx@yyy',
                    errorType: 'GroupNotFound',
                },
            ],
        };
        st.equal(blocks.meshService.shouldDisconnectOnError(groupNotFoundError), 'GroupNotFound');

        // GraphQL errorType: Unauthorized
        const unauthorizedError = {
            graphQLErrors: [
                {
                    message: 'Only the host can renew',
                    errorType: 'Unauthorized',
                },
            ],
        };
        st.equal(blocks.meshService.shouldDisconnectOnError(unauthorizedError), 'Unauthorized');

        // GraphQL errorType: NodeNotFound
        const nodeNotFoundError = {
            graphQLErrors: [
                {
                    message: 'Node not found',
                    errorType: 'NodeNotFound',
                },
            ],
        };
        st.equal(blocks.meshService.shouldDisconnectOnError(nodeNotFoundError), 'NodeNotFound');

        // GraphQL errorType: ValidationError (should NOT disconnect)
        const validationError = {
            graphQLErrors: [
                {
                    message: 'Domain must be 256 characters or less',
                    errorType: 'ValidationError',
                },
            ],
        };
        st.equal(blocks.meshService.shouldDisconnectOnError(validationError), null);

        // Fallback: message string matching
        const messageOnlyError = {
            message: 'GraphQL error: Group not found',
        };
        st.equal(blocks.meshService.shouldDisconnectOnError(messageOnlyError), 'expired');

        const expiredMessageError = {
            message: 'Group expired',
        };
        st.equal(blocks.meshService.shouldDisconnectOnError(expiredMessageError), 'expired');

        // Network error (should NOT disconnect)
        const networkError = {
            message: 'Network request failed',
            networkError: new Error('Fetch failed'),
        };
        st.equal(blocks.meshService.shouldDisconnectOnError(networkError), null);

        st.end();
    });

    t.test('menuMessage returns structured object when not connected', (st) => {
        const runtime = createMockRuntime();
        const blocks = new MeshV2Blocks(runtime);
        const message = blocks.menuMessage();

        st.type(message, 'object', 'message should be an object');
        st.ok(message.domain, 'should have domain property');
        st.ok(message.group, 'should have group property');
        st.notOk(message.expiresAt, 'should not have expiresAt when not connected');
        st.ok(message.group.includes('!'), 'group should indicate not joined');
        st.end();
    });

    t.test('menuMessage returns structured object when connected', (st) => {
        const runtime = createMockRuntime();
        const blocks = new MeshV2Blocks(runtime);
        blocks.meshService = {
            groupId: 'test-group-id',
            groupName: 'abcdef',
            expiresAt: new Date('2024-01-01T11:17:00Z').toISOString(),
            isHost: false,
        };

        const message = blocks.menuMessage();

        st.type(message, 'object', 'message should be an object');
        st.ok(message.domain, 'should have domain property');
        st.ok(message.group, 'should have group property');
        st.ok(message.expiresAt, 'should have expiresAt when connected');
        st.match(message.group, /【.*】/, 'group should contain mesh ID label');
        st.match(message.expiresAt, /⏳/, 'expiresAt should contain clock emoji');
        st.end();
    });

    t.test('menuMessage uses domain from extension', (st) => {
        const runtime = createMockRuntime();
        const blocks = new MeshV2Blocks(runtime);
        blocks.domain = '100-0014';

        const message = blocks.menuMessage();

        st.equal(message.domain, '100-0014', 'should use set domain');
        st.end();
    });

    t.test('menuMessage shows "Not set" when domain is not set', (st) => {
        const runtime = createMockRuntime();
        const blocks = new MeshV2Blocks(runtime);
        blocks.domain = null;

        const message = blocks.menuMessage();

        st.match(message.domain, /Not set|未設定/, 'should show "Not set" for domain');
        st.end();
    });

    t.end();
});
