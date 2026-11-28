// The green flag runs the Japanese program while the Japanese tab is open (Issue #2552).
import {
    japaneseScriptsToStart,
    shouldRunJapaneseOnGreenFlag,
} from '../../../../src/containers/ruby-tab/dncl-green-flag';
import { JAPANESE_TAB_INDEX, RUBY_TAB_INDEX } from '../../../../src/reducers/editor-tab';

describe('shouldRunJapaneseOnGreenFlag', () => {
    test('runs on the Japanese tab in the Japanese mode', () => {
        expect(shouldRunJapaneseOnGreenFlag({ dnclMode: true, activeTabIndex: JAPANESE_TAB_INDEX })).toBe(true);
    });

    test('does not run on the other tabs, even when the Japanese mode is kept', () => {
        expect(shouldRunJapaneseOnGreenFlag({ dnclMode: true, activeTabIndex: 0 })).toBe(false);
        expect(shouldRunJapaneseOnGreenFlag({ dnclMode: true, activeTabIndex: RUBY_TAB_INDEX })).toBe(false);
    });

    test('does not run when the editor shows Ruby', () => {
        expect(shouldRunJapaneseOnGreenFlag({ dnclMode: false, activeTabIndex: JAPANESE_TAB_INDEX })).toBe(false);
    });
});

describe('japaneseScriptsToStart', () => {
    const makeBlocks = (opcodes) => ({
        getScripts: () => Object.keys(opcodes),
        getBlock: (id) => ({ id, opcode: opcodes[id] }),
        getOpcode: (block) => block.opcode,
    });
    const makeRuntime = (runningTopBlocks = []) => ({
        getIsHat: (opcode) => opcode === 'event_whenflagclicked' || opcode === 'event_whenkeypressed',
        threads: runningTopBlocks.map((topBlock) => ({ topBlock, status: 0 })),
    });

    test('starts the scripts without a hat, in the written order', () => {
        const blocks = makeBlocks({ a: 'data_setvariableto', b: 'control_repeat' });
        expect(japaneseScriptsToStart(blocks, makeRuntime())).toEqual(['a', 'b']);
    });

    test('leaves the hat scripts to the green flag itself', () => {
        const blocks = makeBlocks({ a: 'data_setvariableto', f: 'event_whenflagclicked', k: 'event_whenkeypressed' });
        expect(japaneseScriptsToStart(blocks, makeRuntime())).toEqual(['a']);
    });

    test('does not stop a script that is already running', () => {
        const blocks = makeBlocks({ a: 'data_setvariableto', b: 'control_repeat' });
        expect(japaneseScriptsToStart(blocks, makeRuntime(['b']))).toEqual(['a']);
    });

    test('starts a script again when its thread is done', () => {
        const blocks = makeBlocks({ a: 'data_setvariableto' });
        const runtime = makeRuntime();
        runtime.threads = [{ topBlock: 'a', status: 4 }];
        expect(japaneseScriptsToStart(blocks, runtime)).toEqual(['a']);
    });
});
