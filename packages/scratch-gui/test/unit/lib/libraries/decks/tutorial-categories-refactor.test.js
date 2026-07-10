/**
 * Guards the decks/index.jsx + locale-file split into per-category modules
 * (issue #932): deck order/content must stay identical, and the Phase 3
 * (#680) / Phase 4 (#681) stub categories must be independent, empty, and
 * not collide with the existing categories.
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
    'ruby-basics-6-methods'
];

describe('Tutorial deck category split (issue #932)', () => {
    test('index.jsx exposes the same deck ids in the same order as before the split', () => {
        expect(Object.keys(decks)).toEqual(EXPECTED_DECK_ID_ORDER);
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

    test('block-series and dncl are empty stub categories that add no deck ids', () => {
        expect(blockSeriesDecks).toEqual({});
        expect(dnclDecks).toEqual({});
        EXPECTED_DECK_ID_ORDER.forEach(id => {
            expect(Object.prototype.hasOwnProperty.call(blockSeriesDecks, id)).toBe(false);
            expect(Object.prototype.hasOwnProperty.call(dnclDecks, id)).toBe(false);
        });
    });

    test('block-series and dncl locale stubs are empty for all three locales', () => {
        expect(blockSeriesLocale.ja).toEqual({});
        expect(blockSeriesLocale.jaHira).toEqual({});
        expect(blockSeriesLocale.en).toEqual({});
        expect(dnclLocale.ja).toEqual({});
        expect(dnclLocale.jaHira).toEqual({});
        expect(dnclLocale.en).toEqual({});
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
