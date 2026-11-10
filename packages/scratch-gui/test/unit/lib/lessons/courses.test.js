/**
 * Data-shape coverage for the lesson courses (コース › レッスン › チャレンジ).
 *
 * The challenge contents arrive later (1-g), so the regressions guarded here are
 * the skeleton every later sub-issue builds on: ids are unique and stable, the
 * lesson clear rule matches the spec, every challenge has the normalized fields,
 * and every message id resolves in en / ja / ja-Hira.
 */
import {
    COURSES,
    LANGUAGES,
    findChallenge,
    findCourse,
    findLesson,
    lessonClearRule,
} from '../../../../src/lib/lessons/courses';
import en from '../../../../src/locales/en';
import ja from '../../../../src/locales/ja';
import jaHira from '../../../../src/locales/ja-Hira';

const LOCALES = { en, ja, 'ja-Hira': jaHira };

const LESSON1_CHALLENGE_NAMES = [
    '1 キーで音を鳴らそう',
    '2 矢印キーで動かそう',
    '3 押したら話そう',
    '4 くり返そう',
    '5 もし〜なら',
    '6 聞いて答えよう',
    '7 クイズを作ろう',
    '8 数えよう',
    '9 なかまに合図しよう',
    '10 しゃべらせよう',
    '11 メッセージをためよう',
];

const allChallenges = () =>
    COURSES.flatMap((course) => course.lessons.flatMap((lesson) => lesson.challenges));

const collectMessages = () => {
    const messages = [];
    COURSES.forEach((course) => {
        messages.push(course.name, course.badge);
        course.lessons.forEach((lesson) => {
            messages.push(lesson.name);
            lesson.challenges.forEach((challenge) => {
                messages.push(challenge.name);
                if (challenge.task) messages.push(challenge.task);
                challenge.skills.forEach((skill) => messages.push(skill.name));
                challenge.steps.forEach((step) => step.title && messages.push(step.title));
                challenge.debug.forEach((tip) => messages.push(tip));
            });
        });
    });
    return messages;
};

describe('lesson courses', () => {
    test('the first course is the blocks course "きょうからプログラマー"', () => {
        const course = findCourse('kyou-kara-programmer');
        expect(course).toBeTruthy();
        expect(course.language).toBe(LANGUAGES.BLOCKS);
        expect(ja[course.name.id]).toBe('きょうからプログラマー');
        expect(ja[course.badge.id]).toBe('プログラマー デビュー！');
        expect(COURSES[0]).toBe(course);
    });

    test('every course language is one of blocks / ruby / dncl', () => {
        COURSES.forEach((course) => {
            expect(Object.values(LANGUAGES)).toContain(course.language);
        });
    });

    test('lesson 1 is "ブロックのなかま" with the 11 challenges in order', () => {
        const lesson = findLesson('blocks-l1');
        expect(ja[lesson.name.id]).toBe('ブロックのなかま');
        expect(lesson.challenges.map((c) => `${c.number} ${ja[c.name.id]}`)).toEqual(LESSON1_CHALLENGE_NAMES);
    });

    test('lesson 1 clears with 7 challenges including the 3rd, 6th, 8th, 9th and 11th', () => {
        const lesson = findLesson('blocks-l1');
        const rule = lessonClearRule(lesson);
        expect(rule.count).toBe(7);
        const requiredNumbers = rule.required.map((id) => findChallenge(id).challenge.number);
        expect(requiredNumbers).toEqual([3, 6, 8, 9, 11]);
        lesson.challenges.forEach((c) => {
            expect(c.required).toBe([3, 6, 8, 9, 11].includes(c.number));
        });
    });

    test('challenge ids are unique across all courses (they are the record keys)', () => {
        const ids = allChallenges().map((c) => c.id);
        expect(new Set(ids).size).toBe(ids.length);
        ids.forEach((id) => expect(id).toMatch(/^[a-z0-9-]+$/));
    });

    test('course and lesson ids are unique', () => {
        const courseIds = COURSES.map((c) => c.id);
        const lessonIds = COURSES.flatMap((c) => c.lessons.map((l) => l.id));
        expect(new Set(courseIds).size).toBe(courseIds.length);
        expect(new Set(lessonIds).size).toBe(lessonIds.length);
    });

    test('every challenge carries the normalized fields', () => {
        allChallenges().forEach((c) => {
            expect(c).toEqual(
                expect.objectContaining({
                    id: expect.any(String),
                    number: expect.any(Number),
                    required: expect.any(Boolean),
                    skills: expect.any(Array),
                    steps: expect.any(Array),
                    debug: expect.any(Array),
                }),
            );
            expect(c).toHaveProperty('task');
            expect(c).toHaveProperty('goal');
            expect(c).toHaveProperty('allowedBlocks');
            expect(c).toHaveProperty('setup');
            expect(c).toHaveProperty('code');
            c.steps.forEach((step) => {
                expect(step).toHaveProperty('target');
                expect(step).toHaveProperty('blocks');
            });
        });
    });

    test('the clear count never exceeds the number of challenges and covers the required ones', () => {
        COURSES.forEach((course) =>
            course.lessons.forEach((lesson) => {
                const rule = lessonClearRule(lesson);
                expect(rule.count).toBeLessThanOrEqual(lesson.challenges.length);
                expect(rule.count).toBeGreaterThanOrEqual(rule.required.length);
            }),
        );
    });

    test('findChallenge returns the course and lesson the challenge belongs to', () => {
        const found = findChallenge('blocks-l1-broadcast');
        expect(found.course.id).toBe('kyou-kara-programmer');
        expect(found.lesson.id).toBe('blocks-l1');
        expect(found.challenge.number).toBe(9);
        expect(findChallenge('no-such-challenge')).toBeNull();
        expect(findCourse('no-such-course')).toBeNull();
        expect(findLesson('no-such-lesson')).toBeNull();
    });

    test.each(Object.keys(LOCALES))('every message id resolves in %s', (locale) => {
        collectMessages().forEach((message) => {
            expect(LOCALES[locale][message.id]).toEqual(expect.any(String));
        });
    });
});
