/**
 * Structural + locale + conversion coverage for the blockBasics 第1章
 * 「ネコからにげるゲーム」tutorial decks (issue #957, Phase 3 / EPIC #680).
 *
 * These decks are content (not logic), so the meaningful regressions are:
 *   1. deck wiring — category / urlId / step shape / Lv3 Ruby-tab setup
 *   2. locale completeness — every FormattedMessage id resolves in ja / ja-Hira / en
 *   3. book-promo framing — every deck opens with the bibliographic step and
 *      closes with a purchase-link (externalUrl) step
 *   4. runnability — every step's `code` snippet actually converts to blocks
 *      (so the "run the finished cat-chase game" promise is real)
 *   5. image wiring — every step image key is registered in ja-steps / en-steps
 *
 * Mirrors ruby-basics-decks.test.js. See docs/tutorial/improvement-plan.md
 * Phase 3.
 */
import decks from '../../../../../src/lib/libraries/decks/index.jsx';
import {CATEGORIES} from '../../../../../src/lib/libraries/tutorial-tags';
import {jaImages} from '../../../../../src/lib/libraries/decks/ja-steps';
import {enImages} from '../../../../../src/lib/libraries/decks/en-steps';
import {BOOK_URL} from '../../../../../src/lib/libraries/decks/categories/book-promo.jsx';
import ja from '../../../../../src/locales/ja';
import jaHira from '../../../../../src/locales/ja-Hira';
import en from '../../../../../src/locales/en';
import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';

const LOCALES = {ja, 'ja-Hira': jaHira, en};

// The four decks this suite guards: a basic 3-deck ladder + one 発展 demo deck.
const EXPECTED_DECK_IDS = [
    'block-basics-lv0',
    'block-basics-lv2',
    'block-basics-lv3',
    'block-basics-advanced',
];

// Collect every FormattedMessage id referenced by a deck (name + step titles +
// external-link button labels).
const collectMessageIds = deck => {
    const ids = [];
    if (deck.name && deck.name.props && deck.name.props.id) {
        ids.push(deck.name.props.id);
    }
    deck.steps.forEach(step => {
        if (step.title && step.title.props && step.title.props.id) {
            ids.push(step.title.props.id);
        }
        if (step.externalUrlLabel && step.externalUrlLabel.props && step.externalUrlLabel.props.id) {
            ids.push(step.externalUrlLabel.props.id);
        }
    });
    return ids;
};

describe('Block Basics tutorial decks (issue #957)', () => {
    test('all four decks exist under the blockBasics category', () => {
        EXPECTED_DECK_IDS.forEach(id => {
            expect(decks[id]).toBeDefined();
            expect(decks[id].category).toBe(CATEGORIES.blockBasics);
        });
    });

    describe.each(EXPECTED_DECK_IDS)('%s', deckId => {
        let deck;
        beforeEach(() => {
            deck = decks[deckId];
        });

        test('has a urlId and at least 3 steps', () => {
            expect(typeof deck.urlId).toBe('string');
            expect(deck.urlId.length).toBeGreaterThan(0);
            expect(Array.isArray(deck.steps)).toBe(true);
            expect(deck.steps.length).toBeGreaterThanOrEqual(3);
        });

        test('opens with a bibliographic step and closes with a purchase-link step', () => {
            // First step is the shared book-opening step (image only, no code).
            const first = deck.steps[0];
            expect(first.title).toBeTruthy();
            expect(typeof first.image).toBe('string');

            // Last step links to the book purchase page via externalUrl.
            const last = deck.steps[deck.steps.length - 1];
            expect(last.externalUrl).toBe(BOOK_URL);
            expect(last.externalUrlLabel).toBeTruthy();
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

        test('every step image key is registered in ja-steps and en-steps', () => {
            const missing = [];
            deck.steps.forEach(step => {
                if (typeof step.image !== 'string') return;
                if (!Object.prototype.hasOwnProperty.call(jaImages, step.image)) {
                    missing.push(`${step.image} missing in ja-steps`);
                }
                if (!Object.prototype.hasOwnProperty.call(enImages, step.image)) {
                    missing.push(`${step.image} missing in en-steps`);
                }
            });
            expect(missing).toEqual([]);
        });

        test('every step code snippet converts to blocks without errors', async () => {
            const codeSteps = deck.steps.filter(step => step.code);
            for (const step of codeSteps) {
                const converter = new RubyToBlocksConverter(null, {version: '2'});
                const res = await converter.targetCodeToBlocks(null, step.code);
                expect(converter.errors).toHaveLength(0);
                expect(res).toBeTruthy();
            }
        });
    });

    test('the Lv3 deck opens the Ruby tab in Ruby mode via setup', () => {
        expect(decks['block-basics-lv3'].setup).toEqual({tab: 'ruby', rubyMode: 'ruby'});
    });

    test('the code-insert decks (Lv0 / Lv3 / advanced) each carry a runnable snippet', () => {
        ['block-basics-lv0', 'block-basics-lv3', 'block-basics-advanced'].forEach(id => {
            const codeSteps = decks[id].steps.filter(step => step.code);
            expect(codeSteps.length).toBeGreaterThan(0);
        });
    });

    test('the Lv2 deck has the user assemble blocks by hand (no code-insert step)', () => {
        const codeSteps = decks['block-basics-lv2'].steps.filter(step => step.code);
        expect(codeSteps).toHaveLength(0);
    });
});
