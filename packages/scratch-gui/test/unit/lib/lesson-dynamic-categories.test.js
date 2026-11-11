import {
    allowedBlocksToIds,
    filterDynamicCategoryXmlList,
    isDynamicCategoryAllowed,
} from '../../../src/lib/lesson-dynamic-categories';
import { findChallenge } from '../../../src/lib/lessons/courses';
import decks from '../../../src/lib/libraries/decks/index.jsx';
import makeToolboxXML from '../../../src/lib/make-toolbox-xml';

const el = (tag, attrs = {}) => {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    return e;
};

// getVariablesCategory が返す形（変数 1 つ・リスト 1 つがあるとき）
const variablesFlyout = () => [
    el('button', { text: '変数を作る', callbackKey: 'CREATE_VARIABLE' }),
    el('block', { type: 'data_variable' }),
    el('block', { type: 'data_setvariableto' }),
    el('block', { type: 'data_changevariableby' }),
    el('block', { type: 'data_showvariable' }),
    el('block', { type: 'data_hidevariable' }),
    el('button', { text: 'リストを作る', callbackKey: 'CREATE_LIST' }),
    el('block', { type: 'data_listcontents' }),
    el('block', { type: 'data_addtolist' }),
    el('sep'),
    el('block', { type: 'data_deleteoflist' }),
    el('block', { type: 'data_deletealloflist' }),
    el('sep'),
    el('block', { type: 'data_itemoflist' }),
    el('sep'),
    el('block', { type: 'data_showlist' }),
];

const describeList = (list) =>
    list.map((e) =>
        e.tagName.toLowerCase() === 'block'
            ? e.getAttribute('type')
            : e.getAttribute('callbackKey') || e.tagName.toLowerCase(),
    );

const toolbox = (ids) =>
    makeToolboxXML(
        false,
        false,
        'sprite',
        [],
        'c',
        'b',
        's',
        undefined,
        ids ? ids.join(',') : null,
        !!ids,
        false,
        ids,
    );

describe('lesson-dynamic-categories', () => {
    describe('allowedBlocksToIds', () => {
        test('flattens the categories of allowedBlocks', () => {
            expect(allowedBlocksToIds({ looks: ['looks_say'], data: ['data_variable'], sound: [] })).toEqual([
                'looks_say',
                'data_variable',
            ]);
        });
        test('returns null without allowedBlocks', () => {
            expect(allowedBlocksToIds(null)).toBeNull();
        });
    });

    describe('isDynamicCategoryAllowed', () => {
        test('shows both categories when the palette is not narrowed', () => {
            expect(isDynamicCategoryAllowed('variables', null)).toBe(true);
            expect(isDynamicCategoryAllowed('myBlocks', null)).toBe(true);
        });
        test('hides both categories when allowedBlocks has none of their blocks', () => {
            const ids = ['event_whenflagclicked', 'control_repeat'];
            expect(isDynamicCategoryAllowed('variables', ids)).toBe(false);
            expect(isDynamicCategoryAllowed('myBlocks', ids)).toBe(false);
        });
        test('shows Variables for a variable block and for a list block', () => {
            expect(isDynamicCategoryAllowed('variables', ['data_setvariableto'])).toBe(true);
            expect(isDynamicCategoryAllowed('variables', ['data_addtolist'])).toBe(true);
            expect(isDynamicCategoryAllowed('myBlocks', ['data_addtolist'])).toBe(false);
        });
        test('shows My Blocks for a procedures block', () => {
            expect(isDynamicCategoryAllowed('myBlocks', ['procedures_definition'])).toBe(true);
        });
    });

    describe('filterDynamicCategoryXmlList', () => {
        test('keeps everything when the palette is not narrowed', () => {
            const list = variablesFlyout();
            expect(filterDynamicCategoryXmlList(list, null)).toBe(list);
        });
        test('keeps the make-a-variable button and only the allowed variable blocks', () => {
            const ids = ['data_setvariableto', 'data_changevariableby', 'data_variable'];
            expect(describeList(filterDynamicCategoryXmlList(variablesFlyout(), ids))).toEqual([
                'CREATE_VARIABLE',
                'data_variable',
                'data_setvariableto',
                'data_changevariableby',
            ]);
        });
        test('keeps the make-a-list button and drops dangling separators', () => {
            const ids = ['data_deletealloflist', 'data_addtolist'];
            expect(describeList(filterDynamicCategoryXmlList(variablesFlyout(), ids))).toEqual([
                'CREATE_LIST',
                'data_addtolist',
                'sep',
                'data_deletealloflist',
            ]);
        });
        test('filters the My Blocks flyout', () => {
            const list = [
                el('button', { callbackKey: 'CREATE_PROCEDURE' }),
                el('block', { type: 'procedures_call' }),
            ];
            expect(describeList(filterDynamicCategoryXmlList(list, ['procedures_definition']))).toEqual([
                'CREATE_PROCEDURE',
            ]);
        });
    });

    describe('makeToolboxXML', () => {
        test('includes Variables and My Blocks without allowedBlocks', () => {
            const xml = toolbox(null);
            expect(xml).toContain('custom="VARIABLE"');
            expect(xml).toContain('custom="PROCEDURE"');
        });
        test('drops Variables and My Blocks when allowedBlocks has none of their blocks', () => {
            const xml = toolbox(['event_whenthisspriteclicked', 'looks_sayforsecs', 'control_repeat']);
            expect(xml).not.toContain('custom="VARIABLE"');
            expect(xml).not.toContain('custom="PROCEDURE"');
            expect(xml).toContain('control_repeat');
        });
        test('keeps Variables (only) when allowedBlocks has a variable block', () => {
            const xml = toolbox(['event_whenflagclicked', 'data_setvariableto']);
            expect(xml).toContain('custom="VARIABLE"');
            expect(xml).not.toContain('custom="PROCEDURE"');
        });
        test('keeps the old only_blocks behaviour (always shown) when no ids are passed', () => {
            const xml = makeToolboxXML(false, false, 'sprite', [], 'c', 'b', 's', undefined, 'looks_say', true);
            expect(xml).toContain('custom="VARIABLE"');
            expect(xml).toContain('custom="PROCEDURE"');
        });
    });

    describe('existing decks and challenges', () => {
        // 変数を使う deck（チャット・Ruby の基本 3）は、変数のカテゴリが消えないように data を書いている
        test('decks that teach variables allow a variable block', () => {
            Object.entries(decks)
                .filter(([id]) => id.startsWith('chat-'))
                .forEach(([, deck]) => {
                    expect(isDynamicCategoryAllowed('variables', allowedBlocksToIds(deck.allowedBlocks))).toBe(true);
                });
        });
        test('lesson challenges that use variables or lists show the Variables category', () => {
            const { challenge: count } = findChallenge('blocks-l1-count');
            const { challenge: list } = findChallenge('blocks-l1-message-list');
            const { challenge: say } = findChallenge('blocks-l1-ask-answer');
            expect(isDynamicCategoryAllowed('variables', allowedBlocksToIds(count.allowedBlocks))).toBe(true);
            expect(isDynamicCategoryAllowed('variables', allowedBlocksToIds(list.allowedBlocks))).toBe(true);
            expect(isDynamicCategoryAllowed('variables', allowedBlocksToIds(say.allowedBlocks))).toBe(false);
        });
    });
});
