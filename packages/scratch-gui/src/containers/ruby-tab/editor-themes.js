// The Monaco themes of the Ruby tab's editor. The Japanese tab writes on pale paper so that
// it looks like a different language from Ruby (docs/dncl/design.md 1 章).
import { JAPANESE_PAPER_COLOR } from './constants';

const JAPANESE_PAPER_THEME = 'smalruby-japanese-paper';

/**
 * The theme of the Japanese tab: the light theme of Monaco on the paper color.
 * @returns {object} the theme data for `monaco.editor.defineTheme`.
 */
const japanesePaperTheme = () => ({
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {
        'editor.background': JAPANESE_PAPER_COLOR,
        'editorGutter.background': JAPANESE_PAPER_COLOR,
        'editorStickyScroll.background': JAPANESE_PAPER_COLOR,
        'editor.lineHighlightBackground': '#f3ecd9',
    },
});

/**
 * Define the themes before the editor is made (the `beforeMount` of the Editor).
 * @param {object} monaco - the Monaco namespace.
 */
const defineEditorThemes = (monaco) => {
    monaco.editor.defineTheme(JAPANESE_PAPER_THEME, japanesePaperTheme());
};

export { JAPANESE_PAPER_THEME, defineEditorThemes, japanesePaperTheme };
