// === Smalruby: This file is Smalruby-specific (lesson courses data) ===
// コース › レッスン › チャレンジのデータ。形の説明は docs/lessons/README.md。
// 文言は lessons.locale.js（message descriptor の id で引く）。

import { ja } from './lessons.locale';

/** コースの言語。言語の中にコースが並ぶ。 */
export const LANGUAGES = Object.freeze({
    BLOCKS: 'blocks',
    RUBY: 'ruby',
    DNCL: 'dncl',
});

// defaultMessage は ja の文言（FormattedMessage が locale に無いときの表示）。
const message = (id) => ({ id, defaultMessage: ja[id] });

/**
 * チャレンジの定義に既定値を埋める。いまの deck の項目（allowedBlocks / setup /
 * steps / code）をそのまま持ち、レッスン用の項目を足す。読む側が項目の有無を
 * 毎回確かめなくてよいように、ここで全部そろえる。
 * @param {object} def - チャレンジの定義（id と number は必須）。
 * @returns {object} 正規化したチャレンジ。
 */
const defineChallenge = (def) => ({
    name: message(`gui.lessons.challenge.${def.id}.name`),
    // 課題の 1 行（message descriptor）
    task: null,
    // できること: [{id, name}]。レッスンをまたいで id で重ねる
    skills: [],
    // できた の判定（uses / result）。中身は 1-f で決める
    goal: null,
    required: false,
    allowedBlocks: null,
    setup: null,
    // 最後の手段の「プログラムを入れる」（いまの deck の code）
    code: null,
    // うまく動かないときは: [message descriptor]
    debug: [],
    ...def,
    // ヒント。target = 指す場所、blocks = 吹き出しに描くブロック
    steps: (def.steps || []).map((step) => ({ target: null, blocks: null, ...step })),
});

/**
 * レッスンを定義する。必須はチャレンジの `required` を正とし、クリア条件の
 * `required` はそこから作る（二重に書かない）。
 * @param {object} def - レッスンの定義。
 * @param {string} def.id - レッスン id。
 * @param {number} def.count - クリアに要るチャレンジの数。
 * @param {Array<object>} def.challenges - チャレンジの定義（並び順）。
 * @returns {object} レッスン。
 */
const defineLesson = ({ id, count, challenges }) => {
    const normalized = challenges.map(defineChallenge);
    return {
        id,
        name: message(`gui.lessons.lesson.${id}.name`),
        challenges: normalized,
        clear: {
            count,
            required: normalized.filter((c) => c.required).map((c) => c.id),
        },
    };
};

const defineCourse = ({ id, language, lessons }) => ({
    id,
    language,
    name: message(`gui.lessons.course.${id}.name`),
    // クリアの印
    badge: message(`gui.lessons.course.${id}.badge`),
    lessons,
});

// チャレンジ id は記録（localStorage・クラスへの引き継ぎ）のキーなので、並びを
// 変えても変わらない名前にする（番号を入れない）。中身は 1-g で入れる。
const blocksLesson1 = defineLesson({
    id: 'blocks-l1',
    count: 7,
    challenges: [
        { id: 'blocks-l1-key-sound', number: 1 },
        { id: 'blocks-l1-arrow-move', number: 2 },
        { id: 'blocks-l1-click-say', number: 3, required: true },
        { id: 'blocks-l1-repeat', number: 4 },
        { id: 'blocks-l1-if', number: 5 },
        { id: 'blocks-l1-ask-answer', number: 6, required: true },
        { id: 'blocks-l1-quiz', number: 7 },
        { id: 'blocks-l1-count', number: 8, required: true },
        { id: 'blocks-l1-broadcast', number: 9, required: true },
        { id: 'blocks-l1-speak', number: 10 },
        { id: 'blocks-l1-message-list', number: 11, required: true },
    ],
});

export const COURSES = [
    defineCourse({
        id: 'kyou-kara-programmer',
        language: LANGUAGES.BLOCKS,
        lessons: [blocksLesson1],
    }),
];

/**
 * @param {string} courseId - コース id。
 * @param {Array} [courses] - 探すコース（テスト用）。
 * @returns {?object} コース。無ければ null。
 */
export const findCourse = (courseId, courses = COURSES) => courses.find((c) => c.id === courseId) || null;

/**
 * @param {string} lessonId - レッスン id。
 * @param {Array} [courses] - 探すコース（テスト用）。
 * @returns {?object} レッスン。無ければ null。
 */
export const findLesson = (lessonId, courses = COURSES) => {
    for (const course of courses) {
        const lesson = course.lessons.find((l) => l.id === lessonId);
        if (lesson) return lesson;
    }
    return null;
};

/**
 * チャレンジと、それが入っているコース・レッスンを探す。
 * @param {string} challengeId - チャレンジ id。
 * @param {Array} [courses] - 探すコース（テスト用）。
 * @returns {?{course: object, lesson: object, challenge: object}} 無ければ null。
 */
export const findChallenge = (challengeId, courses = COURSES) => {
    for (const course of courses) {
        for (const lesson of course.lessons) {
            const challenge = lesson.challenges.find((c) => c.id === challengeId);
            if (challenge) return { course, lesson, challenge };
        }
    }
    return null;
};

/**
 * レッスンのクリア条件。
 * @param {object} lesson - レッスン。
 * @returns {{count: number, required: Array<string>}} n 個と必須のチャレンジ id。
 */
export const lessonClearRule = (lesson) => lesson.clear;
