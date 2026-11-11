// レッスンの記録（端末の localStorage）。クラスに関係ない形で残し、段 2 で
// クラス管理の課題に引き継ぐ（exportProgress の形で送る）。
//
// 保存の形:
//   { version: 1, challenges: { <challengeId>: { completedAt, courseId, lessonId } } }
import { COURSES, findChallenge } from './courses';

export const LESSON_PROGRESS_STORAGE_KEY = 'smalruby:lessonProgress';
const PROGRESS_VERSION = 1;

/** @returns {object} 何もできていない記録。 */
export const emptyProgress = () => ({ version: PROGRESS_VERSION, challenges: {} });

const defaultStorage = () => {
    try {
        return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
    } catch (e) {
        // localStorage の参照自体が例外になるブラウザ設定がある
        return null;
    }
};

// exportProgress が courseId / lessonId を必ず送れるよう、3 つそろったものだけを記録とみなす
const isRecord = (value) =>
    value !== null &&
    typeof value === 'object' &&
    typeof value.completedAt === 'string' &&
    typeof value.courseId === 'string' &&
    typeof value.lessonId === 'string';

/**
 * 記録を読む。読めない・壊れているときは空の記録（落とさない）。
 * @param {?Storage} [storage] - 読む先（既定は window.localStorage）。
 * @returns {object} 記録。
 */
export const loadProgress = (storage = defaultStorage()) => {
    if (!storage) return emptyProgress();
    try {
        const parsed = JSON.parse(storage.getItem(LESSON_PROGRESS_STORAGE_KEY));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return emptyProgress();
        const challenges = {};
        Object.entries(parsed.challenges || {}).forEach(([id, record]) => {
            if (isRecord(record)) challenges[id] = record;
        });
        return { version: PROGRESS_VERSION, challenges };
    } catch (e) {
        return emptyProgress();
    }
};

/**
 * 記録を書く。書けないとき（容量・プライベートモード）も落とさない。
 * @param {object} progress - 記録。
 * @param {?Storage} [storage] - 書く先（既定は window.localStorage）。
 * @returns {boolean} 書けたら true。
 */
export const saveProgress = (progress, storage = defaultStorage()) => {
    if (!storage) return false;
    try {
        storage.setItem(LESSON_PROGRESS_STORAGE_KEY, JSON.stringify(progress));
        return true;
    } catch (e) {
        return false;
    }
};

/**
 * 2 つの記録を合わせる（同じチャレンジは早い日時を残す）。別のタブが先に書いた
 * 分を、こちらの写しで上書きして消さないために使う。
 * @param {object} progress - こちらの記録。
 * @param {object} other - 合わせる記録（例: いまの localStorage）。
 * @returns {object} 合わせた記録（other で何も変わらなければ progress そのもの）。
 */
export const mergeProgress = (progress, other) => {
    let challenges = null;
    Object.entries(other.challenges).forEach(([id, record]) => {
        const mine = progress.challenges[id];
        if (mine && mine.completedAt <= record.completedAt) return;
        if (!challenges) challenges = { ...progress.challenges };
        challenges[id] = record;
    });
    return challenges ? { ...progress, challenges } : progress;
};

/**
 * チャレンジを「できた」にした記録を返す（元の記録は変えない）。すでにできて
 * いれば最初の日時を残す（クラスに引き継ぐとき「課題の前からできていた」を分ける
 * のに使う）。知らない id は無視する。
 * @param {object} progress - 記録。
 * @param {string} challengeId - チャレンジ id。
 * @param {string} completedAt - できた日時（ISO 文字列）。
 * @param {Array} [courses] - コース（テスト用）。
 * @returns {object} 新しい記録（変わらなければ同じオブジェクト）。
 */
export const markChallengeCompleted = (progress, challengeId, completedAt, courses = COURSES) => {
    if (progress.challenges[challengeId]) return progress;
    const found = findChallenge(challengeId, courses);
    if (!found) return progress;
    return {
        ...progress,
        challenges: {
            ...progress.challenges,
            [challengeId]: { completedAt, courseId: found.course.id, lessonId: found.lesson.id },
        },
    };
};

/**
 * @param {object} progress - 記録。
 * @param {string} challengeId - チャレンジ id。
 * @returns {boolean} できていれば true。
 */
export const isChallengeCompleted = (progress, challengeId) => Boolean(progress.challenges[challengeId]);

/**
 * レッスンのクリア判定（n 個と必須）。
 * @param {object} lesson - レッスン。
 * @param {object} progress - 記録。
 * @returns {{cleared: boolean, completedCount: number, count: number, missingRequired: Array<string>}}
 *   できた数・必要な数・まだの必須チャレンジ id。
 */
