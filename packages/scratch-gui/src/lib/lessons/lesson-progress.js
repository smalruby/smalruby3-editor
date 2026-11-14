// レッスンの記録（端末の localStorage）。クラスに関係ない形で残し、段 2 で
// クラス管理の課題に引き継ぐ（exportProgress の形で送る）。
//
// 保存の形:
//   { version: 1, challenges: { <challengeId>: { completedAt, courseId, lessonId } } }
// 記録の主はチャレンジ id。courseId / lessonId は書いたときの定義の写しで、読むときは
// いまの定義（courses.js）から読みかえる（レッスンの分け方が変わっても、古い記録の
// lessonId を信じない。11 のチャレンジを 3 つのレッスンに分けた #1529）。
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
 * 1 つの記録を、いまの定義に合わせる。知っているチャレンジは courseId / lessonId をいまの
 * 定義から付けなおす（できた日時だけあればよい）。知らないチャレンジ（ほかの版で足された
 * もの）は、書いてあるとおりに残す（消すと、その版にもどったときに記録が無くなる）。
 * @param {string} challengeId - チャレンジ id。
 * @param {*} record - 読んだ記録。
 * @param {Array} courses - コース。
 * @returns {?object} 記録。記録とみなせなければ null。
 */
const normalizeRecord = (challengeId, record, courses) => {
    if (record === null || typeof record !== 'object' || typeof record.completedAt !== 'string') return null;
    const found = findChallenge(challengeId, courses);
    if (!found) return isRecord(record) ? record : null;
    if (record.courseId === found.course.id && record.lessonId === found.lesson.id) return record;
    return { ...record, courseId: found.course.id, lessonId: found.lesson.id };
};

/**
 * 記録を読む。読めない・壊れているときは空の記録（落とさない）。
 * @param {?Storage} [storage] - 読む先（既定は window.localStorage）。
 * @param {Array} [courses] - コース（テスト用）。
 * @returns {object} 記録。
 */
