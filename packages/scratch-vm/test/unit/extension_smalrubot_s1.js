const test = require('tap').test;
const minilog = require('minilog');
// Suppress debug and info logs during tests
minilog.suggest.deny('vm', 'debug');
minilog.suggest.deny('vm', 'info');

const SmalrubotS1Blocks = require('../../src/extensions/scratch3_smalrubot_s1/index.js');

/**
 * Create a mock runtime for testing
 * @returns {object} Mock runtime
 */
const createMockRuntime = () => {
    const runtime = {
        registerPeripheralExtension: () => {},
        on: () => {},
        emit: (event, data) => {
            runtime.lastEmittedEvent = event;
            runtime.lastEmittedData = data;
        },
        constructor: {
            PERIPHERAL_LIST_UPDATE: 'PERIPHERAL_LIST_UPDATE',
            PERIPHERAL_CONNECTED: 'PERIPHERAL_CONNECTED',
            PERIPHERAL_DISCONNECTED: 'PERIPHERAL_DISCONNECTED',
            PERIPHERAL_CONNECTION_LOST_ERROR: 'PERIPHERAL_CONNECTION_LOST_ERROR',
            PERIPHERAL_REQUEST_ERROR: 'PERIPHERAL_REQUEST_ERROR',
        },
    };
    return runtime;
};

/**
 * Create a mock serial port with configurable behavior
 * @param {object} options - Configuration options
 * @param {boolean} options.closeThrows - Whether close() should throw an error
 * @returns {object} Mock serial port
 */
const createMockSerialPort = ({ closeThrows = false } = {}) => {
    const mockReader = {
        cancel: () => Promise.resolve(),
        read: () => new Promise(() => {}), // Never resolves
    };

    const mockWriter = {
        close: () => Promise.resolve(),
        write: () => Promise.resolve(),
    };

    const mockPort = {
        open: () => Promise.resolve(),
        close: () => {
            if (closeThrows) {
                return Promise.reject(new Error('InvalidStateError: The port is already closed'));
            }
            return Promise.resolve();
        },
        readable: {
            getReader: () => mockReader,
        },
        writable: {
            getWriter: () => mockWriter,
        },
    };

    return mockPort;
};

