/**
 * Guards the decks/index.jsx + locale-file split into per-category modules
 * (issue #932): the getting-started / chat / ruby-basics deck order/content
 * must stay identical after the split, and the Phase 3 (#680) / Phase 4
 * (#681) categories must be independent and not collide with the existing
 * categories.
 *
 * Phase 3 第1章 (issue #957) populated the block-series category with the four
 * blockBasics decks, so it is no longer an empty stub; dncl (Phase 4, #681)
 * remains an empty stub for now.
 */
import decks from '../../../../../src/lib/libraries/decks/index.jsx';
import gettingStartedDecks from '../../../../../src/lib/libraries/decks/categories/getting-started.jsx';
import rubyBasicsDecks from '../../../../../src/lib/libraries/decks/categories/ruby-basics.jsx';
import blockSeriesDecks from '../../../../../src/lib/libraries/decks/categories/block-series.jsx';
import dnclDecks from '../../../../../src/lib/libraries/decks/categories/dncl.jsx';
import {
    ja as gettingStartedJa,
    jaHira as gettingStartedJaHira,
    en as gettingStartedEn
} from '../../../../../src/lib/libraries/decks/categories/getting-started.locale.js';
import {
    ja as rubyBasicsJa,
    jaHira as rubyBasicsJaHira,
    en as rubyBasicsEn
} from '../../../../../src/lib/libraries/decks/categories/ruby-basics.locale.js';
import * as blockSeriesLocale from '../../../../../src/lib/libraries/decks/categories/block-series.locale.js';
import * as dnclLocale from '../../../../../src/lib/libraries/decks/categories/dncl.locale.js';
import ja from '../../../../../src/locales/ja';
import jaHira from '../../../../../src/locales/ja-Hira';
import en from '../../../../../src/locales/en';

// The getting-started / chat / ruby-basics decks, in the order they appeared
// before the #932 split. index.jsx must keep this order intact.
const EXPECTED_DECK_ID_ORDER = [
    'intro-getting-started',
    'chat-1-basic-1',
    'chat-1-basic-2',
    'chat-1-basic-3',
    'chat-2-sprites-1',
    'chat-2-sprites-2',
    'chat-2-sprites-3',
    'chat-3-mesh-1',
    'chat-3-mesh-2',
    'chat-3-mesh-3',
    'ruby-basics-1-numbers',
    'ruby-basics-2-strings',
    'ruby-basics-3-variables',
    'ruby-basics-4-arrays',
    'ruby-basics-5-blocks',
    'ruby-basics-6-methods',
    'ruby-basics-7-next'
];

// The blockBasics decks added by Phase 3 第1章 (issue #957). They are spread
// after ...rubyBasics (and before the still-empty ...dncl) in index.jsx.
const BLOCK_SERIES_DECK_ID_ORDER = [
    'block-basics-lv0',
    'block-basics-lv2',
    'block-basics-lv3',
    'block-basics-advanced'
];

describe('Tutorial deck category split (issue #932)', () => {
    test('index.jsx keeps the original deck order and appends the blockBasics decks', () => {
        // The split (#932) preserved the original order; #957 appended the
        // blockBasics decks after ruby-basics. dncl is still empty so adds none.
        expect(Object.keys(decks)).toEqual([...EXPECTED_DECK_ID_ORDER, ...BLOCK_SERIES_DECK_ID_ORDER]);
    });

    test('getting-started and ruby-basics decks are composed from their category modules', () => {
        expect(decks['intro-getting-started']).toBe(gettingStartedDecks['intro-getting-started']);
        expect(decks['ruby-basics-1-numbers']).toBe(rubyBasicsDecks['ruby-basics-1-numbers']);
        expect(decks['ruby-basics-2-strings']).toBe(rubyBasicsDecks['ruby-basics-2-strings']);
        expect(decks['ruby-basics-3-variables']).toBe(rubyBasicsDecks['ruby-basics-3-variables']);
        expect(decks['ruby-basics-4-arrays']).toBe(rubyBasicsDecks['ruby-basics-4-arrays']);
        expect(decks['ruby-basics-5-blocks']).toBe(rubyBasicsDecks['ruby-basics-5-blocks']);
        expect(decks['ruby-basics-6-methods']).toBe(rubyBasicsDecks['ruby-basics-6-methods']);
    });

    test('block-series holds exactly the four blockBasics decks (issue #957); dncl is still an empty stub', () => {
        expect(Object.keys(blockSeriesDecks)).toEqual(BLOCK_SERIES_DECK_ID_ORDER);
        expect(dnclDecks).toEqual({});
        // Neither category may collide with the pre-existing deck ids.
        EXPECTED_DECK_ID_ORDER.forEach(id => {
            expect(Object.prototype.hasOwnProperty.call(blockSeriesDecks, id)).toBe(false);
            expect(Object.prototype.hasOwnProperty.call(dnclDecks, id)).toBe(false);
        });
        // block-series decks are composed from their category module.
        BLOCK_SERIES_DECK_ID_ORDER.forEach(id => {
            expect(decks[id]).toBe(blockSeriesDecks[id]);
        });
    });

    test('dncl locale stub is empty for all three locales', () => {
        expect(dnclLocale.ja).toEqual({});
        expect(dnclLocale.jaHira).toEqual({});
        expect(dnclLocale.en).toEqual({});
    });

    test('block-series locale holds the shared book-promo foundation (#956) plus the blockBasics howtos (#957)', () => {
        // #956 populates the Block-axis common book-promotion strings; #957
        // adds the per-deck blockBasics howto strings on top of them.
        [blockSeriesLocale.ja, blockSeriesLocale.jaHira, blockSeriesLocale.en].forEach(table => {
            const keys = Object.keys(table);
            expect(keys.length).toBeGreaterThan(0);
            keys.forEach(id => {
                expect(
                    id.startsWith('gui.howtos.book-promo.') || id.startsWith('gui.howtos.block-basics-')
                ).toBe(true);
            });
            // Both families must actually be present.
            expect(keys.some(id => id.startsWith('gui.howtos.book-promo.'))).toBe(true);
            expect(keys.some(id => id.startsWith('gui.howtos.block-basics-'))).toBe(true);
        });
    });

    test('central locale files still contain every getting-started / ruby-basics key (via spread)', () => {
        [gettingStartedJa, rubyBasicsJa].forEach(table => {
            Object.keys(table).forEach(id => {
                expect(ja[id]).toBe(table[id]);
            });
        });
        [gettingStartedJaHira, rubyBasicsJaHira].forEach(table => {
            Object.keys(table).forEach(id => {
                expect(jaHira[id]).toBe(table[id]);
            });
        });
        [gettingStartedEn, rubyBasicsEn].forEach(table => {
            Object.keys(table).forEach(id => {
                expect(en[id]).toBe(table[id]);
            });
        });
    });

    test('chat (mesh) decks are unaffected by the split and remain inline in index.jsx', () => {
        EXPECTED_DECK_ID_ORDER.filter(id => id.startsWith('chat-')).forEach(id => {
            expect(decks[id]).toBeDefined();
            expect(gettingStartedDecks[id]).toBeUndefined();
            expect(rubyBasicsDecks[id]).toBeUndefined();
        });
    });
});
