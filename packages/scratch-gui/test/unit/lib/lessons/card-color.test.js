/**
 * レッスン表のカードの色の決め方（docs/lessons/design.md の「カード」）を守る。
 * 各チャレンジの「プログラムを入れる」のできあがり（`code` と `spriteCodes`、ja）を本物の変換で
 * ブロックにして数え、定義の `card.category` がいちばん多いなかま（同数ならメイン）かを確かめる。
 * チャレンジを足したり中身を変えたりして決め方から外れたら、ここが落ちる。
 */
import { blockCategoryOf, cardCategoryFor, countBlockCategories } from '../../../../src/lib/lessons/card-color';
import { CATEGORIES, COURSES, challengeCodeFor } from '../../../../src/lib/lessons/courses';
import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';

const allChallenges = () => COURSES.flatMap((course) => course.lessons.flatMap((lesson) => lesson.challenges));

// できあがりのプログラム（ほかのスプライトの分も）のブロック
const blocksOfChallenge = async (challenge) => {
    const { code, spriteCodes } = challengeCodeFor(challenge, 'ja');
    const codes = [code, ...spriteCodes.map((s) => s.code)].filter(Boolean);
    const blocks = [];
    for (const source of codes) {
        const converter = new RubyToBlocksConverter(null, { version: '2' });
        const ok = await converter.targetCodeToBlocks(null, source);
        expect({ id: challenge.id, ok, errors: converter.errors }).toEqual({ id: challenge.id, ok: true, errors: [] });
        blocks.push(...Object.values(converter.blocks));
    }
    return blocks;
};

describe('blockCategoryOf', () => {
    test('maps the opcode prefix to the block family', () => {
        expect(blockCategoryOf('motion_changeyby')).toBe(CATEGORIES.MOTION);
        expect(blockCategoryOf('looks_say')).toBe(CATEGORIES.LOOKS);
        expect(blockCategoryOf('sound_play')).toBe(CATEGORIES.SOUND);
        expect(blockCategoryOf('event_whenflagclicked')).toBe(CATEGORIES.EVENTS);
        expect(blockCategoryOf('control_repeat')).toBe(CATEGORIES.CONTROL);
        expect(blockCategoryOf('sensing_answer')).toBe(CATEGORIES.SENSING);
        expect(blockCategoryOf('operator_join')).toBe(CATEGORIES.OPERATORS);
        expect(blockCategoryOf('data_setvariableto')).toBe(CATEGORIES.VARIABLES);
        expect(blockCategoryOf('data_variable')).toBe(CATEGORIES.VARIABLES);
        expect(blockCategoryOf('data_addtolist')).toBe(CATEGORIES.LISTS);
        expect(blockCategoryOf('data_deletealloflist')).toBe(CATEGORIES.LISTS);
        expect(blockCategoryOf('text2speech_speakAndWait')).toBe(CATEGORIES.EXTENSIONS);
    });
});

describe('countBlockCategories', () => {
    test('counts the blocks with a shape and skips the shadows', () => {
        const blocks = [
            { opcode: 'event_whenkeypressed', shadow: false },
            { opcode: 'sound_playuntildone', shadow: false },
            { opcode: 'sound_sounds_menu', shadow: true },
            { opcode: 'sound_play', shadow: false },
        ];
        expect(countBlockCategories(blocks)).toEqual({ events: 1, sound: 2 });
    });
});

describe('cardCategoryFor', () => {
    test('is the family with the most blocks', () => {
        expect(cardCategoryFor({ sound: 2, events: 1 }, 'events')).toBe('sound');
    });

    test('is the main family when the most are tied and the main is one of them', () => {
        expect(cardCategoryFor({ motion: 2, events: 2 }, 'motion')).toBe('motion');
    });

    test('is null (undecided) when the most are tied without the main', () => {
        expect(cardCategoryFor({ looks: 2, sensing: 2, events: 1 }, 'events')).toBeNull();
    });

    test('is the main family when there are no blocks', () => {
        expect(cardCategoryFor({}, 'looks')).toBe('looks');
    });
});

describe('the card colors of the courses', () => {
    test('every challenge has a card with a known category and main', () => {
        const known = Object.values(CATEGORIES);
        allChallenges().forEach((challenge) => {
            expect(known).toContain(challenge.card.category);
            expect(known).toContain(challenge.card.main);
        });
    });

    test.each(allChallenges().map((c) => [c.id, c]))(
        '%s: the card color is the family with the most blocks of the finished program (main on a tie)',
        async (id, challenge) => {
            const counts = countBlockCategories(await blocksOfChallenge(challenge));
            expect({ id, counts, category: cardCategoryFor(counts, challenge.card.main) }).toEqual({
                id,
                counts,
                category: challenge.card.category,
            });
        },
    );

    // Issue #1543 の表（数えた結果）。決め方を変えずにチャレンジの中身が変わったら、ここも見直す
    test('the 11 cards of the first course have the colors of the table', () => {
        expect(
            Object.fromEntries(COURSES[0].lessons.flatMap((l) => l.challenges).map((c) => [c.id, c.card.category])),
        ).toEqual({
            'blocks-l1-key-sound': 'sound',
            'blocks-l1-arrow-move': 'motion',
            'blocks-l1-click-say': 'looks',
            'blocks-l1-repeat': 'control',
            'blocks-l1-if': 'control',
            'blocks-l1-ask-answer': 'sensing',
            'blocks-l1-quiz': 'sensing',
            'blocks-l1-count': 'variables',
            'blocks-l1-broadcast': 'events',
            'blocks-l1-speak': 'extensions',
            'blocks-l1-message-list': 'lists',
        });
    });
});
