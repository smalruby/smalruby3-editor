// === Smalruby: This file is Smalruby-specific (reading the `@ruby:*` markers of comments) ===

const MARKER_PREFIX = '@ruby:';

/** The markers that tell where the comment of the user goes, not how the block is written in Ruby. */
const COMMENT_POSITION_PREFIX = '@ruby:comment_position:';

/**
 * The markers whose value is text of the user's program and runs to the end of the line: the source
 * of the subject of `case`, the name of a symbol, the name of a module. A `,` or a space before
 * `@ruby`: inside it is part of the value (a subject such as the string "a `@ruby`:b"), not the start
 * of the next marker.
 */
const REST_OF_LINE_PREFIXES = ['@ruby:syntax:case:', '@ruby:symbol:', '@ruby:module_source:'];

/**
 * The markers that the converter adds after a marker that runs to the end of the line
 * (`@ruby`:symbol:a,`@ruby`:method:puts; `@ruby`:begin_loop_body and the loop markers of
 * `_addCommentMarker` / `addMethodComment`). They are split off the end of its value again.
 */
const TAIL_MARKER_PATTERN =
    /^@ruby:(?:method:[a-z_]+[?!]?|argument:\d+:type:[A-Za-z]+|begin_loop_body|loop_condition_call|syntax:(?:begin_end|while|wait_until))$/;

/** A `,` or spaces right before `@ruby`:, where the next marker on a line starts. */
const SEPARATOR_PATTERN = /,(?=@ruby:)|\s+(?=@ruby:)/g;

/**
 * Split a marker that runs to the end of the line from the markers added after it.
 * @param {string} rest - The line from the start of the marker.
 * @returns {Array<string>} The marker, then the markers added after it.
 */
const splitRestOfLine = (rest) => {
    const tails = [];
    let value = rest;
    for (;;) {
        const match = value.match(/,(@ruby:[^,\s]*)$/);
        if (!match || !TAIL_MARKER_PATTERN.test(match[1])) {
            break;
        }
        tails.unshift(match[1]);
        value = value.slice(0, match.index);
    }
    return [value, ...tails];
};

/**
 * The markers of one line of markers.
 * @param {string} line - A line that starts with `@ruby`:.
 * @returns {Array<string>} The markers.
 */
const markersOfLine = (line) => {
    const markers = [];
    let start = 0;
    while (start < line.length) {
        const rest = line.slice(start);
        if (REST_OF_LINE_PREFIXES.some((prefix) => rest.startsWith(prefix))) {
            markers.push(...splitRestOfLine(rest));
            break;
        }
        SEPARATOR_PATTERN.lastIndex = start + 1;
        const separator = SEPARATOR_PATTERN.exec(line);
        const end = separator ? separator.index : line.length;
        markers.push(line.slice(start, end));
        start = separator ? separator.index + separator[0].length : line.length;
    }
    return markers.filter((marker) => marker !== '');
};

/**
 * The `@ruby`:* markers in a comment text, in order. This is the one place that reads them (issue #1857).
 *
 * A comment can hold the text of the user and the markers of the converter together: the user's
 * text comes first (the lines before the block, then the trailing comment), and the markers follow
 * on their own lines (`comment-handler.js` `_mergeUserComment`). A line is a line of markers when it
 * starts with `@ruby`: (the same lines `scrub.js` leaves out of the `#` comment). On one line the
 * markers are joined with `,` (`@ruby`:lvar:a:1,`@ruby`:syntax:+=) or with a space (`@ruby`:syntax:return
 * `@ruby`:return:foo). A `,` inside the value of a marker (`@ruby`:class:<=X,name=Cat) stays, because
 * only a `,` or spaces right before `@ruby`: split them, and a marker whose value is program text
 * (`REST_OF_LINE_PREFIXES`) is not split at all.
 * @param {?string} text - The comment text.
 * @returns {Array<string>} The markers.
 */
const rubyMarkersOf = (text) => {
    if (typeof text !== 'string' || text === '') {
        return [];
    }
    const markers = [];
    text.split('\n').forEach((line) => {
        if (line.startsWith(MARKER_PREFIX)) {
            markers.push(...markersOfLine(line));
        }
    });
    return markers;
};

/**
 * The last of the markers that starts with a prefix. The last one wins: the converter puts the
 * user's text first and its markers after it, so a line of the user that starts with `@ruby`:
 * does not take the place of the converter's marker.
 * @param {Array<string>} markers - The markers.
 * @param {string} prefix - The start of the marker (`@ruby`:symbol:).
 * @returns {?string} The whole marker, or null.
 */
const findRubyMarkerIn = (markers, prefix) => {
    for (let i = markers.length - 1; i >= 0; i--) {
        if (markers[i].startsWith(prefix)) {
            return markers[i];
        }
    }
    return null;
};

/**
 * The value of the last marker of a comment text that starts with a prefix.
 * @param {?string} text - The comment text.
 * @param {string} prefix - The start of the marker (`@ruby`:module_source:).
 * @returns {?string} The text after the prefix, or null.
 */
const rubyMarkerValueOf = (text, prefix) => {
    const marker = findRubyMarkerIn(rubyMarkersOf(text), prefix);
    return marker === null ? null : marker.slice(prefix.length);
};

/**
 * Whether a comment keeps a feature of Ruby v2 (a module, a class): `@ruby`:module_source:*,
 * `@ruby`:class or `@ruby`:class:*. The settings menu does not switch to v1 while one is used.
 * @param {?string} text - The comment text.
 * @returns {boolean} True if the comment has such a marker.
 */
const isRubyV2Comment = (text) =>
    rubyMarkersOf(text).some(
        (marker) =>
            marker.startsWith('@ruby:module_source:') ||
            marker === '@ruby:class' ||
            marker.startsWith('@ruby:class:'),
    );

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
     * The last marker of a block that starts with a prefix (see `findRubyMarkerIn`).
     * @param {?object} block - The block.
     * @param {string} prefix - The start of the marker (`@ruby`:symbol:).
     * @returns {?string} The whole marker, or null.
     */
    Generator.findRubyMarker = function (block, prefix) {
        return findRubyMarkerIn(this.getRubyMarkers(block), prefix);
    };

    /**
     * The rest of the last marker of a block that starts with a prefix.
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

export {
    isRubyV2Comment,
    rubyMarkersOf,
    rubyMarkerValueOf,
    findRubyMarkerIn,
    isCommentPositionMarker,
    registerRubyMarkers,
};
