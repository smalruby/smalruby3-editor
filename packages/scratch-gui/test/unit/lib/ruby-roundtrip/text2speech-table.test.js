/**
 * Text to Speech blocks ⇔ Ruby, as a table (block notation: test/unit/helpers/block-notation.js).
 * It fixes the output of the converter before the calls of Text to Speech move into a send table
 * (issue #2090); ruby-roundtrip/extension_text2speech.test.js stays as the long round trip.
 */
import { defineBlockRubyTable } from '../../helpers/block-ruby-table';

const voice = (value) => `text2speech_menu_voices(voices = "${value}")`;
const language = (value) => `text2speech_menu_languages(languages = "${value}")`;

const rows = [
    { blocks: 'text2speech_speakAndWait(WORDS: "hello")', ruby: 'text2speech.speak("hello")' },
    { blocks: 'text2speech_speakAndWait(WORDS: $w)', ruby: 'text2speech.speak($w)' },
    ...['ALTO', 'TENOR', 'SQUEAK', 'GIANT', 'KITTEN'].map((name) => ({
        blocks: `text2speech_setVoice(VOICE: ${voice(name)})`,
        ruby: `text2speech.voice = "${name}"`,
    })),
    { blocks: `text2speech_setVoice(VOICE: ${voice('ALTO')})`, ruby: 'text2speech.voice = "alto"', only: 'toBlocks' },
    {
        blocks: `text2speech_setVoice(VOICE: ${voice('KITTEN')})`,
        ruby: 'text2speech.voice = "Kitten"',
        only: 'toBlocks',
    },
    { blocks: 'text2speech_setVoice(VOICE: $v)', ruby: 'text2speech.voice = $v' },
    ...['en', 'ja', 'de', 'zh-cn', 'pt-br', 'es-419'].map((name) => ({
        blocks: `text2speech_setLanguage(LANGUAGE: ${language(name)})`,
        ruby: `text2speech.language = "${name}"`,
    })),
    // `ES` is the one upper-case value of the menu: a string is lowered before it is looked up, so
    // "ES" is not found and the call is not converted (only `$l` or the lower-case names are).
    {
        blocks: `text2speech_setLanguage(LANGUAGE: ${language('en')})`,
        ruby: 'text2speech.language = "EN"',
        only: 'toBlocks',
    },
    { blocks: 'text2speech_setLanguage(LANGUAGE: $l)', ruby: 'text2speech.language = $l' },
];

defineBlockRubyTable('Text to Speech blocks ⇔ Ruby', rows, { versions: ['1', '2'] });

defineBlockRubyTable(
    'Text to Speech blocks ⇔ Ruby (stage)',
    [
        { blocks: 'text2speech_speakAndWait(WORDS: "hello")', ruby: 'text2speech.speak("hello")' },
        { blocks: `text2speech_setVoice(VOICE: ${voice('GIANT')})`, ruby: 'text2speech.voice = "GIANT"' },
        { blocks: `text2speech_setLanguage(LANGUAGE: ${language('ja')})`, ruby: 'text2speech.language = "ja"' },
    ],
    { stage: true },
);
