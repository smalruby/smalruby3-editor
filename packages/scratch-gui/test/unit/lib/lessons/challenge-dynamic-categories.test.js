// レッスンのチャレンジで、入れるプログラム（code・spriteCodes・ヒントのブロック）をブロックにしたとき使う
// 「変数」「ブロック定義」カテゴリのブロックが allowedBlocks に入っているか。
// 入っていないと、allowedBlocks による動的カテゴリの絞り込み（lesson-dynamic-categories.js）で
// そのカテゴリや中のブロックが消え、チャレンジを進められなくなる。
// チュートリアルの deck の確かめ（deck-dynamic-categories.test.js）とは分けてある。チュートリアルを
// 上流に戻して deck のテストを消しても、こちらは残す。
import { COURSES } from '../../../../src/lib/lessons/courses';
import { missingDynamicOpcodes } from '../../../helpers/dynamic-category-opcodes';

const challengeCases = [];
Object.values(COURSES || {}).forEach((course) =>
    (course.lessons || []).forEach((lesson) =>
        (lesson.challenges || []).forEach((challenge) => {
            if (challenge.allowedBlocks) challengeCases.push([`challenge ${challenge.id}`, challenge]);
        }),
    ),
);

describe('challenge allowedBlocks covers the variables / my blocks used by the code', () => {
    test('there are challenges to check', () => {
        expect(challengeCases.length).toBeGreaterThan(0);
    });

    test.each(challengeCases)('%s', async (name, challenge) => {
        expect(await missingDynamicOpcodes(challenge)).toEqual([]);
    });
});