test('Smalrubot S1 Blocks', (t) => {
    // Mock Web Serial API
    // Use global._mockNavigator to avoid Navigator object conversion in Node.js
    const mockNavigator = {
        serial: {
            requestPort: () => Promise.resolve(createMockSerialPort()),
        },
    };

    global._mockNavigator = mockNavigator;

    t.test('constructor', (st) => {
        const mockRuntime = createMockRuntime();
        const blocks = new SmalrubotS1Blocks(mockRuntime);
        st.type(blocks, SmalrubotS1Blocks);
        st.ok(blocks.smalrubot);
        st.end();
    });

    t.test('getInfo', (st) => {
        const mockRuntime = createMockRuntime();
        const blocks = new SmalrubotS1Blocks(mockRuntime);
        const info = blocks.getInfo();
        st.equal(info.id, 'smalrubotS1');
        st.equal(info.name, 'Studuino');
        st.ok(info.blocks.length > 0);
        st.equal(info.showStatusButton, true);
        st.end();
    });

    t.test('disconnect handles errors gracefully', (st) => {
        const mockRuntime = createMockRuntime();
        const blocks = new SmalrubotS1Blocks(mockRuntime);
        const smalrubot = blocks.smalrubot;

        // Set up smalrubot in a connected state with a port that throws on close
        smalrubot.serialPort = createMockSerialPort({ closeThrows: true });
        smalrubot.reader = {
            cancel: () => Promise.reject(new Error('Reader already canceled')),
        };
        smalrubot.writer = {
            close: () => Promise.reject(new Error('Cannot close a ERRORED writable stream')),
        };
        smalrubot.connectionState = 'connected';

        // Perform disconnect
        return smalrubot
            .disconnect()
            .then(() => {
                // Verify state transitioned to disconnected despite errors
                st.equal(
                    smalrubot.connectionState,
                    'disconnected',
                    'should transition to disconnected state even when errors occur',
                );

                // Verify resources are cleaned up
                st.equal(smalrubot.serialPort, null, 'should set serialPort to null');
                st.equal(smalrubot.reader, null, 'should set reader to null');
                st.equal(smalrubot.writer, null, 'should set writer to null');

                // Verify PERIPHERAL_DISCONNECTED event was emitted
                st.equal(
                    mockRuntime.lastEmittedEvent,
                    'PERIPHERAL_DISCONNECTED',
                    'should emit PERIPHERAL_DISCONNECTED event',
                );

                st.end();
            })
            .catch((err) => {
                st.fail(`disconnect should not throw errors: ${err.message}`);
                st.end();
            });
    });

    t.test('disconnect from already disconnected state', (st) => {
        const mockRuntime = createMockRuntime();
        const blocks = new SmalrubotS1Blocks(mockRuntime);
        const smalrubot = blocks.smalrubot;

        // Already in disconnected state
        smalrubot.connectionState = 'disconnected';

        return smalrubot.disconnect().then(() => {
            st.equal(smalrubot.connectionState, 'disconnected', 'should remain in disconnected state');
            st.end();
        });
    });

    t.test('disconnect without serial port', (st) => {
        const mockRuntime = createMockRuntime();
        const blocks = new SmalrubotS1Blocks(mockRuntime);
        const smalrubot = blocks.smalrubot;

        // Set connected state but no serial port (edge case)
        smalrubot.connectionState = 'connected';
        smalrubot.serialPort = null;

        return smalrubot.disconnect().then(() => {
            st.equal(smalrubot.connectionState, 'disconnected', 'should transition to disconnected state');
            st.end();
        });
    });

    t.test('disconnect cleans up all resources', (st) => {
        const mockRuntime = createMockRuntime();
        const blocks = new SmalrubotS1Blocks(mockRuntime);
        const smalrubot = blocks.smalrubot;

        // Set up smalrubot in a connected state
        smalrubot.serialPort = createMockSerialPort();
        smalrubot.reader = {
            cancel: () => Promise.resolve(),
        };
        smalrubot.writer = {
            close: () => Promise.resolve(),
        };
        smalrubot.writing = true;
        smalrubot.writeQueue = ['data1', 'data2'];
        smalrubot.connectionState = 'connected';

        return smalrubot.disconnect().then(() => {
            st.equal(smalrubot.serialPort, null, 'should clear serialPort');
            st.equal(smalrubot.reader, null, 'should clear reader');
            st.equal(smalrubot.writer, null, 'should clear writer');
            st.equal(smalrubot.writing, false, 'should reset writing flag');
            st.same(smalrubot.writeQueue, [], 'should clear writeQueue');
            st.equal(smalrubot.connectionState, 'disconnected', 'should transition to disconnected state');
            st.end();
        });
    });

    t.test('connectDirect sets serial port and calls connect', (st) => {
        const mockRuntime = createMockRuntime();
        const blocks = new SmalrubotS1Blocks(mockRuntime);
        const smalrubot = blocks.smalrubot;
        const mockPort = createMockSerialPort();

        let connectCalled = false;
        smalrubot.connect = () => {
            connectCalled = true;
            st.equal(smalrubot.serialPort, mockPort, 'serialPort should be set before connect');
            st.equal(smalrubot.connectionState, 'scanned', 'state should be scanned before connect');
            smalrubot.setConnectionState('connected');
            return Promise.resolve();
        };

        return blocks.connectDirect(mockPort).then(() => {
            st.ok(connectCalled, 'should call connect');
            st.equal(smalrubot.serialPort, mockPort, 'should set serial port');
            st.equal(smalrubot.connectionState, 'connected', 'should be in connected state');
            st.end();
        });
    });

    t.test('connectDirect disconnects first when not in disconnected state', (st) => {
        const mockRuntime = createMockRuntime();
        const blocks = new SmalrubotS1Blocks(mockRuntime);
        const smalrubot = blocks.smalrubot;
        const mockPort = createMockSerialPort();

        let disconnectCalled = false;
        const originalDisconnect = smalrubot.disconnect.bind(smalrubot);
        smalrubot.disconnect = () => {
            disconnectCalled = true;
            return originalDisconnect();
        };

        smalrubot.connect = () => {
            smalrubot.setConnectionState('connected');
            return Promise.resolve();
        };

        // Simulate already-connected state
        smalrubot.serialPort = createMockSerialPort();
        smalrubot.connectionState = 'connected';

        return blocks.connectDirect(mockPort).then(() => {
            st.ok(disconnectCalled, 'should disconnect first');
            st.equal(smalrubot.serialPort, mockPort, 'should set new serial port after disconnect');
            st.equal(smalrubot.connectionState, 'connected', 'should be in connected state');
            st.end();
        });
    });

    t.test('connectDirect propagates connect errors', (st) => {
        const mockRuntime = createMockRuntime();
        const blocks = new SmalrubotS1Blocks(mockRuntime);
        const smalrubot = blocks.smalrubot;
        const mockPort = createMockSerialPort();

        smalrubot.connect = () => Promise.reject(new Error('Connection failed'));

        return blocks.connectDirect(mockPort).then(
            () => {
                st.fail('should reject');
                st.end();
            },
            (err) => {
                st.match(err.message, /Connection failed/, 'should propagate the error');
                st.end();
            },
        );
    });

    t.test('connectDirect rejects when smalrubot is not initialized', (st) => {
        const mockRuntime = createMockRuntime();
        const blocks = new SmalrubotS1Blocks(mockRuntime);
        blocks.smalrubot = null;
        const mockPort = createMockSerialPort();

        return blocks.connectDirect(mockPort).then(
            () => {
                st.fail('should reject');
                st.end();
            },
            (err) => {
                st.ok(err, 'should reject with an error');
                st.end();
            },
        );
    });

    // #2189: menu values are saved in sb3 files. Only add values; never rename or remove them.
    t.test('menus keep the saved names and values', (st) => {
        const blocks = new SmalrubotS1Blocks(createMockRuntime());
        const info = blocks.getInfo();
        st.same(Object.keys(info.menus).sort(), ['actions', 'positions', 'sensorPositions']);
        const values = (name) => info.menus[name].items.map((item) => item.value);
        st.same(values('actions').sort(), ['backward', 'forward', 'left', 'right', 'stop']);
        st.same(values('positions').sort(), ['left', 'right']);
        ['left', 'right', 'touch', 'light', 'sound'].forEach((value) => {
            st.ok(values('sensorPositions').includes(value), `sensorPositions keeps "${value}"`);
        });
        st.ok(values('sensorPositions').includes('ir_a4'), 'sensorPositions has "ir_a4"');
        st.ok(values('sensorPositions').includes('ir_a5'), 'sensorPositions has "ir_a5"');
        st.end();
    });

    t.test('blocks keep their opcodes and the robot car blocks come after the heading', (st) => {
        const blocks = new SmalrubotS1Blocks(createMockRuntime());
        const info = blocks.getInfo();
        const opcodes = info.blocks.filter((b) => b.opcode).map((b) => b.opcode);
        st.same(opcodes, [
            'getSensorValue',
            'turnLedOn',
            'turnLedOff',
            'getMotorSpeed',
            'setMotorSpeed',
            'action',
            'actionAndStopAfter',
            'bendArm',
            'setArmCalibration',
        ]);
        const labelIndex = info.blocks.findIndex((b) => b.blockType === 'label');
        st.ok(labelIndex > 0, 'has a heading label');
        st.equal(info.blocks[labelIndex].text, 'Robot car');
        st.equal(info.blocks[labelIndex + 1].opcode, 'action');
        st.end();
    });

    t.test('getSensorValue reads the same port for old and new values', (st) => {
        const blocks = new SmalrubotS1Blocks(createMockRuntime());
        const calls = [];
        blocks.smalrubot.readCommand = (commandName, pin) => {
            calls.push([commandName, pin]);
            return Promise.resolve('12');
        };
        const cases = [
            ['left', 'get_ir_photoreflector_value', 4],
            ['ir_a4', 'get_ir_photoreflector_value', 4],
            ['right', 'get_ir_photoreflector_value', 5],
            ['ir_a5', 'get_ir_photoreflector_value', 5],
            ['touch', 'get_touch_sensor_value', 2],
            ['light', 'get_light_sensor_value', 6],
            ['sound', 'get_sound_sensor_value', 7],
        ];
        return Promise.all(cases.map(([position]) => blocks.smalrubot.getSensorValue(position))).then((results) => {
            st.same(
                results,
                cases.map(() => 12),
            );
            st.same(
                calls,
                cases.map(([, commandName, pin]) => [commandName, pin]),
            );
            st.end();
        });
    });

    // #2189: a project saved before the rename (old menu values) opens with the same blocks and values.
    t.test('a saved project with the old menu values opens unchanged', (st) => {
        const Runtime = require('../../src/engine/runtime');
        const sb3 = require('../../src/serialization/sb3');
        const block = (opcode, extra) =>
            Object.assign(
                { opcode, next: null, parent: null, inputs: {}, fields: {}, shadow: false, topLevel: false },
                extra,
            );
        const blocks = {
            sensor: block('smalrubotS1_getSensorValue', {
                topLevel: true,
                x: 0,
                y: 0,
                inputs: { POSITION: [1, 'sensorMenu'] },
            }),
            sensorMenu: block('smalrubotS1_menu_sensorPositions', {
                parent: 'sensor',
                shadow: true,
                fields: { sensorPositions: ['left', null] },
            }),
            act: block('smalrubotS1_action', {
                topLevel: true,
                x: 0,
                y: 100,
                inputs: { ACTION: [1, 'actMenu'] },
            }),
            actMenu: block('smalrubotS1_menu_actions', {
                parent: 'act',
                shadow: true,
                fields: { actions: ['backward', null] },
            }),
            led: block('smalrubotS1_turnLedOn', {
                topLevel: true,
                x: 0,
                y: 200,
                inputs: { POSITION: [1, 'ledMenu'] },
            }),
            ledMenu: block('smalrubotS1_menu_positions', {
                parent: 'led',
                shadow: true,
                fields: { positions: ['right', null] },
            }),
        };
        const project = {
            targets: [
                {
                    isStage: true,
                    name: 'Stage',
                    variables: {},
                    lists: {},
                    broadcasts: {},
                    blocks: {},
                    comments: {},
                    currentCostume: 0,
                    costumes: [],
                    sounds: [],
                    volume: 100,
                },
                {
                    isStage: false,
                    name: 'Sprite1',
                    variables: {},
                    lists: {},
                    broadcasts: {},
                    blocks,
                    comments: {},
                    currentCostume: 0,
                    costumes: [],
                    sounds: [],
                    volume: 100,
                    visible: true,
                    x: 0,
                    y: 0,
                    size: 100,
                    direction: 90,
                    draggable: false,
                    rotationStyle: 'all around',
                },
            ],
            monitors: [],
            extensions: ['smalrubotS1'],
            meta: { semver: '3.0.0' },
        };
        // Deserialize directly (no costume assets are needed to check the blocks).
        const runtime = new Runtime();
        return sb3.deserialize(project, runtime).then(({ targets, extensions }) => {
            st.ok(extensions.extensionIDs.has('smalrubotS1'), 'the extension is required by the project');
            const sprite = targets.find((target) => !target.isStage);
            const loaded = sprite.blocks._blocks;
            st.equal(loaded.sensor.opcode, 'smalrubotS1_getSensorValue');
            st.equal(loaded.sensorMenu.opcode, 'smalrubotS1_menu_sensorPositions');
            st.equal(loaded.sensorMenu.fields.sensorPositions.value, 'left');
            st.equal(loaded.actMenu.fields.actions.value, 'backward');
            st.equal(loaded.ledMenu.fields.positions.value, 'right');

            // ... and every saved value is still a value of the extension's menus.
            const info = new SmalrubotS1Blocks(createMockRuntime()).getInfo();
            const has = (menu, value) => info.menus[menu].items.some((item) => item.value === value);
            st.ok(has('sensorPositions', 'left'));
            st.ok(has('actions', 'backward'));
            st.ok(has('positions', 'right'));
            st.end();
        });
    });

    t.end();
});
