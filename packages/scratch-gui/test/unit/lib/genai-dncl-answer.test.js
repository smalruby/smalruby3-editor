import { checkDnclAnswer } from '../../../src/lib/genai-dncl-answer.js';
import { COPY_END, COPY_START } from '../../../src/lib/genai-prompt.js';
import RubyToBlocksConverter from '../../../src/lib/ruby-to-blocks-converter';

// The converter as the Ruby tab uses it (without a VM).
const convert = async (name, code) => {
    const converter = new RubyToBlocksConverter(null, { version: '2' });
    const result = await converter.targetCodeToBlocks(null, code);
    return { result, errors: converter.errors, blocks: converter.blocks };
};

const pasted = (code) => `答えです。\n${COPY_START}\n\`\`\`\n${code}\n\`\`\`\n${COPY_END}\n動かしてみてね。`;

const check = (code) => checkDnclAnswer({ answer: pasted(code), editingName: 'Abby', convert });

describe('checkDnclAnswer', () => {
    test('an answer in Smalruby DNCL is ✔, and the DNCL is what goes into the editor', async () => {
        const code =
            'Data = [3, 1, 2]\ngoukei ← 0\ni を 0 から 2 まで 1 ずつ増やしながら\n  goukei = goukei + Data[i]\nを繰り返す\n表示する(goukei)';
        const result = await check(code);
        expect(result.problems).toEqual([]);
        expect(result.ok).toBe(true);
        expect(result.parts).toHaveLength(1);
        expect(result.parts[0].name).toBe('Abby');
        expect(result.parts[0].code).toBe(`${code}\n`);
    });

    test('an answer in the DNCLv2 form (line numbers, ｜ ⎿, colons) is ✔', async () => {
        const code = [
            '(1) Data = [3, 18, 29, 33, 48, 52, 62, 77, 89, 97]',
            '(2) kazu = 要素数(Data)',
            '(3) 表示する("0～99:")',
            '(4) atai = 【外部からの入力】',
            '(5) hidari = 0 , migi = kazu - 1',
            '(6) owari = 0',
            '(7) hidari <= migi and owari == 0 の間繰り返す:',
            '(8) ｜ aida = (hidari + migi) ÷ 2',
            '(9) ｜ もし Data[aida] == atai ならば:',
            '(10)｜ ｜ 表示する(atai, "は", aida, "番目にありました")',
            '(11)｜ ｜ owari = 1',
            '(12)｜ そうでなくもし Data[aida] < atai ならば:',
            '(13)｜ ｜ hidari = aida + 1',
            '(14)｜ そうでなければ:',
            '(15)⎿ ⎿ migi = aida - 1',
            '(16) もし owari == 0 ならば:',
            '(17)⎿ 表示する(atai, "は見つかりませんでした")',
        ].join('\n');
        const result = await check(code);
        expect(result.problems).toEqual([]);
        expect(result.ok).toBe(true);
        // The line numbers go, as when the DNCL is pasted into the editor.
        expect(result.parts[0].code).not.toMatch(/^\(\d+\)/m);
    });

    test('a conversion error is shown on its DNCL line', async () => {
        // Line 4 of the DNCL (the 増やしながら loop makes the Ruby longer before it).
        const code = 'i を 0 から 2 まで 1 ずつ増やしながら\n  表示する(i)\nを繰り返す\nx = foo(';
        const result = await check(code);
        expect(result.ok).toBe(false);
        const errors = result.problems.filter((problem) => problem.type === 'error');
        expect(errors.length).toBeGreaterThan(0);
        expect(errors.every((problem) => problem.row === 3)).toBe(true);
    });

    test('the same error is said once, though several Ruby lines come from its DNCL line', async () => {
        const result = await check('Data = [3, 1, 2]\nfor i in range(len(Data)):\n    x = 1');
        expect(result.ok).toBe(false);
        const said = result.problems.map((problem) => `${problem.row}:${problem.text}`);
        expect(new Set(said).size).toBe(said.length);
    });

    test('a validation error (a variable with @) is shown on its DNCL line', async () => {
        const result = await check('a = 1\n@b = 2');
        expect(result.ok).toBe(false);
        expect(result.problems).toEqual([
            { type: 'error', sprite: null, row: 1, text: '日本語モードでは変数に「@」は使えません' },
        ]);
    });

    test('a missing closer is said in the words of DNCL, not as a missing end (#1419)', async () => {
        const result = await check('もし x > 0 ならば\n  表示する(x)');
        expect(result.ok).toBe(false);
        expect(result.problems).toEqual([
            {
                type: 'error',
                sprite: null,
                row: 0,
                text: '「もし〜ならば」を「を実行する」で閉じてください',
            },
        ]);
    });

    test('a `//` comment gets the hint to use #', async () => {
        const result = await check('a = 1 // 生徒番号\n表示する(a)');
        expect(result.ok).toBe(false);
        expect(result.problems[0].text).toContain('// はコメントではありません');
        expect(result.problems[0].row).toBe(0);
    });

    test('an answer with 1-based indexes is ✔ with a note on the line (#1420)', async () => {
        const code =
            'Data = [3, 1, 2]\ngoukei ← 0\ni を 1 から 3 まで 1 ずつ増やしながら\n  goukei = goukei + Data[i]\nを繰り返す\n表示する(goukei)';
        const result = await check(code);
        expect(result.ok).toBe(true);
        expect(result.problems).toEqual([]);
        expect(result.indexHints).toEqual([
            { line: 4, access: 'Data[i]', array: 'Data', last: 2, fixed: 'Data[i - 1]' },
        ]);
    });

    test('an answer with 0-based indexes has no note', async () => {
        const code =
            'Data = [3, 1, 2]\ngoukei ← 0\ni を 0 から 2 まで 1 ずつ増やしながら\n  goukei = goukei + Data[i]\nを繰り返す\n表示する(goukei)';
        const result = await check(code);
        expect(result.ok).toBe(true);
        expect(result.indexHints).toEqual([]);
    });

    test('the note is on the line of the tidied DNCL (line numbers taken away)', async () => {
        const code = '(1) Data = [3, 1, 2]\n(2) 表示する(Data[3])';
        const result = await check(code);
        expect(result.ok).toBe(true);
        expect(result.indexHints.map((hint) => hint.line)).toEqual([2]);
        expect(result.parts[0].code.split('\n')[1]).toContain('Data[3]');
    });

    test('an answer without a program is ✗', async () => {
        const result = await checkDnclAnswer({
            answer: 'ごめんなさい、わかりません。',
            editingName: 'Abby',
            convert,
        });
        expect(result.ok).toBe(false);
        expect(result.problems).toEqual([{ type: 'noProgram' }]);
    });
});
