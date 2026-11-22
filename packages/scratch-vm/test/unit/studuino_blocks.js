const test = require('tap').test;

const SmalrubotS1Blocks = require('../../src/extensions/scratch3_smalrubot_s1/index.js');
const studuinoBlocks = require('../../src/extensions/scratch3_smalrubot_s1/studuino-blocks');
const {
    normalizeSettings,
    setStuduinoSettings,
} = require('../../src/extensions/scratch3_smalrubot_s1/studuino-settings');

const formatMessage = (m) => m.default;

const createRuntime = () => ({
    registerPeripheralExtension: () => {},
    on: () => {},
    emit: () => {},
    extensionStorage: {},
    constructor: {
        PERIPHERAL_LIST_UPDATE: 'PERIPHERAL_LIST_UPDATE',
        PERIPHERAL_CONNECTED: 'PERIPHERAL_CONNECTED',
        PERIPHERAL_DISCONNECTED: 'PERIPHERAL_DISCONNECTED',
        PERIPHERAL_CONNECTION_LOST_ERROR: 'PERIPHERAL_CONNECTION_LOST_ERROR',
        PERIPHERAL_REQUEST_ERROR: 'PERIPHERAL_REQUEST_ERROR',
    },
});

const OPCODES = [
    'studuinoDcMotorSpeed',
    'studuinoDcMotorDirection',
    'studuinoDcMotorStop',
    'studuinoServo',
    'studuinoServoReserve',
    'studuinoServoMoveReserved',
    'studuinoServoMoveReservedIn',
    'studuinoLed',
    'studuinoBuzzerOn',
    'studuinoBuzzerOff',
    'studuinoLightSensor',
    'studuinoSoundSensor',
    'studuinoIrPhotoreflector',
    'studuinoTemperatureSensor',
    'studuinoTouchSensorPressed',
    'studuinoButtonPressed',
];

test('getInfo: docs の 16 個の部品のブロックがあり、どれも通常モードのパレットには出さない', (t) => {
    const ext = new SmalrubotS1Blocks(createRuntime());
    const info = ext.getInfo();
    const blocks = info.blocks.filter((b) => OPCODES.includes(b.opcode));
    t.same(
        blocks.map((b) => b.opcode),
        OPCODES,
    );
    blocks.forEach((b) => t.equal(b.hideFromPalette, true, b.opcode));
    // 通常モードのブロックは出たまま
    t.notOk(info.blocks.find((b) => b.opcode === 'setMotorSpeed').hideFromPalette);
    t.end();
});

test('getInfo: 引数の名前とメニュー（docs の約束）', (t) => {
    const info = new SmalrubotS1Blocks(createRuntime()).getInfo();
    const args = (op) => Object.keys(info.blocks.find((b) => b.opcode === op).arguments);
    t.same(args('studuinoDcMotorSpeed'), ['PORT', 'SPEED']);
    t.same(args('studuinoDcMotorDirection'), ['PORT', 'DIRECTION']);
    t.same(args('studuinoDcMotorStop'), ['PORT', 'MODE']);
    t.same(args('studuinoServoReserve'), ['PORT', 'ANGLE']);
    t.same(args('studuinoServoMoveReserved'), []);
    t.same(args('studuinoServoMoveReservedIn'), ['SECS']);
    t.equal(info.blocks.find((b) => b.opcode === 'studuinoServoMoveReservedIn').arguments.SECS.defaultValue, 1);
    t.same(args('studuinoLed'), ['PORT', 'STATE']);
    t.same(args('studuinoBuzzerOn'), ['PORT', 'PITCH']);
    t.same(
        info.menus.studuinoDcMotorDirections.items.map((i) => i.value),
        ['normal', 'reverse'],
    );
    t.same(
        info.menus.studuinoDcMotorStopModes.items.map((i) => i.value),
        ['brake', 'coast'],
    );
    t.same(
        info.menus.studuinoLedStates.items.map((i) => i.value),
        ['on', 'off'],
    );
    t.equal(info.menus.studuinoLightSensorPorts.items, 'studuinoLightSensorPorts');
    t.equal(info.blocks.find((b) => b.opcode === 'studuinoTouchSensorPressed').blockType, 'Boolean');
    t.equal(info.blocks.find((b) => b.opcode === 'studuinoLightSensor').blockType, 'reporter');
    t.end();
});

test('ポートのメニュー: 割り当てたポートだけを「部品 (ポート)」で出す', (t) => {
    const runtime = createRuntime();
    const ext = new SmalrubotS1Blocks(runtime);
    // 既定はロボットカーの配線
    t.same(ext.studuinoIrPhotoreflectorPorts(), [
        { text: 'IR photoreflector (A4)', value: 'A4' },
        { text: 'IR photoreflector (A5)', value: 'A5' },
    ]);
    setStuduinoSettings(runtime, { mode: 'studuino', ports: { A6: 'light_sensor', A3: 'light_sensor' } });
    t.same(ext.studuinoLightSensorPorts(), [
        { text: 'light sensor (A3)', value: 'A3' },
        { text: 'light sensor (A6)', value: 'A6' },
    ]);
    // 割り当てが無いときも空にしない（値は空）
    t.same(ext.studuinoBuzzerPorts(), [{ text: 'buzzer', value: '' }]);
    t.end();
});

test('ブラウザでは動かさない（値のブロックは 0 / 偽）', (t) => {
    const ext = new SmalrubotS1Blocks(createRuntime());
    t.equal(ext.studuinoLightSensor({ PORT: 'A6' }), 0);
    t.equal(ext.studuinoTouchSensorPressed({ PORT: 'A2' }), false);
    t.equal(ext.studuinoLed({ PORT: 'A0', STATE: 'on' }), undefined);
    t.equal(ext.studuinoServoReserve({ PORT: 'D9', ANGLE: 90 }), undefined);
    t.equal(ext.studuinoServoMoveReservedIn({ SECS: 1 }), undefined);
    t.end();
});

test('paletteBlocks: 割り当てた部品のブロックだけ・予約のブロックはサーボモーターが 1 つでも出す', (t) => {
    const one = normalizeSettings({ version: 1, mode: 'studuino', ports: { D9: 'servo_motor', A0: 'led' } });
    t.same(
        studuinoBlocks.paletteBlocks(one).map((b) => b.opcode),
        [
            'studuinoServo',
            'studuinoServoReserve',
            'studuinoServoMoveReserved',
            'studuinoServoMoveReservedIn',
            'studuinoLed',
        ],
    );
    const two = normalizeSettings({ version: 1, mode: 'studuino', ports: { D9: 'servo_motor', D10: 'servo_motor' } });
    t.same(
        studuinoBlocks.paletteBlocks(two).map((b) => [b.opcode, b.ports, b.hasPort]),
        [
            ['studuinoServo', ['D9', 'D10'], true],
            ['studuinoServoReserve', ['D9', 'D10'], true],
            ['studuinoServoMoveReserved', ['D9', 'D10'], false],
            ['studuinoServoMoveReservedIn', ['D9', 'D10'], false],
        ],
    );
    t.same(studuinoBlocks.paletteBlocks(normalizeSettings({ version: 1, ports: {} })), []);
    t.same(studuinoBlocks.portMenuItems(one, 'led', formatMessage), [{ text: 'LED (A0)', value: 'A0' }]);
    t.end();
});
