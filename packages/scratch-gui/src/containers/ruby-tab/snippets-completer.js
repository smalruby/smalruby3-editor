import BaseCompleter from './base-completer';

import MotionSnippets from './motion-snippets.json';
import LooksSnippets from './looks-snippets.json';
import SoundSnippets from './sound-snippets.json';
import EventsSnippets from './events-snippets.json';
import ControlSnippets from './control-snippets.json';
import SensingSnippets from './sensing-snippets.json';
import OperatorsSnippets from './operators-snippets.json';
import VariablesSnippets from './variables-snippets.json';
import ProcedureSnippets from './procedure-snippets.json';

import MusicSnippets from './music-snippets.json';
import PenSnippets from './pen-snippets.json';
import VideoSensingSnippets from './video-sensing-snippets.json';
import TextToSpeechSnippets from './text-to-speech-snippets.json';
import TranslateSnippets from './translate-snippets.json';
import MicrobitSnippets from './microbit-snippets.json';
import SmalrubotS1Snippets from './smalrubot-s1-snippets.json';
import MicrobitMoreSnippets from './microbit-more-snippets.json';
import KoshienSnippets from './koshien-snippets.json';
import MakeySnippets from './makey-snippets.json';
import GdxForSnippets from './gdx_for-snippets.json';

// Regex to detect Japanese characters (hiragana, katakana, kanji)
const JAPANESE_CHAR_PATTERN = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/;

// Regex to detect expression-expected keywords at end of line before cursor
const EXPRESSION_KEYWORD_PATTERN = /\b(if|unless|until|while|elsif)\s+$/;

// Context types for completion filtering
const CONTEXT_TOP_LEVEL = 'top_level';
const CONTEXT_INSIDE_BLOCK = 'inside_block';
const CONTEXT_EXPRESSION_EXPECTED = 'expression_expected';

// Allowed snippet types per context
const CONTEXT_ALLOWED_TYPES = {
    [CONTEXT_TOP_LEVEL]: new Set(['event', 'enum_member']),
    [CONTEXT_INSIDE_BLOCK]: new Set(['function', 'method', 'snippet', 'variable', 'value', 'constant', 'enum_member']),
    [CONTEXT_EXPRESSION_EXPECTED]: new Set(['variable', 'value', 'constant', 'method', 'enum_member'])
};

class SnippetsCompleter extends BaseCompleter {
    #coreCompletions = [];
    #extensionCompletions = [];
    #vm;

    constructor (vm) {
        super();
        this.#vm = vm;

        const coreSnippetsList = [
            {snippets: MotionSnippets, category: '01'},
            {snippets: LooksSnippets, category: '02'},
            {snippets: SoundSnippets, category: '03'},
            {snippets: EventsSnippets, category: '04'},
            {snippets: ControlSnippets, category: '05'},
            {snippets: SensingSnippets, category: '06'},
            {snippets: OperatorsSnippets, category: '07'},
            {snippets: VariablesSnippets, category: '08'},
            {snippets: ProcedureSnippets, category: '09'}
        ];

        const extensionSnippetsList = [
            {snippets: MusicSnippets, category: '10', extensionId: 'music'},
            {snippets: PenSnippets, category: '11', extensionId: 'pen'},
            {snippets: VideoSensingSnippets, category: '12', extensionId: 'videoSensing'},
            {snippets: TextToSpeechSnippets, category: '13', extensionId: 'text2speech'},
            {snippets: TranslateSnippets, category: '14', extensionId: 'translate'},
            {snippets: MicrobitSnippets, category: '15', extensionId: 'microbit'},
            {snippets: SmalrubotS1Snippets, category: '17', extensionId: 'smalrubotS1'},
            {snippets: MicrobitMoreSnippets, category: '18', extensionId: 'microbitMore'},
            {snippets: KoshienSnippets, category: '19', extensionId: 'koshien'},
            {snippets: MakeySnippets, category: '20', extensionId: 'makeymakey'},
            {snippets: GdxForSnippets, category: '21', extensionId: 'gdxfor'}
        ];

        const processSnippets = (list, target) => {
            list.forEach(({snippets, category, extensionId}) => {
                for (const [caption, item] of Object.entries(snippets)) {
                    item.caption = caption;
                    item.type = item.type || 'snippet';
                    if (!item.sortText) {
                        item.sortText = `${category}_${caption}`;
                    }
                    if (extensionId) {
                        item.extensionId = extensionId;
                    }
                    target.push(item);
                }
            });
        };

        processSnippets(coreSnippetsList, this.#coreCompletions);
        processSnippets(extensionSnippetsList, this.#extensionCompletions);
    }

    /**
     * Provide completion items for Monaco Editor.
     * @param {object} model - Monaco text model.
     * @param {object} position - Current cursor position.
     * @param {object} context - Completion context.
     * @param {object} token - Cancellation token.
     * @param {object} monaco - The monaco instance.
     * @returns {object} Completion items.
     */
    provideCompletionItems (model, position, context, token, monaco) {
        const word = model.getWordUntilPosition(position);

        // Allow single Japanese character to trigger completions (e.g. "動"),
        // but require at least 3 characters for ASCII input to avoid noise.
        const isJapanese = JAPANESE_CHAR_PATTERN.test(word.word);
        const minLength = isJapanese ? 1 : 3;
        if (word.word.length < minLength) {
            return {suggestions: []};
        }

        const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn
        };

        const activeCompletions = this.#coreCompletions.concat(
            this.#extensionCompletions.filter(item => this.#isExtensionActive(item.extensionId))
        );

        const detectedContext = this.#detectContext(model, position);
        const filteredCompletions = this.#filterByContext(activeCompletions, detectedContext);

        const suggestions = filteredCompletions.map(item => this.toCompletionItem(item, range, monaco));

        return {
            suggestions: suggestions
        };
    }

