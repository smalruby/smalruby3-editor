/**
 * Guards the decks/index.jsx + locale-file split into per-category modules
 * (issue #932): deck order/content must stay identical across the split.
 * block-series has since been populated by Phase 4 (#681 / #958); dncl is
 * still an empty stub for Phase 3 (#680). Each category module must remain
 * independent and not collide with the others.
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
    'ruby-basics-7-next',
    // block-series decks (Phase 4 / #681, #958) — appended after ruby-basics
    'block-shooting-lv0',
    'block-shooting-lv2',
    'block-shooting-lv3',
    'block-shooting-advanced'
];

const BLOCK_SERIES_DECK_IDS = [
    'block-shooting-lv0',
    'block-shooting-lv2',
    'block-shooting-lv3',
    'block-shooting-advanced'
];

describe('Tutorial deck category split (issue #932)', () => {
    test('index.jsx exposes the same deck ids in the same order as before the split', () => {
        expect(Object.keys(decks)).toEqual(EXPECTED_DECK_ID_ORDER);
    });

    test('getting-started, ruby-basics and block-series decks are composed from their category modules', () => {
        expect(decks['intro-getting-started']).toBe(gettingStartedDecks['intro-getting-started']);
        expect(decks['ruby-basics-1-numbers']).toBe(rubyBasicsDecks['ruby-basics-1-numbers']);
        expect(decks['ruby-basics-2-strings']).toBe(rubyBasicsDecks['ruby-basics-2-strings']);
        expect(decks['ruby-basics-3-variables']).toBe(rubyBasicsDecks['ruby-basics-3-variables']);
        expect(decks['ruby-basics-4-arrays']).toBe(rubyBasicsDecks['ruby-basics-4-arrays']);
        expect(decks['ruby-basics-5-blocks']).toBe(rubyBasicsDecks['ruby-basics-5-blocks']);
        expect(decks['ruby-basics-6-methods']).toBe(rubyBasicsDecks['ruby-basics-6-methods']);
        BLOCK_SERIES_DECK_IDS.forEach(id => {
            expect(decks[id]).toBe(blockSeriesDecks[id]);
        });
    });

    test('block-series exposes exactly its Phase 4 decks; dncl is still an empty stub', () => {
        expect(Object.keys(blockSeriesDecks)).toEqual(BLOCK_SERIES_DECK_IDS);
        expect(dnclDecks).toEqual({});
        EXPECTED_DECK_ID_ORDER.forEach(id => {
            expect(Object.prototype.hasOwnProperty.call(dnclDecks, id)).toBe(false);
        });
    });

    test('dncl locale stub is empty for all three locales', () => {
        expect(dnclLocale.ja).toEqual({});
        expect(dnclLocale.jaHira).toEqual({});
        expect(dnclLocale.en).toEqual({});
    });

    test('block-series locale holds the shared book-promo foundation (#956) plus Phase 4 deck howtos (#681)', () => {
        // #956 added the Block-axis common book-promotion strings; #681/#958
        // added the per-deck howto strings for the block-shooting decks.
        [blockSeriesLocale.ja, blockSeriesLocale.jaHira, blockSeriesLocale.en].forEach(table => {
            const keys = Object.keys(table);
            expect(keys.length).toBeGreaterThan(0);
            // every key is either the shared book-promo foundation or a
            // block-shooting deck howto — no strays from other categories.
            keys.forEach(id => {
                const isBookPromo = id.startsWith('gui.howtos.book-promo.');
                const isBlockShooting = BLOCK_SERIES_DECK_IDS.some(
                    deckId => id.startsWith(`gui.howtos.${deckId}.`)
                );
                expect(isBookPromo || isBlockShooting).toBe(true);
            });
            // the shared book-promo foundation must still be present.
            expect(keys.some(id => id.startsWith('gui.howtos.book-promo.'))).toBe(true);
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
