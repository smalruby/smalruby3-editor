import {
    blockText,
    definitionJson,
    describeChanges,
    diffBlocks,
    stackBlocks,
} from '../../../src/lib/genai-block-diff.js';
import RubyToBlocksConverter from '../../../src/lib/ruby-to-blocks-converter';

// The real converter, without a VM: the blocks a program becomes.
const toBlocks = async (code) => {
    const converter = new RubyToBlocksConverter(null, { version: '2' });
    await converter.targetCodeToBlocks(null, code);
    return converter.blocks;
};

const opcodes = (blocks, entries) => entries.map((entry) => blocks[entry.id].opcode);

// Definitions written the way scratch-blocks writes them (messages in the editor language).
const define = (json) => ({
    init() {
        this.jsonInit(json);
    },
});
const definitions = {
    event_whenbroadcastreceived: define({
        message0: '%1 を受け取ったとき',
        args0: [{ type: 'field_variable', name: 'BROADCAST_OPTION' }],
    }),
    sound_play: define({ message0: '%1 の音を鳴らす', args0: [{ type: 'input_value', name: 'SOUND_MENU' }] }),
    sound_sounds_menu: define({
        message0: '%1',
        args0: [{ type: 'field_dropdown', name: 'SOUND_MENU', options: [] }],
    }),
    control_wait: define({ message0: '%1 秒待つ', args0: [{ type: 'input_value', name: 'DURATION' }] }),
    looks_say: define({ message0: '%1 と言う', args0: [{ type: 'input_value', name: 'MESSAGE' }] }),
    looks_seteffectto: define({
        message0: '%1 の効果を %2 にする',
        args0: [
            {
                type: 'field_dropdown',
                name: 'EFFECT',
                options: [
                    ['色', 'COLOR'],
                    ['幽霊', 'GHOST'],
                ],
            },
            { type: 'input_value', name: 'VALUE' },
        ],
    }),
    operator_add: define({
        message0: '%1 + %2',
        args0: [
            { type: 'input_value', name: 'NUM1' },
            { type: 'input_value', name: 'NUM2' },
        ],
    }),
    control_if: define({
        message0: 'もし %1 なら',
        message1: '%1',
        args0: [{ type: 'input_value', name: 'CONDITION' }],
        args1: [{ type: 'input_statement', name: 'SUBSTACK' }],
    }),
    control_wait_until: define({ message0: '%1 まで待つ', args0: [{ type: 'input_value', name: 'CONDITION' }] }),
    sensing_touchingobject: define({
        message0: '%1 に触れた',
        args0: [{ type: 'input_value', name: 'TOUCHINGOBJECTMENU' }],
    }),
    sensing_touchingobjectmenu: define({
        message0: '%1',
        args0: [
            {
                type: 'field_dropdown',
                name: 'TOUCHINGOBJECTMENU',
                options: () => [
                    ['マウスのポインター', '_mouse_'],
                    ['端', '_edge_'],
                ],
            },
        ],
    }),
    event_whenflagclicked: {
        init() {
            const workspace = this.workspace.options.parentWorkspace ?? this.workspace;
            this.jsonInit({
                message0: '%1 が押されたとき',
                args0: [{ type: 'field_image', src: `${workspace.options.pathToMedia}green-flag.svg` }],
            });
        },
    },
    broken: {
        init() {
            this.jsonInit({ message0: 'こわれた' });
            this.setColour('#fff');
        },
    },
};

describe('stackBlocks', () => {
    test('lists the blocks of each script from the top, also inside 「もし」, not the values', async () => {
        const blocks = await toBlocks('when_flag_clicked do\n  if 1 < 2\n    move(10)\n  end\n  sleep(1)\nend\n');
        expect(opcodes(blocks, stackBlocks(blocks))).toEqual([
            'event_whenflagclicked',
            'control_if',
            'motion_movesteps',
            'control_wait',
        ]);
    });

    test('tells two scripts with the same top block apart', async () => {
        const blocks = await toBlocks(
            'when_flag_clicked do\n  sleep(1)\nend\n\nwhen_flag_clicked do\n  sleep(1)\nend\n',
        );
        const scripts = new Set(stackBlocks(blocks).map((entry) => entry.script));
        expect(scripts.size).toBe(2);
    });
});

