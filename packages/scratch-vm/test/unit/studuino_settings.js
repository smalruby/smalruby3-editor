const test = require('tap').test;

const Runtime = require('../../src/engine/runtime');
const sb3 = require('../../src/serialization/sb3');
const {
    STORAGE_KEY,
    MODE_NORMAL,
    MODE_STUDUINO,
    STUDUINO_SETTINGS_CHANGED,
    DEFAULT_PORTS,
    PARTS_BY_PORT,
    normalizeSettings,
    toStorage,
    getStuduinoSettings,
    setStuduinoSettings,
} = require('../../src/extensions/scratch3_smalrubot_s1/studuino-settings');

test('既定はロボットカーの配線・通常モード・補正なし', (t) => {
    const s = normalizeSettings(undefined);
    t.equal(s.mode, MODE_NORMAL);
    t.same(s.ports, DEFAULT_PORTS);
    t.same(s.calibration, { dcMotor: {}, servoMotor: {} });
    t.equal(s.unknownVersion, null);
    t.end();
});

test('既定のままなら保存しない（通常の作品の project.json を変えない）', (t) => {
    t.equal(toStorage(normalizeSettings(null)), null);
    t.end();
});

test('Studuino モードとポートの設定を保存の形にする（ポートは表の順・はじめの値の補正は省く）', (t) => {
    const storage = toStorage({
        mode: MODE_STUDUINO,
        ports: { A6: 'light_sensor', M1: 'dc_motor', D9: 'servo_motor' },
        calibration: { dcMotor: { M1: 100, M2: 90 }, servoMotor: { D9: 0, D12: -5 } },
    });
    t.same(storage, {
        version: 1,
        mode: 'studuino',
        ports: { D9: 'servo_motor', M1: 'dc_motor', A6: 'light_sensor' },
        calibration: { dcMotor: { M2: 90 }, servoMotor: { D12: -5 } },
    });
    t.same(Object.keys(storage.ports), ['D9', 'M1', 'A6']);
    t.end();
});

test('知らないポート・ポートに合わない部品・範囲の外の補正値を直す', (t) => {
    const s = normalizeSettings({
        version: 1,
        mode: 'studuino',
        ports: { A8: 'led', A6: 'led', A4: 'push_switch', A3: 'push_switch', M1: 'servo_motor' },
        calibration: { dcMotor: { M1: 150, M3: 50 }, servoMotor: { D9: -20, D10: 'x', D11: 2.6 } },
    });
    t.same(s.ports, { A3: 'push_switch' });
    t.same(s.calibration, { dcMotor: {}, servoMotor: { D9: -15, D11: 3 } });
    t.equal(s.mode, MODE_STUDUINO);
    t.end();
});

test('ports が空のオブジェクトなら「どこにもつながない」', (t) => {
    t.same(normalizeSettings({ version: 1, mode: 'normal', ports: {} }).ports, {});
    t.same(toStorage({ mode: MODE_NORMAL, ports: {}, calibration: {} }), { version: 1, mode: 'normal', ports: {} });
    t.end();
});

test('知らない版は読めるところだけ読み、通常モードで開いて知らせる', (t) => {
    const s = normalizeSettings({ version: 9, mode: 'studuino', ports: { A0: 'led' } });
    t.equal(s.mode, MODE_NORMAL);
    t.equal(s.unknownVersion, 9);
    t.same(s.ports, { A0: 'led' });
    t.end();
});

test('PARTS_BY_PORT: ボタンは A0〜A3、A6・A7 はアナログのセンサーだけ', (t) => {
    t.ok(PARTS_BY_PORT.A0.includes('push_switch'));
    t.notOk(PARTS_BY_PORT.A5.includes('push_switch'));
    t.same(PARTS_BY_PORT.A7, ['light_sensor', 'sound_sensor', 'ir_photoreflector', 'temperature_sensor']);
    t.same(PARTS_BY_PORT.M2, ['dc_motor']);
    t.end();
});

test('runtime に書くと extensionStorage に入り、変わったときだけイベントを出す', (t) => {
    const rt = new Runtime();
    const events = [];
    rt.on(STUDUINO_SETTINGS_CHANGED, (s) => events.push(s));
    let changed = 0;
    rt.on('PROJECT_CHANGED', () => changed++);
    setStuduinoSettings(rt, { mode: MODE_STUDUINO, ports: { A0: 'led' } });
    t.same(rt.extensionStorage[STORAGE_KEY], { version: 1, mode: 'studuino', ports: { A0: 'led' } });
    t.equal(getStuduinoSettings(rt).mode, MODE_STUDUINO);
    setStuduinoSettings(rt, { mode: MODE_STUDUINO, ports: { A0: 'led' } });
    t.equal(events.length, 1);
    t.equal(changed, 1);
    // 既定にもどしたらキーを消す
    setStuduinoSettings(rt, normalizeSettings(null));
    t.notOk(STORAGE_KEY in rt.extensionStorage);
    t.equal(events.length, 2);
    t.end();
});

test('sb3: 保存・読みこみで往復し、空なら extensionStorage を書かない', (t) => {
    const rt = new Runtime();
    t.notOk('extensionStorage' in sb3.serialize(rt));
    setStuduinoSettings(rt, { mode: MODE_STUDUINO, ports: { M1: 'dc_motor', A6: 'light_sensor' } });
    const json = sb3.serialize(rt);
    t.same(json.extensionStorage, {
        smalrubotS1: { version: 1, mode: 'studuino', ports: { M1: 'dc_motor', A6: 'light_sensor' } },
    });
    // 保存したものは runtime と別のオブジェクト（あとで runtime を変えても保存済みは変わらない）
    t.not(json.extensionStorage.smalrubotS1, rt.extensionStorage.smalrubotS1);

    const rt2 = new Runtime();
    return sb3.deserialize(JSON.parse(JSON.stringify(json)), rt2, null, false).then(() => {
        t.equal(getStuduinoSettings(rt2).mode, MODE_STUDUINO);
        t.same(getStuduinoSettings(rt2).ports, { M1: 'dc_motor', A6: 'light_sensor' });
    });
});

test('sb3: extensionStorage の無い作品は既定（前の作品の設定を持ちこさない）', (t) => {
    const rt = new Runtime();
    rt.extensionStorage = { smalrubotS1: { version: 1, mode: 'studuino', ports: {} } };
    return sb3.deserialize({ targets: [], monitors: [], meta: {} }, rt, null, false).then(() => {
        t.same(rt.extensionStorage, {});
        t.equal(getStuduinoSettings(rt).mode, MODE_NORMAL);
    });
});

test('sb3: スプライトの読みこみでは作品の設定を変えない', (t) => {
    const rt = new Runtime();
    rt.extensionStorage = { smalrubotS1: { version: 1, mode: 'studuino', ports: {} } };
    return sb3
        .deserialize({ name: 'Sprite1', isStage: false, costumes: [], sounds: [], blocks: {} }, rt, null, true)
        .catch(() => null)
        .then(() => {
            t.equal(rt.extensionStorage.smalrubotS1.mode, 'studuino');
        });
});

test('runtime.dispose で extensionStorage を空にする', (t) => {
    const rt = new Runtime();
    rt.extensionStorage = { smalrubotS1: { version: 1 } };
    rt.dispose();
    t.same(rt.extensionStorage, {});
    t.end();
});
