import {
    getStuduinoSettings,
    STUDUINO_SETTINGS_CHANGED,
} from '@smalruby/scratch-vm/src/extensions/scratch3_smalrubot_s1/studuino-settings';
import EventEmitter from 'events';
import { filterDynamicCategoryXmlList, isDynamicCategoryAllowed } from '../../../src/lib/lesson-dynamic-categories';
import makeToolboxXML from '../../../src/lib/make-toolbox-xml';
import {
    isStuduinoAllowedBlock,
    isStuduinoModeSettings,
    makeStuduinoCategoryXml,
    makeStuduinoPartBlocksXml,
    prependToolboxCategory,
    setStuduinoMode,
    STUDUINO_ALLOWED_BLOCKS,
} from '../../../src/lib/studuino-mode';

const makeVm = () => {
    const runtime = new EventEmitter();
    runtime.extensionStorage = {};
    runtime.emitProjectChanged = jest.fn();
    return { runtime };
};

// blocks.jsx と同じ渡し方: onlyBlocks と dynamicCategoryIds に一覧、拡張機能は隠す
const studuinoToolbox = (extensions = []) =>
    makeToolboxXML(
        false,
        false,
        'sprite',
        extensions,
        'c',
        'b',
        's',
        undefined,
        STUDUINO_ALLOWED_BLOCKS.join(','),
        true,
        true,
        STUDUINO_ALLOWED_BLOCKS.slice(),
    );

const blockTypes = (xml) => [...xml.matchAll(/<block[^>]*type="([^"]+)"/g)].map((m) => m[1]);

describe('studuino-mode', () => {
    describe('STUDUINO_ALLOWED_BLOCKS', () => {
        test('has only the first-stage standard blocks', () => {
            expect(isStuduinoAllowedBlock('event_whenflagclicked')).toBe(true);
            expect(isStuduinoAllowedBlock('control_forever')).toBe(true);
            expect(isStuduinoAllowedBlock('operator_round')).toBe(true);
            expect(isStuduinoAllowedBlock('sensing_timer')).toBe(true);
            expect(isStuduinoAllowedBlock('data_changevariableby')).toBe(true);
        });

        test.each([
            'event_whenkeypressed',
            'control_stop',
            'control_create_clone_of',
            'operator_join',
            'operator_mathop',
            'sensing_askandwait',
            'data_showvariable',
            'data_addtolist',
            'procedures_call',
            'looks_say',
            'motion_movesteps',
            'smalrubotS1_action',
        ])('does not allow %s', (opcode) => {
            expect(isStuduinoAllowedBlock(opcode)).toBe(false);
        });
    });

    describe('palette', () => {
        test('shows only the allowed core blocks', () => {
            const xml = studuinoToolbox();
            const types = blockTypes(xml).filter((t) => !/^(math_|text|event_broadcast_menu)/.test(t));
            const shown = types.filter((t) => !t.endsWith('_menu'));
            shown.forEach((t) => expect(STUDUINO_ALLOWED_BLOCKS).toContain(t));
            expect(shown).toEqual(
                expect.arrayContaining(['event_whenflagclicked', 'control_if_else', 'sensing_timer']),
            );
            expect(xml).not.toContain('toolboxitemid="motion"');
            expect(xml).not.toContain('toolboxitemid="looks"');
            expect(xml).not.toContain('toolboxitemid="sound"');
        });

        test('keeps Variables and hides My Blocks', () => {
            const xml = studuinoToolbox();
            expect(xml).toContain('custom="VARIABLE"');
            expect(xml).not.toContain('custom="PROCEDURE"');
            expect(isDynamicCategoryAllowed('myBlocks', STUDUINO_ALLOWED_BLOCKS.slice())).toBe(false);
        });

        test('hides extension categories', () => {
            const xml = studuinoToolbox([{ id: 'pen', xml: '<category name="Pen" id="pen"></category>' }]);
            expect(xml).not.toContain('name="Pen"');
        });

        test('the Variables flyout keeps number variables but not lists', () => {
            const el = (tag, attrs) => {
                const e = document.createElement(tag);
                Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
                return e;
            };
            const list = [
                el('button', { callbackKey: 'CREATE_VARIABLE' }),
                el('block', { type: 'data_variable' }),
                el('block', { type: 'data_setvariableto' }),
                el('block', { type: 'data_changevariableby' }),
                el('block', { type: 'data_showvariable' }),
                el('sep', {}),
                el('button', { callbackKey: 'CREATE_LIST' }),
                el('block', { type: 'data_listcontents' }),
                el('block', { type: 'data_addtolist' }),
            ];
            const kept = filterDynamicCategoryXmlList(list, STUDUINO_ALLOWED_BLOCKS.slice()).map(
                (e) => e.getAttribute('type') || e.getAttribute('callbackKey'),
            );
            expect(kept).toEqual(['CREATE_VARIABLE', 'data_variable', 'data_setvariableto', 'data_changevariableby']);
        });
    });

    describe('setStuduinoMode', () => {
        test('enters and leaves the mode through the VM settings', () => {
            const vm = makeVm();
            const changed = jest.fn();
            vm.runtime.on(STUDUINO_SETTINGS_CHANGED, changed);

            const entered = setStuduinoMode(vm, true);
            expect(isStuduinoModeSettings(entered)).toBe(true);
            expect(vm.runtime.extensionStorage.smalrubotS1.mode).toBe('studuino');
            expect(changed).toHaveBeenCalledTimes(1);

            const left = setStuduinoMode(vm, false);
            expect(isStuduinoModeSettings(left)).toBe(false);
            // 既定の設定にもどったので保存しない
            expect(vm.runtime.extensionStorage.smalrubotS1).toBeUndefined();
        });

        test('keeps the port settings', () => {
            const vm = makeVm();
            vm.runtime.extensionStorage.smalrubotS1 = { version: 1, mode: 'normal', ports: { A6: 'light_sensor' } };
            setStuduinoMode(vm, true);
            expect(getStuduinoSettings(vm.runtime).ports).toEqual({ A6: 'light_sensor' });
        });

        test('does nothing without a VM', () => {
            expect(setStuduinoMode(null, true)).toBeNull();
        });
    });

    describe('ArtecRobo category', () => {
        test('puts the port settings button first in the palette', () => {
            const category = makeStuduinoCategoryXml({
                name: 'アーテックロボ & <ロボ>',
                buttonText: '入出力の設定',
                colors: { colourPrimary: '#0fBD8C', colourTertiary: '#0B8E69' },
            });
            expect(category).toContain('callbackKey="STUDUINO_PORT_SETTINGS"');
            expect(category).toContain('name="アーテックロボ &amp; &lt;ロボ&gt;"');
            const xml = prependToolboxCategory(studuinoToolbox(), category);
            expect(xml.indexOf('STUDUINO_PORT_SETTINGS')).toBeLessThan(xml.indexOf('toolboxitemid="events"'));
            expect(xml.startsWith('<xml')).toBe(true);
        });

        test('leaves an empty toolbox alone', () => {
            expect(prependToolboxCategory(null, '<category/>')).toBeNull();
        });
    });
});

