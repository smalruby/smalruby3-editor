/**
 * @fileoverview Test for only_blocks parameter initialization logic
 */

import {CATEGORY_BLOCKS, initializeBlockSelectionFromOnlyBlocks} from '../../src/lib/block-utils.js';

describe('only_blocks parameter initialization', () => {
    test('should initialize with all blocks selected when no only_blocks parameter (default behavior)', () => {
        const result = initializeBlockSelectionFromOnlyBlocks(null);
        expect(result).toEqual({
            motion: CATEGORY_BLOCKS.motion,
            looks: CATEGORY_BLOCKS.looks,
            sound: CATEGORY_BLOCKS.sound,
            event: CATEGORY_BLOCKS.event,
            control: CATEGORY_BLOCKS.control,
            sensing: CATEGORY_BLOCKS.sensing,
            operators: CATEGORY_BLOCKS.operators
        });
    });

    test('should initialize empty selection when empty string is provided', () => {
        const result = initializeBlockSelectionFromOnlyBlocks('');
        expect(result).toEqual({
            motion: [],
            looks: [],
            sound: [],
            event: [],
            control: [],
            sensing: [],
            operators: []
        });
    });

    test('should select all motion blocks when "motion_" is specified', () => {
        const result = initializeBlockSelectionFromOnlyBlocks('motion_');
        expect(result.motion).toEqual(CATEGORY_BLOCKS.motion);
        expect(result.looks).toEqual([]);
        expect(result.sound).toEqual([]);
    });

    test('should select specific block when exact block ID is specified', () => {
        const result = initializeBlockSelectionFromOnlyBlocks('motion_movesteps');
        expect(result.motion).toEqual(['motion_movesteps']);
        expect(result.looks).toEqual([]);
    });

    test('should handle multiple categories with underscore suffix', () => {
        const result = initializeBlockSelectionFromOnlyBlocks('motion_.looks_');
        expect(result.motion).toEqual(CATEGORY_BLOCKS.motion);
        expect(result.looks).toEqual(CATEGORY_BLOCKS.looks);
        expect(result.sound).toEqual([]);
    });

    test('should handle mix of category and specific block selections', () => {
        const result = initializeBlockSelectionFromOnlyBlocks('motion_.looks_say.sound_play');
        expect(result.motion).toEqual(CATEGORY_BLOCKS.motion);
        expect(result.looks).toEqual(['looks_say']);
        expect(result.sound).toEqual(['sound_play']);
    });

    test('should not have prefix matching issues - looks_say should not affect looks_sayforsecs', () => {
        // When only looks_say is specified, looks_sayforsecs should NOT be selected
        const result = initializeBlockSelectionFromOnlyBlocks('looks_say');
        expect(result.looks).toEqual(['looks_say']);
        expect(result.looks).not.toContain('looks_sayforsecs');
    });

    test('should work with comma separator', () => {
        const result = initializeBlockSelectionFromOnlyBlocks('motion_movesteps,looks_say');
        expect(result.motion).toEqual(['motion_movesteps']);
        expect(result.looks).toEqual(['looks_say']);
    });

    test('should work with period separator', () => {
        const result = initializeBlockSelectionFromOnlyBlocks('motion_movesteps.looks_say');
        expect(result.motion).toEqual(['motion_movesteps']);
        expect(result.looks).toEqual(['looks_say']);
    });

    // Hex format tests (TDD - failing first)
    describe('hex format parsing', () => {
        test('should recognize hex format starting with 0', () => {
            // Simple hex case: select first motion block only  
            // First bit should be 1: hex 8 = 1000, but we want 0001 = 1
            const result = initializeBlockSelectionFromOnlyBlocks('01000000000000000000000000000000');
            expect(result.motion).toEqual(['motion_movesteps']);
            expect(result.looks).toEqual([]);
            expect(result.sound).toEqual([]);
        });

        test('should parse hex format for multiple categories', () => {
            // Select first motion block (bit 0) and first looks block (bit 15)
            // With reversed bit order: hex 1 = 1000 reversed sets bit 0
            // Bit 15 is in 4th hex digit position 3: 1000 reversed = 0001, so need 8
            const result = initializeBlockSelectionFromOnlyBlocks('01008000000000000000000000000000');
            expect(result.motion).toEqual(['motion_movesteps']);
            expect(result.looks).toEqual(['looks_sayforsecs']);
            expect(result.sound).toEqual([]);
        });

        test('should handle all blocks selected in hex format', () => {
            // All 1s in binary -> all blocks selected
            const result = initializeBlockSelectionFromOnlyBlocks('0ffffffffffffffffffffffffffffffff');
            expect(result.motion).toEqual(CATEGORY_BLOCKS.motion);
            expect(result.looks).toEqual(CATEGORY_BLOCKS.looks);
            expect(result.sound).toEqual(CATEGORY_BLOCKS.sound);
            expect(result.event).toEqual(CATEGORY_BLOCKS.event);
            expect(result.control).toEqual(CATEGORY_BLOCKS.control);
            expect(result.sensing).toEqual(CATEGORY_BLOCKS.sensing);
            expect(result.operators).toEqual(CATEGORY_BLOCKS.operators);
        });

        test('should handle empty selection in hex format', () => {
            // All 0s after the leading 0 -> no blocks selected
            const result = initializeBlockSelectionFromOnlyBlocks('00000000000000000000000000000000');
            expect(result).toEqual({
                motion: [],
                looks: [],
                sound: [],
                event: [],
                control: [],
                sensing: [],
                operators: []
            });
        });

        test('should maintain backward compatibility - non-hex formats still work', () => {
            // Existing comma format should still work
            const result = initializeBlockSelectionFromOnlyBlocks('motion_movesteps,looks_say');
            expect(result.motion).toEqual(['motion_movesteps']);
            expect(result.looks).toEqual(['looks_say']);
        });

        test('should parse motion_setx only with failing test first', () => {
            // Create a hex that should give motion_setx only + all other categories
            // This test is designed to fail first (RED) to demonstrate the bug
            // Expected: motion_setx + all other categories
            // Actual (bug): some categories empty
            const result = initializeBlockSelectionFromOnlyBlocks('00048ffffffffffffffffffff7');

            // This should fail initially due to the bug - motion should only have motion_setx
            // but other categories should have all blocks
            expect(result.motion).toEqual(['motion_setx']);
            expect(result.looks.length).toBeGreaterThan(0); // Should not be empty
            expect(result.sound.length).toBeGreaterThan(0); // Should not be empty
            expect(result.event.length).toBeGreaterThan(0); // Should not be empty
            expect(result.control.length).toBeGreaterThan(0); // Should not be empty
            expect(result.sensing.length).toBeGreaterThan(0); // Should not be empty
            expect(result.operators.length).toBeGreaterThan(0); // Should not be empty
        });

        describe('backward compatibility for sensing_online addition', () => {
            test('should NOT include sensing_online when URL has no flag for it (pre-addition URL)', () => {
                // Before sensing_online was added, URL params only had 80 bits (0-79)
                // sensing_online is at bit 80, so old URLs lack this bit
                // Expected: sensing_online should NOT be included (unspecified bits = 0)
                // This hex param: all bits set to 1 for the first 80 blocks
                // (20 hex digits = 80 bits, sensing_online at bit 80 is not specified)
                const result = initializeBlockSelectionFromOnlyBlocks('0ffffffffffffffffffff');

                // All blocks up to bit 79 should be selected
                expect(result.motion.length).toBe(15);
                expect(result.looks.length).toBe(21);
                expect(result.sound.length).toBe(8);
                expect(result.event.length).toBe(8);
                expect(result.control.length).toBe(11);

                // sensing should include blocks up to dayssince2000 (bit 79)
                expect(result.sensing).toContain('sensing_dayssince2000'); // bit 79

                // sensing_online (bit 80) and sensing_username (bit 81) are NOT specified
                // so they should NOT be selected
                expect(result.sensing).not.toContain('sensing_online'); // bit 80
                expect(result.sensing).not.toContain('sensing_username'); // bit 81
            });

            test('should include sensing_online when explicitly set to 1', () => {
                // Explicitly include sensing_online by setting bit 80 to 1
                // 20 hex digits (80 bits) + 1 more hex digit for bits 80-83
                // Bit 80 is position 0 in the 21st hex digit
                // In reversed bit order: 1000 (binary) = 0x1 (hex)
                const result = initializeBlockSelectionFromOnlyBlocks('0ffffffffffffffffffff1');

                expect(result.sensing).toContain('sensing_online');
            });

            test('should exclude sensing_online when explicitly set to 0', () => {
                // Explicitly exclude sensing_online by setting bit 80 to 0
                // while keeping sensing_username (bit 81) selected
                // Bits 80-83: we want 80=0, 81=1, 82=0, 83=0 → binary 0100
                // With bit reversal (LSB first): 0010 → hex 0x2
                // Need 20 'f's (bits 0-79) + '2' (bits 80-83)
                const result = initializeBlockSelectionFromOnlyBlocks('0ffffffffffffffffffff2');

                // sensing_dayssince2000 (bit 79) should be selected
                expect(result.sensing).toContain('sensing_dayssince2000');

                // sensing_online (bit 80) should NOT be selected
                expect(result.sensing).not.toContain('sensing_online');

                // sensing_username (bit 81) should be selected
                expect(result.sensing).toContain('sensing_username');
            });
        });
    });
});