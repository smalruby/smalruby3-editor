/**
 * Guards the Block-axis common foundation (issue #956): the four block
 * tutorial categories (blockBasics/blockGames/blockMath/blockScience), the
 * library category display order, and the shared book-promotion helpers
 * (BOOK constants + opening/closing step factories) that the follow-up
 * Block series decks (#680) build on.
 */
import {CATEGORIES} from '../../../../../src/lib/libraries/tutorial-tags';
import {
    BOOK,
    BOOK_URL,
    bookOpeningStep,
    bookClosingStep,
    bookAdvancedClosingStep
} from '../../../../../src/lib/libraries/decks/categories/book-promo.jsx';
import ja from '../../../../../src/locales/ja';
import jaHira from '../../../../../src/locales/ja-Hira';
import en from '../../../../../src/locales/en';

const BLOCK_CATEGORIES = ['blockBasics', 'blockGames', 'blockMath', 'blockScience'];

describe('Block-axis taxonomy (issue #956)', () => {
    test('CATEGORIES contains the four block categories', () => {
        BLOCK_CATEGORIES.forEach(key => {
            expect(CATEGORIES[key]).toBe(key);
        });
    });

    test('category display order is gettingStarted -> block 4 -> rubyBasics -> mesh', () => {
        const order = Object.values(CATEGORIES);
        const idx = key => order.indexOf(key);
        // gettingStarted first
        expect(idx('gettingStarted')).toBe(0);
        // the four block categories come next, in the intended sequence
        expect(order.slice(1, 5)).toEqual(BLOCK_CATEGORIES);
        // rubyBasics after all block categories
        BLOCK_CATEGORIES.forEach(key => {
            expect(idx('rubyBasics')).toBeGreaterThan(idx(key));
        });
        // mesh after rubyBasics
        expect(idx('meshStep1')).toBeGreaterThan(idx('rubyBasics'));
        expect(idx('meshStep1')).toBeLessThan(idx('meshStep2'));
        expect(idx('meshStep2')).toBeLessThan(idx('meshStep3'));
    });

    test('central locale files carry a label for every block category', () => {
        BLOCK_CATEGORIES.forEach(key => {
            const id = `gui.library.${key}`;
            expect(typeof ja[id]).toBe('string');
            expect(ja[id].length).toBeGreaterThan(0);
            expect(typeof jaHira[id]).toBe('string');
            expect(jaHira[id].length).toBeGreaterThan(0);
            expect(typeof en[id]).toBe('string');
            expect(en[id].length).toBeGreaterThan(0);
        });
    });
});

describe('Book promotion shared helpers (issue #956)', () => {
    test('BOOK carries placeholder bibliographic info and a purchase URL', () => {
        expect(typeof BOOK.title).toBe('string');
        expect(BOOK.title.length).toBeGreaterThan(0);
        expect(typeof BOOK.author).toBe('string');
        expect(BOOK.author.length).toBeGreaterThan(0);
        expect(typeof BOOK_URL).toBe('string');
        expect(BOOK_URL).toBe(BOOK.url);
        expect(BOOK_URL).toMatch(/^https?:\/\//);
    });

    test('bookOpeningStep produces a content step with a title and image', () => {
        const step = bookOpeningStep(1, 'blockBasicsOpening');
        expect(step.title).toBeDefined();
        expect(step.image).toBe('blockBasicsOpening');
    });

    test('bookClosingStep links to the purchase URL via externalUrl', () => {
        const step = bookClosingStep(4, 'blockGamesClosing');
        expect(step.title).toBeDefined();
        expect(step.image).toBe('blockGamesClosing');
        expect(step.externalUrl).toBe(BOOK_URL);
        expect(step.externalUrlLabel).toBeDefined();
    });

    test('bookAdvancedClosingStep links to the purchase URL via externalUrl', () => {
        const step = bookAdvancedClosingStep(5, 'blockMathAdvancedClosing');
        expect(step.title).toBeDefined();
        expect(step.image).toBe('blockMathAdvancedClosing');
        expect(step.externalUrl).toBe(BOOK_URL);
        expect(step.externalUrlLabel).toBeDefined();
    });

    test('book-promo strings are present in the central locale files (all three)', () => {
        const ids = [
            'gui.howtos.book-promo.opening.title',
            'gui.howtos.book-promo.closing.title',
            'gui.howtos.book-promo.advancedClosing.title',
            'gui.howtos.book-promo.purchase'
        ];
        ids.forEach(id => {
            expect(typeof ja[id]).toBe('string');
            expect(typeof jaHira[id]).toBe('string');
            expect(typeof en[id]).toBe('string');
        });
    });
});
