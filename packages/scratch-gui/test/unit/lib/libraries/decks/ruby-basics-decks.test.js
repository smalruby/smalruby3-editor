/**
 * Structural + locale + conversion coverage for the Ruby Basics tutorial decks.
 *
 * These decks are content (not logic), so the meaningful regressions are:
 *   1. deck wiring — category / setup / urlId / step shape
 *   2. locale completeness — every FormattedMessage id resolves in ja / ja-Hira / en
 *   3. runnability — every step's `code` snippet actually converts to blocks
 *      (so the "the cat says X" promise in the images is real)
 *
 * See docs/tutorial/improvement-plan.md Phase 2 and issues #852 / #853.
 */
import decks from '../../../../../src/lib/libraries/decks/index.jsx';
import {CATEGORIES} from '../../../../../src/lib/libraries/tutorial-tags';
import ja from '../../../../../src/locales/ja';
import jaHira from '../../../../../src/locales/ja-Hira';
import en from '../../../../../src/locales/en';
import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';

const LOCALES = {ja, 'ja-Hira': jaHira, en};

// The seven decks this suite guards. Decks 1-3 are #852; decks 4-6 are #853;
// deck 7 (TryRuby bridge) is #854.
const EXPECTED_DECK_IDS = [
    'ruby-basics-1-numbers',
    'ruby-basics-2-strings',
    'ruby-basics-3-variables',
    'ruby-basics-4-arrays',
    'ruby-basics-5-blocks',
    'ruby-basics-6-methods',
    'ruby-basics-7-next',
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
    test('all seven decks exist under the rubyBasics category', () => {
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

    // Deck 7 is the "next steps" bridge to TryRuby. Unlike decks 1-6 (whose last
    // step is an externalResources preview card), deck 7 uses the externalUrl
    // step mechanism (#853) to place an "Open TryRuby" button on an image step.
    describe('ruby-basics-7-next (TryRuby bridge)', () => {
        const deck = decks['ruby-basics-7-next'];

        test('has exactly one step with an externalUrl pointing at TryRuby root', () => {
            const externalSteps = deck.steps.filter(step => step.externalUrl);
            expect(externalSteps).toHaveLength(1);
            // TryRuby does not accept a language path segment, so the root URL is required.
            expect(externalSteps[0].externalUrl).toBe('https://try.ruby-lang.org/');
        });

        test('the externalUrl step keeps a title image and a localized button label', () => {
            const step = deck.steps.find(s => s.externalUrl);
            expect(step.title).toBeTruthy();
            expect(typeof step.image).toBe('string');
            const labelId = step.externalUrlLabel && step.externalUrlLabel.props &&
                step.externalUrlLabel.props.id;
            expect(typeof labelId).toBe('string');
            Object.entries(LOCALES).forEach(([locale, table]) => {
                expect(Object.prototype.hasOwnProperty.call(table, labelId)).toBe(true);
                if (!Object.prototype.hasOwnProperty.call(table, labelId)) {
                    throw new Error(`${labelId} missing in ${locale}`);
                }
            });
        });
    });
});
