// チュートリアルの deck で、入れるプログラム（steps の code・deck の code）をブロックにしたとき使う
// 「変数」「ブロック定義」カテゴリのブロックが allowedBlocks に入っているか。
// 入っていないと、allowedBlocks による動的カテゴリの絞り込み（lesson-dynamic-categories.js）で
// そのカテゴリや中のブロックが消え、チュートリアルを進められなくなる。
// レッスンのチャレンジの確かめは test/unit/lib/lessons/challenge-dynamic-categories.test.js。
// このファイルは、チュートリアルを上流に戻すときに deck といっしょに消す。
import { allowedBlocksToIds, isDynamicCategoryAllowed } from '../../../../../src/lib/lesson-dynamic-categories';
import decks from '../../../../../src/lib/libraries/decks/index.jsx';
import { missingDynamicOpcodes } from '../../../../helpers/dynamic-category-opcodes';

const deckCases = Object.entries(decks)
    .filter(([, deck]) => deck.allowedBlocks)
    .map(([id, deck]) => [`deck ${id}`, deck]);

describe('deck allowedBlocks covers the variables / my blocks used by the code', () => {
    test('there are decks to check', () => {
        expect(deckCases.length).toBeGreaterThan(0);
    });

    test.each(deckCases)('%s', async (name, deck) => {
        expect(await missingDynamicOpcodes(deck)).toEqual([]);
    });
});

// 変数を使う deck（チャット・Ruby の基本 3）は、変数のカテゴリが消えないように data を書いている
test('decks that teach variables allow a variable block', () => {
    Object.entries(decks)
        .filter(([id]) => id.startsWith('chat-'))
        .forEach(([, deck]) => {
            expect(isDynamicCategoryAllowed('variables', allowedBlocksToIds(deck.allowedBlocks))).toBe(true);
        });
});
