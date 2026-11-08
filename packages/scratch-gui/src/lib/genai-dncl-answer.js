// Checking a DNCL answer of "生成AI に相談" in the Ruby tab's Japanese (DNCL) mode
// (#1402): the DNCL is turned into Ruby first (through the DNCLv2 pre-processor, so the
// form of 共通テスト with line numbers, ｜ / ⎿ and colons is read too), and then judged as
// the Ruby modes are. Errors are moved back to DNCL lines with the source map.
// The converter is passed in, so this file stays free of the VM.
import { tidyPastedDncl, withDoubleSlashHint } from './dncl/dncl-paste-tidy';
import { dnclToRuby } from './dncl/dncl-to-ruby';
import { extractDncl } from './genai-dncl-prompt.js';

// Opcodes the converter leaves a line as when it can't make an ordinary block of it.
const RAW_OPCODES = ['ruby_statement', 'ruby_expression'];

// Problems go to the AI too, so they are in Japanese whatever the editor language.
const DOUBLE_SLASH_HINT =
    'スモウルビーでは // はコメントではありません（整数の割り算です）。コメントには # を使ってください。';

const errorText = (error) =>
    typeof error === 'string' ? error : error.text || error.message || JSON.stringify(error);

/**
 * Check a pasted DNCL answer: take the DNCL out, tidy it as a paste into the editor would
 * (line numbers and `//` comments), turn it into Ruby and convert that. It is a success
 * only when every line becomes an ordinary block, as in the Ruby modes.
 * @param {object} params - parameters.
 * @param {string} params.answer - what the student pasted.
 * @param {string} params.editingName - the sprite in the editor (the answer is for it).
 * @param {function(string, string): Promise<object>} params.convert - converts the Ruby of
 *     the sprite; resolves to a converter with `result`, `errors` and `blocks`.
 * @returns {Promise<object>} checkAnswer's shape `{ok, code, parts, fixes, problems}`: the
 *     one part's `code` is the DNCL (what goes into the editor), errors are on DNCL rows.
 */
const checkDnclAnswer = async ({ answer, editingName, convert }) => {
    const extracted = extractDncl(answer);
    if (!extracted) return { ok: false, code: '', parts: [], fixes: [], problems: [{ type: 'noProgram' }] };
    const code = tidyPastedDncl(extracted);
    const lines = code.split('\n');
    const part = { name: editingName, code, fixes: [], converter: null };
    const problems = [];
    // Several Ruby lines may come from one DNCL line (a loop becomes 2 lines), so the same
    // error on the same DNCL line is said once.
    const said = new Set();
    const toProblems = (errors) =>
        withDoubleSlashHint(errors, lines, DOUBLE_SLASH_HINT).forEach((error) => {
            const key = `${error.row}:${error.text}`;
            if (said.has(key)) return;
            said.add(key);
            problems.push({ type: 'error', sprite: null, row: error.row, text: error.text });
        });
    const transpiled = dnclToRuby(code);
    if (transpiled.ruby === null) {
        toProblems(transpiled.errors.map((error) => ({ row: error.line - 1, text: error.message })));
    } else {
        try {
            part.converter = await convert(editingName, transpiled.ruby);
            if (part.converter.result) {
                const count = Object.values(part.converter.blocks || {}).filter((block) =>
                    RAW_OPCODES.includes(block.opcode),
                ).length;
                if (count > 0) problems.push({ type: 'raw', sprite: null, count });
            } else {
                const errors = part.converter.errors.map((error) => ({
                    row: typeof error.row === 'number' ? error.row : null,
                    text: errorText(error),
                }));
                const placed = errors.filter((error) => error.row !== null);
                const moved = transpiled.sourceMap.rubyErrorsToDncl(placed);
                errors
                    .filter((error) => error.row === null)
                    .forEach((error) => problems.push({ type: 'error', sprite: null, row: null, text: error.text }));
                toProblems(moved);
            }
        } catch (e) {
            problems.push({ type: 'exception', sprite: null, text: e.message || String(e) });
        }
    }
    return { ok: problems.length === 0, code, parts: [part], fixes: [], problems };
};

export { checkDnclAnswer };
