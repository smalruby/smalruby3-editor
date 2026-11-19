// === Smalruby: This file is Smalruby-specific (Ruby tab constants) ===

const FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48];
const DEFAULT_FONT_SIZE = 16;
const FURIGANA_ENABLED_KEY = 'smalruby:furiganaEnabled';
const AUTO_CORRECT_ENABLED_KEY = 'smalruby:autoCorrectEnabled';
const AUTO_CORRECT_SETTINGS_KEY = 'smalruby:autoCorrectSettings';
const DNCL_MODE_KEY = 'smalruby:dnclMode';
// Monaco marker owner for the DNCL array index warnings (Issue #1357).
const DNCL_INDEX_HINT_OWNER = 'smalruby-dncl-index';
// Monaco marker owner for the code that cannot be written in DNCL, such as the
// post-test loop (Issue #1626).
const DNCL_UNSUPPORTED_OWNER = 'smalruby-dncl-unsupported';
// Monaco marker owner for the warnings on a `//` that looks like a comment
// (Issue #1711).
const DNCL_SLASH_COMMENT_OWNER = 'smalruby-dncl-slash-comment';
// Monaco marker owner for the warnings on `-` / `*` / `/` with a string
// (Issue #1465).
const DNCL_STRING_ARITHMETIC_OWNER = 'smalruby-dncl-string-arithmetic';
// The pale paper color of the Japanese tab's editor. The same value as the design token
// $color-japanese-paper (src/css/smalruby-tokens.css): Monaco takes its theme colors in JS.
const JAPANESE_PAPER_COLOR = '#fbf7ec';

export {
    FONT_SIZES,
    DEFAULT_FONT_SIZE,
    FURIGANA_ENABLED_KEY,
    AUTO_CORRECT_ENABLED_KEY,
    AUTO_CORRECT_SETTINGS_KEY,
    DNCL_MODE_KEY,
    DNCL_INDEX_HINT_OWNER,
    DNCL_UNSUPPORTED_OWNER,
    DNCL_SLASH_COMMENT_OWNER,
    DNCL_STRING_ARITHMETIC_OWNER,
    JAPANESE_PAPER_COLOR,
};
