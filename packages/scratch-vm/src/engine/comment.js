/**
 * @file
 * Object representing a Scratch Comment (block or workspace).
 */

const uid = require('../util/uid');
const xmlEscape = require('../util/xml-escape');

class Comment {
    /**
     * @param {string} id Id of the comment.
     * @param {string} text Text content of the comment.
     * @param {number} x X position of the comment on the workspace.
     * @param {number} y Y position of the comment on the workspace.
     * @param {number} width The width of the comment when it is full size.
     * @param {number} height The height of the comment when it is full size.
     * @param {boolean} minimized Whether the comment is minimized.
     * @class
     */
    constructor (id, text, x, y, width, height, minimized) {
        this.id = id || uid();
        this.text = text;
        this.x = x;
        this.y = y;
        this.width = Math.max(Number(width), Comment.MIN_WIDTH);
        this.height = Math.max(Number(height), Comment.MIN_HEIGHT);
        this.minimized = minimized || false;
        this.blockId = null;
    }

    toXML () {
        // === Smalruby: Start of toXML modernization (cherry-picked from upstream spork@29bdbd1fe) ===
        // Blockly v12's deserializer (`ji` in scratch-blocks v2.1.19) reads
        // the `pinned` attribute as the bubble-visible flag (a v1
        // semantic shift — `pinned` is no longer "anchored to a block",
        // it is now "bubble shown"). Therefore `pinned` should be
        // `!minimized`, not `blockId !== null` (which was the v1 meaning).
        //
        // The minimized state is carried by the `collapsed` attribute (which
        // the v2.1.19 deserializer reads), matching upstream v13.7.2.
        //
        // Additionally, the deserializer applies `setBubbleLocation(x, y)`
        // from the parsed XML attributes via `setTimeout(1)` — for
        // `@ruby:*` comments created by the converter, x/y default to
        // (0, 0), so all bubbles end up stacked at the workspace origin.
        // Omit x/y attributes when both are 0 so the deserializer's
        // parseInt returns NaN and skips the reposition, letting the
        // bubble follow its block's anchor instead.
        const pinned = !this.minimized;
        const xyAttr =
            this.x === 0 && this.y === 0 ? '' : ` x="${this.x}" y="${this.y}"`;
        return `<comment id="${this.id}"${xyAttr} w="${this.width}" h="${
            this.height}" pinned="${pinned}" collapsed="${
            this.minimized}">${xmlEscape(this.text)}</comment>`;
        // === Smalruby: End of toXML modernization ===
    }

    // TODO choose min and defaults for width and height
    static get MIN_WIDTH () {
        return 20;
    }

    static get MIN_HEIGHT () {
        return 20;
    }

    static get DEFAULT_WIDTH () {
        return 100;
    }

    static get DEFAULT_HEIGHT () {
        return 100;
    }

}

module.exports = Comment;
