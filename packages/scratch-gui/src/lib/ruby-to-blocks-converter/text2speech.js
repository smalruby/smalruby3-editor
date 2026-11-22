import { menuInputArg, registerSendTable, textArg } from './send-table';

const Text2Speech = 'text2speech';

const VoiceMenu = ['ALTO', 'TENOR', 'SQUEAK', 'GIANT', 'KITTEN'];

const LanguageMenu = [
    'ar',
    'zh-cn',
    'da',
    'nl',
    'en',
    'fr',
    'de',
    'hi',
    'is',
    'it',
    'ja',
    'ko',
    'nb',
    'pl',
    'pt-br',
    'pt',
    'ro',
    'ru',
    'ES',
    'es-419',
    'sv',
    'tr',
    'cy',
];

// The language of the shadow behind a block argument: the language of the project, or English.
const defaultLanguageOf = (converter) => {
    const stage = converter.vm.runtime.getTargetForStage();
    return stage && stage.textToSpeechLanguage ? stage.textToSpeechLanguage : 'en';
};

// The calls that map one to one onto a block (send-table.js). A string of a voice or a language is
// looked up without regard to case (`"alto"` → `ALTO`, `"EN"` → `en`).
const TEXT2SPEECH_SENDS = [
    {
        receiver: Text2Speech,
        name: 'speak',
        opcode: 'text2speech_speakAndWait',
        changesReceiver: true,
        args: [textArg('WORDS', 'hello')],
    },
    {
        receiver: Text2Speech,
        name: 'voice=',
        opcode: 'text2speech_setVoice',
        changesReceiver: true,
        args: [
            menuInputArg('VOICE', 'text2speech_menu_voices', 'voices', 'ALTO', {
                choices: VoiceMenu,
                normalize: (value) => value.toUpperCase(),
            }),
        ],
    },
    {
        receiver: Text2Speech,
        name: 'language=',
        opcode: 'text2speech_setLanguage',
        changesReceiver: true,
        args: [
            menuInputArg('LANGUAGE', 'text2speech_menu_languages', 'languages', defaultLanguageOf, {
                choices: LanguageMenu,
                normalize: (value) => value.toLowerCase(),
            }),
        ],
    },
];

/**
 * Text to Speech converter
 */
const Text2SpeechConverter = {
    sends: TEXT2SPEECH_SENDS,

    register: function (converter) {
        // `text2speech` itself is a Ruby expression that the calls of the table turn into their blocks.
        converter.registerOnSend('self', Text2Speech, 0, (params) => {
            const { node } = params;

            return converter.createRubyExpressionBlock(Text2Speech, node);
        });

        registerSendTable(converter, TEXT2SPEECH_SENDS);
    },
};

export default Text2SpeechConverter;
