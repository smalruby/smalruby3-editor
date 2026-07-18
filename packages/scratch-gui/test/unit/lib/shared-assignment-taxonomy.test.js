import {
    MAX_TAGS,
    SCHOOL_LEVELS,
    SUBJECTS_BY_LEVEL,
    gradesForLevel,
    parseTags,
} from '../../../src/lib/shared-assignment-taxonomy.js';

describe('shared assignment taxonomy (D5)', () => {
    test('school levels carry their grade ranges', () => {
        expect(SCHOOL_LEVELS.map((l) => l.value)).toEqual(['elementary', 'junior-high', 'high', 'other']);
        expect(gradesForLevel('elementary')).toEqual([1, 2, 3, 4, 5, 6]);
        expect(gradesForLevel('junior-high')).toEqual([1, 2, 3]);
        expect(gradesForLevel('high')).toEqual([1, 2, 3]);
        expect(gradesForLevel('nope')).toEqual([]);
    });

    test('subject vocabularies mirror the server', () => {
        expect(SUBJECTS_BY_LEVEL['junior-high']).toContain('技術・家庭（技術分野）');
        expect(SUBJECTS_BY_LEVEL.high).toEqual(['情報Ⅰ', '情報Ⅱ', 'その他']);
        expect(SUBJECTS_BY_LEVEL.other).toEqual([]);
    });
});

describe('parseTags', () => {
    test('splits on commas (ja/en) and whitespace, trims and dedupes', () => {
        expect(parseTags('甲子園, メッシュ、入門 甲子園')).toEqual(['甲子園', 'メッシュ', '入門']);
    });

    test('caps at MAX_TAGS and drops empty/overlong tags', () => {
        expect(parseTags('a,b,c,d,e,f,g')).toHaveLength(MAX_TAGS);
        expect(parseTags(`ok,${'x'.repeat(21)}`)).toEqual(['ok']);
        expect(parseTags('')).toEqual([]);
        expect(parseTags(null)).toEqual([]);
    });
});
