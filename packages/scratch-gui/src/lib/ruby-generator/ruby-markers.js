// === Smalruby: This file is Smalruby-specific (reading the `@ruby:*` markers of comments) ===

const MARKER_PREFIX = '@ruby:';

/** The markers that tell where the comment of the user goes, not how the block is written in Ruby. */
const COMMENT_POSITION_PREFIX = '@ruby:comment_position:';

/**
 * The `@ruby`:* markers in a comment text, in order. This is the one place that reads them (issue #1857).
 *
 * A comment can hold the text of the user and the markers of the converter together: the user's
 * text comes first (the lines before the block, then the trailing comment), and the markers follow
 * on their own lines (`comment-handler.js` `_mergeUserComment`). A line is a line of markers when it
 * starts with `@ruby`: (the same lines `scrub.js` leaves out of the `#` comment). On one line the
 * markers are joined with `,` (`@ruby`:lvar:a:1,`@ruby`:syntax:+=) or with a space (`@ruby`:syntax:return
 * `@ruby`:return:foo). A `,` inside the value of a marker (`@ruby`:class:<=X,name=Cat, the source of
 * `@ruby`:syntax:case) stays, because only a `,` or spaces right before `@ruby`: split them.
 * @param {?string} text - The comment text.
 * @returns {Array<string>} The markers.
 */
const rubyMarkersOf = (text) => {
    if (typeof text !== 'string' || text === '') {
        return [];
    }
    const markers = [];
    text.split('\n').forEach((line) => {
        if (!line.startsWith(MARKER_PREFIX)) {
            return;
        }
        line.split(/,(?=@ruby:)|\s+(?=@ruby:)/).forEach((marker) => {
            if (marker !== '') {
                markers.push(marker);
            }
        });
    });
    return markers;
};

/**
 * Whether a marker tells where the comment of the user goes (`@ruby`:comment_position:*).
 * @param {string} marker - The marker.
 * @returns {boolean} True for a comment position marker.
 */
const isCommentPositionMarker = (marker) => marker.startsWith(COMMENT_POSITION_PREFIX);

/**
 * Register the methods that read the markers of a block on the RubyGenerator. The generators of the
 * blocks use them instead of looking at the comment text, so a comment of the user does not hide
 * the markers.
 * @param {object} Generator - The RubyGenerator.
 * @returns {object} The Generator.
 */
const registerRubyMarkers = (Generator) => {
    /**
     * The markers of a block that tell how it is written in Ruby. The comment position markers are
     * left out: they are about the comment of the user (read by `scrub_`), and leaving them out
     * keeps "the block has only this marker" true when the user adds a comment.
     * @param {?object} block - The block.
     * @returns {Array<string>} The markers.
     */
    Generator.getRubyMarkers = function (block) {
        if (!block) {
            return [];
        }
        return rubyMarkersOf(this.getCommentText(block)).filter((marker) => !isCommentPositionMarker(marker));
    };

    /**
     * The markers of a block joined with `,`, for a reader that matches the whole set of markers
     * (`@ruby`:super,`@ruby`:return:foo). The text of the user is not in it.
     * @param {?object} block - The block.
     * @returns {string} The markers, or '' when the block has none.
     */
    Generator.getRubyMarkerText = function (block) {
        return this.getRubyMarkers(block).join(',');
    };

    /**
     * Whether a block has a marker.
     * @param {?object} block - The block.
     * @param {string} marker - The whole marker (`@ruby`:method:clone).
     * @returns {boolean} True if the block has it.
     */
    Generator.hasRubyMarker = function (block, marker) {
        return this.getRubyMarkers(block).includes(marker);
    };

    /**
     * The first marker of a block that starts with a prefix.
     * @param {?object} block - The block.
     * @param {string} prefix - The start of the marker (`@ruby`:symbol:).
     * @returns {?string} The whole marker, or null.
     */
    Generator.findRubyMarker = function (block, prefix) {
        return this.getRubyMarkers(block).find((marker) => marker.startsWith(prefix)) || null;
    };

    /**
     * The rest of the first marker of a block that starts with a prefix.
     * @param {?object} block - The block.
     * @param {string} prefix - The start of the marker (`@ruby`:symbol:).
     * @returns {?string} The text after the prefix (`hello` of `@ruby`:symbol:hello), or null.
     */
    Generator.rubyMarkerValue = function (block, prefix) {
        const marker = this.findRubyMarker(block, prefix);
        return marker === null ? null : marker.slice(prefix.length);
    };

    return Generator;
};

export { rubyMarkersOf, isCommentPositionMarker, registerRubyMarkers };
