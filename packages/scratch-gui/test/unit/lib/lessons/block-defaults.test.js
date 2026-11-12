import { allowedBlocksToIds } from '../../../../src/lib/lesson-dynamic-categories';
import {
    allowedBlockDefaults,
    allowedBlockOpcode,
    applyBlockDefaultsToElements,
    applyBlockDefaultsToToolboxXml,
} from '../../../../src/lib/lessons/block-defaults';
import { COURSES, findChallenge } from '../../../../src/lib/lessons/courses';
import makeToolboxXML from '../../../../src/lib/make-toolbox-xml';

const toolbox = (isStage = false) =>
    makeToolboxXML(
        false,
        isStage,
        'sprite',
        [],
        'costume1',
        'backdrop1',
        'Meow',
        undefined,
        null,
        false,
        false,
        null,
    );

const parse = (xml) => new DOMParser().parseFromString(xml, 'text/xml');

/** toolbox の XML で、カテゴリ直下の type のブロックを返す。 */
const blockOf = (xml, type) => parse(xml).querySelector(`category > block[type="${type}"]`);
const fieldOf = (block, name) =>
    Array.from(block.children).find((c) => c.tagName === 'field' && c.getAttribute('name') === name);
const inputFieldOf = (block, name) => {
    const value = Array.from(block.children).find((c) => c.tagName === 'value' && c.getAttribute('name') === name);
    return value.querySelector('shadow > field');
};