export const lessonClearStatus = (lesson, progress) => {
    const { count, required } = lesson.clear;
    const completedCount = lesson.challenges.filter((c) => isChallengeCompleted(progress, c.id)).length;
    const missingRequired = required.filter((id) => !isChallengeCompleted(progress, id));
    return {
        cleared: completedCount >= count && missingRequired.length === 0,
        completedCount,
        count,
        missingRequired,
    };
};

/**
 * できたチャレンジの「できること」の一覧（コースの並び順・重なりは 1 つ）。
 * @param {object} progress - 記録。
 * @param {Array} [courses] - コース（テスト用）。
 * @returns {Array<object>} できること（{id, name}）。
 */
export const completedSkills = (progress, courses = COURSES) => {
    const seen = new Set();
    const skills = [];
    courses.forEach((course) =>
        course.lessons.forEach((lesson) =>
            lesson.challenges
                .filter((c) => isChallengeCompleted(progress, c.id))
                .forEach((c) =>
                    (c.skills || []).forEach((skill) => {
                        if (seen.has(skill.id)) return;
                        seen.add(skill.id);
                        skills.push(skill);
                    }),
                ),
        ),
    );
    return skills;
};

/**
 * 送るための形（1 チャレンジ 1 行、できた順）。
 * @param {object} progress - 記録。
 * @returns {Array<{challengeId: string, courseId: string, lessonId: string, completedAt: string}>} 行。
 */
export const exportProgress = (progress) =>
    Object.entries(progress.challenges)
        .map(([challengeId, record]) => ({
            challengeId,
            courseId: record.courseId,
            lessonId: record.lessonId,
            completedAt: record.completedAt,
        }))
        .sort((a, b) => a.completedAt.localeCompare(b.completedAt) || a.challengeId.localeCompare(b.challengeId));

/**
 * レッスンの最後のチャレンジか（並び順で最後）。「できた！」の文言を変える。
 * 必須がそろったかどうかでは変えない（必須は段 1 から外す予定・#1520）。
 * @param {string} challengeId - チャレンジ id。
 * @param {Array} [courses] - コース（テスト用）。
 * @returns {boolean} 最後なら true（知らない id は false）。
 */
export const isLastChallengeOfLesson = (challengeId, courses = COURSES) => {
    const found = findChallenge(challengeId, courses);
    if (!found) return false;
    const { challenges } = found.lesson;
    return challenges[challenges.length - 1].id === challengeId;
};

/**
 * レッスンの中で、`afterId` の次から並び順にさがして（最後まで行ったら先頭にもどる）、
 * まだできていない最初のチャレンジ。`afterId` 自身は選ばない。
 * @param {object} lesson - レッスン。
 * @param {object} progress - 記録。
 * @param {?string} afterId - ここの次からさがす。null なら先頭から。
 * @returns {?object} チャレンジ。全部できていれば null。
 */
const nextIncompleteChallenge = (lesson, progress, afterId) => {
    const { challenges } = lesson;
    const start = afterId === null ? 0 : challenges.findIndex((c) => c.id === afterId) + 1;
    for (let i = 0; i < challenges.length; i++) {
        const challenge = challenges[(start + i) % challenges.length];
        if (challenge.id !== afterId && !isChallengeCompleted(progress, challenge.id)) return challenge;
    }
    return null;
};

/**
 * 「次のチャレンジ」でレッスン表を開くとき、どのレッスンを見せて、どのチャレンジを次として
 * 目立たせるか（#1520）。
 *   - レッスンの途中: いまのレッスン。次は、いまの次から並び順にさがしたまだできていないもの
 *     （最後まで行ったら先頭にもどる）。
 *   - レッスンの最後: コースに次のレッスンがあればそのレッスンの、まだできていない最初のもの。
 *     次のレッスンが無ければ、いまのレッスンの中でまだできていないもの。
 * @param {string} challengeId - いまのチャレンジ id。
 * @param {object} progress - 記録。
 * @param {Array} [courses] - コース（テスト用）。
 * @returns {?{language: string, courseId: string, lessonId: string, nextChallengeId: ?string}}
 *   知らない id は null。`nextChallengeId` は全部できていれば null。
 */
export const lessonsLibraryFocus = (challengeId, progress, courses = COURSES) => {
    const found = findChallenge(challengeId, courses);
    if (!found) return null;
    const { course, lesson } = found;
    let focusLesson = lesson;
    let next = null;
    if (isLastChallengeOfLesson(challengeId, courses)) {
        const nextLesson = course.lessons[course.lessons.indexOf(lesson) + 1];
        if (nextLesson) {
            focusLesson = nextLesson;
            next = nextIncompleteChallenge(nextLesson, progress, null);
        }
    }
    if (focusLesson === lesson) next = nextIncompleteChallenge(lesson, progress, challengeId);
    return {
        language: course.language,
        courseId: course.id,
        lessonId: focusLesson.id,
        nextChallengeId: next ? next.id : null,
    };
};
