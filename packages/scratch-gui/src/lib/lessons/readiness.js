// じゅんびチェック（#2299）の記録と、そこから決める「おすすめ」のチャレンジ。記録は端末の localStorage に、
// レッスンの記録（lesson-progress.js）のとなりに置く（クラスには送らない。クラスに残すのは別の Issue）。
//
// 保存の形:
//   {
//     version: 1,
//     courses: { <courseId>: { answers: { <baseChallengeId>: { correct, answeredAt, clearedAt? } } } },
//     offered: { <courseId>: <ISO 日時> },
//   }
//   - answers: じゅんびチェックの問いに、1 回めに選んだものが正しかったか（土台のチャレンジ id ごと）。チェックを
//     やりなおすと、答えた問いから上書きする（あとで正しく答えれば「おすすめ」が消える）
//   - clearedAt: まちがえたあとで、そのチャレンジが「できた」になった日時（「おすすめ」が消える）
//   - offered: 「先にじゅんびチェックをする？」を聞いた日時（1 回だけ聞く）
// 判定はここの純粋関数で行い、画面（「できた！」・レッスン表のカード・課題の「おさらい」・先生の表）はこれを使う。
import { isAssignmentChallenge } from './assignment-progress';
import { COURSES, courseReadinessCheck, findChallenge, findCourse } from './courses';

export const READINESS_STORAGE_KEY = 'smalruby:lessonReadiness';
const READINESS_VERSION = 1;

/** @returns {object} 何も答えていない記録。 */
export const emptyReadiness = () => ({ version: READINESS_VERSION, courses: {}, offered: {} });

const defaultStorage = () => {
    try {
        return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
    } catch (e) {
        // localStorage の参照自体が例外になるブラウザ設定がある
        return null;
    }
};

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const normalizeAnswer = (value) => {
    if (!isObject(value) || typeof value.correct !== 'boolean' || typeof value.answeredAt !== 'string') return null;
    const answer = { correct: value.correct, answeredAt: value.answeredAt };
    if (typeof value.clearedAt === 'string') answer.clearedAt = value.clearedAt;
    return answer;
};

/**
 * 記録を読む。読めない・壊れているときは空の記録（落とさない）。形のちがう項目は捨てる。
 * @param {?Storage} [storage] - 読む先（既定は window.localStorage）。
 * @returns {object} 記録。
 */
export const loadReadiness = (storage = defaultStorage()) => {
    if (!storage) return emptyReadiness();
    try {
        const parsed = JSON.parse(storage.getItem(READINESS_STORAGE_KEY));
        if (!isObject(parsed)) return emptyReadiness();
        const courses = {};
        Object.entries(isObject(parsed.courses) ? parsed.courses : {}).forEach(([courseId, value]) => {
            if (!isObject(value) || !isObject(value.answers)) return;
            const answers = {};
            Object.entries(value.answers).forEach(([id, answer]) => {
                const normalized = normalizeAnswer(answer);
                if (normalized) answers[id] = normalized;
            });
            courses[courseId] = { answers };
        });
        const offered = {};
        Object.entries(isObject(parsed.offered) ? parsed.offered : {}).forEach(([courseId, at]) => {
            if (typeof at === 'string') offered[courseId] = at;
        });
        return { version: READINESS_VERSION, courses, offered };
    } catch (e) {
        return emptyReadiness();
    }
};

/**
 * 記録を書く。書けないとき（容量・プライベートモード）も落とさない。
 * @param {object} readiness - 記録。
 * @param {?Storage} [storage] - 書く先（既定は window.localStorage）。
 * @returns {boolean} 書けたら true。
 */
export const saveReadiness = (readiness, storage = defaultStorage()) => {
    if (!storage) return false;
    try {
        storage.setItem(READINESS_STORAGE_KEY, JSON.stringify(readiness));
        return true;
    } catch (e) {
        return false;
    }
};

const answersOf = (readiness, courseId) =>
    readiness && readiness.courses && readiness.courses[courseId] ? readiness.courses[courseId].answers : {};

/**
 * じゅんびチェックの問いに答えた記録を返す（元の記録は変えない）。同じ問いは新しい答えで上書きする
 * （チェックをやりなおして正しく答えたら「おすすめ」が消える。まちがえたら、また「おすすめ」になる）。
 * @param {object} readiness - 記録。
 * @param {string} courseId - チェックのコース id。
 * @param {string} baseChallengeId - 問いの土台のチャレンジ id。
 * @param {boolean} correct - 1 回めに選んだものが正しかったか。
 * @param {string} answeredAt - 答えた日時（ISO 文字列）。
 * @returns {object} 新しい記録。
 */
