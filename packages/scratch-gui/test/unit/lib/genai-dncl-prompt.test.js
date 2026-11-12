import { DNCL_BUILTIN_NAMES, convertBuiltinFunctions } from '../../../src/lib/dncl/dncl-builtins';
import { dnclToRuby } from '../../../src/lib/dncl/dncl-to-ruby';
import {
    DNCL_COMMAND_EXAMPLES,
    DNCL_TAB_KINDS,
    buildDnclRewritePrompt,
    buildDnclTabPrompt,
    extractDncl,
} from '../../../src/lib/genai-dncl-prompt.js';
import { COPY_END, COPY_START, PROBLEM_KINDS } from '../../../src/lib/genai-prompt.js';
import RubyToBlocksConverter from '../../../src/lib/ruby-to-blocks-converter';

const params = {
    kindLabel: 'エラーが出る',
    text: '動かすと止まる',
    code: 'Data = [3, 1, 2]\ni を 0 から 2 まで 1 ずつ増やしながら\n  表示する(Data[i])\nを繰り返す\n',
    errors: ['3 行目: undefined method'],
    assignmentName: null,
};

describe('the kinds of trouble of the Japanese (DNCL) mode', () => {
    test('are the troubles of practicing the DNCL of 共通テスト', () => {
        expect(DNCL_TAB_KINDS.map((id) => PROBLEM_KINDS.find((kind) => kind.id === id).label)).toEqual([
            '答えが合わない',
            'エラーが出る',
            'どう書けばいいかわからない',
            '問題の考え方がわからない',
        ]);
    });
});

describe('buildDnclTabPrompt', () => {
    const prompt = buildDnclTabPrompt(params);

    test('tells that the post-test loop cannot be written (issue #1626)', () => {
        expect(prompt).toContain('後判定の繰り返し');
        expect(prompt).not.toMatch(/「を\s*〜\s*になるまで実行する」の行で閉じて/);
    });

    test('passes the DNCL in the editor as it is', () => {
        expect(prompt).toContain(
            `【直すプログラム（生徒がいま書いている DNCL）】\n\`\`\`\n${params.code.trim()}\n\`\`\``,
        );
        expect(prompt).toContain('【エディタに出ているエラー】\n3 行目: undefined method');
    });

    test('asks for DNCL with indexes from 0', () => {
        expect(prompt).toContain('配列の添字は 0 から始まります');
        expect(prompt).toContain('Python や Ruby ではなく');
        expect(prompt).toContain('直したプログラムを DNCL でください');
    });

    test('says how assignments and the ends of blocks are written', () => {
        expect(prompt).toContain('代入は「←」か「=」で書いてください');
        expect(prompt).toContain('「もし〜ならば」は「を実行する」');
        expect(prompt).toContain('「を繰り返す」');
        expect(prompt).toContain('「関数」は「と定義する」');
    });

    // Gemini read the error of an assignment to an argument as a matter of `=` and `←` (#1403).
    test('says an argument of a function cannot be assigned to, with the way out', () => {
        expect(prompt).toContain('関数の引数には代入できません');
        expect(prompt).toContain('「x ← a」のようにほかの変数に写してから');
    });

    test('asks for the explanation in the words of DNCL, and the code between the markers', () => {
        expect(prompt).toContain('DNCL のことばで 1〜3 行で説明してください');
        expect(prompt).toContain(COPY_START);
        expect(prompt).toContain(COPY_END);
    });

    test('has no sounds, costumes, other sprites or Ruby commands', () => {
        expect(prompt).not.toContain('音:');
        expect(prompt).not.toContain('コスチューム:');
        expect(prompt).not.toContain('when_flag_clicked');
        expect(prompt).not.toContain('```ruby');
    });

    test('lists an example of every built-in function of dncl-builtins', () => {
        DNCL_BUILTIN_NAMES.forEach((name) => expect(prompt).toContain(`${name}(`));
    });

    test('says when there is no program yet', () => {
        expect(buildDnclTabPrompt({ ...params, code: '  ', errors: [] })).toContain('（まだプログラムはありません）');
    });
});

describe('DNCL_BUILTIN_NAMES', () => {
    test.each(DNCL_BUILTIN_NAMES)('%s is converted by convertBuiltinFunctions', (name) => {
        expect(convertBuiltinFunctions(`${name}(a, b)`)).not.toContain(name);
    });
});

describe('DNCL_COMMAND_EXAMPLES', () => {
    test('has one example per built-in function', () => {
        expect(DNCL_COMMAND_EXAMPLES.every((example) => example && example.code && example.note)).toBe(true);
    });

    test.each(DNCL_COMMAND_EXAMPLES.map((example) => [example.note, example.code]))(
        'becomes ordinary blocks: %s',
        async (note, code) => {
            const { ruby, errors } = dnclToRuby(code);
            expect(errors).toEqual([]);
            const converter = new RubyToBlocksConverter(null, { version: '2' });
            const ok = await converter.targetCodeToBlocks(null, ruby);
            const raw = Object.values(converter.blocks).filter((block) =>
                ['ruby_statement', 'ruby_expression'].includes(block.opcode),
            );
            expect({ ok, errors: converter.errors, raw: raw.length }).toEqual({ ok: true, errors: [], raw: 0 });
        },
    );
});

describe('extractDncl', () => {
    test('takes the fenced code between the markers, whatever its language name', () => {
        const answer = `説明です。\n${COPY_START}\n\`\`\`dncl\nx ← 1\n表示する(x)\n\`\`\`\n${COPY_END}\n確かめてね`;
        expect(extractDncl(answer)).toBe('x ← 1\n表示する(x)\n');
    });

    test('takes the text between the markers without a fence', () => {
        expect(extractDncl(`${COPY_START}\nx ← 1\n${COPY_END}`)).toBe('x ← 1\n');
    });

    test('takes plain DNCL without markers or fence, and nothing from prose', () => {
        expect(extractDncl('もし x > 0 ならば\n  表示する(x)\nを実行する')).toBe(
            'もし x > 0 ならば\n  表示する(x)\nを実行する\n',
        );
        expect(extractDncl('ごめんなさい、わかりません。')).toBeNull();
        expect(extractDncl('')).toBeNull();
    });
});

describe('buildDnclRewritePrompt', () => {
    test('asks again for DNCL with the problems and the code', () => {
        const prompt = buildDnclRewritePrompt({ code: 'x ← 1\n', problems: ['1 行目: まちがい'] });
        expect(prompt).toContain('・1 行目: まちがい');
        expect(prompt).toContain('```\nx ← 1\n```');
        expect(prompt).toContain('DNCL の書き方で');
        expect(prompt).toContain('添字は 0 から');
        expect(prompt).toContain(COPY_START);
    });
});