    /**
     * Detect the code context at the cursor position.
     * @param {object} model - Monaco text model.
     * @param {object} position - Current cursor position.
     * @returns {string} One of 'top_level', 'inside_block', or 'expression_expected'.
     */
    #detectContext (model, position) {
        const textBeforeCursor = model.getValueInRange({
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column
        });

        // Count nesting level by tracking do/def vs end keywords
        let nestingLevel = 0;
        const lines = textBeforeCursor.split('\n');
        for (const line of lines) {
            // Strip comments
            const codePart = line.replace(/#.*$/, '');
            const opens = (codePart.match(/\bdo\b/g) || []).length +
                          (codePart.match(/\bdef\s/g) || []).length;
            const closes = (codePart.match(/\bend\b/g) || []).length;
            nestingLevel += opens - closes;
        }

        if (nestingLevel <= 0) {
            return CONTEXT_TOP_LEVEL;
        }

        // Check current line for expression-expected patterns
        const textUntilPosition = model.getValueInRange({
            startLineNumber: position.lineNumber,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column
        });

        // Remove the current word being typed to check the preceding context
        const wordBeforeCursor = textUntilPosition.replace(/\S+$/, '');
        if (EXPRESSION_KEYWORD_PATTERN.test(wordBeforeCursor)) {
            return CONTEXT_EXPRESSION_EXPECTED;
        }

        return CONTEXT_INSIDE_BLOCK;
    }

    /**
     * Filter completions based on the detected context.
     * @param {Array} completions - Array of snippet items.
     * @param {string} detectedContext - The detected context type.
     * @returns {Array} Filtered completions.
     */
    #filterByContext (completions, detectedContext) {
        const allowedTypes = CONTEXT_ALLOWED_TYPES[detectedContext];
        if (!allowedTypes) {
            return completions;
        }

        return completions.filter(item => {
            const type = item.type || 'snippet';

            // Special handling for 'snippet' type based on context
            if (type === 'snippet') {
                if (detectedContext === CONTEXT_TOP_LEVEL) {
                    // At top level, only 'def' snippet is allowed
                    return item.caption === 'def';
                }
                if (detectedContext === CONTEXT_INSIDE_BLOCK) {
                    // Inside block, all snippets except 'def' are allowed
                    return item.caption !== 'def';
                }
                // For expression_expected, snippets are not allowed
                return false;
            }

            return allowedTypes.has(type);
        });
    }

    #isExtensionActive (extensionId) {
        if (!this.#vm || !this.#vm.extensionManager) {
            return true;
        }
        if (Array.isArray(extensionId)) {
            return extensionId.some(id => this.#vm.extensionManager.isExtensionLoaded(id));
        }
        return this.#vm.extensionManager.isExtensionLoaded(extensionId);
    }
}

export default SnippetsCompleter;
