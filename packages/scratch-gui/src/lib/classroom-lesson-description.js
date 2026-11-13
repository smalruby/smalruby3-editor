/**
 * The lesson description that goes into an assignment page (#1780).
 *
 * When the teacher links a lesson, the assignment's first page gets a short,
 * friendly text for the students: the course name, what the course teaches,
 * the completion condition, how many required (★) challenges there are, that
 * the order is free, and — when work is also submitted — "make a project with
 * what you learned and submit it".
 *
 * Page text is plain text written in one language (like the official
 * templates), so the description is written in the teacher's UI language:
 * ja (kanji and kana), ja-Hira (hiragana only, for younger students) or en
 * (any other locale). Course names / descriptions come from the course data
 * (lib/lessons/lessons.locale.js).
 *
 * The rest is the pure logic of when the text is written: into empty pages
 * right away, following the lesson while page 1 is still the generated text,
 * and otherwise only after the teacher says yes (shouldAskOverwrite).
 */
import { createLessonDraft, setLessonChecked } from './classroom-lesson-settings.js';
import { COURSES } from './lessons/courses.js';
import { en as lessonsEn, ja as lessonsJa, jaHira as lessonsJaHira } from './lessons/lessons.locale.js';

const LESSON_MESSAGES = { ja: lessonsJa, 'ja-Hira': lessonsJaHira, en: lessonsEn };

// One template per language. Each line is a function so plural forms (en)
// and optional lines stay readable.
const TEXT = {
    ja: {
        intro: (course) => `「${course}」のレッスンにチャレンジしよう！`,
        conditionAll: (total) => `・チャレンジは ${total} つ。全部できたら課題クリア！`,
        conditionCount: (total, target) => `・チャレンジは ${total} つ。そのうち ${target} つできたら課題クリア！`,
        required: (required) => `・★ のついたチャレンジ ${required} つは、かならずやろう。`,
        order: '・やる順番は自由！ 好きなチャレンジからはじめよう。',
        submit: '・おわったら、学んだことをつかって作品をつくって提出しよう。',
    },
    'ja-Hira': {
        intro: (course) => `「${course}」の レッスンに チャレンジしよう！`,
        conditionAll: (total) => `・チャレンジは ${total} つ。ぜんぶ できたら かだいクリア！`,
        conditionCount: (total, target) =>
            `・チャレンジは ${total} つ。そのうち ${target} つ できたら かだいクリア！`,
        required: (required) => `・★ の ついた チャレンジ ${required} つは、かならず やろう。`,
        order: '・やる じゅんばんは じゆう！ すきな チャレンジから はじめよう。',
        submit: '・おわったら、まなんだことを つかって さくひんを つくって ていしゅつしよう。',
    },
    en: {
        intro: (course) => `Let's try the "${course}" lesson!`,
        conditionAll: (total) =>
            total === 1
                ? '- There is 1 challenge. Finish it to clear the assignment!'
                : `- There are ${total} challenges. Finish all of them to clear the assignment!`,
        conditionCount: (total, target) =>
            `- There are ${total} challenges. Finish ${target} of them to clear the assignment!`,
        required: (required) =>
            required === 1
                ? '- Be sure to do the challenge marked ★.'
                : `- Be sure to do the ${required} challenges marked ★.`,
        order: '- You can do them in any order. Start with the one you like!',
        submit: '- When you finish, use what you learned to make a project and submit it.',
    },
};

/**
 * @param {?string} locale - the UI locale (e.g. 'ja', 'ja-Hira', 'en', 'zh-cn')
 * @returns {string} the language of the description: 'ja' | 'ja-Hira' | 'en'
 */
export const descriptionLocale = (locale) => {
    if (locale === 'ja-Hira') return 'ja-Hira';
    if (typeof locale === 'string' && (locale === 'ja' || locale.startsWith('ja-'))) return 'ja';
    return 'en';
};

const courseText = (descriptor, lang) => {
    if (!descriptor) return '';
    return (
        LESSON_MESSAGES[lang][descriptor.id] || LESSON_MESSAGES.ja[descriptor.id] || descriptor.defaultMessage || ''
    );
};

