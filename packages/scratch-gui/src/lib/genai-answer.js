// Steps 4-6 of "生成AI に相談" (#1280): check whether a pasted answer turns into
// blocks, and switch between the original program and the AI's version.
// The converter is passed in, so this file stays free of the VM.
import { extractRuby } from './genai-prompt.js';
import { repairRuby, splitBySprite } from './genai-repair.js';

// Opcodes the converter leaves a line as when it can't make an ordinary block of it.
const RAW_OPCODES = ['ruby_statement', 'ruby_expression'];

// `class Foo < Bar` / `module M` at the start of a line (not in a comment or a string).
const CLASS_LINE = /^\s*(?:class|module)\s+[A-Z]/;

/**
 * Find class and module definitions. The converter quietly drops `class Foo`
 * and puts what is inside into the sprite being converted, so an answer written
 * as classes would look like a success while it goes to the wrong sprite (#1280).
 * The question asks for `# 「name」` lines instead, so they are a problem.
 * @param {string} code - the Ruby of one sprite.
 * @returns {Array<{line: number, source: string}>} the definitions (1-based lines).
 */
const findClassDefinitions = (code) =>
    code
        .split('\n')
        .map((source, index) => ({ line: index + 1, source }))
        .filter((entry) => CLASS_LINE.test(entry.source))
        .map((entry) => ({ line: entry.line, source: entry.source.trim() }));

/**
 * Check a pasted answer: take the Ruby out, split it by sprite, repair it and
 * convert each part. It is a success only when every line becomes an ordinary
 * block in the sprite it was written for: names the sprite lacks, class
 * definitions and lines left as "Ruby" blocks are problems (#1280).
 * @param {object} params - parameters.
 * @param {string} params.answer - what the student pasted.
 * @param {Array<{name: string, sounds: Array<string>, costumes: Array<string>}>} params.sprites -
 *     the sprites ('ステージ' for the stage).
 * @param {string} params.editingName - the sprite an answer without headings goes to.
 * @param {function(string, string): Promise<object>} params.convert - converts one sprite's
 *     Ruby; resolves to a converter with `result`, `errors` and `blocks`.
 * @returns {Promise<object>} `{ok, code, parts, fixes, problems}`: `parts` are
 *     `{name, code, fixes, converter}` and `problems` are objects with a `type`.
 */
const checkAnswer = async ({ answer, sprites, editingName, convert }) => {
    const code = extractRuby(answer);
    if (!code) return { ok: false, code: '', parts: [], fixes: [], problems: [{ type: 'noProgram' }] };
    const byName = {};
    sprites.forEach((sprite) => {
        byName[sprite.name] = sprite;
    });
    const sections = splitBySprite(code, Object.keys(byName)) || [{ name: editingName, code }];
    const several = sections.length > 1;
    const parts = [];
    const problems = [];
    for (const section of sections) {
        const sprite = byName[section.name] || { sounds: [], costumes: [] };
        const repaired = repairRuby(section.code, sprite);
        const where = several ? section.name : null;
        const own = [
            ...repaired.missing.map((miss) => ({ type: 'missing', sprite: where, ...miss })),
            ...findClassDefinitions(repaired.code).map((def) => ({ type: 'classDef', sprite: where, ...def })),
        ];
        problems.push(...own);
        // The converter (with the VM) also reports a missing sound or costume: say it once.
        const reported = new Set(own.map((problem) => problem.line));
        const part = { name: section.name, code: repaired.code, fixes: repaired.fixes, converter: null };
        try {
            part.converter = await convert(section.name, repaired.code);
            if (part.converter.result) {
                const count = Object.values(part.converter.blocks || {}).filter((block) =>
                    RAW_OPCODES.includes(block.opcode),
                ).length;
                if (count > 0) problems.push({ type: 'raw', sprite: where, count });
            } else {
                part.converter.errors
                    .map((error) =>
                        typeof error === 'string'
                            ? { type: 'error', sprite: where, row: null, text: error }
                            : {
                                  type: 'error',
                                  sprite: where,
                                  row: typeof error.row === 'number' ? error.row : null,
                                  text: error.text || error.message || JSON.stringify(error),
                              },
                    )
                    .filter((problem) => problem.row === null || !reported.has(problem.row + 1))
                    .forEach((problem) => problems.push(problem));
            }
        } catch (e) {
            problems.push({ type: 'exception', sprite: where, text: e.message || String(e) });
        }
        parts.push(part);
    }
    return {
        ok: problems.length === 0,
        code: several ? parts.map((part) => `# 「${part.name}」\n${part.code}`).join('\n') : parts[0].code,
        parts,
        fixes: parts.flatMap((part) => part.fixes.map((fix) => ({ name: several ? part.name : null, ...fix }))),
        problems,
    };
};

const quoteNames = (names) => names.map((name) => `「${name}」`).join('');

/**
 * One problem in Japanese for the rewrite request: the question to the AI stays
 * in Japanese whatever the editor language (#1279).
 * @param {object} problem - a problem from checkAnswer.
 * @returns {string} the problem as a line of the request.
 */
const problemToJapanese = (problem) => {
    const sprite = problem.sprite ? `「${problem.sprite}」の ` : '';
    switch (problem.type) {
        case 'noProgram':
            return '貼りつけた文にプログラムが見つかりませんでした';
        case 'missing': {
            const what = problem.kind === 'sound' ? '音' : 'コスチューム';
            const names =
                problem.names.length > 0 ? `使える${what}:${quoteNames(problem.names)}` : `使える${what}はありません`;
            return `${sprite}${problem.line} 行目: ${what}「${problem.name}」はありません（${names}）`;
        }
        case 'classDef':
            return `${sprite}${problem.line} 行目: クラスの定義（${problem.source}）は使えません。「# 「スプライト名」」の行でスプライトごとに分けてください`;
        case 'raw':
            return `${sprite}${problem.count} か所が、スモウルビーのブロックになりませんでした`;
        case 'error':
            return `${sprite}${problem.row === null ? '' : `${problem.row + 1} 行目: `}${problem.text}`;
        default:
            return `${sprite}${problem.text}`;
    }
};

/**
 * Switch between the original and the AI's version. The side being left keeps
 * what the student changed meanwhile, so trying things out never throws their
 * edits away.
 * @param {Array<{before: string, after: string}>} snapshots - one per sprite put in.
 * @param {boolean} toAfter - switching to the AI's version.
 * @param {Array<string>} currentCodes - each sprite's program now (same order).
 * @returns {Array<object>} the snapshots after the switch; load `after` (or `before`).
 */
const switchSnapshots = (snapshots, toAfter, currentCodes) =>
    snapshots.map((snap, index) =>
        toAfter ? { ...snap, before: currentCodes[index] } : { ...snap, after: currentCodes[index] },
    );

/**
 * The snapshots whose sprite still exists (the student may delete one meanwhile).
 * @param {Array<{target: object}>} snapshots - one per sprite put in.
 * @param {Array<object>} targets - the targets in the project now.
 * @returns {Array<object>} the snapshots that can still be switched.
 */
const liveSnapshots = (snapshots, targets) => snapshots.filter((snap) => targets.includes(snap.target));

export { checkAnswer, findClassDefinitions, liveSnapshots, problemToJapanese, switchSnapshots };
