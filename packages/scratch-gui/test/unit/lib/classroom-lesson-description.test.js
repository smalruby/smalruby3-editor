/* eslint-env jest */
/**
 * レッスンの説明文（#1780）: 課題のページに入れる文と、いつ入れる・いつ聞くか。
 */
import { MAX_ASSIGNMENT_PAGE_TEXT_LENGTH } from '../../../src/lib/classroom-assignment-utils.js';
import {
    autoDescriptionPages,
    buildLessonDescription,
    descriptionLocale,
    firstLessonDraft,
    overwriteDescriptionPages,
    pagesAreEmpty,
    shouldAskOverwrite,
} from '../../../src/lib/classroom-lesson-description.js';
import { COURSES, findCourse } from '../../../src/lib/lessons/courses.js';

const course = findCourse('kyou-kara-programmer');

// 6 つ選んで ★ 2、条件は 4 つ
const draft = {
    courseId: 'kyou-kara-programmer',
    challengeIds: [
        'blocks-l1-key-sound',
        'blocks-l1-arrow-move',
        'blocks-l1-click-say',
        'blocks-l1-repeat',
        'blocks-l1-if',
        'blocks-l1-ask-answer',
    ],
    requiredChallengeIds: ['blocks-l1-key-sound', 'blocks-l1-repeat'],
    completion: { type: 'count', count: 4 },
    submitWork: false,
    scoring: null,
};

describe('descriptionLocale', () => {
    test('ja-Hira, ja and the rest (en)', () => {
        expect(descriptionLocale('ja-Hira')).toBe('ja-Hira');
        expect(descriptionLocale('ja')).toBe('ja');
        expect(descriptionLocale('en')).toBe('en');
        expect(descriptionLocale('zh-cn')).toBe('en');
        expect(descriptionLocale(undefined)).toBe('en');
    });
});

describe('buildLessonDescription', () => {
    test('ja: course name, what it teaches, condition, ★, free order', () => {
        const text = buildLessonDescription({ course, draft, locale: 'ja' });
        expect(text).toBe(
            [
                '「きょうからプログラマー」のレッスンにチャレンジしよう！',
                'キーやクリックでネコを動かしたり、音を鳴らしたり、質問したりしながら、くり返し・もし〜なら・変数・メッセージ・リストといったプログラムの基本を学べるよ。',
                '',
                '・チャレンジは 6 つ。そのうち 4 つできたら課題クリア！',
                '・★ のついたチャレンジ 2 つは、かならずやろう。',
                '・やる順番は自由！ 好きなチャレンジからはじめよう。',
            ].join('\n'),
        );
    });

    test('ja: submitting work adds the last line', () => {
        const text = buildLessonDescription({ course, draft: { ...draft, submitWork: true }, locale: 'ja' });
        expect(text.split('\n').pop()).toBe('・おわったら、学んだことをつかって作品をつくって提出しよう。');
    });

    test('ja: "all" and no ★', () => {
        const text = buildLessonDescription({
            course,
            draft: { ...draft, requiredChallengeIds: [], completion: { type: 'all', count: null } },
            locale: 'ja',
        });
        expect(text).toContain('・チャレンジは 6 つ。全部できたら課題クリア！');
        expect(text).not.toContain('★');
    });

    test('a count equal to the number of challenges reads as "all"', () => {
        const text = buildLessonDescription({
            course,
            draft: { ...draft, completion: { type: 'count', count: 6 } },
            locale: 'ja',
        });
        expect(text).toContain('全部できたら課題クリア！');
    });

    test('ja-Hira is written in hiragana', () => {
        const text = buildLessonDescription({ course, draft: { ...draft, submitWork: true }, locale: 'ja-Hira' });
        expect(text).toContain('「きょうからプログラマー」の レッスンに チャレンジしよう！');
        expect(text).toContain('・チャレンジは 6 つ。そのうち 4 つ できたら かだいクリア！');
        expect(text).toContain('・★ の ついた チャレンジ 2 つは、かならず やろう。');
        expect(text).toContain('・やる じゅんばんは じゆう！');
        expect(text).toContain('さくひんを つくって ていしゅつしよう。');
        // 漢字を使わない
        expect(text).not.toMatch(/[一-龯]/);
    });

    test('en, with singular forms', () => {
        const text = buildLessonDescription({ course, draft: { ...draft, submitWork: true }, locale: 'en' });
        expect(text).toContain('Let\'s try the "Programmer from Today" lesson!');
        expect(text).toContain('There are 6 challenges. Finish 4 of them to clear the assignment!');
        expect(text).toContain('Be sure to do the 2 challenges marked ★.');
        expect(text).toContain('You can do them in any order.');
        expect(text).toContain('make a project and submit it');
        const one = buildLessonDescription({
            course,
            draft: {
                ...draft,
                challengeIds: ['blocks-l1-if'],
                requiredChallengeIds: ['blocks-l1-if'],
                completion: { type: 'all', count: null },
            },
            locale: 'en',
        });
        expect(one).toContain('There is 1 challenge. Finish it to clear the assignment!');
        expect(one).toContain('Be sure to do the challenge marked ★.');
    });

    test('nothing to describe without a course or a challenge', () => {
        expect(buildLessonDescription({ course, draft: null, locale: 'ja' })).toBe('');
        expect(buildLessonDescription({ course: null, draft, locale: 'ja' })).toBe('');
        expect(buildLessonDescription({ course, draft: { ...draft, challengeIds: [] }, locale: 'ja' })).toBe('');
    });

    test('fits in one page in every locale, even with everything chosen', () => {
        COURSES.forEach((c) => {
            const all = c.lessons.flatMap((l) => l.challenges.map((ch) => ch.id));
            const full = {
                ...draft,
                courseId: c.id,
                challengeIds: all,
                requiredChallengeIds: all,
                submitWork: true,
            };
            ['ja', 'ja-Hira', 'en'].forEach((locale) => {
                const text = buildLessonDescription({ course: c, draft: full, locale });
                expect(text.length).toBeGreaterThan(0);
                expect(text.length).toBeLessThanOrEqual(MAX_ASSIGNMENT_PAGE_TEXT_LENGTH);
            });
        });
    });
});