/**
 * The description of a lesson for the assignment page.
 * @param {object} params - inputs
 * @param {?object} params.course - the draft's course (lib/lessons/courses.js)
 * @param {?object} params.draft - lesson draft (lib/classroom-lesson-settings.js): the chosen
 *     challenges, the required ones, the completion condition and submitWork
 * @param {?string} params.locale - the teacher's UI locale
 * @returns {string} the text ('' when there is nothing to describe)
 */
export const buildLessonDescription = ({ course, draft, locale }) => {
    if (!course || !draft || draft.challengeIds.length === 0) return '';
    const lang = descriptionLocale(locale);
    const text = TEXT[lang];
    const total = draft.challengeIds.length;
    const required = draft.requiredChallengeIds.length;
    const count = draft.completion.type === 'count' ? draft.completion.count : null;
    // Same rule as completionTarget: the count never goes below the required ones.
    const target =
        count === null || typeof count === 'undefined' ? total : Math.min(Math.max(count, required), total);
    const lines = [text.intro(courseText(course.name, lang))];
    const what = courseText(course.description, lang);
    if (what) lines.push(what);
    lines.push('');
    lines.push(target >= total ? text.conditionAll(total) : text.conditionCount(total, target));
    if (required > 0) lines.push(text.required(required));
    lines.push(text.order);
    if (draft.submitWork) lines.push(text.submit);
    return lines.join('\n');
};

const isBlank = (text) => !(text || '').trim();

/**
 * "The page is empty": no page has text. An attached image alone does not
 * count — the description goes above it.
 * @param {Array<object>} pages - editor pages
 * @returns {boolean} whether the pages have no text
 */
export const pagesAreEmpty = (pages) => pages.every((page) => isBlank(page.text));

const withFirstText = (pages, text) =>
    pages.length === 0 ? [{ text }] : pages.map((page, i) => (i === 0 ? { ...page, text } : page));

/**
 * The pages after the lesson changed, without asking: the description goes
 * into empty pages, and follows the lesson while page 1 is still the text
 * generated for the previous lesson (it goes away with「レッスンを使わない」).
 * @param {Array<object>} pages - editor pages
 * @param {string} previousText - the description of the lesson before the change
 * @param {string} nextText - the description of the lesson after the change
 * @returns {?Array<object>} new pages, or null to leave them as they are
 */
export const autoDescriptionPages = (pages, previousText, nextText) => {
    const first = pages.length > 0 ? pages[0].text || '' : '';
    if (first === nextText) return null;
    const generated = previousText !== '' && first === previousText;
    if (generated || (pagesAreEmpty(pages) && nextText !== '')) return withFirstText(pages, nextText);
    return null;
};

/**
 * Whether closing the lesson panel asks「ページの説明をレッスンの説明で上書きしますか？」:
 * there is a description and the pages hold something else the teacher wrote.
 * @param {Array<object>} pages - editor pages
 * @param {string} text - the description of the current lesson
 * @returns {boolean} whether to ask
 */
export const shouldAskOverwrite = (pages, text) =>
    text !== '' && !pagesAreEmpty(pages) && (pages[0] ? pages[0].text || '' : '') !== text;

/**
 * ［はい］: the description replaces the text of page 1. Its image and the
 * other pages stay.
 * @param {Array<object>} pages - editor pages
 * @param {string} text - the description
 * @returns {Array<object>} new pages
 */
export const overwriteDescriptionPages = (pages, text) => withFirstText(pages, text);

/**
 * The lesson an assignment made with［＋ 作成 ▾］→「レッスン」starts with:
 * the first lesson of the first course, all its challenges.
 * @param {Array<object>} [courses] - courses (for tests)
 * @returns {?object} lesson draft (null without courses)
 */
export const firstLessonDraft = (courses = COURSES) => {
    const course = courses[0];
    if (!course || course.lessons.length === 0) return null;
    return setLessonChecked(createLessonDraft(course.id), course, course.lessons[0].id, true);
};
