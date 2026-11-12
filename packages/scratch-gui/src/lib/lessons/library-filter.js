// レッスン表の絞り込み（検索）と、上の帯に出すもの（言語のボタン・コースのボタン）を決める純粋関数。
// 見せる側は components/lessons-library/lessons-library.jsx。
import { LANGUAGES } from './courses';
import { courseProgress } from './lesson-progress';

/** 上の帯の言語のボタンの並び（コースがある言語だけ出す）。 */
export const LANGUAGE_ORDER = Object.freeze([LANGUAGES.BLOCKS, LANGUAGES.RUBY, LANGUAGES.DNCL]);

/**
 * コースがこの数を超えたら、帯の 2 段目にコースのボタン（押すとそのコースまでスクロール）を出す。
 * 少ないうちは縦に並べたコースの見出しで足りる（#1530 の案 3 の A）。
 */
export const COURSE_NAV_THRESHOLD = 4;

// カタカナ（ァ〜ヶ）とひらがな（ぁ〜ゖ）の符号位置の差
const KATAKANA_TO_HIRAGANA = 0x60;

/**
 * 検索の文字を比べやすい形にする（前後の空白を取る・全角英数を半角に・小文字に・カタカナをひらがなに）。
 * カタカナをひらがなにそろえるのは、「クイズ」を「くいず」と打っても見つかるようにするため
 * （子どもはカタカナに変換せずに打つことが多い）。
 * @param {?string} query - 入力された文字。
 * @returns {string} 比べる文字（空なら絞り込まない）。
 */
export const normalizeQuery = (query) =>
    String(query || '')
        .normalize('NFKC')
        .trim()
        .toLowerCase()
        .replace(/[\u30a1-\u30f6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - KATAKANA_TO_HIRAGANA));

/**
 * 名前が検索の文字を含むか（部分一致）。空の検索は全部に合う。
 * @param {string} name - チャレンジの名前（いまの locale の文言）。
 * @param {?string} query - 入力された文字。
 * @returns {boolean} 合えば true。
 */
export const matchesQuery = (name, query) => {
    const q = normalizeQuery(query);
    if (!q) return true;
    return normalizeQuery(name).includes(q);
};

/**
 * コースごとの進み具合（`courseProgress`）を、検索に合うチャレンジだけに絞って返す。
 * 合うチャレンジが無いレッスン・コースは除く。進み具合の数（`completedCount` / `total` /
 * `allCompleted`）とレッスンの番号は、絞る前のコース全体のまま（見出しのバーは検索で変えない）。
 * @param {Array<object>} courses - コース。
 * @param {object} progress - 記録。
 * @param {?string} query - 入力された文字。
 * @param {function(object): string} nameOf - チャレンジ → いまの locale の名前。
 * @returns {Array<object>} `{course, completedCount, total, allCompleted, lessons}` の並び。
 */
export const filterCourseStatuses = (courses, progress, query, nameOf) => {
    const q = normalizeQuery(query);
    return courses
        .map((course) => {
            const status = courseProgress(course, progress);
            if (!q) return { course, ...status };
            const lessons = status.lessons
                .map((lessonStatus) => ({
                    ...lessonStatus,
                    challenges: lessonStatus.challenges.filter(({ challenge }) => matchesQuery(nameOf(challenge), q)),
                }))
                .filter((lessonStatus) => lessonStatus.challenges.length > 0);
            return { course, ...status, lessons };
        })
        .filter((status) => !q || status.lessons.length > 0);
};

/**
 * 上の帯に出す言語（コースがある言語だけ。並びは `LANGUAGE_ORDER`）。Ruby・日本語のボタンは
 * コースができたら自然に出る。
 * @param {Array<object>} courses - コース。
 * @returns {Array<string>} 言語の並び。
 */
export const libraryLanguages = (courses) =>
    LANGUAGE_ORDER.filter((language) => courses.some((course) => course.language === language));

/**
 * コースのボタン（帯の 2 段目）を出すか。
 * @param {Array<object>} courses - いま選んでいる言語のコース。
 * @returns {boolean} 出すなら true。
 */
export const showCourseNav = (courses) => courses.length > COURSE_NAV_THRESHOLD;