describe('pagesAreEmpty', () => {
    test('empty when no page has text (an image alone does not count)', () => {
        expect(pagesAreEmpty([])).toBe(true);
        expect(pagesAreEmpty([{ text: '' }])).toBe(true);
        expect(pagesAreEmpty([{ text: '  \n' }, { text: '' }])).toBe(true);
        expect(pagesAreEmpty([{ text: '', imageKey: 'k' }])).toBe(true);
        expect(pagesAreEmpty([{ text: '' }, { text: 'a' }])).toBe(false);
    });
});

describe('autoDescriptionPages', () => {
    test('fills the first page when the pages are empty', () => {
        expect(autoDescriptionPages([{ text: '' }], '', 'new')).toEqual([{ text: 'new' }]);
        expect(autoDescriptionPages([], '', 'new')).toEqual([{ text: 'new' }]);
        // keeps the image and the other pages
        expect(autoDescriptionPages([{ text: '', imageKey: 'k' }, { text: '' }], '', 'new')).toEqual([
            { text: 'new', imageKey: 'k' },
            { text: '' },
        ]);
    });

    test('follows the lesson while the first page is still the generated text', () => {
        expect(autoDescriptionPages([{ text: 'old' }, { text: 'p2' }], 'old', 'new')).toEqual([
            { text: 'new' },
            { text: 'p2' },
        ]);
        // 「レッスンを使わない」: the generated text goes away again
        expect(autoDescriptionPages([{ text: 'old' }], 'old', '')).toEqual([{ text: '' }]);
    });

    test('leaves pages the teacher wrote alone', () => {
        expect(autoDescriptionPages([{ text: 'mine' }], 'old', 'new')).toBeNull();
        expect(autoDescriptionPages([{ text: 'mine' }], '', 'new')).toBeNull();
        // nothing to change
        expect(autoDescriptionPages([{ text: 'same' }], 'same', 'same')).toBeNull();
        expect(autoDescriptionPages([{ text: '' }], '', '')).toBeNull();
    });
});

describe('shouldAskOverwrite / overwriteDescriptionPages', () => {
    test('asks only when the teacher wrote something else', () => {
        expect(shouldAskOverwrite([{ text: 'mine' }], 'desc')).toBe(true);
        expect(shouldAskOverwrite([{ text: '' }, { text: 'mine' }], 'desc')).toBe(true);
        expect(shouldAskOverwrite([{ text: 'desc' }], 'desc')).toBe(false);
        expect(shouldAskOverwrite([{ text: '' }], 'desc')).toBe(false);
        expect(shouldAskOverwrite([{ text: 'mine' }], '')).toBe(false);
    });

    test('overwrites the first page text only', () => {
        expect(overwriteDescriptionPages([{ text: 'mine', imageKey: 'k' }, { text: 'p2' }], 'desc')).toEqual([
            { text: 'desc', imageKey: 'k' },
            { text: 'p2' },
        ]);
        expect(overwriteDescriptionPages([], 'desc')).toEqual([{ text: 'desc' }]);
    });
});

describe('firstLessonDraft', () => {
    test('the first lesson of the first course, all its challenges', () => {
        const first = firstLessonDraft();
        expect(first.courseId).toBe(COURSES[0].id);
        expect(first.challengeIds).toEqual(COURSES[0].lessons[0].challenges.map((c) => c.id));
        expect(first.requiredChallengeIds).toEqual([]);
        expect(first.completion).toEqual({ type: 'all', count: null });
        expect(first.submitWork).toBe(false);
    });

    test('null without courses', () => {
        expect(firstLessonDraft([])).toBeNull();
    });
});
