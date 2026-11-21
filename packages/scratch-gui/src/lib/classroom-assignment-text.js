/**
 * Light formatting of an assignment page's text (the teacher's words).
 *
 * Students closed the assignment panel without reading it, so the teacher's
 * plain text is shown with a few marks the teacher can type in the textarea
 * (docs/classroom/ui-ux.md 「課題のページの書き方」):
 *   - the first line is a heading (unless it is a list item)
 *   - `*words*` (or `**words**`) is highlighted
 *   - lines starting with `1.` (any number and `.`), `・` or `- ` are list items
 *   - `【…】` is a coloured label
 *   - a blank line breaks paragraphs
 * Everything else is literal text: no links, no HTML. The result is plain
 * data that a React component renders as elements (never as HTML), and it is
 * made at display time only, so the stored text stays as the teacher wrote it
 * and old assignments get the formatting too.
 */

// `*words*` / `**words**`: the words do not start or end with a space (so 「2 * 3 * 4」 stays as it is)
// and hold no `*`. `【…】` holds no bracket and is not empty.
const INLINE_RE = /(\*{1,2})(?![\s*])([^*\n]*?[^*\s])\1|【([^【】\n]+)】/g;
const ORDERED_RE = /^\s*([0-9０-９]+)[.．](?![0-9０-９])\s*(.*)$/;
const BULLET_RE = /^\s*(?:・|- )\s*(.*)$/;

const toHalfWidthDigits = (s) => s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

/**
 * Splits one line into text, highlighted words and labels.
 * @param {string} line - one line (no newline)
 * @returns {Array<{type: ('text'|'highlight'|'label'), text: string}>} the pieces (empty for an empty line)
 */
export const parseInline = (line) => {
    const pieces = [];
    const source = String(line || '');
    let last = 0;
    INLINE_RE.lastIndex = 0;
    let match;
    while ((match = INLINE_RE.exec(source)) !== null) {
        if (match.index > last) pieces.push({ type: 'text', text: source.slice(last, match.index) });
        if (typeof match[3] === 'string') pieces.push({ type: 'label', text: match[3] });
        else pieces.push({ type: 'highlight', text: match[2] });
        last = match.index + match[0].length;
    }
    if (last < source.length) pieces.push({ type: 'text', text: source.slice(last) });
    return pieces;
};

/**
 * @param {string} line - one line
 * @returns {?{ordered: boolean, number: ?number, text: string}} the list item, or null when it is not one
 */
const listItemOf = (line) => {
    const ordered = ORDERED_RE.exec(line);
    if (ordered) return { ordered: true, number: Number(toHalfWidthDigits(ordered[1])), text: ordered[2] };
    const bullet = BULLET_RE.exec(line);
    if (bullet) return { ordered: false, number: null, text: bullet[1] };
    return null;
};

/**
 * Parses a page's text into a heading and blocks (paragraphs and lists).
 * @param {?string} text - the page text as stored
 * @returns {{heading: ?Array<object>, blocks: Array<object>}} the heading's pieces (null when there is
 *   none) and the blocks: `{type: 'paragraph', lines: Array<Array<piece>>}` or
 *   `{type: 'list', ordered: boolean, items: Array<{number: ?number, pieces: Array<piece>}>}`
 */
export const parseAssignmentText = (text) => {
    const lines = String(text || '')
        .replace(/\r\n?/g, '\n')
        .split('\n');
    let start = 0;
    while (start < lines.length && !lines[start].trim()) start++;
    let heading = null;
    if (start < lines.length && !listItemOf(lines[start])) {
        heading = parseInline(lines[start].trim());
        start++;
    }
    const blocks = [];
    let current = null;
    for (let i = start; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) {
            current = null;
            continue;
        }
        const item = listItemOf(line);
        if (item) {
            if (!current || current.type !== 'list' || current.ordered !== item.ordered) {
                current = { type: 'list', ordered: item.ordered, items: [] };
                blocks.push(current);
            }
            current.items.push({ number: item.number, pieces: parseInline(item.text) });
            continue;
        }
        if (!current || current.type !== 'paragraph') {
            current = { type: 'paragraph', lines: [] };
            blocks.push(current);
        }
        current.lines.push(parseInline(line));
    }
    return { heading, blocks };
};

/**
 * One line without the marks (`*words*` → `words`, `【ポイント】` stays), for places that show
 * the text in one plain line (the opened row of the assignment board).
 * @param {?string} line - one line
 * @returns {string} the plain text
 */
export const plainAssignmentLine = (line) =>
    parseInline(line)
        .map((piece) => (piece.type === 'label' ? `【${piece.text}】` : piece.text))
        .join('');
