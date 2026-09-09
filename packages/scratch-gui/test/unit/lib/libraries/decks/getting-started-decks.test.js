/**
 * Structural + locale + conversion coverage for the single-feature
 * "さあ、始めましょう" (gettingStarted) tutorial decks.
 *
 * These decks are content, so the meaningful regressions are:
 *   1. deck wiring — category / urlId / step count / no cross-deck dependency
 *      (the category promises "好きなものを3つ", so a deck must not require
 *      another deck to be finished first)
 *   2. locale completeness — every FormattedMessage id resolves in ja / ja-Hira / en
 *   3. asset wiring — every step image key resolves in both ja and en image maps
 *   4. runnability — every step's `code` snippet actually converts to blocks
 *
 * See docs/tutorial/improvement-plan.md and issues #1177 / #1179.
 */
import decks from '../../../../../src/lib/libraries/decks/index.jsx';
import {jaImages} from '../../../../../src/lib/libraries/decks/ja-steps';
import {enImages} from '../../../../../src/lib/libraries/decks/en-steps';
import {CATEGORIES} from '../../../../../src/lib/libraries/tutorial-tags';
import ja from '../../../../../src/locales/ja';
import jaHira from '../../../../../src/locales/ja-Hira';
import en from '../../../../../src/locales/en';
import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';

const LOCALES = {ja, 'ja-Hira': jaHira, en};

// The single-feature decks added by #1179. `intro-getting-started` is the
// pre-existing deck and is guarded separately (it is a Ruby intro, not a
// single-feature block deck).
const SINGLE_FEATURE_DECK_IDS = ['getting-started-costume', 'getting-started-sprites'];

const collectMessageIds = deck => {
    const ids = [];
    if (deck.name && deck.name.props && deck.name.props.id) {
        ids.push(deck.name.props.id);
    }
    deck.steps.forEach(step => {
        if (step.title && step.title.props && step.title.props.id) {
            ids.push(step.title.props.id);
        }
    });
    return ids;
};

describe('Getting Started single-feature tutorial decks', () => {
    test('the pre-existing intro deck is untouched and still first', () => {
        expect(decks['intro-getting-started']).toBeDefined();
        expect(Object.keys(decks)[0]).toBe('intro-getting-started');
    });

    test('both decks exist under the gettingStarted category', () => {
        SINGLE_FEATURE_DECK_IDS.forEach(id => {
            expect(decks[id]).toBeDefined();
            expect(decks[id].category).toBe(CATEGORIES.gettingStarted);
        });
    });

    describe.each(SINGLE_FEATURE_DECK_IDS)('%s', deckId => {
        let deck;
        beforeEach(() => {
            deck = decks[deckId];
        });

        test('has a urlId and 3-6 steps (single feature,完結する長さ)', () => {
            expect(typeof deck.urlId).toBe('string');
            expect(deck.urlId.length).toBeGreaterThan(0);
            expect(Array.isArray(deck.steps)).toBe(true);
            expect(deck.steps.length).toBeGreaterThanOrEqual(3);
            expect(deck.steps.length).toBeLessThanOrEqual(6);
        });

        test('does not chain to another deck (order-independent)', () => {
            deck.steps.forEach(step => {
                expect(step.deckIds).toBeUndefined();
            });
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

        test('has a thumbnail and every step image key resolves in ja / en image maps', () => {
            expect(deck.img).toBeTruthy();
            const missing = [];
            deck.steps.forEach(step => {
                expect(typeof step.image).toBe('string');
                if (!Object.prototype.hasOwnProperty.call(jaImages, step.image)) {
                    missing.push(`${step.image} missing in jaImages`);
                }
                if (!Object.prototype.hasOwnProperty.call(enImages, step.image)) {
                    missing.push(`${step.image} missing in enImages`);
                }
            });
            expect(missing).toEqual([]);
        });

        test('no two steps reuse the same image key (説明と絵がズレるのを防ぐ)', () => {
            // jest は画像 import をすべて同じスタブに解決するので、解決後の値では
            // なくキーの重複を見る（ja-steps.js のキー → ファイルは 1:1 で運用する）。
            const keys = deck.steps.map(step => step.image);
            expect(new Set(keys).size).toBe(keys.length);
        });

        test('every step code snippet converts to blocks without errors', async () => {
            const codeSteps = deck.steps.filter(step => step.code);
            expect(codeSteps.length).toBeGreaterThan(0);
            for (const step of codeSteps) {
                // Single-feature decks teach blocks, so the inserted Ruby has to
                // land in the Code tab as blocks.
                expect(step.codeType).toBe('blocks');
                const converter = new RubyToBlocksConverter(null, {version: '2'});
                const res = await converter.targetCodeToBlocks(null, step.code);
                expect(converter.errors).toHaveLength(0);
                expect(res).toBeTruthy();
            }
        });
    });
});
