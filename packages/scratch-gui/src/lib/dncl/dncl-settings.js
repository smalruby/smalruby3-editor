// === Smalruby: This file is Smalruby-specific (the settings of a Japanese mode program) ===
import { SETTINGS_PATTERNS, settingsOfSource, withSettings } from '@smalruby/ja-notation';
import { dnclToRuby } from './dncl-to-ruby';
import { rubyToDncl } from './ruby-to-dncl';

// The settings of a program of the Japanese mode (where the array indexes
// start, the comment mark, the explanation of the logical operators) are the
// sentences at its top (docs/dncl/design.md 4 章). They are not kept anywhere
// else: the Ruby comments stay with the blocks, so the project keeps them.

/**
 * The pattern of settings a program is written by.
 * @param {string} dncl - The Japanese of the editor.
 * @returns {?string} The id of the pattern (`example`, `indexFromOne`), or
 *   null when the settings are not one of the patterns.
 */
const dnclSettingsPatternId = (dncl) => {
    const settings = settingsOfSource(dncl);
    const pattern = SETTINGS_PATTERNS.find((p) =>
        Object.keys(p.settings).every((key) => p.settings[key] === settings[key]),
    );
    return pattern ? pattern.id : null;
};

/**
 * The same program written by the settings of a pattern: the sentences at the
 * top are written for the pattern and the program is written again by them, so
 * it means the same (`A[0]` becomes `A[1]` when the indexes come to start at
 * 1). A program that cannot become Ruby keeps its code as it is, and only the
 * sentences at the top change.
 * prism must be loaded first (`loadPrism()` of src/lib/prism-parser.js).
 * @param {string} dncl - The Japanese of the editor.
 * @param {string} patternId - The id of the pattern.
 * @returns {string} The Japanese.
 */
const dnclWithSettingsPattern = (dncl, patternId) => {
    const pattern = SETTINGS_PATTERNS.find((p) => p.id === patternId);
    if (!pattern) return dncl;
    const { ruby } = dnclToRuby(dncl);
    if (ruby === null) return withSettings(dncl, pattern.settings);
    return rubyToDncl(withSettings(ruby, pattern.settings)).dncl;
};

/**
 * The program with the setting that the array indexes start at 1, for a
 * paste whose comments say so (`# 配列の添字は1から始まる`): the sentence is
 * written at the top, and the indexes are kept as they are written.
 * @param {string} dncl - The Japanese of the editor.
 * @returns {?string} The Japanese, or null when the indexes start at 1 already.
 */
const dnclWithIndexFromOne = (dncl) => {
    const settings = settingsOfSource(dncl);
    if (settings.indexBase === 1) return null;
    return withSettings(dncl, { ...settings, indexBase: 1 });
};

export { dnclSettingsPatternId, dnclWithIndexFromOne, dnclWithSettingsPattern, SETTINGS_PATTERNS };