export const loadProgress = (storage = defaultStorage(), courses = COURSES) => {
    if (!storage) return emptyProgress();
    try {
        const parsed = JSON.parse(storage.getItem(LESSON_PROGRESS_STORAGE_KEY));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return emptyProgress();
        const challenges = {};
        Object.entries(parsed.challenges || {}).forEach(([id, value]) => {
            const record = normalizeRecord(id, value, courses);
            if (record) challenges[id] = record;
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
 * レッスンの進み具合（できた数・全部の数・全部できたか）。段 1 にクリア条件（n 個・必須）は無い。
 * @param {object} lesson - レッスン。
 * @param {object} progress - 記録。
 * @returns {{completedCount: number, total: number, allCompleted: boolean}} 進み具合。
 */
export const lessonProgress = (lesson, progress) => {
    const completedCount = lesson.challenges.filter((c) => isChallengeCompleted(progress, c.id)).length;
    const total = lesson.challenges.length;
    return { completedCount, total, allCompleted: total > 0 && completedCount === total };
};

/**
 * コースの進み具合と、レッスンごとの進み具合・チャレンジ（レッスン表が見せるもの）。
 * コースの「全部できた」（クリアの印）は、コースのチャレンジが全部できたとき。
 * @param {object} course - コース。
 * @param {object} progress - 記録。
 * @returns {{completedCount: number, total: number, allCompleted: boolean, lessons: Array<object>}}
 *   コース全体の数と、`lessons`（並び順に `{lesson, number, completedCount, total, allCompleted,
 *   challenges: [{challenge, completed}]}`。`number` はコースの中のレッスンの番号）。
 */
export const courseProgress = (course, progress) => {
    const lessons = course.lessons.map((lesson, index) => ({
        lesson,
        number: index + 1,
        ...lessonProgress(lesson, progress),
        challenges: lesson.challenges.map((challenge) => ({
            challenge,
            completed: isChallengeCompleted(progress, challenge.id),
        })),
    }));
    const completedCount = lessons.reduce((sum, l) => sum + l.completedCount, 0);
    const total = lessons.reduce((sum, l) => sum + l.total, 0);
    // チャレンジがまだ無いコースを「全部できた」にしない
    return { completedCount, total, allCompleted: total > 0 && completedCount === total, lessons };
};

/**
 * 送るための形（1 チャレンジ 1 行、できた順）。
 * @param {object} progress - 記録。
 * @returns {Array<{challengeId: string, courseId: string, lessonId: string, completedAt: string}>} 行。
 */
export const exportProgress = (progress) =>
    // courseId / lessonId は loadProgress がいまの定義に合わせたもの
    Object.entries(progress.challenges)
        .map(([challengeId, record]) => ({
            challengeId,
            courseId: record.courseId,
            lessonId: record.lessonId,
            completedAt: record.completedAt,
        }))
        .sort((a, b) => a.completedAt.localeCompare(b.completedAt) || a.challengeId.localeCompare(b.challengeId));

/**
 * 「できた！」のボタン（#1520）。
 *   - `next`: レッスンにまだできていないチャレンジがある →「次のチャレンジ」
 *   - `otherLessons`: レッスンのチャレンジが全部できて、コースの後ろにまだ全部はできていないレッスンが
 *     ある →「ほかのレッスンへ」
 *   - `library`: 全部できて、後ろにそういうレッスンが無い →「レッスン表へ」
 * 並び順で最後かどうかでは決めない（途中を飛ばした生徒に「おわり」と言わないため）。
 */
export const COMPLETED_ACTIONS = Object.freeze({
    NEXT: 'next',
    OTHER_LESSONS: 'otherLessons',
    LIBRARY: 'library',
});

const isLessonAllCompleted = (lesson, progress) => lessonProgress(lesson, progress).allCompleted;

/**
 * コースの中で、`lesson` より後ろにある、まだ全部はできていない最初のレッスン。全部できている
 * レッスンは飛ばす（「ほかのレッスンへ」で、もうやることの無いレッスンを開かないため）。
 * @param {object} course - コース。
 * @param {object} lesson - レッスン。
 * @param {object} progress - 記録。
 * @returns {?object} レッスン。無ければ null。
 */
const nextLessonOf = (course, lesson, progress) =>
    course.lessons.slice(course.lessons.indexOf(lesson) + 1).find((l) => !isLessonAllCompleted(l, progress)) || null;

/**
 * 「できた！」に出すボタンの種類（COMPLETED_ACTIONS）。
 * @param {string} challengeId - できたチャレンジ id。
 * @param {object} progress - 記録（できたチャレンジを含む）。
 * @param {Array} [courses] - コース（テスト用）。
 * @returns {string} COMPLETED_ACTIONS のどれか（知らない id は NEXT）。
 */
export const completedAction = (challengeId, progress, courses = COURSES) => {
    const found = findChallenge(challengeId, courses);
    if (!found || !isLessonAllCompleted(found.lesson, progress)) return COMPLETED_ACTIONS.NEXT;
    return nextLessonOf(found.course, found.lesson, progress)
        ? COMPLETED_ACTIONS.OTHER_LESSONS
        : COMPLETED_ACTIONS.LIBRARY;
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
 * 目立たせるか（#1520）。「できた！」のボタン（completedAction）と食い違わないように決める:
 *   - レッスンにまだできていないチャレンジがある: いまのレッスン。次は、いまの次から並び順に
 *     さがしたまだできていないもの（最後まで行ったら先頭にもどる）。
 *   - 全部できていて、後ろにまだ全部はできていないレッスンがある: そのレッスンの、まだできていない最初のもの。
 *   - 全部できていて、後ろにそういうレッスンが無い: いまのレッスン。印は付けない。
 * @param {string} challengeId - いまのチャレンジ id。
 * @param {object} progress - 記録。
 * @param {Array} [courses] - コース（テスト用）。
 * @returns {?{language: string, courseId: string, lessonId: string, nextChallengeId: ?string}}
 *   知らない id は null。`nextChallengeId` は印を付けないとき null。
 */
export const lessonsLibraryFocus = (challengeId, progress, courses = COURSES) => {
    const found = findChallenge(challengeId, courses);
    if (!found) return null;
    const { course, lesson } = found;
    let focusLesson = lesson;
    let next;
    if (completedAction(challengeId, progress, courses) === COMPLETED_ACTIONS.OTHER_LESSONS) {
        focusLesson = nextLessonOf(course, lesson, progress);
        next = nextIncompleteChallenge(focusLesson, progress, null);
    } else {
        next = nextIncompleteChallenge(lesson, progress, challengeId);
    }
    return {
        language: course.language,
        courseId: course.id,
        lessonId: focusLesson.id,
        nextChallengeId: next ? next.id : null,
    };
};

/**
 * コースのチャレンジのうち、いちばん最近できたもの（できた日時が同じならコースの並び順で後ろのもの）。
 * @param {object} course - コース。
 * @param {object} progress - 記録。
 * @returns {?object} チャレンジ。1 つもできていなければ null。
 */
const latestCompletedChallenge = (course, progress) => {
    let latest = null;
    let latestAt = '';
    course.lessons.forEach((lesson) =>
        lesson.challenges.forEach((challenge) => {
            const record = progress.challenges[challenge.id];
            if (record && record.completedAt >= latestAt) {
                latest = challenge;
                latestAt = record.completedAt;
            }
        }),
    );
    return latest;
};

/**
 * ウェルカムの「レッスンを始める」でレッスン表を開くとき、どのレッスンを見せて、どのチャレンジに
 * 「次はこれ！」を付けるか（#1888）。見せ方は「できた！」の「次のチャレンジへ」（lessonsLibraryFocus）と同じ:
 *   - まだ全部はできていない最初のコースを見る。全部できていれば null（メニューから開いたときと同じ）。
 *   - そのコースで 1 つもできていない: 最初のまだできていないチャレンジ（= レッスン 1 の最初のチャレンジ）。
 *   - 途中: いちばん最近できたチャレンジを「いまのチャレンジ」として lessonsLibraryFocus で決める。
 *     それで印が付かない（後ろのレッスンが全部できていて、前のレッスンが残っている）ときは、
 *     コースの並び順で最初のまだできていないチャレンジに付ける。
 * @param {object} progress - 記録。
 * @param {Array} [courses] - コース（テスト用）。
 * @returns {?{language: string, courseId: string, lessonId: string, nextChallengeId: string}} 全部できていれば null。
 */
export const startLessonsFocus = (progress, courses = COURSES) => {
    const course = courses.find((c) => !courseProgress(c, progress).allCompleted && c.lessons.length > 0);
    if (!course) return null;
    const latest = latestCompletedChallenge(course, progress);
    if (latest) {
        const focus = lessonsLibraryFocus(latest.id, progress, courses);
        if (focus && focus.nextChallengeId) return focus;
    }
    const lesson = course.lessons.find((l) => !isLessonAllCompleted(l, progress));
    const next = lesson ? nextIncompleteChallenge(lesson, progress, null) : null;
    if (!next) return null;
    return { language: course.language, courseId: course.id, lessonId: lesson.id, nextChallengeId: next.id };
};
