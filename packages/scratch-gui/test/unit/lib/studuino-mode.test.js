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
});
