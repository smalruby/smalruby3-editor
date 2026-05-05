/**
 * Unit tests replacing integration tests from block-display-modal.test.js (tests 4-6)
 *
 * Tests the initializeBlockSelectionFromOnlyBlocks() logic directly
 * instead of through the browser UI with Selenium.
 */
import { CATEGORY_BLOCKS, initializeBlockSelectionFromOnlyBlocks } from '../../../src/lib/block-utils';

describe('initializeBlockSelectionFromOnlyBlocks', () => {
    // From block-display-modal.test.js test 6
    test('All blocks should be selected by default when no only_blocks parameter', () => {
        const result = initializeBlockSelectionFromOnlyBlocks(null);

        // All categories should have all their blocks selected
        Object.keys(CATEGORY_BLOCKS).forEach((categoryId) => {
            expect(result[categoryId]).toEqual(CATEGORY_BLOCKS[categoryId]);
        });
    });

    // From block-display-modal.test.js test 5
    test('only_blocks with category prefix should select entire category', () => {
        const result = initializeBlockSelectionFromOnlyBlocks('motion_');

        // Motion category should be fully selected
        expect(result.motion).toEqual(CATEGORY_BLOCKS.motion);

        // Other categories should be empty
        expect(result.looks).toEqual([]);
        expect(result.sound).toEqual([]);
        expect(result.event).toEqual([]);
        expect(result.control).toEqual([]);
        expect(result.sensing).toEqual([]);
        expect(result.operators).toEqual([]);
    });

    // From block-display-modal.test.js test 4 (prefix matching issue)
    test('only_blocks=looks_say should select only looks_say, not looks_sayforsecs', () => {
        const result = initializeBlockSelectionFromOnlyBlocks('looks_say');

        // looks_say should be selected
        expect(result.looks).toContain('looks_say');

        // looks_sayforsecs should NOT be selected (exact match, not prefix)
        expect(result.looks).not.toContain('looks_sayforsecs');
    });

    // From block-display-modal.test.js test 7 (exact match test)
    test('exact block matching - no prefix matching issues', () => {
        const result = initializeBlockSelectionFromOnlyBlocks('looks_say');

        // Only looks_say should be in looks category
        expect(result.looks).toEqual(['looks_say']);
    });

    test('empty string returns empty selections', () => {
        const result = initializeBlockSelectionFromOnlyBlocks('');

        Object.keys(CATEGORY_BLOCKS).forEach((categoryId) => {
            expect(result[categoryId]).toEqual([]);
        });
    });

    test('multiple blocks can be selected with comma separator', () => {
        const result = initializeBlockSelectionFromOnlyBlocks('motion_movesteps,looks_say');

        expect(result.motion).toEqual(['motion_movesteps']);
        expect(result.looks).toEqual(['looks_say']);
        expect(result.sound).toEqual([]);
    });
});
