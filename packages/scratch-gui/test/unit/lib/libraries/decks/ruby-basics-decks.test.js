/**
 * Structural + locale + conversion coverage for the Ruby Basics tutorial decks.
 *
 * These decks are content (not logic), so the meaningful regressions are:
 *   1. deck wiring — category / setup / urlId / step shape
 *   2. locale completeness — every FormattedMessage id resolves in ja / ja-Hira / en
 *   3. runnability — every step's `code` snippet actually converts to blocks
 *      (so the "the cat says X" promise in the images is real)
 *
 * See docs/tutorial/improvement-plan.md Phase 2 and issue #852.
 */
import decks from '../../../../../src/lib/libraries/decks/index.jsx';
import {CATEGORIES} from '../../../../../src/lib/libraries/tutorial-tags';
import ja from '../../../../../src/locales/ja';
import jaHira from '../../../../../src/locales/ja-Hira';
import en from '../../../../../src/locales/en';
import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';

const LOCALES = {ja, 'ja-Hira': jaHira, en};

// The three decks this suite guards. Deck 1 already ships; decks 2 & 3 are #852.
const EXPECTED_DECK_IDS = [
    'ruby-basics-1-numbers',
    'ruby-basics-2-strings',
    'ruby-basics-3-variables',
];

// Collect every FormattedMessage id referenced by a deck (name + step titles +
// external-resource names).
const collectMessageIds = deck => {
    const ids = [];
    if (deck.name && deck.name.props && deck.name.props.id) {
        ids.push(deck.name.props.id);
    }
    deck.steps.forEach(step => {
        if (step.title && step.title.props && step.title.props.id) {
            ids.push(step.title.props.id);
        }
        if (step.externalResources) {
            Object.values(step.externalResources).forEach(res => {
                if (res.name && res.name.props && res.name.props.id) {
                    ids.push(res.name.props.id);
                }
            });
        }
    });
    return ids;
};

describe('Ruby Basics tutorial decks', () => {
    test('all three decks exist under the rubyBasics category', () => {
        EXPECTED_DECK_IDS.forEach(id => {
            expect(decks[id]).toBeDefined();
            expect(decks[id].category).toBe(CATEGORIES.rubyBasics);
        });
    });

    describe.each(EXPECTED_DECK_IDS)('%s', deckId => {
        let deck;
        beforeEach(() => {
            deck = decks[deckId];
        });

        test('opens the Ruby tab in Ruby mode via setup', () => {
            expect(deck.setup).toEqual({tab: 'ruby', rubyMode: 'ruby'});
        });

        test('has a urlId and at least 5 steps', () => {
            expect(typeof deck.urlId).toBe('string');
            expect(deck.urlId.length).toBeGreaterThan(0);
            expect(Array.isArray(deck.steps)).toBe(true);
            expect(deck.steps.length).toBeGreaterThanOrEqual(5);
        });

        test('every message id resolves in ja / ja-Hira / en', () => {
            const ids = collectMessageIds(deck);
            expect(ids.length).toBeGreaterThan(0);
            const missing = [];
            ids.forEach(id => {
                Object.entries(LOCALES).forEach(([locale, table]) => {
                    if (!Object.prototype.hasOwnProperty.call(table, id)) {
                        missing.push(`${id} missing in ${locale}`);
                    }
                });
            });
            expect(missing).toEqual([]);
        });

        test('every step code snippet converts to blocks without errors', async () => {
            const codeSteps = deck.steps.filter(step => step.code);
            expect(codeSteps.length).toBeGreaterThan(0);
            for (const step of codeSteps) {
                const converter = new RubyToBlocksConverter(null, {version: '2'});
                const res = await converter.targetCodeToBlocks(null, step.code);
                expect(converter.errors).toHaveLength(0);
                expect(res).toBeTruthy();
            }
        });
    });
});
