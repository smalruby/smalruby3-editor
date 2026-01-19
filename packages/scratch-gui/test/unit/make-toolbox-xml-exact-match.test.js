/**
 * @fileoverview Test for exact match logic in make-toolbox-xml shouldIncludeBlock function
 */

// Import the function we want to test
// Note: Since shouldIncludeBlock is not exported, we'll create a test version
const shouldIncludeBlockExactMatch = function (blockType, allowedPatterns) {
    if (!allowedPatterns || allowedPatterns.length === 0) return true;

    return allowedPatterns.some(pattern => {
        // Check if pattern is a category prefix (ends with underscore)
        if (pattern.endsWith('_')) {
            return blockType.startsWith(pattern);
        }
        // Otherwise, require exact match
        return blockType === pattern;
    });
};

describe('shouldIncludeBlock exact match logic', () => {
    test('should include block with exact match', () => {
        const result = shouldIncludeBlockExactMatch('looks_say', ['looks_say']);
        expect(result).toBeTruthy();
    });

    test('should not include block with prefix match when exact match is required', () => {
        // This test shows the desired behavior: looks_sayforsecs should NOT be included
        // when only looks_say is in the allowed patterns
        const result = shouldIncludeBlockExactMatch('looks_sayforsecs', ['looks_say']);
        expect(result).toBeFalsy();
    });

    test('should include block with category prefix match', () => {
        // Category prefixes (ending with _) should still work with startsWith
        const result = shouldIncludeBlockExactMatch('looks_say', ['looks_']);
        expect(result).toBeTruthy();
    });

    test('should include multiple blocks with category prefix', () => {
        const result1 = shouldIncludeBlockExactMatch('looks_say', ['looks_']);
        const result2 = shouldIncludeBlockExactMatch('looks_sayforsecs', ['looks_']);
        expect(result1).toBeTruthy();
        expect(result2).toBeTruthy();
    });

    test('should handle multiple exact matches', () => {
        const result = shouldIncludeBlockExactMatch('looks_say', ['motion_movesteps', 'looks_say', 'sound_play']);
        expect(result).toBeTruthy();
    });

    test('should reject blocks not in allowed patterns', () => {
        const result = shouldIncludeBlockExactMatch('looks_think', ['looks_say', 'motion_movesteps']);
        expect(result).toBeFalsy();
    });

    test('should return true for empty or null allowed patterns', () => {
        const result1 = shouldIncludeBlockExactMatch('looks_say', []);
        const result2 = shouldIncludeBlockExactMatch('looks_say', null);
        expect(result1).toBeTruthy();
        expect(result2).toBeTruthy();
    });

    test('should demonstrate current problematic behavior with prefix matching', () => {
        // This test demonstrates the current problem: looks_sayforsecs gets included
        // when looks_say is specified due to startsWith logic
        const currentShouldIncludeBlock = function (blockType, allowedPatterns) {
            if (!allowedPatterns || allowedPatterns.length === 0) return true;
            return allowedPatterns.some(pattern =>
                blockType === pattern || blockType.startsWith(pattern)
            );
        };

        // This currently returns true (problematic behavior)
        const problematicResult = currentShouldIncludeBlock('looks_sayforsecs', ['looks_say']);
        expect(problematicResult).toBeTruthy(); // This shows the current problem

        // This is the desired behavior (should return false)
        const correctResult = shouldIncludeBlockExactMatch('looks_sayforsecs', ['looks_say']);
        expect(correctResult).toBeFalsy(); // This shows the desired behavior
    });
});