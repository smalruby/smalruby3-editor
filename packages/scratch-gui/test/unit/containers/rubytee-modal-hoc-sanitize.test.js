import { sanitizeResourceReferences } from '../../../src/containers/rubytee-modal-hoc';

describe('sanitizeResourceReferences', () => {
    // --- Sound ---
    describe('sounds', () => {
        test('replaces invalid sound name in play() with first valid sound', () => {
            const code = 'play("ポップ")';
            const result = sanitizeResourceReferences(code, ['ネコ', 'イヌ'], ['コスチューム1'], ['背景1']);
            expect(result).toBe('play("ネコ")');
        });

        test('replaces invalid sound name in play_until_done() with first valid sound', () => {
            const code = 'play_until_done("ポップ")';
            const result = sanitizeResourceReferences(code, ['ネコ'], ['コスチューム1'], ['背景1']);
            expect(result).toBe('play_until_done("ネコ")');
        });

        test('comments out play() when sound list is empty', () => {
            const code = 'play("ポップ")';
            const result = sanitizeResourceReferences(code, [], ['コスチューム1'], ['背景1']);
            expect(result).toBe('# play("ポップ") # この音は存在しないのでコメントアウトしました');
        });

        test('comments out play_until_done() when sound list is empty', () => {
            const code = 'play_until_done("ポップ")';
            const result = sanitizeResourceReferences(code, [], ['コスチューム1'], ['背景1']);
            expect(result).toBe('# play_until_done("ポップ") # この音は存在しないのでコメントアウトしました');
        });

        test('keeps valid play() unchanged', () => {
            const code = 'play("ネコ")';
            const result = sanitizeResourceReferences(code, ['ネコ', 'イヌ'], ['コスチューム1'], ['背景1']);
            expect(result).toBe('play("ネコ")');
        });

        test('handles indented play() lines', () => {
            const code = '  play("ポップ")';
            const result = sanitizeResourceReferences(code, ['ネコ'], ['コスチューム1'], ['背景1']);
            expect(result).toBe('  play("ネコ")');
        });

        test('handles multiple lines with mixed valid/invalid sounds', () => {
            const code = ['play("ネコ")', 'play("ポップ")', 'play_until_done("ドン")'].join('\n');
            const result = sanitizeResourceReferences(code, ['ネコ'], ['コスチューム1'], ['背景1']);
            expect(result).toBe(['play("ネコ")', 'play("ネコ")', 'play_until_done("ネコ")'].join('\n'));
        });
    });

    // --- Costume ---
    describe('costumes', () => {
        test('replaces invalid costume name in switch_costume() with first valid costume', () => {
            const code = 'switch_costume("存在しないコスチューム")';
            const result = sanitizeResourceReferences(code, ['ネコ'], ['コスチューム1', 'コスチューム2'], ['背景1']);
            expect(result).toBe('switch_costume("コスチューム1")');
        });

        test('replaces invalid costume name in self.costume = with first valid costume', () => {
            const code = 'self.costume = "存在しないコスチューム"';
            const result = sanitizeResourceReferences(code, ['ネコ'], ['コスチューム1'], ['背景1']);
            expect(result).toBe('self.costume = "コスチューム1"');
        });

        test('keeps valid switch_costume() unchanged', () => {
            const code = 'switch_costume("コスチューム1")';
            const result = sanitizeResourceReferences(code, ['ネコ'], ['コスチューム1', 'コスチューム2'], ['背景1']);
            expect(result).toBe('switch_costume("コスチューム1")');
        });

        test('handles indented switch_costume() lines', () => {
            const code = '  switch_costume("存在しない")';
            const result = sanitizeResourceReferences(code, ['ネコ'], ['コスチューム1'], ['背景1']);
            expect(result).toBe('  switch_costume("コスチューム1")');
        });

        test('skips costume replacement when costume list is empty', () => {
            const code = 'switch_costume("存在しないコスチューム")';
            const result = sanitizeResourceReferences(code, ['ネコ'], [], ['背景1']);
            expect(result).toBe('switch_costume("存在しないコスチューム")');
        });
    });

    // --- Backdrop ---
    describe('backdrops', () => {
        test('replaces invalid backdrop name in switch_backdrop() with first valid backdrop', () => {
            const code = 'switch_backdrop("存在しない背景")';
            const result = sanitizeResourceReferences(code, ['ネコ'], ['コスチューム1'], ['背景1', '背景2']);
            expect(result).toBe('switch_backdrop("背景1")');
        });

        test('replaces invalid backdrop name in switch_backdrop_and_wait()', () => {
            const code = 'switch_backdrop_and_wait("存在しない背景")';
            const result = sanitizeResourceReferences(code, ['ネコ'], ['コスチューム1'], ['背景1']);
            expect(result).toBe('switch_backdrop_and_wait("背景1")');
        });

        test('replaces invalid backdrop name in switch_backdrop_to_and_wait()', () => {
            const code = 'switch_backdrop_to_and_wait("存在しない背景")';
            const result = sanitizeResourceReferences(code, ['ネコ'], ['コスチューム1'], ['背景1']);
            expect(result).toBe('switch_backdrop_to_and_wait("背景1")');
        });

        test('replaces invalid backdrop name in self.backdrop =', () => {
            const code = 'self.backdrop = "存在しない背景"';
            const result = sanitizeResourceReferences(code, ['ネコ'], ['コスチューム1'], ['背景1']);
            expect(result).toBe('self.backdrop = "背景1"');
        });

        test('keeps valid switch_backdrop() unchanged', () => {
            const code = 'switch_backdrop("背景1")';
            const result = sanitizeResourceReferences(code, ['ネコ'], ['コスチューム1'], ['背景1', '背景2']);
            expect(result).toBe('switch_backdrop("背景1")');
        });

        test('handles indented switch_backdrop() lines', () => {
            const code = '  switch_backdrop("存在しない背景")';
            const result = sanitizeResourceReferences(code, ['ネコ'], ['コスチューム1'], ['背景1']);
            expect(result).toBe('  switch_backdrop("背景1")');
        });

        test('skips backdrop replacement when backdrop list is empty', () => {
            const code = 'switch_backdrop("存在しない背景")';
            const result = sanitizeResourceReferences(code, ['ネコ'], ['コスチューム1'], []);
            expect(result).toBe('switch_backdrop("存在しない背景")');
        });
    });

    // --- Edge cases ---
    describe('edge cases', () => {
        test('handles empty code string', () => {
            const result = sanitizeResourceReferences('', ['ネコ'], ['コスチューム1'], ['背景1']);
            expect(result).toBe('');
        });

        test('handles code with no resource references', () => {
            const code = 'move(10)\nwait(1)';
            const result = sanitizeResourceReferences(code, ['ネコ'], ['コスチューム1'], ['背景1']);
            expect(result).toBe('move(10)\nwait(1)');
        });

        test('handles multiple resource types in one code block', () => {
            const code = [
                'play("ポップ")',
                'switch_costume("存在しないコスチューム")',
                'switch_backdrop("存在しない背景")',
            ].join('\n');
            const result = sanitizeResourceReferences(code, ['ネコ'], ['コスチューム1'], ['背景1']);
            expect(result).toBe(
                ['play("ネコ")', 'switch_costume("コスチューム1")', 'switch_backdrop("背景1")'].join('\n'),
            );
        });
    });
});
