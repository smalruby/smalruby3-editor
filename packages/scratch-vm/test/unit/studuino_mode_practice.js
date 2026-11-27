const test = require('tap').test;

const StuduinoModePracticeBoard = require('../../src/extensions/scratch3_smalrubot_s1/studuino-mode-practice');
const { setStuduinoSettings } = require('../../src/extensions/scratch3_smalrubot_s1/studuino-settings');

const { PRACTICE_HANDLERS, clampRound } = StuduinoModePracticeBoard;

const createRuntime = () => {
    const listeners = {};
    const emitted = [];
    return {
        extensionStorage: {},
        emitted,
        on: (name, fn) => {
            (listeners[name] = listeners[name] || []).push(fn);
        },
        emit: (name, value) => {
            emitted.push({ name, value });
            (listeners[name] || []).forEach((fn) => fn(value));
        },
    };
};

const PORTS = {
    M1: 'dc_motor',
    D9: 'servo_motor',
    D10: 'servo_motor',
    A0: 'led',
    A1: 'buzzer',
    A2: 'touch_sensor',
    A3: 'push_switch',
    A6: 'light_sensor',
};

const setup = () => {
    const runtime = createRuntime();
    setStuduinoSettings(runtime, { mode: 'studuino', ports: PORTS });
    const board = new StuduinoModePracticeBoard(runtime);
    const port = (name) => board.getState().ports.find((p) => p.port === name);
    return { runtime, board, port };
};

test('clampRound: 範囲に収めてから四捨五入（Studuino IR と同じ）', (t) => {
    t.equal(clampRound(300, { min: 0, max: 255 }), 255);
    t.equal(clampRound(-5, { min: 0, max: 180 }), 0);
    t.equal(clampRound(89.5, { min: 0, max: 180 }), 90);
    t.equal(clampRound('abc', { min: 0, max: 180 }), 0);
    t.end();
});

test('getState: 割り当てたポートだけを、ポートの表の順に、はじめの状態で出す', (t) => {
    const { board } = setup();
    t.same(
        board.getState().ports.map((p) => p.port),
        ['D9', 'D10', 'M1', 'A0', 'A1', 'A2', 'A3', 'A6'],
    );
    t.same(board.getState().ports[0], { port: 'D9', part: 'servo_motor', degree: 90 });
    t.end();
});

test('部品の命令: 値は範囲に収め、割り当てていないポート・別の部品は何もしない', (t) => {
    const { board, port } = setup();
    board.dcMotorSpeed('M1', 300.4);
    board.dcMotorDirection('M1', 'normal');
    t.same(port('M1'), { port: 'M1', part: 'dc_motor', direction: 'normal', speed: 255 });
    board.dcMotorStop('M1', 'brake');
    t.equal(port('M1').direction, 'brake');
    board.servo('D9', 200);
    t.equal(port('D9').degree, 180);
    board.buzzerOn('A1', 50);
    t.same(port('A1'), { port: 'A1', part: 'buzzer', on: true, pitch: 130 });
    board.buzzerOff('A1');
    t.equal(port('A1').on, false);
    board.led('A0', 'on');
    t.equal(port('A0').on, true);
    // 割り当てていない（M2）・別の部品（A6 は光センサー）
    board.dcMotorSpeed('M2', 100);
    board.led('A6', 'on');
    t.notOk(board.getState().ports.find((p) => p.port === 'M2'));
    t.same(port('A6'), { port: 'A6', part: 'light_sensor', value: 0 });
    t.end();
});

test('setInput: センサーは 0〜1023、タッチセンサー・ボタンは押したか', (t) => {
    const { board } = setup();
    t.equal(board.setInput('A6', 2000), true);
    t.equal(board.readSensor('A6', 'light_sensor'), 1023);
    t.equal(board.readSensor('A6', 'sound_sensor'), 0);
    board.setInput('A3', true);
    t.equal(board.readButton('A3', 'push_switch'), true);
    t.equal(board.readButton('A2', 'touch_sensor'), false);
    t.equal(board.setInput('A0', 1), false);
    t.end();
});

