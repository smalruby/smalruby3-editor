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
 * containing the other, then the only asset there is.
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
    if (partial) return partial;
    return names.length === 1 ? names[0] : null;
};

// play / play_until_done in any spelling the AI tends to use, with an optional `name:` / `sound:` keyword.
const SOUND_CALL =
    /\b(play_sound_until_done|play_until_done|start_sound|play_sound|play)\s*\(\s*(?:(?:name|sound)\s*:\s*)?(["'])(.*?)\2\s*\)/g;
const COSTUME_CALL = /\b(switch_costume_to|switch_costume)\s*\(\s*(?:(?:name|costume)\s*:\s*)?(["'])(.*?)\2\s*\)/g;
const WAIT_CALL = /\bwait\s*\(\s*(\d+(?:\.\d+)?)\s*\)|\bwait\s+(\d+(?:\.\d+)?)\b/g;

/**
 * Repair one sprite's Ruby: command spellings and sound/costume names.
 * @param {string} code - the Ruby for one sprite.
 * @param {object} assets - what the sprite has.
 * @param {Array<string>} assets.sounds - sound names.
 * @param {Array<string>} assets.costumes - costume names.
 * @returns {{code: string, fixes: Array<{line: number, from: string, to: string}>}} the repaired
 *     code and what changed (1-based line numbers).
 */
const repairRuby = (code, { sounds = [], costumes = [] } = {}) => {
    const fixes = [];
    const lines = code.split('\n').map((line, index) => {
        const fixed = line
            .replace(SOUND_CALL, (whole, method, quote, name) => {
                const resolved = resolveName(name, sounds) || name;
                const command = method.endsWith('until_done') ? 'play_until_done' : 'play';
                return `${command}("${resolved}")`;
            })
            .replace(COSTUME_CALL, (whole, method, quote, name) => {
                const resolved = resolveName(name, costumes) || name;
                return `switch_costume("${resolved}")`;
            })
            .replace(WAIT_CALL, (whole, inParens, bare) => `sleep(${inParens || bare})`);
        if (fixed !== line) fixes.push({ line: index + 1, from: line.trim(), to: fixed.trim() });
        return fixed;
    });
    return { code: lines.join('\n'), fixes };
};

const HEADING = /^\s*#\s*(?:[「『"]\s*)?(.+?)(?:\s*[」』"])?\s*(?:の\s*プログラム)?\s*[:：]?\s*$/;

/**
 * Split an answer that covers several sprites at `# 「name」` comment lines.
 * @param {string} code - the Ruby from the answer.
 * @param {Array<string>} names - the sprite names in the project (and 'ステージ').
 * @returns {?Array<{name: string, code: string}>} one part per sprite, or null when the
 *     answer has no sprite headings.
 */
const splitBySprite = (code, names) => {
    const parts = [];
    let current = null;
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
    return parts.map((part) => ({ name: part.name, code: `${part.lines.join('\n').trim()}\n` }));
};

export { repairRuby, resolveName, splitBySprite };
