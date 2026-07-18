/**
 * みんなの課題 (shared assignment library) attribute taxonomy — EPIC #1066 D5.
 *
 * Mirrors the server's controlled vocabulary (infra/smalruby-classroom
 * lambda/handler.ts SHARED_SUBJECTS): school level × grades × subject plus
 * free tags. Subjects are Japanese strings by design (they ARE the values,
 * not i18n keys); school level labels are translated by the components.
 */

export const SCHOOL_LEVELS = [
    { value: 'elementary', maxGrade: 6 },
    { value: 'junior-high', maxGrade: 3 },
    { value: 'high', maxGrade: 3 },
    { value: 'other', maxGrade: 6 },
];

/** Controlled subject vocabulary per school level ('other' is free text). */
export const SUBJECTS_BY_LEVEL = {
    elementary: ['総合的な学習の時間', '算数', '理科', '図画工作', '特別活動・クラブ', 'その他'],
    'junior-high': ['技術・家庭（技術分野）', '数学', '理科', '総合的な学習の時間', 'その他'],
    high: ['情報Ⅰ', '情報Ⅱ', 'その他'],
    other: [],
};

export const MAX_TAGS = 5;
export const MAX_TAG_LENGTH = 20;

/**
 * Grade choices (1..max) for a school level.
 * @param {string} schoolLevel - one of SCHOOL_LEVELS values
 * @returns {Array<number>} selectable grades
 */
export const gradesForLevel = (schoolLevel) => {
    const level = SCHOOL_LEVELS.find((l) => l.value === schoolLevel);
    return level ? Array.from({ length: level.maxGrade }, (_, i) => i + 1) : [];
};

/**
 * Parse a free tag input ("甲子園, 入門" / space separated) into a clean
 * tag list: trimmed, deduplicated, capped at MAX_TAGS.
 * @param {string} raw - raw input text
 * @returns {Array<string>} normalized tags
 */
export const parseTags = (raw) =>
    [
        ...new Set(
            String(raw || '')
                .split(/[,、\s]+/)
                .map((t) => t.trim())
                .filter((t) => t.length > 0 && t.length <= MAX_TAG_LENGTH),
        ),
    ].slice(0, MAX_TAGS);
