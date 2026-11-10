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
 * @param {object} def - チャレンジの定義（id は必須。number は defineLesson が付ける）。
 * @returns {object} 正規化したチャレンジ。
 */
export const defineChallenge = (def) => ({
    name: message(`gui.lessons.challenge.${def.id}.name`),
    // 課題の 1 行（message descriptor）
    task: null,
    // できること: [{id, name}]。レッスンをまたいで id で重ねる
    skills: [],
    // できた の判定: 条件の配列（全部を満たしたら「できた」）。形は goal.js と
    // docs/lessons/README.md。null ならそのチャレンジは判定しない
    goal: null,
    required: false,
    allowedBlocks: null,
    setup: null,
    // 最後の手段の「プログラムを入れる」（いまの deck の code）
    code: null,
    // うまく動かないときは: [message descriptor]
    debug: [],
    ...def,
    // ヒント。title = 文言、target = 指す場所、blocks = 吹き出しに描くブロック、
    // spotlight = はじめて開いたチャレンジだけ周りを暗くして指す場所を照らす
    steps: (def.steps || []).map((step) => ({ title: null, target: null, blocks: null, spotlight: false, ...step })),
});

/**
 * レッスンを定義する。必須はチャレンジの `required` を正とし、クリア条件の
 * `required` はそこから作る（二重に書かない）。何個めか（`number`）も並びから
 * 付ける（並びを変えたときに番号がずれないように、定義には書かない）。
 * @param {object} def - レッスンの定義。
 * @param {string} def.id - レッスン id。
 * @param {number} def.count - クリアに要るチャレンジの数。
 * @param {Array<object>} def.challenges - チャレンジの定義（並び順）。
 * @returns {object} レッスン。
 */
export const defineLesson = ({ id, count, challenges }) => {
    const normalized = challenges.map((def, index) => defineChallenge({ ...def, number: index + 1 }));
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

/**
 * @param {object} def - コースの定義。
 * @param {string} def.id - コース id。
 * @param {string} def.language - 言語（`LANGUAGES`）。
 * @param {Array<object>} def.lessons - レッスン（並び順）。
 * @returns {object} コース。
 */
export const defineCourse = ({ id, language, lessons }) => ({
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
        { id: 'blocks-l1-key-sound' },
        { id: 'blocks-l1-arrow-move' },
        {
            id: 'blocks-l1-click-say',
            required: true,
            task: message('gui.lessons.challenge.blocks-l1-click-say.task'),
            allowedBlocks: {
                looks: ['looks_say', 'looks_sayforsecs'],
                event: ['event_whenthisspriteclicked'],
            },
            setup: { tab: 'code' },
        },
        { id: 'blocks-l1-repeat' },
        { id: 'blocks-l1-if' },
        { id: 'blocks-l1-ask-answer', required: true },
        { id: 'blocks-l1-quiz' },
        { id: 'blocks-l1-count', required: true },
        { id: 'blocks-l1-broadcast', required: true },
        { id: 'blocks-l1-speak' },
        { id: 'blocks-l1-message-list', required: true },
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
