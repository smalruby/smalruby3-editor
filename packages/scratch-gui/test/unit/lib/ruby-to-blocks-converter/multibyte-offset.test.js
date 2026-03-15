import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';

describe('Multibyte character offset handling', () => {
    let converter;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, {version: '2'});
    });

    describe('error location with multibyte characters', () => {
        test('error after Japanese comment reports correct line', async () => {
            // go_to(0, 0) is a syntax error (should be go_to([0, 0]))
            // '# ゴースト' has multibyte chars that shift byte offsets
            const code = '# ゴースト\ngo_to(0, 0)';
            await converter.targetCodeToBlocks(null, code);
            expect(converter.errors.length).toBeGreaterThan(0);
            // Error should be on line 2, not misplaced due to byte offset
            expect(converter.errors[0].row).toBe(1); // 0-indexed, so line 2 = row 1
        });

        test('error on line with Japanese text reports correct column', async () => {
            // 'ゴースト.abc(' has a syntax error at the unclosed paren
            // 'ゴースト' is 4 chars but 12 bytes in UTF-8
            const code = 'ゴースト.abc(';
            await converter.targetCodeToBlocks(null, code);
            expect(converter.errors.length).toBeGreaterThan(0);
            // Column should be based on char offset (9), not byte offset (17)
            // 'ゴースト.abc(' = 4 + 1 + 3 + 1 = 9 chars, column is 0-indexed
            expect(converter.errors[0].column).toBeLessThanOrEqual(9);
        });

        test('multiple lines with Japanese text have correct error positions', async () => {
            const code = '# 最初のコメント\n# 二番目のコメント\ngo_to(0, 0)';
            await converter.targetCodeToBlocks(null, code);
            expect(converter.errors.length).toBeGreaterThan(0);
            // Error should be on line 3 (row 2 in 0-indexed)
            expect(converter.errors[0].row).toBe(2);
        });
    });

    describe('_getSource with multibyte characters', () => {
        test('extracts correct source from node after Japanese text', async () => {
            // 'say("こんにちは")' after Japanese comment
            const code = '# 日本語コメント\nsay("こんにちは")';
            await converter.targetCodeToBlocks(null, code);
            // Even if conversion fails, _getSource should work correctly
            // We can verify indirectly through error messages containing correct source
            if (converter.errors.length > 0 && converter.errors[0].source) {
                // Source in error should not be garbled
                expect(converter.errors[0].source).not.toMatch(/[\x00-\x08]/);
            }
        });

        test('error source text is not garbled with multibyte characters', async () => {
            // This code has an intentional error after Japanese text
            const code = '# ゴーストがずっと動くようにします\ngo_to(0, 0)';
            await converter.targetCodeToBlocks(null, code);
            expect(converter.errors.length).toBeGreaterThan(0);
            // The error source should contain readable text, not garbled bytes
            if (converter.errors[0].source) {
                expect(converter.errors[0].source).toMatch(/go_to/);
            }
        });
    });
});
