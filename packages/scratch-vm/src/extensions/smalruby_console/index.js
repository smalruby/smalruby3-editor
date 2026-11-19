const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const Cast = require('../../util/cast');
let formatMessage = require('format-message');
const translations = require('./translations.json');
const blockIconURI = require('./console-icon-uri');

/**
 * The event the console emits for each line it shows (`runtime.emit(PRINT_EVENT, text)`).
 * The GUI keeps the lines and draws the console (it is not in the VM, so the
 * lines are not saved with the project).
 * @type {string}
 */
const PRINT_EVENT = 'SMALRUBY_CONSOLE_PRINT';

const setupTranslations = () => {
    const localeSetup = formatMessage.setup();
    if (localeSetup && localeSetup.translations[localeSetup.locale]) {
        Object.assign(localeSetup.translations[localeSetup.locale], translations[localeSetup.locale]);
    }
};

/**
 * The console: `表示する` (print a line) and `入力する` (take an answer) of the
 * Japanese mode (docs/dncl/design.md, chapter 5). The only extension the
 * Japanese mode adds: the rest of a Japanese program is the usual blocks.
 *
 * The input is the question of the sensing blocks (`聞いて待つ`) with no words,
 * so the questions of both wait in the one queue, and the GUI answers them in
 * the console while it is shown (on the stage otherwise).
 */
class SmalrubyConsoleBlocks {
    static get EXTENSION_ID() {
        return 'smalrubyConsole';
    }

    static get PRINT_EVENT() {
        return PRINT_EVENT;
    }

    constructor(runtime) {
        this.runtime = runtime;
        if (runtime && runtime.formatMessage) formatMessage = runtime.formatMessage;
        setupTranslations();
    }

    getInfo() {
        setupTranslations();
        return {
            id: SmalrubyConsoleBlocks.EXTENSION_ID,
            name: formatMessage({
                id: 'smalrubyConsole.categoryName',
                default: 'Console',
                description: 'Label for the console extension category',
            }),
            color1: '#5C6B73',
            color2: '#4D5A61',
            color3: '#3F4A50',
            blockIconURI,
            blocks: [
                {
                    opcode: 'print',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'smalrubyConsole.print',
                        default: 'print [TEXT]',
                        description: 'show a line in the console',
                    }),
                    arguments: {
                        TEXT: {
                            type: ArgumentType.STRING,
                            defaultValue: formatMessage({
                                id: 'smalrubyConsole.print.defaultText',
                                default: 'Hello!',
                                description: 'the default text of the print block',
                            }),
                        },
                    },
                },
                {
                    opcode: 'input',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'smalrubyConsole.input',
                        default: 'input',
                        description: 'wait for an answer in the console and report it',
                    }),
                    disableMonitor: true,
                },
            ],
            translationMap: translations,
        };
    }

    /**
     * Show a line in the console.
     * @param {object} args - The arguments (`TEXT`).
     */
    print(args) {
        this.runtime.emit(PRINT_EVENT, Cast.toString(args.TEXT));
    }

    /**
     * Wait for an answer and report it. The question is the one of `聞いて待つ`
     * with no words (`sensing_askandwait`), so its answer is also `答え`.
     * @param {object} args - The arguments (none).
     * @param {object} util - The block utility.
     * @returns {Promise<string>} The answer.
     */
    input(args, util) {
        const ask = this.runtime._primitives.sensing_askandwait;
        const answer = this.runtime._primitives.sensing_answer;
        if (!ask || !answer) return '';
        return Promise.resolve(ask({ QUESTION: '' }, util)).then(() => Cast.toString(answer()));
    }
}

module.exports = SmalrubyConsoleBlocks;
