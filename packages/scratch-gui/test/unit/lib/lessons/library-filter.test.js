import { COURSES, defineCourse, defineLesson, LANGUAGES } from '../../../../src/lib/lessons/courses';
import { emptyProgress } from '../../../../src/lib/lessons/lesson-progress';
import {
    COURSE_NAV_THRESHOLD,
    filterCourseStatuses,
    libraryLanguages,
    matchesQuery,
    normalizeQuery,
    showCourseNav,
} from '../../../../src/lib/lessons/library-filter';

// チャレンジの名前（テストでは id をそのまま名前にする）
const nameOf = (challenge) => challenge.id;

const makeCourse = (id, lessons, language = LANGUAGES.BLOCKS) => defineCourse({ id, language, lessons });
const makeLesson = (id, challengeIds) => defineLesson({ id, challenges: challengeIds.map((cid) => ({ id: cid })) });

describe('normalizeQuery', () => {
    test('trims, lowercases and folds full-width letters', () => {
        expect(normalizeQuery('  Ｋｅｙ ')).toBe('key');
        expect(normalizeQuery('')).toBe('');
        expect(normalizeQuery(null)).toBe('');
    });

    test('folds katakana (full- and half-width) into hiragana', () => {
        expect(normalizeQuery('クイズ')).toBe('くいず');
        expect(normalizeQuery('ｷｰ')).toBe('きー');
    });
});

describe('matchesQuery', () => {
    test('matches a part of the name, ignoring case', () => {
        expect(matchesQuery('キーで音を鳴らそう', 'キー')).toBe(true);
        expect(matchesQuery('Play a Sound with a Key', 'KEY')).toBe(true);
        expect(matchesQuery('くり返そう', 'キー')).toBe(false);
        expect(matchesQuery('クイズを作ろう', 'くいず')).toBe(true);
        expect(matchesQuery('キーでおとをならそう', 'きー')).toBe(true);
    });

    test('an empty query matches everything', () => {
        expect(matchesQuery('anything', '')).toBe(true);
        expect(matchesQuery('anything', '   ')).toBe(true);
    });
});

describe('filterCourseStatuses', () => {
    const courses = [
        makeCourse('c1', [makeLesson('l1', ['key-sound', 'arrow-move']), makeLesson('l2', ['repeat'])]),
        makeCourse('c2', [makeLesson('l3', ['say-hello'])]),
    ];

    test('without a query, keeps every course, lesson and challenge', () => {
        const result = filterCourseStatuses(courses, emptyProgress(), '', nameOf);
        expect(result.map((s) => s.course.id)).toEqual(['c1', 'c2']);
        expect(result[0].lessons.map((l) => l.lesson.id)).toEqual(['l1', 'l2']);
        expect(result[0].lessons[0].challenges.map((c) => c.challenge.id)).toEqual(['key-sound', 'arrow-move']);
    });

    test('keeps only the matching challenges and hides lessons and courses without any', () => {
        const result = filterCourseStatuses(courses, emptyProgress(), 'key', nameOf);
        expect(result.map((s) => s.course.id)).toEqual(['c1']);
        expect(result[0].lessons.map((l) => l.lesson.id)).toEqual(['l1']);
        expect(result[0].lessons[0].challenges.map((c) => c.challenge.id)).toEqual(['key-sound']);
    });

    test('keeps the progress of the whole course while filtering', () => {
        const result = filterCourseStatuses(courses, emptyProgress(), 'key', nameOf);
        expect(result[0].total).toBe(3);
        expect(result[0].lessons[0].number).toBe(1);
    });

    test('returns nothing when no challenge matches', () => {
        expect(filterCourseStatuses(courses, emptyProgress(), 'zzz', nameOf)).toEqual([]);
    });
});

describe('libraryLanguages', () => {
    test('shows only languages that have a course, in the fixed order', () => {
        expect(libraryLanguages(COURSES)).toEqual([LANGUAGES.BLOCKS]);
        const ruby = makeCourse('r', [], LANGUAGES.RUBY);
        expect(libraryLanguages([ruby, ...COURSES])).toEqual([LANGUAGES.BLOCKS, LANGUAGES.RUBY]);
    });
});

describe('showCourseNav', () => {
    test('shows the course buttons only when there are more than 4 courses', () => {
        expect(COURSE_NAV_THRESHOLD).toBe(4);
        const many = (n) => Array.from({ length: n }, (_, i) => makeCourse(`c${i}`, []));
        expect(showCourseNav(many(1))).toBe(false);
        expect(showCourseNav(many(4))).toBe(false);
        expect(showCourseNav(many(5))).toBe(true);
    });
});
