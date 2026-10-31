import {
    checkAnswer,
    findClassDefinitions,
    liveSnapshots,
    problemToJapanese,
    switchSnapshots,
} from '../../../src/lib/genai-answer.js';
import RubyToBlocksConverter from '../../../src/lib/ruby-to-blocks-converter';

// The real converter, without a VM: what the student's answer would become.
const convert = async (name, code) => {
    const converter = new RubyToBlocksConverter(null, { version: '2' });
    converter.result = await converter.targetCodeToBlocks(null, code);
    return converter;
};

const sprites = [
    { name: 'Abby', sounds: ['Pop'], costumes: ['abby-a', 'abby-b'] },
    { name: 'Dee', sounds: ['Meow', 'Dance Around'], costumes: ['dee-a'] },
    { name: 'ステージ', sounds: [], costumes: ['背景1'] },
];

const wrap = (code) => `▼▼\n\`\`\`ruby\n${code}\`\`\`\n▲▲`;

describe('findClassDefinitions', () => {
    test('finds class and module lines, wherever they are', () => {
        expect(findClassDefinitions('class Foo < Bar\n  move(10)\nend\n  module M\nend\n')).toEqual([
            { line: 1, source: 'class Foo < Bar' },
            { line: 4, source: 'module M' },
        ]);
    });

    test('ignores comments and strings that mention class', () => {
        expect(findClassDefinitions('# class Foo\nsay("class A")\n')).toEqual([]);
    });
});

describe('checkAnswer', () => {
    test('says there is no program when nothing can be taken out', async () => {
        const result = await checkAnswer({ answer: 'ごめんなさい', sprites, editingName: 'Abby', convert });
        expect(result).toEqual({ ok: false, code: '', parts: [], fixes: [], problems: [{ type: 'noProgram' }] });
    });

    test('puts each sprite part in its own sprite and repairs it', async () => {
        const answer = wrap(
            '# 「Abby」\nwhen_flag_clicked do\n  play(name: "pop")\nend\n\n# 「Dee」\nwhen_clicked do\n  play("meow")\nend\n',
        );
        const result = await checkAnswer({ answer, sprites, editingName: 'Abby', convert });
        expect(result.ok).toBe(true);
        expect(result.problems).toEqual([]);
        expect(result.parts.map((part) => [part.name, part.code])).toEqual([
            ['Abby', 'when_flag_clicked do\n  play("Pop")\nend\n'],
            ['Dee', 'when_clicked do\n  play("Meow")\nend\n'],
        ]);
        expect(result.fixes).toEqual([
            { name: 'Abby', line: 2, from: 'play(name: "pop")', to: 'play("Pop")' },
            { name: 'Dee', line: 2, from: 'play("meow")', to: 'play("Meow")' },
        ]);
        expect(result.code).toBe(
            '# 「Abby」\nwhen_flag_clicked do\n  play("Pop")\nend\n\n# 「Dee」\nwhen_clicked do\n  play("Meow")\nend\n',
        );
        expect(result.parts.every((part) => part.converter.result)).toBe(true);
    });

    test('without headings, the answer goes to the sprite being edited', async () => {
        const result = await checkAnswer({
            answer: wrap('when_flag_clicked do\n  move(10)\nend\n'),
            sprites,
            editingName: 'Dee',
            convert,
        });
        expect(result.ok).toBe(true);
        expect(result.parts.map((part) => part.name)).toEqual(['Dee']);
        expect(result.fixes).toEqual([]);
        expect(result.code).toBe('when_flag_clicked do\n  move(10)\nend\n');
    });

    test('a sound the sprite does not have is a problem, not a stand-in', async () => {
        const result = await checkAnswer({
            answer: wrap('when_flag_clicked do\n  play("beep")\nend\n'),
            sprites,
            editingName: 'Abby',
            convert,
        });
        expect(result.ok).toBe(false);
        expect(result.problems).toEqual([
            { type: 'missing', sprite: null, line: 2, kind: 'sound', name: 'beep', names: ['Pop'] },
        ]);
    });

    test('a class definition is not a success even though the converter takes it (#1280)', async () => {
        const result = await checkAnswer({
            answer: wrap('class Foo < Bar\n  when_flag_clicked do\n    move(10)\n  end\nend\n'),
            sprites,
            editingName: 'Abby',
            convert,
        });
        expect(result.ok).toBe(false);
        expect(result.problems).toEqual([{ type: 'classDef', sprite: null, line: 1, source: 'class Foo < Bar' }]);
    });

    test('a line that does not become a block is reported with the sprite name', async () => {
        const answer = wrap('# 「Abby」\nwhen_flag_clicked do\n  foo.bar(1)\nend\n# 「Dee」\nmove(10)\n');
        const result = await checkAnswer({ answer, sprites, editingName: 'Abby', convert });
        expect(result.ok).toBe(false);
        expect(result.problems).toHaveLength(1);
        expect(result.problems[0]).toMatchObject({ type: 'error', sprite: 'Abby', row: 1 });
    });

    test('blocks left as "Ruby" are not a success', async () => {
        const raw = async () => ({
            result: true,
            errors: [],
            blocks: { a: { opcode: 'ruby_statement' }, b: { opcode: 'text' }, c: { opcode: 'ruby_expression' } },
        });
        const result = await checkAnswer({ answer: wrap('x\n'), sprites, editingName: 'Abby', convert: raw });
        expect(result.ok).toBe(false);
        expect(result.problems).toEqual([{ type: 'raw', sprite: null, count: 2 }]);
    });

    test('a line already reported by Smalruby is not reported again by the converter', async () => {
        const vmLike = async () => ({
            result: false,
            errors: [
                { row: 1, text: '音「beep」は存在しません。' },
                { row: 2, text: 'ほかのまちがい' },
            ],
            blocks: {},
        });
        const result = await checkAnswer({
            answer: wrap('when_flag_clicked do\n  play("beep")\n  foo\nend\n'),
            sprites,
            editingName: 'Abby',
            convert: vmLike,
        });
        expect(result.problems).toEqual([
            { type: 'missing', sprite: null, line: 2, kind: 'sound', name: 'beep', names: ['Pop'] },
            { type: 'error', sprite: null, row: 2, text: 'ほかのまちがい' },
        ]);
    });

    test('a converter that throws is a problem of that sprite', async () => {
        const broken = async () => {
            throw new Error('boom');
        };
        const result = await checkAnswer({
            answer: wrap('move(1)\n'),
            sprites,
            editingName: 'Abby',
            convert: broken,
        });
        expect(result.ok).toBe(false);
        expect(result.problems).toEqual([{ type: 'exception', sprite: null, text: 'boom' }]);
    });
});

