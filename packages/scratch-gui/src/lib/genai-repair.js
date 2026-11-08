// Fix what a generative AI commonly gets wrong about Smalruby before turning its
// answer into blocks. Only Smalruby knows the commands and the project's sound and
// costume names, so it repairs them here instead of asking the AI again and again.
// Pure functions only.

const normalize = (name) =>
    String(name)
        .toLowerCase()
        .replace(/[\s_\-・]/g, '');

/**
 * Pick the asset the AI meant: exact name, then case/space-insensitive, then one
 * containing the other. A name that fits none is not replaced by the only asset
 * there is (#1280): a different sound playing silently is worse than asking the
 * student to choose, so the caller reports it instead.
 * @param {string} wanted - the name the AI wrote.
 * @param {Array<string>} names - the names that exist.
 * @returns {?string} the existing name, or null when none fits.
 */
const resolveName = (wanted, names) => {
    if (!names || names.length === 0) return null;
    if (names.includes(wanted)) return wanted;
    const key = normalize(wanted);
    const same = names.find((n) => normalize(n) === key);
    if (same) return same;
    const partial = names.find((n) => key && (normalize(n).includes(key) || key.includes(normalize(n))));
    return partial || null;
};

// play / play_until_done in any spelling the AI tends to use, with an optional `name:` / `sound:` keyword.
const SOUND_CALL =
    /\b(play_sound_until_done|play_until_done|start_sound|play_sound|play)\s*\(\s*(?:(?:name|sound)\s*:\s*)?(["'])(.*?)\2\s*\)/g;
const COSTUME_CALL = /\b(switch_costume_to|switch_costume)\s*\(\s*(?:(?:name|costume)\s*:\s*)?(["'])(.*?)\2\s*\)/g;
const WAIT_CALL = /\bwait\s*\(\s*(\d+(?:\.\d+)?)\s*\)|\bwait\s+(\d+(?:\.\d+)?)\b/g;

// Scratch block names turned into English, which generative AIs write for Smalruby
// commands (seen in the prompt lab, #1283). Applied outside strings and comments.
const COMMAND_ALIASES = [
    [/(?<![\w.])when_green_flag_clicked\b/g, 'when_flag_clicked'],
    [/(?<![\w.])when_(?:this_)?sprite_clicked\b/g, 'when_clicked'],
    [/(?<![\w.])when_(?:broadcast_received|i_receive)\b/g, 'when_receive'],
    [/(?<![\w.])forever(?=\s+do\b)/g, 'loop'],
    [/(?<![\w.])touched\?/g, 'touching?'],
    [/(?<![\w.])key_pressed\?/g, 'keyboard.pressed?'],
    [/(?<![\w.])when_start_as_clone\b/g, 'when_start_as_a_clone'],
    [/(?<![\w.])create_clone(?!\s*\(|\w)/g, 'create_clone("_myself_")'],
    [/(?<![\w.])stop_all(?!\w)(?:\s*\(\s*\))?/g, 'stop("all")'],
    [/(?<![\w.])(?:rand|pick_random|random)\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g, 'rand($1..$2)'],
    [/(?<![\w.])point_in_direction\s*\(\s*([^()]*?)\s*\)/g, 'self.direction = $1'],
];

/**
 * Apply `fn` to the parts of a line that are code, leaving strings and the
 * comment alone.
 * @param {string} line - one line of Ruby.
 * @param {function(string): string} fn - rewrites a piece of code.
 * @returns {string} the line.
 */
const mapCode = (line, fn) => {
    let out = '';
    let piece = '';
    let quote = null;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (quote) {
            out += ch;
            if (ch === '\\') {
                out += line[++i] || '';
            } else if (ch === quote) {
                quote = null;
            }
        } else if (ch === '"' || ch === "'") {
            out += fn(piece) + ch;
            piece = '';
            quote = ch;
        } else if (ch === '#') {
            return out + fn(piece) + line.slice(i);
        } else {
            piece += ch;
        }
    }
    return out + fn(piece);
};

const renameCommands = (code) =>
    COMMAND_ALIASES.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), code);

/**
 * Repair one sprite's Ruby: Scratch-style command names, command spellings and sound/costume names.
 * @param {string} code - the Ruby for one sprite.
 * @param {object} assets - what the sprite has.
 * @param {Array<string>} assets.sounds - sound names.
 * @param {Array<string>} assets.costumes - costume names.
 * @returns {{code: string, fixes: Array<{line: number, from: string, to: string}>,
 *     missing: Array<{line: number, kind: string, name: string, names: Array<string>}>}} the
 *     repaired code, what changed and the sound/costume names the sprite does not have
 *     (1-based line numbers).
 */
const repairRuby = (code, { sounds = [], costumes = [] } = {}) => {
    const fixes = [];
    const missing = [];
    const resolve = (name, names, kind, line) => {
        const resolved = resolveName(name, names);
        if (resolved) return resolved;
        missing.push({ line, kind, name, names });
        return name;
    };
    const lines = code.split('\n').map((line, index) => {
        const fixed = mapCode(line, renameCommands)
            .replace(SOUND_CALL, (whole, method, quote, name) => {
                const resolved = resolve(name, sounds, 'sound', index + 1);
                const command = method.endsWith('until_done') ? 'play_until_done' : 'play';
                return `${command}("${resolved}")`;
            })
            .replace(COSTUME_CALL, (whole, method, quote, name) => {
                const resolved = resolve(name, costumes, 'costume', index + 1);
                return `switch_costume("${resolved}")`;
            })
            .replace(WAIT_CALL, (whole, inParens, bare) => `sleep(${inParens || bare})`);
        if (fixed !== line) fixes.push({ line: index + 1, from: line.trim(), to: fixed.trim() });
        return fixed;
    });
    return { code: lines.join('\n'), fixes, missing };
};

const HEADING = /^\s*#\s*(?:[「『"]\s*)?(.+?)(?:\s*[」』"])?\s*(?:の\s*プログラム)?\s*[:：]?\s*$/;

/**
 * Split an answer that covers several sprites at `# 「name」` comment lines.
 * @param {string} code - the Ruby from the answer.
 * @param {Array<string>} names - the sprite names in the project (and 'ステージ').
 * @param {object} [options] - options.
 * @param {?string} [options.leadingName] - the sprite the lines before the first heading
 *     belong to. Without it they are dropped. The Ruby tab's answer has no headings, so a
 *     comment there that is only a sprite name (a block comment 「ネコ」) would otherwise
 *     cut off the program above it (#1398).
 * @returns {?Array<{name: string, code: string}>} one part per sprite, or null when the
 *     answer has no sprite headings.
 */
const splitBySprite = (code, names, { leadingName = null } = {}) => {
    const parts = [];
    const leading = { name: leadingName, lines: [] };
    let current = leadingName ? leading : null;
    for (const line of code.split('\n')) {
        const match = line.match(HEADING);
        const name = match && names.find((n) => normalize(n) === normalize(match[1]));
        if (name) {
            current = { name, lines: [] };
            parts.push(current);
        } else if (current) {
            current.lines.push(line);
        }
    }
    if (parts.length === 0) return null;
    if (leading.lines.some((line) => line.trim())) parts.unshift(leading);
    return parts.map((part) => ({ name: part.name, code: `${part.lines.join('\n').trim()}\n` }));
};

export { repairRuby, resolveName, splitBySprite };
