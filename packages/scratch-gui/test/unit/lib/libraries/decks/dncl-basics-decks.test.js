/**
 * Structural + locale + conversion coverage for the DNCL Basics tutorial decks
 * (first half: display / variables / conditionals).
 *
 * These decks are content (not logic), so the meaningful regressions are:
 *   1. deck wiring — category / setup (DNCL mode!) / urlId / step shape
 *   2. locale completeness — every FormattedMessage id resolves in ja / ja-Hira / en
 *   3. runnability — every step's `code` snippet converts to blocks, so the
 *      "press the green flag and the cat says X" promise is real
 *   4. DNCL readability — the decks run in `rubyMode: 'dncl'`, so the Ruby
 *      snippet the card inserts must render as DNCL (表示する / もし ... ならば)
 *      and survive the DNCL → Ruby round trip. A snippet that only reads well
 *      in Ruby would show the learner English keywords in DNCL mode.
 *
 * See docs/tutorial/improvement-plan.md Phase 4 and issues #681 / #964.
 */
import decks from '../../../../../src/lib/libraries/decks/index.jsx';
import tutorialTags, {CATEGORIES} from '../../../../../src/lib/libraries/tutorial-tags';
import ja from '../../../../../src/locales/ja';
import jaHira from '../../../../../src/locales/ja-Hira';
import en from '../../../../../src/locales/en';
import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';
import {rubyToDncl} from '../../../../../src/lib/dncl/ruby-to-dncl';
import {dnclToRuby} from '../../../../../src/lib/dncl/dncl-to-ruby';

const LOCALES = {ja, 'ja-Hira': jaHira, en};

const EXPECTED_DECK_IDS = [
    'dncl-basics-1-display',
    'dncl-basics-2-variables',
    'dncl-basics-3-conditionals'
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

describe('DNCL taxonomy (issue #964)', () => {
    test('CATEGORIES contains dnclBasics, after the mesh series', () => {
        expect(CATEGORIES.dnclBasics).toBe('dnclBasics');
        const order = Object.values(CATEGORIES);
        expect(order.indexOf('dnclBasics')).toBeGreaterThan(order.indexOf('meshStep3'));
    });

    test('a dncl filter tag is offered in the tutorial library', () => {
        const tag = tutorialTags.find(t => t.tag === 'dncl');
        expect(tag).toBeDefined();
        expect(tag.intlLabel.id).toBe('gui.libraryTags.dncl');
    });

    test('central locale files carry the category label and the tag label', () => {
        ['gui.library.dnclBasics', 'gui.libraryTags.dncl'].forEach(id => {
            Object.entries(LOCALES).forEach(([locale, table]) => {
                expect(typeof table[id]).toBe('string');
                expect(`${locale}:${table[id] || ''}`.length).toBeGreaterThan(locale.length + 1);
            });
        });
    });
});

describe('DNCL Basics tutorial decks', () => {
    test('all three decks exist under the dnclBasics category', () => {
        EXPECTED_DECK_IDS.forEach(id => {
            expect(decks[id]).toBeDefined();
            expect(decks[id].category).toBe(CATEGORIES.dnclBasics);
        });
    });

    describe.each(EXPECTED_DECK_IDS)('%s', deckId => {
        let deck;
        beforeEach(() => {
            deck = decks[deckId];
        });

        test('opens the Ruby tab in DNCL mode via setup', () => {
            expect(deck.setup).toEqual({tab: 'ruby', rubyMode: 'dncl'});
        });

        test('is tagged dncl so the library filter finds it', () => {
            expect(deck.tags).toContain('dncl');
        });

        test('has a urlId, a thumbnail and at least 5 steps', () => {
            expect(typeof deck.urlId).toBe('string');
            expect(deck.urlId.length).toBeGreaterThan(0);
            expect(deck.img).toBeTruthy();
            expect(Array.isArray(deck.steps)).toBe(true);
            expect(deck.steps.length).toBeGreaterThanOrEqual(5);
        });

        test('every step carries an image', () => {
            deck.steps.forEach(step => {
                expect(typeof step.image).toBe('string');
                expect(step.image.length).toBeGreaterThan(0);
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

        test('every step code snippet reads as DNCL and round-trips back to Ruby', () => {
            const codeSteps = deck.steps.filter(step => step.code);
            codeSteps.forEach(step => {
                const {dncl} = rubyToDncl(step.code);
                // `puts(...)` must show up as 表示する(...) — otherwise the
                // learner sees English in a Japanese-only tutorial.
                expect(dncl).not.toMatch(/\bputs\b/);
                expect(dncl).toContain('表示する');
                const back = dnclToRuby(dncl);
                expect(back.errors).toEqual([]);
            });
        });
    });

    test('deck 3 teaches both branches of a conditional in DNCL', () => {
        const dnclSnippets = decks['dncl-basics-3-conditionals'].steps
            .filter(step => step.code)
            .map(step => rubyToDncl(step.code).dncl);
        expect(dnclSnippets.some(code => code.includes('もし') && code.includes('ならば'))).toBe(true);
        expect(dnclSnippets.some(code => code.includes('そうでなければ'))).toBe(true);
    });
});
