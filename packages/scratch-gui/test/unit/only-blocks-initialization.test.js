/**
 * @fileoverview Test for only_blocks parameter initialization logic
 */
import { CATEGORY_BLOCKS, initializeBlockSelectionFromOnlyBlocks } from '../../src/lib/block-utils.js';

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
            operators: CATEGORY_BLOCKS.operators,
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
            operators: [],
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
            // sensing blocks are selected but order may differ (bit order vs display order)
            expect(result.sensing.length).toBe(CATEGORY_BLOCKS.sensing.length);
            expect(result.sensing).toContain('sensing_online');
            expect(result.sensing).toContain('sensing_username');
            expect(result.sensing).toContain('sensing_dayssince2000');
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
                operators: [],
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
            test('should NOT include sensing_online when old URL with all sensing OFF', () => {
                // Old Smalruby URL: all sensing blocks OFF (bits 64-79 = 0)
                // This URL was generated before sensing_online existed
                // Expected: sensing_online (bit 80, extended) should NOT be included
                const result = initializeBlockSelectionFromOnlyBlocks('0fffffffffffffff70000efff7');

                // All sensing blocks should be OFF (empty array)
                expect(result.sensing).toEqual([]);

                // Specifically, sensing_online should NOT be included
                expect(result.sensing).not.toContain('sensing_online');
            });

            test('should NOT include sensing_online when old URL with sensing_username OFF', () => {
                // Old Smalruby URL: sensing_username OFF (bit 80 = 0), other sensing blocks ON
                // This URL was generated before sensing_online existed
                // Expected: sensing_online (bit 81, extended) should NOT be included
                const result = initializeBlockSelectionFromOnlyBlocks('0ffffffffffffffffffffefff7');

                // sensing_username should be OFF (bit 80)
                expect(result.sensing).not.toContain('sensing_username');

                // sensing_online should NOT be included (bit 81, extended block, not in old URL)
                expect(result.sensing).not.toContain('sensing_online');

                // Base sensing blocks (bits 63-79) should be ON
                expect(result.sensing).toContain('sensing_dayssince2000'); // bit 79
                expect(result.sensing).toContain('sensing_current');
                expect(result.sensing.length).toBe(17); // 17 base blocks (bits 63-79)
            });

            test('should include sensing_online when URL has 100 bits all ON', () => {
                // New Smalruby URL: all bits 0-99 ON (25 hex digits = 100 bits)
                // Bit 99 = sensing_online (extended block)
                // 25 hex digits with all 'f' -> all blocks selected
                const result = initializeBlockSelectionFromOnlyBlocks('0fffffffffffffffffffffffff');

                // All base blocks should be selected
                expect(result.motion.length).toBe(15);
                expect(result.looks.length).toBe(21);

                // sensing_online (bit 99, extended) should be included
                expect(result.sensing).toContain('sensing_online');

                // All base sensing blocks should be included
                expect(result.sensing).toContain('sensing_username'); // bit 80
                expect(result.sensing).toContain('sensing_dayssince2000'); // bit 79
            });

            test('should exclude sensing_online when URL has bit 99 OFF', () => {
                // New Smalruby URL: bits 0-98 ON, bit 99 OFF (sensing_online)
                // 25 hex digits, last hex = 7 (binary 0111 reversed = 1110, bit 99 = 0)
                const result = initializeBlockSelectionFromOnlyBlocks('0fffffffffffffffffffffff7');

                // sensing_online (bit 99) should NOT be included
                expect(result.sensing).not.toContain('sensing_online');

                // All base sensing blocks should be included
                expect(result.sensing).toContain('sensing_username'); // bit 80
                expect(result.sensing).toContain('sensing_dayssince2000'); // bit 79
                expect(result.sensing.length).toBe(18); // All base sensing blocks (18 total)
            });
        });

        describe('backward compatibility for events_ prefix (legacy format)', () => {
            test('should support events_ prefix for selecting all event blocks', () => {
                // Old URLs used "events_" but we renamed category to "event"
                // Should be converted to "event_" automatically
                const result = initializeBlockSelectionFromOnlyBlocks('events_');

                // All event blocks should be selected
                expect(result.event).toEqual(CATEGORY_BLOCKS.event);

                // Other categories should be empty
                expect(result.motion).toEqual([]);
                expect(result.looks).toEqual([]);
            });

            test('should support events_xxx prefix for selecting specific event blocks', () => {
                // Old URLs used "events_whenflagclicked" format
                // Should be converted to "event_whenflagclicked" automatically
                const result = initializeBlockSelectionFromOnlyBlocks('events_whenflagclicked');

                // Only the specific event block should be selected
                expect(result.event).toEqual(['event_whenflagclicked']);

                // Other event blocks should not be selected
                expect(result.event).not.toContain('event_whenkeypressed');
            });

            test('should support mixed events_ and event_ in same parameter', () => {
                // Support mixing old and new formats
                const result = initializeBlockSelectionFromOnlyBlocks('events_whenflagclicked,event_whenkeypressed');

                // Both blocks should be selected
                expect(result.event).toContain('event_whenflagclicked');
                expect(result.event).toContain('event_whenkeypressed');
                expect(result.event.length).toBe(2);
            });

            test('should support events_ with period separator', () => {
                const result = initializeBlockSelectionFromOnlyBlocks('motion_movesteps.events_whenflagclicked');

                expect(result.motion).toEqual(['motion_movesteps']);
                expect(result.event).toEqual(['event_whenflagclicked']);
            });
        });
    });
});