describe('diffBlocks', () => {
    test('「メッセージを受け取ったら音を鳴らす」: only the sound block is added', async () => {
        const before = await toBlocks('when_receive("メッセージ1") do\n  sleep(1)\nend\n');
        const after = await toBlocks('when_receive("メッセージ1") do\n  sleep(1)\n  play("Meow")\nend\n');
        const diff = diffBlocks(before, after);
        expect(opcodes(after, diff.added)).toEqual(['sound_play']);
        expect(diff.changed).toEqual([]);
        expect(diff.removed).toEqual([]);
        const hat = Object.values(after).find((block) => block.opcode === 'event_whenbroadcastreceived');
        expect(diff.added[0].top).toBe(hat.id);
    });

    test('a block of the same kind with other values is changed', async () => {
        const before = await toBlocks('when_flag_clicked do\n  sleep(1)\n  say("こんにちは")\nend\n');
        const after = await toBlocks('when_flag_clicked do\n  sleep(2)\n  say("こんにちは")\nend\n');
        const diff = diffBlocks(before, after);
        expect(diff.added).toEqual([]);
        expect(opcodes(after, diff.changed)).toEqual(['control_wait']);
        expect(before[diff.changed[0].beforeId].opcode).toBe('control_wait');
        expect(diff.removed).toEqual([]);
    });

    test('a block that only moved is not marked', async () => {
        const before = await toBlocks('when_flag_clicked do\n  sleep(1)\n  say("A")\nend\n');
        const after = await toBlocks('when_flag_clicked do\n  say("A")\n  sleep(1)\nend\n');
        expect(diffBlocks(before, after)).toEqual({ added: [], changed: [], removed: [] });
    });

    test('a block gone from the program is removed', async () => {
        const before = await toBlocks('when_flag_clicked do\n  sleep(1)\n  move(10)\nend\n');
        const after = await toBlocks('when_flag_clicked do\n  sleep(1)\nend\n');
        const diff = diffBlocks(before, after);
        expect(diff.added).toEqual([]);
        expect(diff.changed).toEqual([]);
        expect(opcodes(before, diff.removed)).toEqual(['motion_movesteps']);
    });

    test('a new script is added with all its blocks; an empty program adds everything', async () => {
        const after = await toBlocks('when_flag_clicked do\n  sleep(1)\nend\n');
        expect(opcodes(after, diffBlocks({}, after).added)).toEqual(['event_whenflagclicked', 'control_wait']);
    });

    test('the second of two same blocks is the added one', async () => {
        const before = await toBlocks('when_flag_clicked do\n  sleep(1)\nend\n');
        const after = await toBlocks('when_flag_clicked do\n  sleep(1)\n  sleep(1)\nend\n');
        const diff = diffBlocks(before, after);
        const waits = stackBlocks(after).filter((entry) => after[entry.id].opcode === 'control_wait');
        expect(diff.added.map((entry) => entry.id)).toEqual([waits[1].id]);
    });

    test('a changed value inside a block marks that block, not a new one', async () => {
        const before = await toBlocks('when_flag_clicked do\n  say(1 + 2)\nend\n');
        const after = await toBlocks('when_flag_clicked do\n  say(1 + 3)\nend\n');
        const diff = diffBlocks(before, after);
        expect(opcodes(after, diff.changed)).toEqual(['looks_say']);
        expect(diff.added).toEqual([]);
    });
});

describe('definitionJson', () => {
    test('takes what the definition gives to jsonInit, even if it then fails', () => {
        expect(definitionJson(definitions, 'broken')).toEqual({ message0: 'こわれた' });
    });

    test('is null for an unknown block or no definitions', () => {
        expect(definitionJson(definitions, 'nothing')).toBeNull();
        expect(definitionJson(null, 'sound_play')).toBeNull();
    });
});

