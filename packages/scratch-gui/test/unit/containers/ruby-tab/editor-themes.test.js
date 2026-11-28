// The paper of the Japanese tab (docs/dncl/design.md 1 章): the Monaco theme takes its colors in
// JS, so its color has to stay the same as the design token $color-japanese-paper.
import fs from 'fs';
import path from 'path';
import { JAPANESE_PAPER_COLOR } from '../../../../src/containers/ruby-tab/constants';
import {
    JAPANESE_PAPER_THEME,
    defineEditorThemes,
    japanesePaperTheme,
} from '../../../../src/containers/ruby-tab/editor-themes';

const TOKENS = path.resolve(__dirname, '../../../../src/css/smalruby-tokens.css');

describe('the theme of the Japanese tab', () => {
    test('the paper color is the design token $color-japanese-paper', () => {
        const match = fs.readFileSync(TOKENS, 'utf8').match(/^\$color-japanese-paper:\s*(#[0-9a-f]{6});/im);
        expect(match).not.toBeNull();
        expect(JAPANESE_PAPER_COLOR.toLowerCase()).toBe(match[1].toLowerCase());
    });

    test('the editor and its line numbers are on the paper', () => {
        const theme = japanesePaperTheme();
        expect(theme.base).toBe('vs');
        expect(theme.colors['editor.background']).toBe(JAPANESE_PAPER_COLOR);
        expect(theme.colors['editorGutter.background']).toBe(JAPANESE_PAPER_COLOR);
    });

    test('the theme is defined before the editor is made', () => {
        const monaco = { editor: { defineTheme: jest.fn() } };
        defineEditorThemes(monaco);
        expect(monaco.editor.defineTheme).toHaveBeenCalledWith(JAPANESE_PAPER_THEME, japanesePaperTheme());
    });
});
