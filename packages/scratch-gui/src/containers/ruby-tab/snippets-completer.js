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
import MeshSnippets from './mesh-snippets.json';
import SmalrubotS1Snippets from './smalrubot-s1-snippets.json';
import MicrobitMoreSnippets from './microbit-more-snippets.json';
import KoshienSnippets from './koshien-snippets.json';
import MakeySnippets from './makey-snippets.json';
import GdxForSnippets from './gdx_for-snippets.json';

// Regex to detect Japanese characters (hiragana, katakana, kanji)
const JAPANESE_CHAR_PATTERN = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/;

class SnippetsCompleter extends BaseCompleter {
    #completions = [];

    constructor () {
        super();

        const snippetsList = [
            {snippets: MotionSnippets, category: '01'},
            {snippets: LooksSnippets, category: '02'},
            {snippets: SoundSnippets, category: '03'},
            {snippets: EventsSnippets, category: '04'},
            {snippets: ControlSnippets, category: '05'},
            {snippets: SensingSnippets, category: '06'},
            {snippets: OperatorsSnippets, category: '07'},
            {snippets: VariablesSnippets, category: '08'},
            {snippets: ProcedureSnippets, category: '09'},

            {snippets: MusicSnippets, category: '10'},
            {snippets: PenSnippets, category: '11'},
            {snippets: VideoSensingSnippets, category: '12'},
            {snippets: TextToSpeechSnippets, category: '13'},
            {snippets: TranslateSnippets, category: '14'},
            {snippets: MicrobitSnippets, category: '15'},
            {snippets: MeshSnippets, category: '16'},
            {snippets: SmalrubotS1Snippets, category: '17'},
            {snippets: MicrobitMoreSnippets, category: '18'},
            {snippets: KoshienSnippets, category: '19'},
            {snippets: MakeySnippets, category: '20'},
            {snippets: GdxForSnippets, category: '21'}
        ];
        snippetsList.forEach(({snippets, category}) => {
            for (const [caption, item] of Object.entries(snippets)) {
                item.caption = caption;
                item.type = item.type || 'snippet';
                if (!item.sortText) {
                    item.sortText = `${category}_${caption}`;
                }
                this.#completions.push(item);
            }
        });
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

        const suggestions = this.#completions.map(item => this.toCompletionItem(item, range, monaco));

        return {
            suggestions: suggestions
        };
    }
}

export default SnippetsCompleter;