export const recordReadinessAnswer = (readiness, courseId, baseChallengeId, correct, answeredAt) => ({
    ...readiness,
    courses: {
        ...readiness.courses,
        [courseId]: {
            answers: {
                ...answersOf(readiness, courseId),
                [baseChallengeId]: { correct: Boolean(correct), answeredAt },
            },
        },
    },
});

/**
 * チャレンジが「できた」になったことを記録に入れる。そのチャレンジを問いでまちがえていたコース全部で、「おすすめ」を
 * 消す（clearedAt）。前からできていたチャレンジでも、まちがえたあとでもう一度できたら消す。
 * @param {object} readiness - 記録。
 * @param {string} challengeId - できたチャレンジ id。
 * @param {string} clearedAt - できた日時（ISO 文字列）。
 * @returns {object} 新しい記録（変わらなければ同じオブジェクト）。
 */
export const markReadinessChallengeCleared = (readiness, challengeId, clearedAt) => {
    let courses = null;
    Object.entries(readiness.courses || {}).forEach(([courseId, { answers }]) => {
        const answer = answers[challengeId];
        if (!answer || answer.correct || answer.clearedAt) return;
        if (!courses) courses = { ...readiness.courses };
        courses[courseId] = { answers: { ...answers, [challengeId]: { ...answer, clearedAt } } };
    });
    return courses ? { ...readiness, courses } : readiness;
};

/**
 * 「先にじゅんびチェックをする？」を聞いたことを記録に入れる（1 回だけ聞く）。
 * @param {object} readiness - 記録。
 * @param {string} courseId - コース id。
 * @param {string} at - 聞いた日時（ISO 文字列）。
 * @returns {object} 新しい記録（もう聞いていれば同じオブジェクト）。
 */
export const markReadinessOffered = (readiness, courseId, at) =>
    readiness.offered && readiness.offered[courseId]
        ? readiness
        : { ...readiness, offered: { ...readiness.offered, [courseId]: at } };

const isRecommendedAnswer = (answer) => Boolean(answer) && answer.correct === false && !answer.clearedAt;

/**
 * コースのじゅんびチェックの結果。
 * @param {object} course - コース（`baseChallenges` を持つ）。
 * @param {object} readiness - 記録。
 * @returns {{total: number, answeredCount: number, correctIds: Array<string>, wrongIds: Array<string>,
 *   recommendedIds: Array<string>, allCorrect: boolean}} 結果。`total` は土台のチャレンジの数、`wrongIds` は
 *   まちがえた問いの土台のチャレンジ（あとでできたものも入る）、`recommendedIds` はそのうちまだ「おすすめ」のもの
 *   （コースの `baseChallenges` の並び）。`allCorrect` は全部の問いに答えて全部正しかったか。
 */
export const readinessResult = (course, readiness) => {
    const base = course && Array.isArray(course.baseChallenges) ? course.baseChallenges : [];
    const answers = answersOf(readiness, course ? course.id : null);
    const answered = base.filter((id) => answers[id]);
    const correctIds = answered.filter((id) => answers[id].correct);
    const wrongIds = answered.filter((id) => !answers[id].correct);
    return {
        total: base.length,
        answeredCount: answered.length,
        correctIds,
        wrongIds,
        recommendedIds: base.filter((id) => isRecommendedAnswer(answers[id])),
        allCorrect: base.length > 0 && correctIds.length === base.length,
    };
};

/**
 * コースのじゅんびチェックで「おすすめ」になっているチャレンジ（まちがえた問いのチャレンジのうち、まだ正しく答えなおして
 * いない・できていないもの）。並びはコースの `baseChallenges` のとおり。ほかのコースのチャレンジもある。
 * @param {object} course - コース。
 * @param {object} readiness - 記録。
 * @param {Array} [courses] - チャレンジを探すコース（テスト用）。
 * @returns {Array<{course: object, lesson: object, challenge: object}>} チャレンジ（findChallenge の結果）。
 */
export const recommendedChallenges = (course, readiness, courses = COURSES) =>
    readinessResult(course, readiness)
        .recommendedIds.map((id) => findChallenge(id, courses))
        .filter(Boolean);

/**
 * どれかのコースで「おすすめ」になっているチャレンジ id（レッスン表のカードの印）。
 * @param {object} readiness - 記録。
 * @param {Array} [courses] - コース（テスト用）。
 * @returns {Array<string>} チャレンジ id（重なりなし）。
 */
export const recommendedChallengeIds = (readiness, courses = COURSES) => [
    ...new Set(courses.flatMap((course) => readinessResult(course, readiness).recommendedIds)),
];

