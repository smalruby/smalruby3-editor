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

    // #2191: the practice board (no real board connected).
    const PRACTICE_EVENT = 'STUDUINO_PRACTICE_BOARD_STATE';

    /**
     * A runtime that records every event it sends.
     * @returns {object} Mock runtime with `events`.
     */
    const createRecordingRuntime = () => {
        const runtime = createMockRuntime();
        runtime.events = [];
        runtime.emit = (event, data) => {
            runtime.events.push([event, data]);
            runtime.lastEmittedEvent = event;
            runtime.lastEmittedData = data;
        };
        return runtime;
    };

    /**
     * A util for blocks with a stack frame (bendArm, actionAndStopAfter).
     * @returns {object} Mock util.
     */
    const createUtil = () => ({
        stackFrame: {},
        yielded: 0,
        yield() {
            this.yielded++;
        },
    });

    /**
     * Put the real board in the connected state with a writer that records the serial messages.
     * @param {object} blocks - the extension.
     * @returns {Array<string>} - the serial messages written.
     */
    const connectWithRecordingWriter = (blocks) => {
        const smalrubot = blocks.smalrubot;
        const written = [];
        const decoder = new TextDecoder();
        smalrubot.writer = {
            write: (bytes) => {
                const message = decoder.decode(bytes);
                written.push(message);
                // The board answers a sensor read with "<pin>:<value>".
                const read = message.match(/^!6\d(\d\d)/);
                if (read) {
                    const pin = Number(read[1]);
                    smalrubot.sensorValues[pin] = { value: '77', updatedAt: Number(new Date()) + 1000 };
                }
                return Promise.resolve();
            },
            close: () => Promise.resolve(),
        };
        smalrubot.serialPort = createMockSerialPort();
        smalrubot.armDegree = 90;
        smalrubot.setConnectionState('connected');
        return written;
    };

    t.test('practice board: the initial state', (st) => {
        const runtime = createRecordingRuntime();
        const blocks = new SmalrubotS1Blocks(runtime);
        const expected = {
            mode: 'practice',
            leds: { A0: false, A1: false },
            motors: { M1: { direction: 'stop', speed: 50 }, M2: { direction: 'stop', speed: 50 } },
            servo: { D10: { degree: 90, calibration: 0 } },
            sensors: { A2: 0, A4: 0, A5: 0, A6: 0, A7: 0 },
        };
        st.same(blocks.getPracticeBoardState(), expected);
        st.same(runtime.studuinoPracticeBoardState, expected, 'the latest state is kept on the runtime');
        st.equal(SmalrubotS1Blocks.PRACTICE_BOARD_STATE_EVENT, PRACTICE_EVENT);
        st.equal(blocks.isConnected(), false);
        st.end();
    });

    t.test('practice board: LEDs turn on and off', (st) => {
        const runtime = createRecordingRuntime();
        const blocks = new SmalrubotS1Blocks(runtime);
        return blocks
            .turnLedOn({ POSITION: 'left' })
            .then(() => {
                st.same(blocks.getPracticeBoardState().leds, { A0: true, A1: false });
                const [event, state] = runtime.events[runtime.events.length - 1];
                st.equal(event, PRACTICE_EVENT, 'a change is sent with the event');
                st.same(state.leds, { A0: true, A1: false });
                return blocks.turnLedOn({ POSITION: 'right' });
            })
            .then(() => blocks.turnLedOff({ POSITION: 'left' }))
            .then(() => {
                st.same(blocks.getPracticeBoardState().leds, { A0: false, A1: true });
                st.end();
            });
    });

    t.test('practice board: actions set the motor directions', (st) => {
        const blocks = new SmalrubotS1Blocks(createRecordingRuntime());
        const directions = () => {
            const { motors } = blocks.getPracticeBoardState();
            return [motors.M1.direction, motors.M2.direction];
        };
        const cases = [
            ['forward', ['normal', 'normal']],
            ['backward', ['reverse', 'reverse']],
            ['left', ['reverse', 'normal']],
            ['right', ['normal', 'reverse']],
            ['stop', ['stop', 'stop']],
        ];
        cases.forEach(([action, expected]) => {
            blocks.action({ ACTION: action });
            st.same(directions(), expected, action);
        });
        st.end();
    });

    t.test('practice board: the speed is used from the next action', (st) => {
        const blocks = new SmalrubotS1Blocks(createRecordingRuntime());
        blocks.setMotorSpeed({ POSITION: 'left', SPEED: 120 });
        blocks.setMotorSpeed({ POSITION: 'right', SPEED: '30' });
        st.equal(blocks.getMotorSpeed({ POSITION: 'left' }), 100);
        st.equal(blocks.getMotorSpeed({ POSITION: 'right' }), 30);
        st.equal(blocks.getPracticeBoardState().motors.M1.speed, 50, 'not yet used');
        blocks.action({ ACTION: 'forward' });
        const { motors } = blocks.getPracticeBoardState();
        st.same(motors, { M1: { direction: 'normal', speed: 100 }, M2: { direction: 'normal', speed: 30 } });
        st.end();
    });

    t.test('practice board: actionAndStopAfter stops the motors at the end', (st) => {
        const blocks = new SmalrubotS1Blocks(createRecordingRuntime());
        let finished = false;
        const util = {
            stackTimerNeedsInit: () => !util.started,
            startStackTimer: () => {
                util.started = true;
            },
            stackTimerFinished: () => finished,
            yield: () => {},
        };
        blocks.runtime.requestRedraw = () => {};
        blocks.actionAndStopAfter({ ACTION: 'backward', SECS: 1 }, util);
        st.equal(blocks.getPracticeBoardState().motors.M1.direction, 'reverse');
        finished = true;
        blocks.actionAndStopAfter({ ACTION: 'backward', SECS: 1 }, util);
        st.equal(blocks.getPracticeBoardState().motors.M1.direction, 'stop');
        st.end();
    });

    t.test('practice board: bendArm with 0 seconds', (st) => {
        const blocks = new SmalrubotS1Blocks(createRecordingRuntime());
        const util = createUtil();
        blocks.bendArm({ DEGREE: 200, SECS: 0 }, util);
        st.equal(blocks.getPracticeBoardState().servo.D10.degree, 180, 'clamped to 180');
        st.equal(util.yielded, 0);
        st.end();
    });

    t.test('practice board: bendArm moves the arm little by little', (st) => {
        const blocks = new SmalrubotS1Blocks(createRecordingRuntime());
        const util = createUtil();
        blocks.bendArm({ DEGREE: 0, SECS: 1 }, util);
        st.equal(util.yielded, 1);
        st.equal(blocks.getPracticeBoardState().servo.D10.degree, 90, 'not moved yet');

        util.stackFrame.timer = { timeElapsed: () => 500 };
        blocks.bendArm({ DEGREE: 0, SECS: 1 }, util);
        st.equal(blocks.getPracticeBoardState().servo.D10.degree, 45, 'half way after half the time');

        util.stackFrame.timer = { timeElapsed: () => 1000 };
        blocks.bendArm({ DEGREE: 0, SECS: 1 }, util);
        st.equal(blocks.getPracticeBoardState().servo.D10.degree, 0);
        st.equal(util.yielded, 2, 'finished');
        st.end();
    });

    t.test('practice board: setArmCalibration keeps the value', (st) => {
        const blocks = new SmalrubotS1Blocks(createRecordingRuntime());
        return blocks.setArmCalibration({ DEGREE: -20 }).then(() => {
            st.equal(blocks.getPracticeBoardState().servo.D10.calibration, -15);
            st.end();
        });
    });

    t.test('practice board: sensors return the values set from the panel', (st) => {
        const runtime = createRecordingRuntime();
        const blocks = new SmalrubotS1Blocks(runtime);
        st.ok(blocks.setPracticeSensorValue('A6', 80), 'by port');
        st.ok(blocks.setPracticeSensorValue('ir_a4', '15'), 'by menu value');
        st.ok(blocks.setPracticeSensorValue('right', 3));
        st.ok(blocks.setPracticeSensorValue('touch', 1));
        st.ok(blocks.setPracticeSensorValue('sound', 42));
        st.notOk(blocks.setPracticeSensorValue('A3', 1), 'an unknown port is refused');
        st.notOk(blocks.setPracticeSensorValue('A6', 'abc'), 'a non-number is refused');
        st.same(runtime.lastEmittedData.sensors, { A2: 1, A4: 15, A5: 3, A6: 80, A7: 42 });
        const positions = ['light', 'ir_a4', 'left', 'ir_a5', 'right', 'touch', 'sound', 'unknown'];
        return Promise.all(positions.map((position) => blocks.getSensorValue({ POSITION: position }))).then(
            (values) => {
                st.same(values, [80, 15, 15, 3, 3, 1, 42, 0]);
                st.end();
            },
        );
    });

    t.test('practice board: stop turns the LEDs off and stops the motors', (st) => {
        const blocks = new SmalrubotS1Blocks(createRecordingRuntime());
        blocks.action({ ACTION: 'forward' });
        return blocks
            .turnLedOn({ POSITION: 'left' })
            .then(() => blocks.stopAll())
            .then(() => {
                const state = blocks.getPracticeBoardState();
                st.same(state.leds, { A0: false, A1: false });
                st.equal(state.motors.M1.direction, 'stop');
                st.equal(state.motors.M2.direction, 'stop');
                st.end();
            });
    });

    t.test('practice board: works without Web Serial', (st) => {
        const saved = global._mockNavigator;
        global._mockNavigator = {};
        const runtime = createRecordingRuntime();
        const blocks = new SmalrubotS1Blocks(runtime);
        blocks.setPracticeSensorValue('light', 5);
        return blocks
            .getSensorValue({ POSITION: 'light' })
            .then((value) => {
                st.equal(value, 5);
                return blocks.turnLedOn({ POSITION: 'left' });
            })
            .then(() => {
                st.equal(blocks.getPracticeBoardState().leds.A0, true);
                st.notOk(
                    runtime.events.some(([event]) => event === 'PERIPHERAL_REQUEST_ERROR'),
                    'no connection error is reported',
                );
                global._mockNavigator = saved;
                st.end();
            });
    });

    t.test('switching: connecting and disconnecting change the mode', (st) => {
        const runtime = createRecordingRuntime();
        const blocks = new SmalrubotS1Blocks(runtime);
        connectWithRecordingWriter(blocks);
        st.equal(blocks.getPracticeBoardState().mode, 'device');
        st.equal(runtime.studuinoPracticeBoardState.mode, 'device');
        st.ok(runtime.events.some(([event, state]) => event === PRACTICE_EVENT && state.mode === 'device'));
        runtime.events = [];
        return blocks.smalrubot.requestDisconnect().then(() => {
            st.equal(blocks.getPracticeBoardState().mode, 'practice');
            st.ok(runtime.events.some(([event, state]) => event === PRACTICE_EVENT && state.mode === 'practice'));
            st.end();
        });
    });

    t.test('switching: while connected, the blocks write the same serial commands as before', (st) => {
        const blocks = new SmalrubotS1Blocks(createRecordingRuntime());
        const written = connectWithRecordingWriter(blocks);
        const before = blocks.getPracticeBoardState();
        const util = createUtil();
        return blocks
            .turnLedOn({ POSITION: 'left' })
            .then(() => blocks.turnLedOff({ POSITION: 'right' }))
            .then(() => {
                blocks.setMotorSpeed({ POSITION: 'right', SPEED: 20 });
                blocks.action({ ACTION: 'forward' });
                blocks.bendArm({ DEGREE: 45, SECS: 0 }, util);
                return blocks.setArmCalibration({ DEGREE: 5 });
            })
            .then(() => blocks.getSensorValue({ POSITION: 'ir_a4' }))
            .then((value) => {
                st.equal(value, 77, 'the value read from the serial port');
                // `action` does not wait for its writes, so compare without the order.
                st.same(written.slice().sort(), [
                    '!2105005.',
                    '!4200128.',
                    '!4201051.',
                    '!4300000.',
                    '!4301000.',
                    '!4405045.',
                    '!5100001.',
                    '!5101000.',
                    '!6404000.',
                ]);
                const after = blocks.getPracticeBoardState();
                st.same(after.leds, before.leds, 'the practice board is not changed');
                st.same(after.motors, before.motors);
                st.same(after.servo, before.servo);
                st.end();
            });
    });

    t.test('switching: stop while connected writes the same commands and stops the practice board', (st) => {
        const blocks = new SmalrubotS1Blocks(createRecordingRuntime());
        const written = connectWithRecordingWriter(blocks);
        blocks.practiceBoard.action('forward');
        blocks.stopAll();
        // stopAll of the real board is a chain of promises: wait for it.
        return new Promise((resolve) => setTimeout(resolve, 10)).then(() => {
            st.same(written, ['!5100000.', '!5101000.', '!4300003.', '!4301003.']);
            st.equal(blocks.getPracticeBoardState().motors.M1.direction, 'stop');
            st.end();
        });
    });

    t.test('switching: the speed set before connecting is used by the real board', (st) => {
        const blocks = new SmalrubotS1Blocks(createRecordingRuntime());
        blocks.setMotorSpeed({ POSITION: 'left', SPEED: 10 });
        const written = connectWithRecordingWriter(blocks);
        st.equal(blocks.getMotorSpeed({ POSITION: 'left' }), 10);
        blocks.action({ ACTION: 'backward' });
        return new Promise((resolve) => setTimeout(resolve, 10)).then(() => {
            st.equal(written[0], '!4200026.');
            st.end();
        });
    });

    // #2193: the record of the commands sent and the sensor values read.
    const LOG_EVENT = 'STUDUINO_COMMAND_LOG';
    const LOG_CLEAR_EVENT = 'STUDUINO_COMMAND_LOG_CLEAR';

    /**
     * Run the same blocks and return the record without `seq` / `t`.
     * @param {object} blocks - the extension.
     * @returns {Promise<Array<object>>} - the entries.
     */
    const runSameBlocks = (blocks) => {
        const util = createUtil();
        blocks.runtime.requestRedraw = () => {};
        return blocks
            .turnLedOn({ POSITION: 'left' })
            .then(() => blocks.turnLedOff({ POSITION: 'right' }))
            .then(() => {
                blocks.setMotorSpeed({ POSITION: 'right', SPEED: 20 });
                blocks.action({ ACTION: 'forward' });
                blocks.action({ ACTION: 'stop' });
                blocks.bendArm({ DEGREE: 200, SECS: 0 }, util);
                return blocks.setArmCalibration({ DEGREE: 20 });
            })
            .then(() => blocks.getSensorValue({ POSITION: 'light' }))
            .then(() => blocks.getSensorValue({ POSITION: 'ir_a4' }))
            .then(() =>
                blocks.getCommandLog().map((entry) => {
                    const copy = Object.assign({}, entry);
                    delete copy.seq;
                    delete copy.t;
                    return copy;
                }),
            );
    };

    const EXPECTED_LOG = [
        { kind: 'led', port: 'A0', value: 'on' },
        { kind: 'led', port: 'A1', value: 'off' },
        { kind: 'motor', port: 'M1', value: 'normal', speed: 50 },
        { kind: 'motor', port: 'M2', value: 'normal', speed: 20 },
        { kind: 'motor', port: 'M1', value: 'stop', speed: 0 },
        { kind: 'motor', port: 'M2', value: 'stop', speed: 0 },
        { kind: 'servo', port: 'D10', value: 180 },
        { kind: 'servoCalibration', port: 'D10', value: 15 },
        { kind: 'sensorRead', port: 'A6', sensor: 'light', value: 77 },
        { kind: 'sensorRead', port: 'A4', sensor: 'irPhotoreflector', value: 77 },
    ];

    t.test('command log: the practice board and the real board make the same record', (st) => {
        const practice = new SmalrubotS1Blocks(createRecordingRuntime());
        practice.setPracticeSensorValue('light', 77);
        practice.setPracticeSensorValue('ir_a4', 77);
        const device = new SmalrubotS1Blocks(createRecordingRuntime());
        connectWithRecordingWriter(device);
        return Promise.all([runSameBlocks(practice), runSameBlocks(device)]).then(([practiceLog, deviceLog]) => {
            st.same(
                practiceLog,
                EXPECTED_LOG.map((entry) => Object.assign({ board: 'practice' }, entry)),
            );
            st.same(
                deviceLog,
                EXPECTED_LOG.map((entry) => Object.assign({ board: 'device' }, entry)),
            );
            st.end();
        });
    });

    t.test('command log: every entry is sent with the event, with seq and t', (st) => {
        const runtime = createRecordingRuntime();
        const blocks = new SmalrubotS1Blocks(runtime);
        let now = 1000;
        blocks.commandLog.now = () => now;
        blocks.clearCommandLog();
        now = 1250;
        return blocks.turnLedOn({ POSITION: 'right' }).then(() => {
            const sent = runtime.events.filter(([event]) => event === LOG_EVENT).map(([, entry]) => entry);
            st.equal(SmalrubotS1Blocks.COMMAND_LOG_EVENT, LOG_EVENT);
            st.equal(SmalrubotS1Blocks.COMMAND_LOG_CLEAR_EVENT, LOG_CLEAR_EVENT);
            st.equal(sent.length, 1);
            st.match(sent[0], { board: 'practice', kind: 'led', port: 'A1', value: 'on', t: 250 });
            st.same(blocks.getCommandLog(), sent, 'getCommandLog returns the same entries');
            st.end();
        });
    });

    t.test('command log: the same command again is recorded again', (st) => {
        const blocks = new SmalrubotS1Blocks(createRecordingRuntime());
        return blocks
            .turnLedOn({ POSITION: 'left' })
            .then(() => blocks.turnLedOn({ POSITION: 'left' }))
            .then(() => {
                st.equal(blocks.getCommandLog().length, 2, 'even though the practice board state did not change');
                st.end();
            });
    });

    t.test('command log: keeps only the latest entries', (st) => {
        const blocks = new SmalrubotS1Blocks(createRecordingRuntime());
        blocks.commandLog.max = 3;
        ['left', 'right', 'left', 'right', 'left'].forEach((position) => blocks.turnLedOn({ POSITION: position }));
        const log = blocks.getCommandLog();
        st.equal(log.length, 3);
        st.same(
            log.map((entry) => entry.seq),
            [3, 4, 5],
            'the oldest are dropped',
        );
        st.same(
            blocks.getCommandLog(2).map((entry) => entry.seq),
            [4, 5],
            'the latest N',
        );
        st.same(blocks.getCommandLog(0), []);
        st.end();
    });

    t.test('command log: cleared by clearCommandLog, the green flag and loading a project', (st) => {
        const runtime = createRecordingRuntime();
        const handlers = {};
        runtime.on = (event, handler) => {
            (handlers[event] = handlers[event] || []).push(handler);
        };
        const blocks = new SmalrubotS1Blocks(runtime);
        const fire = (event) => (handlers[event] || []).forEach((handler) => handler());
        ['PROJECT_START', 'PROJECT_LOADED'].forEach((event) => {
            blocks.turnLedOn({ POSITION: 'left' });
            st.equal(blocks.getCommandLog().length, 1);
            fire(event);
            st.same(blocks.getCommandLog(), [], event);
        });
        blocks.turnLedOn({ POSITION: 'left' });
        blocks.clearCommandLog();
        st.same(blocks.getCommandLog(), []);
        st.ok(
            runtime.events.some(([event]) => event === LOG_CLEAR_EVENT),
            'clearing is sent with the event',
        );
        blocks.turnLedOn({ POSITION: 'left' });
        st.equal(blocks.getCommandLog()[0].seq, 4, 'seq keeps growing after clearing');
        st.end();
    });

    t.test('command log: a timed bendArm records the angles on the way only when they change', (st) => {
        const blocks = new SmalrubotS1Blocks(createRecordingRuntime());
        const util = createUtil();
        blocks.bendArm({ DEGREE: 0, SECS: 1 }, util);
        [500, 500, 1000].forEach((elapsed) => {
            util.stackFrame.timer = { timeElapsed: () => elapsed };
            blocks.bendArm({ DEGREE: 0, SECS: 1 }, util);
        });
        st.same(
            blocks.getCommandLog().map((entry) => entry.value),
            [45, 0],
        );
        st.end();
    });

    t.test('command log: stop (the stop button) is not a command of the project', (st) => {
        const blocks = new SmalrubotS1Blocks(createRecordingRuntime());
        return blocks.stopAll().then(() => {
            st.same(blocks.getCommandLog(), []);
            st.end();
        });
    });

    t.end();
});