describe('problemToJapanese', () => {
    test('writes each problem for the rewrite request in Japanese', () => {
        expect(problemToJapanese({ type: 'noProgram' })).toBe('貼りつけた文にプログラムが見つかりませんでした');
        expect(
            problemToJapanese({
                type: 'missing',
                sprite: 'Abby',
                line: 2,
                kind: 'sound',
                name: 'beep',
                names: ['Pop'],
            }),
        ).toBe('「Abby」の 2 行目: 音「beep」はありません（使える音:「Pop」）');
        expect(
            problemToJapanese({ type: 'missing', sprite: null, line: 3, kind: 'costume', name: 'z', names: [] }),
        ).toBe('3 行目: コスチューム「z」はありません（使えるコスチュームはありません）');
        expect(problemToJapanese({ type: 'classDef', sprite: null, line: 1, source: 'class Foo < Bar' })).toBe(
            '1 行目: クラスの定義（class Foo < Bar）は使えません。「# 「スプライト名」」の行でスプライトごとに分けてください',
        );
        expect(problemToJapanese({ type: 'raw', sprite: 'Dee', count: 2 })).toBe(
            '「Dee」の 2 か所が、スモウルビーのブロックになりませんでした',
        );
        expect(problemToJapanese({ type: 'error', sprite: null, row: 0, text: 'だめ' })).toBe('1 行目: だめ');
        expect(problemToJapanese({ type: 'exception', sprite: 'Dee', text: 'boom' })).toBe('「Dee」の boom');
    });
});

describe('switchSnapshots', () => {
    const snapshots = [
        { target: 'A', name: 'Abby', before: 'old A', after: 'ai A' },
        { target: 'D', name: 'Dee', before: 'old D', after: 'ai D' },
    ];

    test('keeps what the student changed on the side being left', () => {
        const toBefore = switchSnapshots(snapshots, false, ['ai A edited', 'ai D']);
        expect(toBefore).toEqual([
            { target: 'A', name: 'Abby', before: 'old A', after: 'ai A edited' },
            { target: 'D', name: 'Dee', before: 'old D', after: 'ai D' },
        ]);
        const toAfter = switchSnapshots(toBefore, true, ['old A', 'old D edited']);
        expect(toAfter.map((snap) => [snap.before, snap.after])).toEqual([
            ['old A', 'ai A edited'],
            ['old D edited', 'ai D'],
        ]);
    });

    test('five round trips bring both sprites back and forth unchanged', () => {
        let current = snapshots;
        let shown = ['ai A', 'ai D'];
        for (let i = 0; i < 5; i++) {
            current = switchSnapshots(current, false, shown);
            shown = current.map((snap) => snap.before);
            expect(shown).toEqual(['old A', 'old D']);
            current = switchSnapshots(current, true, shown);
            shown = current.map((snap) => snap.after);
            expect(shown).toEqual(['ai A', 'ai D']);
        }
    });
});

describe('liveSnapshots', () => {
    test('drops sprites deleted after the blocks were put in', () => {
        const a = { id: 'a' };
        const d = { id: 'd' };
        const snapshots = [
            { target: a, name: 'Abby' },
            { target: d, name: 'Dee' },
        ];
        expect(liveSnapshots(snapshots, [a])).toEqual([{ target: a, name: 'Abby' }]);
    });
});