describe('lessons/block-defaults', () => {
    describe('allowedBlockOpcode', () => {
        test('takes the opcode of a string or an object entry', () => {
            expect(allowedBlockOpcode('looks_say')).toBe('looks_say');
            expect(allowedBlockOpcode({ opcode: 'control_repeat', inputs: { TIMES: 3 } })).toBe('control_repeat');
            expect(allowedBlockOpcode(null)).toBeNull();
        });
        test('allowedBlocksToIds flattens object entries to opcodes', () => {
            expect(
                allowedBlocksToIds({
                    event: [{ opcode: 'event_whenkeypressed', fields: { KEY_OPTION: '1' } }],
                    control: ['control_wait'],
                }),
            ).toEqual(['event_whenkeypressed', 'control_wait']);
        });
    });

    describe('allowedBlockDefaults', () => {
        test('returns null without any initial value', () => {
            expect(allowedBlockDefaults(null, 'ja')).toBeNull();
            expect(allowedBlockDefaults({ looks: ['looks_say'] }, 'ja')).toBeNull();
        });
        test('collects the initial values by opcode, resolving the locale', () => {
            const defaults = allowedBlockDefaults(
                {
                    event: [{ opcode: 'event_whenkeypressed', fields: { KEY_OPTION: '1' } }],
                    looks: [
                        { opcode: 'looks_say', inputs: { MESSAGE: { ja: 'くすぐったい！', en: 'That tickles!' } } },
                    ],
                    control: [{ opcode: 'control_repeat', inputs: { TIMES: 3 } }],
                },
                'en',
            );
            expect(defaults).toEqual({
                event_whenkeypressed: { fields: { KEY_OPTION: '1' }, inputs: {} },
                looks_say: { fields: {}, inputs: { MESSAGE: 'That tickles!' } },
                control_repeat: { fields: {}, inputs: { TIMES: '3' } },
            });
        });
        test('falls back to en, then ja, for a locale that is not given', () => {
            const allowed = { looks: [{ opcode: 'looks_say', inputs: { MESSAGE: { ja: 'やあ！' } } }] };
            expect(allowedBlockDefaults(allowed, 'ja-Hira').looks_say.inputs.MESSAGE).toBe('やあ！');
        });
    });

    describe('applyBlockDefaultsToToolboxXml', () => {
        test('keeps the xml as it is without defaults', () => {
            const xml = toolbox();
            expect(applyBlockDefaultsToToolboxXml(xml, null)).toBe(xml);
        });
        test('adds a field the toolbox does not write (the key of "when key pressed")', () => {
            const xml = applyBlockDefaultsToToolboxXml(toolbox(), {
                event_whenkeypressed: { fields: { KEY_OPTION: '1' }, inputs: {} },
            });
            expect(fieldOf(blockOf(xml, 'event_whenkeypressed'), 'KEY_OPTION').textContent).toBe('1');
        });
        test('sets a field that is there', () => {
            const before = toolbox();
            const xml = applyBlockDefaultsToToolboxXml(
                before.replace(
                    '<block type="event_whenkeypressed">',
                    '<block type="event_whenkeypressed"><field name="KEY_OPTION">space</field>',
                ),
                { event_whenkeypressed: { fields: { KEY_OPTION: 'up arrow' }, inputs: {} } },
            );
            const block = blockOf(xml, 'event_whenkeypressed');
            expect(block.querySelectorAll('field')).toHaveLength(1);
            expect(fieldOf(block, 'KEY_OPTION').textContent).toBe('up arrow');
        });
        test('sets the shadow of an input (numbers, text and menus)', () => {
            const xml = applyBlockDefaultsToToolboxXml(toolbox(), {
                control_repeat: { fields: {}, inputs: { TIMES: '3' } },
                operator_equals: { fields: {}, inputs: { OPERAND2: '7' } },
                looks_sayforsecs: { fields: {}, inputs: { MESSAGE: 'やあ！' } },
                sound_play: { fields: {}, inputs: { SOUND_MENU: 'ニャー' } },
            });
            expect(inputFieldOf(blockOf(xml, 'control_repeat'), 'TIMES').textContent).toBe('3');
            expect(inputFieldOf(blockOf(xml, 'operator_equals'), 'OPERAND2').textContent).toBe('7');
            expect(inputFieldOf(blockOf(xml, 'operator_equals'), 'OPERAND1').textContent).toBe('');
            expect(inputFieldOf(blockOf(xml, 'looks_sayforsecs'), 'MESSAGE').textContent).toBe('やあ！');
            expect(inputFieldOf(blockOf(xml, 'looks_sayforsecs'), 'SECS').textContent).toBe('2');
            expect(inputFieldOf(blockOf(xml, 'sound_play'), 'SOUND_MENU').textContent).toBe('ニャー');
            // ほかのブロックはそのまま
            expect(inputFieldOf(blockOf(xml, 'sound_playuntildone'), 'SOUND_MENU').textContent).toBe('Meow');
        });
        test('sets the blocks of an extension category too', () => {
            const ext =
                '<category name="Text to Speech" id="text2speech"><block type="text2speech_speakAndWait">' +
                '<value name="WORDS"><shadow type="text"><field name="TEXT">hello</field></shadow></value></block></category>';
            const base = makeToolboxXML(false, false, 'sprite', [{ id: 'text2speech', xml: ext }], 'c', 'b', 's');
            const xml = applyBlockDefaultsToToolboxXml(base, {
                text2speech_speakAndWait: { fields: {}, inputs: { WORDS: 'ボタンが押されました' } },
            });
            expect(inputFieldOf(blockOf(xml, 'text2speech_speakAndWait'), 'WORDS').textContent).toBe(
                'ボタンが押されました',
            );
        });
        test('ignores an input without a shadow, and keeps the xml when it cannot be read', () => {
            const xml = applyBlockDefaultsToToolboxXml(toolbox(), {
                control_if: { fields: {}, inputs: { CONDITION: 'x' } },
            });
            expect(blockOf(xml, 'control_if').children).toHaveLength(0);
            expect(
                applyBlockDefaultsToToolboxXml('<xml><category>', { control_if: { fields: {}, inputs: {} } }),
            ).toBe('<xml><category>');
        });
    });

    describe('applyBlockDefaultsToElements', () => {
        test('sets the blocks of a dynamic category flyout', () => {
            const block = new DOMParser().parseFromString(
                '<block type="data_setvariableto"><field name="VARIABLE">v</field>' +
                    '<value name="VALUE"><shadow type="text"><field name="TEXT">0</field></shadow></value></block>',
                'text/xml',
            ).documentElement;
            const list = [block];
            expect(
                applyBlockDefaultsToElements(list, { data_setvariableto: { fields: {}, inputs: { VALUE: '5' } } }),
            ).toBe(list);
            expect(block.querySelector('shadow > field').textContent).toBe('5');
            expect(applyBlockDefaultsToElements(list, null)).toBe(list);
        });
    });

    // レッスン 1 の仕様（#1473〜#1475 の「パレット」の表記）の初期値
    describe('lesson 1 palettes', () => {
        const defaultsOf = (id, locale = 'ja') =>
            allowedBlockDefaults(findChallenge(id).challenge.allowedBlocks, locale);
        test.each([
            [
                'blocks-l1-key-sound',
                'ja',
                { sound_playuntildone: { SOUND_MENU: 'ニャー' }, sound_play: { SOUND_MENU: 'ニャー' } },
            ],
            ['blocks-l1-key-sound', 'ja-Hira', { sound_play: { SOUND_MENU: 'Meow' } }],
            ['blocks-l1-key-sound', 'en', { sound_play: { SOUND_MENU: 'Meow' } }],
            [
                'blocks-l1-repeat',
                'ja',
                { control_repeat: { TIMES: '3' }, looks_switchbackdropto: { BACKDROP: 'Canyon' } },
            ],
            ['blocks-l1-if', 'ja', { looks_say: { MESSAGE: 'くすぐったい！' } }],
            ['blocks-l1-if', 'en', { looks_say: { MESSAGE: 'That tickles!' } }],
            ['blocks-l1-ask-answer', 'ja', { sensing_askandwait: { QUESTION: 'なまえは？' } }],
            ['blocks-l1-ask-answer', 'en', { sensing_askandwait: { QUESTION: "What's your name?" } }],
            [
                'blocks-l1-quiz',
                'ja',
                {
                    sensing_askandwait: { QUESTION: '4+3=?' },
                    operator_equals: { OPERAND2: '7' },
                    looks_sayforsecs: { MESSAGE: '正解です' },
                },
            ],
            ['blocks-l1-quiz', 'ja-Hira', { looks_sayforsecs: { MESSAGE: 'せいかいです' } }],
            ['blocks-l1-quiz', 'en', { looks_sayforsecs: { MESSAGE: 'Correct' } }],
            ['blocks-l1-broadcast', 'ja', { looks_sayforsecs: { MESSAGE: 'やあ！' } }],
            ['blocks-l1-speak', 'ja', { text2speech_speakAndWait: { WORDS: 'ボタンが押されました' } }],
            ['blocks-l1-speak', 'ja-Hira', { text2speech_speakAndWait: { WORDS: 'ボタンがおされました' } }],
            ['blocks-l1-speak', 'en', { text2speech_speakAndWait: { WORDS: 'The button was clicked' } }],
            ['blocks-l1-message-list', 'ja', { sensing_askandwait: { QUESTION: 'メッセージは？' } }],
            // ツールボックスの初期値は半角の「こんにちは!」なので、仕様の全角「こんにちは！」を書く
            ['blocks-l1-click-say', 'ja', { looks_sayforsecs: { MESSAGE: 'こんにちは！' } }],
            ['blocks-l1-click-say', 'ja-Hira', { looks_sayforsecs: { MESSAGE: 'こんにちは！' } }],
            ['blocks-l1-click-say', 'en', { looks_sayforsecs: { MESSAGE: 'Hello!' } }],
            ['blocks-l1-ask-answer', 'ja', { looks_sayforsecs: { MESSAGE: 'こんにちは！' } }],
            ['blocks-l1-count', 'ja', { looks_say: { MESSAGE: 'こんにちは！' } }],
        ])('%s (%s) has the initial values of the spec', (id, locale, expected) => {
            const defaults = defaultsOf(id, locale);
            Object.entries(expected).forEach(([opcode, inputs]) => {
                expect(defaults[opcode].inputs).toEqual(expect.objectContaining(inputs));
            });
        });
        test.each([
            ['blocks-l1-key-sound', 'space'],
            ['blocks-l1-arrow-move', 'up arrow'],
            ['blocks-l1-repeat', '1'],
        ])('%s starts "when key pressed" with the key %s', (id, key) => {
            expect(defaultsOf(id).event_whenkeypressed.fields.KEY_OPTION).toBe(key);
        });
        test('every entry of allowedBlocks has an opcode and only known keys', () => {
            COURSES.forEach((course) =>
                course.lessons.forEach((lesson) =>
                    lesson.challenges.forEach((challenge) => {
                        Object.values(challenge.allowedBlocks || {}).forEach((entries) =>
                            entries.forEach((entry) => {
                                expect(typeof allowedBlockOpcode(entry)).toBe('string');
                                if (typeof entry === 'object') {
                                    Object.keys(entry).forEach((key) =>
                                        expect(['opcode', 'fields', 'inputs']).toContain(key),
                                    );
                                }
                            }),
                        );
                    }),
                ),
            );
        });
    });
});