test('状態が変わったときだけイベントを送る・設定を変えたら送り直す', (t) => {
    const { runtime, board } = setup();
    const count = () => runtime.emitted.filter((e) => e.name === StuduinoModePracticeBoard.STATE_EVENT).length;
    board.led('A0', 'on');
    const n = count();
    board.led('A0', 'on');
    t.equal(count(), n);
    setStuduinoSettings(runtime, { mode: 'studuino', ports: { A0: 'led' } });
    t.equal(count(), n + 1);
    t.same(runtime.studuinoModePracticeState.ports, [{ port: 'A0', part: 'led', on: true }]);
    t.end();
});

test('部品を変えたポートは、はじめの状態にもどる', (t) => {
    const { runtime, board, port } = setup();
    board.led('A0', 'on');
    setStuduinoSettings(runtime, { mode: 'studuino', ports: Object.assign({}, PORTS, { A0: 'buzzer' }) });
    t.same(port('A0'), { port: 'A0', part: 'buzzer', on: false, pitch: 0 });
    t.end();
});

test('stopAll: LED・ブザーを消し DC モーターを止める（サーボの角度は残す）・予約も消す', (t) => {
    const { board, port } = setup();
    board.led('A0', 'on');
    board.buzzerOn('A1', 440);
    board.dcMotorDirection('M1', 'reverse');
    board.servo('D9', 30);
    board.reserveServo('D10', 10);
    board.stopAll();
    t.equal(port('A0').on, false);
    t.equal(port('A1').on, false);
    t.equal(port('M1').direction, 'stop');
    t.equal(port('D9').degree, 30);
    t.same(board.getState().reservations, {});
    t.end();
});

test('予約: 積み重ねて、動かすと全部いっしょに動いて空になる・旗で空にする', (t) => {
    const { runtime, board, port } = setup();
    const ext = { studuinoPractice: board };
    PRACTICE_HANDLERS.studuinoServoReserve(ext, { PORT: 'D9', ANGLE: 10 });
    PRACTICE_HANDLERS.studuinoServoReserve(ext, { PORT: 'D10', ANGLE: 170 });
    t.equal(port('D9').degree, 90);
    PRACTICE_HANDLERS.studuinoServoMoveReserved(ext, {});
    t.equal(port('D9').degree, 10);
    t.equal(port('D10').degree, 170);
    t.same(board.getState().reservations, {});
    PRACTICE_HANDLERS.studuinoServoReserve(ext, { PORT: 'D9', ANGLE: 40 });
    runtime.emit('PROJECT_START');
    t.same(board.getState().reservations, {});
    t.end();
});

test('M 秒で動かす: 時間の割合で近づき、終わると予約の角度', (t) => {
    const { board, port } = setup();
    const ext = { studuinoPractice: board };
    let yields = 0;
    const util = { stackFrame: {}, yield: () => yields++ };
    PRACTICE_HANDLERS.studuinoServoReserve(ext, { PORT: 'D9', ANGLE: 0 });
    PRACTICE_HANDLERS.studuinoServoMoveReservedIn(ext, { SECS: 1 }, util);
    t.equal(yields, 1);
    // 半分の時間がたった
    let elapsed = 500;
    util.stackFrame.studuinoMove.timer = { timeElapsed: () => elapsed };
    PRACTICE_HANDLERS.studuinoServoMoveReservedIn(ext, { SECS: 1 }, util);
    t.equal(port('D9').degree, 45);
    t.equal(yields, 2);
    elapsed = 1200;
    PRACTICE_HANDLERS.studuinoServoMoveReservedIn(ext, { SECS: 1 }, util);
    t.equal(port('D9').degree, 0);
    t.equal(yields, 2);
    t.end();
});

test('M 秒で動かす: 予約が無ければ何もしない・0 秒ならすぐ', (t) => {
    const { board, port } = setup();
    const ext = { studuinoPractice: board };
    const util = { stackFrame: {}, yield: () => t.fail('yield') };
    PRACTICE_HANDLERS.studuinoServoMoveReservedIn(ext, { SECS: 1 }, util);
    PRACTICE_HANDLERS.studuinoServoReserve(ext, { PORT: 'D9', ANGLE: 20 });
    PRACTICE_HANDLERS.studuinoServoMoveReservedIn(ext, { SECS: 0 }, util);
    t.equal(port('D9').degree, 20);
    t.end();
});
