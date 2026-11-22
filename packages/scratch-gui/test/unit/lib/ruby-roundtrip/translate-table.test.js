/**
 * Translate blocks ⇔ Ruby, as a table (block notation: test/unit/helpers/block-notation.js).
 * It fixes the output of the converter before the calls of Translate move into a send table
 * (issue #2090); ruby-roundtrip/extension_translate*.test.js stay as the long round trips.
 */
import { defineBlockRubyTable } from '../../helpers/block-ruby-table';

const language = (value) => `translate_menu_languages(languages = "${value}")`;

defineBlockRubyTable('Translate blocks ⇔ Ruby (v2)', [
    {
        blocks: `looks_say(MESSAGE: translate_getTranslate(WORDS: "hello", LANGUAGE: ${language('ja')}))`,
        ruby: 'say(translate.call("hello", "ja"))',
    },
    {
        blocks: `looks_say(MESSAGE: translate_getTranslate(WORDS: $w, LANGUAGE: ${language('en')}))`,
        ruby: 'say(translate.call($w, "en"))',
    },
    // A number of the words becomes the text of its digits (and comes back as a string).
    {
        blocks: `looks_say(MESSAGE: translate_getTranslate(WORDS: "1", LANGUAGE: ${language('ja')}))`,
        ruby: 'say(translate.call(1, "ja"))',
        only: 'toBlocks',
    },
    {
        blocks: `looks_say(MESSAGE: translate_getTranslate(WORDS: "1.5", LANGUAGE: ${language('ja')}))`,
        ruby: 'say(translate.call(1.5, "ja"))',
        only: 'toBlocks',
    },
    {
        blocks: 'looks_say(MESSAGE: translate_getTranslate(WORDS: "hello", LANGUAGE: $l))',
        ruby: 'say(translate.call("hello", $l))',
    },
    { blocks: 'translate_getViewerLanguage', ruby: 'translate.language' },
    { blocks: 'looks_say(MESSAGE: translate_getViewerLanguage)', ruby: 'say(translate.language)' },
    // The form of version 1 is read in version 2 too, and written in the form of version 2.
    {
        blocks: `looks_say(MESSAGE: translate_getTranslate(WORDS: "hello", LANGUAGE: ${language('ja')}))`,
        ruby: 'say(translate("hello", "ja"))',
        only: 'toBlocks',
    },
    { blocks: 'looks_say(MESSAGE: translate_getViewerLanguage)', ruby: 'say(language)', only: 'toBlocks' },
]);

defineBlockRubyTable(
    'Translate blocks ⇔ Ruby (v2, stage)',
    [{ blocks: 'translate_getViewerLanguage', ruby: 'translate.language' }],
    { stage: true },
);

defineBlockRubyTable(
    'Translate blocks ⇔ Ruby (v1)',
    [
        {
            blocks: `looks_say(MESSAGE: translate_getTranslate(WORDS: "hello", LANGUAGE: ${language('ja')}))`,
            ruby: 'say(translate("hello", "ja"))',
        },
        {
            blocks: 'looks_say(MESSAGE: translate_getTranslate(WORDS: $w, LANGUAGE: $l))',
            ruby: 'say(translate($w, $l))',
        },
        { blocks: 'looks_say(MESSAGE: translate_getViewerLanguage)', ruby: 'say(language)' },
        {
            blocks: `looks_say(MESSAGE: translate_getTranslate(WORDS: "1", LANGUAGE: ${language('ja')}))`,
            ruby: 'say(translate(1, "ja"))',
            only: 'toBlocks',
        },
    ],
    { version: '1' },
);