describe('部品のブロック（#2216）', () => {
    const settings = (ports) => ({ mode: 'studuino', ports, calibration: { dcMotor: {}, servoMotor: {} } });

    test('使えるブロックの一覧に 16 個の部品のブロックが入る', () => {
        const parts = STUDUINO_ALLOWED_BLOCKS.filter((op) => op.startsWith('smalrubotS1_studuino'));
        expect(parts).toHaveLength(16);
        expect(isStuduinoAllowedBlock('smalrubotS1_studuinoServoMoveReservedIn')).toBe(true);
        expect(isStuduinoAllowedBlock('smalrubotS1_studuinoLightSensor')).toBe(true);
        // 通常モードのブロックは使えない
        expect(isStuduinoAllowedBlock('smalrubotS1_setMotorSpeed')).toBe(false);
    });

    test('割り当てた部品のブロックだけを、最初のポートで並べる', () => {
        const xml = makeStuduinoPartBlocksXml(settings({ A6: 'light_sensor', A3: 'light_sensor', A0: 'led' }));
        const types = [...xml.matchAll(/<block type="([^"]+)">/g)].map((m) => m[1]);
        expect(types).toEqual(['smalrubotS1_studuinoLed', 'smalrubotS1_studuinoLightSensor']);
        expect(xml).toContain(
            '<block type="smalrubotS1_studuinoLed"><field name="PORT">A0</field><field name="STATE">on</field></block>',
        );
        expect(xml).toContain('<block type="smalrubotS1_studuinoLightSensor"><field name="PORT">A3</field></block>');
    });

    test('数の引数は math_number の影・予約したサーボを動かすブロックはポートを持たない', () => {
        const one = makeStuduinoPartBlocksXml(settings({ M1: 'dc_motor', D9: 'servo_motor' }));
        expect(one).toContain(
            '<value name="SPEED"><shadow type="math_number"><field name="NUM">100</field></shadow></value>',
        );
        expect(one).toContain(
            '<block type="smalrubotS1_studuinoServoReserve"><field name="PORT">D9</field>' +
                '<value name="ANGLE"><shadow type="math_number"><field name="NUM">90</field></shadow></value></block>',
        );
        expect(one).toContain('<block type="smalrubotS1_studuinoServoMoveReserved"></block>');
        expect(one).toContain(
            '<block type="smalrubotS1_studuinoServoMoveReservedIn">' +
                '<value name="SECS"><shadow type="math_number"><field name="NUM">1</field></shadow></value></block>',
        );
        expect(makeStuduinoPartBlocksXml(settings({ A0: 'led' }))).not.toContain('Reserve');
    });

    test('何も割り当てていなければ部品のブロックは出さない（ボタンだけのカテゴリ）', () => {
        expect(makeStuduinoPartBlocksXml(settings({}))).toBe('');
        const colors = { colourPrimary: '#000', colourTertiary: '#111' };
        expect(
            makeStuduinoCategoryXml({ name: 'a', buttonText: 'b', colors, blocksXml: '<block type="x"></block>' }),
        ).toContain('</button><block type="x"></block></category>');
    });
});