/**
 * チャレンジを開いたときに「先にじゅんびチェックをする？」を聞くか。聞くのは、じゅんびチェックのあるコースの
 * レッスン 1 の最初のチャレンジを、はじめて開いたとき（まだ聞いていない・チェックの問いに 1 つも答えていない）だけ。
 * クラスの課題から開いたときも聞く（#2300）。じゅんびチェックは課題の「おさらい（課題の外）」にいつも出ているので、
 * 課題の外へ案内しても、そこから「課題にもどる」で課題のチャレンジにもどれる。
 * @param {object} args - 引数。
 * @param {string} args.challengeId - 開いたチャレンジ id。
 * @param {object} args.readiness - 記録。
 * @param {Array} [courses] - コース（テスト用）。
 * @returns {?{courseId: string, checkChallengeId: string}} 聞くときは、コースとじゅんびチェックのチャレンジ id。
 */
export const readinessOffer = ({ challengeId, readiness }, courses = COURSES) => {
    const found = findChallenge(challengeId, courses);
    if (!found) return null;
    const { course, lesson } = found;
    if (lesson !== course.lessons[0] || lesson.challenges[0] !== found.challenge) return null;
    const check = courseReadinessCheck(course);
    if (!check) return null;
    if (readiness.offered && readiness.offered[course.id]) return null;
    if (Object.keys(answersOf(readiness, course.id)).length > 0) return null;
    return { courseId: course.id, checkChallengeId: check.id };
};

/**
 * 課題のレッスン表の「おさらい（課題の外）」に出すチャレンジ（#2300）。課題のコースのじゅんびチェック（いつも出す）と、
 * そのチェックでいま「おすすめ」のチャレンジだけ（ほかは出さない）。課題に入っているものは課題のほうに出るので外す。
 * じゅんびチェックの無いコースの課題では出さない。
 * @param {?object} lesson - 課題のレッスンの設定（assignment-progress.js の normalizeAssignmentLesson）。
 * @param {?object} readiness - 記録。
 * @param {Array} [courses] - コース（テスト用）。
 * @returns {Array<{course: object, lesson: object, challenge: object}>} チャレンジ（findChallenge の結果）。
 */
export const assignmentReviewChallenges = (lesson, readiness, courses = COURSES) => {
    if (!lesson) return [];
    const course = findCourse(lesson.courseId, courses);
    const check = course ? courseReadinessCheck(course) : null;
    if (!check) return [];
    const found = [
        findChallenge(check.id, courses),
        ...recommendedChallenges(course, readiness || emptyReadiness(), courses),
    ];
    const seen = new Set(lesson.challengeIds);
    return found.filter((item) => {
        if (!item || seen.has(item.challenge.id)) return false;
        seen.add(item.challenge.id);
        return true;
    });
};

/**
 * 課題の流れの中でチャレンジを開くときの、開き方（#2300）。課題のチャレンジなら「課題から」、課題の外なら「おさらい」
 * （課題の数に入らない。クラスへは current に `review: true` を付けて送る）。課題の流れの外（メニューの「レッスン」から
 * など）では、どちらでもない。
 * @param {?object} lesson - 課題のレッスンの設定。
 * @param {?string} challengeId - 開くチャレンジ id。
 * @param {boolean} inAssignmentFlow - 課題の流れの中か（課題だけのレッスン表・課題か「おさらい」のチャレンジの中）。
 * @returns {{fromAssignment: boolean, fromReview: boolean}} 開き方。
 */
export const challengeOpenContext = (lesson, challengeId, inAssignmentFlow) => {
    if (!inAssignmentFlow || !lesson || !challengeId) return { fromAssignment: false, fromReview: false };
    const fromAssignment = isAssignmentChallenge(lesson, challengeId);
    return { fromAssignment, fromReview: !fromAssignment };
};

/**
 * 「おさらい」の中の「課題にもどる」の行き先（#2300）。おさらいの前にやっていた課題のチャレンジが、まだ課題にあって
 * できていなければ、それを開きなおす。ほかは課題だけのレッスン表を開く（そのチャレンジの次から「次はこれ！」）。
 * @param {?object} lesson - 課題のレッスンの設定。
 * @param {object} progress - 端末のレッスンの記録。
 * @param {?string} lastAssignmentChallengeId - おさらいの前に開いていた課題のチャレンジ id。
 * @returns {{challengeId: string}|{libraryAfterId: ?string}} 開くチャレンジか、レッスン表の起点。
 */
export const reviewReturnTarget = (lesson, progress, lastAssignmentChallengeId) => {
    const id = isAssignmentChallenge(lesson, lastAssignmentChallengeId) ? lastAssignmentChallengeId : null;
    if (id && !(progress && progress.challenges && progress.challenges[id])) return { challengeId: id };
    return { libraryAfterId: id };
};