describe('blockText', () => {
    test('says the block in its own words, with the values put in', async () => {
        const blocks = await toBlocks('when_receive("メッセージ1") do\n  play("Meow")\n  sleep(1)\nend\n');
        const textOf = (opcode) =>
            blockText(
                Object.values(blocks).find((block) => block.opcode === opcode),
                blocks,
                definitions,
            );
        expect(textOf('event_whenbroadcastreceived')).toBe('[メッセージ1] を受け取ったとき');
        expect(textOf('sound_play')).toBe('(Meow) の音を鳴らす');
        expect(textOf('control_wait')).toBe('(1) 秒待つ');
        const flag = await toBlocks('when_flag_clicked do\nend\n');
        expect(blockText(Object.values(flag)[0], flag, definitions)).toBe('🏁 が押されたとき');
    });

    test('puts a block put in a block in ( ) and shows the label of a menu', async () => {
        const blocks = await toBlocks('when_flag_clicked do\n  say(1 + 2)\n  set_effect("ghost", 50)\nend\n');
        const say = Object.values(blocks).find((block) => block.opcode === 'looks_say');
        expect(blockText(say, blocks, definitions)).toBe('((1) + (2)) と言う');
        const effect = Object.values(blocks).find((block) => block.opcode === 'looks_seteffectto');
        expect(blockText(effect, blocks, definitions)).toBe('[幽霊] の効果を (50) にする');
    });

    test('shows the label of a menu made when it opens', async () => {
        const blocks = await toBlocks('wait until touching?("_edge_")\n');
        const wait = Object.values(blocks).find((block) => block.opcode === 'control_wait_until');
        expect(blockText(wait, blocks, definitions)).toBe('((端) に触れた) まで待つ');
    });

    test('shows the value when a menu made when it opens fails', () => {
        const failing = {
            menu_x: define({
                message0: '%1',
                args0: [
                    {
                        type: 'field_dropdown',
                        name: 'X',
                        options() {
                            throw new Error('needs the block');
                        },
                    },
                ],
            }),
        };
        expect(blockText({ opcode: 'menu_x', fields: { X: { value: 'a' } }, inputs: {} }, {}, failing)).toBe('[a]');
    });

    test('leaves out the inside of 「もし」', async () => {
        const blocks = await toBlocks('if 1 < 2\n  move(10)\nend\n');
        const cond = Object.values(blocks).find((block) => block.opcode === 'control_if');
        expect(blockText(cond, blocks, definitions)).toBe('もし (operator_lt) なら');
    });

    test('falls back to the words of a block of the student’s own, then to the opcode', () => {
        const call = { opcode: 'procedures_call', mutation: { proccode: 'jump %s times' }, inputs: {}, fields: {} };
        expect(blockText(call, {}, definitions)).toBe('jump ( ) times');
        expect(blockText({ opcode: 'pen_clear', inputs: {}, fields: {} }, {}, definitions)).toBe('pen_clear');
    });
});

describe('describeChanges', () => {
    test('says what is added, changed and removed, and in which script', async () => {
        const before = await toBlocks('when_receive("メッセージ1") do\n  sleep(1)\n  say("A")\nend\n');
        const after = await toBlocks('when_receive("メッセージ1") do\n  sleep(2)\n  play("Meow")\nend\n');
        const changes = describeChanges(diffBlocks(before, after), before, after, definitions);
        expect(changes.map(({ id, ...rest }) => rest)).toEqual([
            {
                kind: 'added',
                text: '(Meow) の音を鳴らす',
                beforeText: null,
                scriptText: '[メッセージ1] を受け取ったとき',
            },
            {
                kind: 'changed',
                text: '(2) 秒待つ',
                beforeText: '(1) 秒待つ',
                scriptText: '[メッセージ1] を受け取ったとき',
            },
            { kind: 'removed', text: '(A) と言う', beforeText: null, scriptText: null },
        ]);
    });

    test('a new script has no script around its top block', async () => {
        const after = await toBlocks('when_receive("メッセージ1") do\nend\n');
        expect(describeChanges(diffBlocks({}, after), {}, after, definitions)[0].scriptText).toBeNull();
    });
});
