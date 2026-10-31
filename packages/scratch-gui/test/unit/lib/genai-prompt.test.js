import {
    COPY_END,
    COPY_START,
    buildGenaiPrompt,
    buildRewritePrompt,
    extractRuby,
    splitPrompt,
} from '../../../src/lib/genai-prompt.js';

const programs = [
    {
        name: 'ねこ',
        code: 'when_flag_clicked do\n  move(10)\nend\n',
        sounds: ['ニャー'],
        costumes: ['ねこ1', 'ねこ2'],
    },
    { name: 'ボール', code: 'when_flag_clicked do\n  move(5)\nend\n', sounds: [], costumes: ['ボール'] },
];

describe('buildGenaiPrompt', () => {
    test('includes the rules, the trouble and every program as fenced Ruby', () => {
        const prompt = buildGenaiPrompt({
            kindLabel: '思ったとおりに動かない',
            text: '  かべで止まってほしい  ',
            programs,
            editingName: 'ねこ',
            assignmentName: 'ボールをよけるゲーム',
        });
        expect(prompt).toContain('【守ってほしいこと】');
        expect(prompt).toContain('質問を返さず、すぐに直したプログラムを出してください');
        expect(prompt).toContain('直すのは、できるだけ「ねこ」のプログラムだけ');
        expect(prompt).toContain('「# 「スプライト名」」という 1 行から始めて');
        expect(prompt).toContain('play("音の名前")');
        expect(prompt).toContain(COPY_START);
        expect(prompt).toContain('思ったとおりに動かない：\nかべで止まってほしい');
        expect(prompt).toContain('【課題】\nボールをよけるゲーム');
        expect(prompt).toContain('生徒がいま作っているのは「ねこ」です。');
        expect(prompt).toContain('「ねこ」（音: "ニャー"／コスチューム: "ねこ1"、"ねこ2"）:');
        expect(prompt).toContain(
            '「ボール」（音: なし／コスチューム: "ボール"）:\n```ruby\nwhen_flag_clicked do\n  move(5)\nend\n```',
        );
        expect(prompt.endsWith('「ねこ」の直したプログラムをください。')).toBe(true);
    });

    test('leaves out the assignment when there is none', () => {
        const prompt = buildGenaiPrompt({ kindLabel: 'エラーが出る', text: 'x', programs, editingName: null });
        expect(prompt).not.toContain('【課題】');
    });
});

describe('splitPrompt', () => {
    const prompt = Array.from({ length: 40 }, (_, i) => `line ${i} ${'あ'.repeat(20)}`).join('\n');

    test('returns the prompt as is for one part', () => {
        expect(splitPrompt(prompt, 1)).toEqual([prompt]);
    });

    test('splits into the requested parts that together keep every line', () => {
        const parts = splitPrompt(prompt, 3);
        expect(parts).toHaveLength(3);
        expect(parts[0].startsWith('【3 つに分けた 1 つ目】')).toBe(true);
        expect(parts[0]).toContain('「受け取りました」とだけ');
        expect(parts[2]).toContain('これで全部です');
        for (let i = 0; i < 40; i++) {
            expect(parts.some((part) => part.includes(`line ${i} `))).toBe(true);
        }
    });
});

describe('extractRuby', () => {
    test('takes the fenced code between the copy markers', () => {
        const answer = [
            'そのとおり！',
            '```ruby\nputs "ちがう"\n```',
            COPY_START,
            '```ruby\nwhen_flag_clicked do\n  move(10)\nend\n```',
            COPY_END,
            'がんばって！',
        ].join('\n');
        expect(extractRuby(answer)).toBe('when_flag_clicked do\n  move(10)\nend\n');
    });

    test('takes the last ruby block without markers', () => {
        const answer = 'まず\n```ruby\nmove(1)\n```\nつぎに\n```ruby\nmove(2)\n```';
        expect(extractRuby(answer)).toBe('move(2)\n');
    });

    test('accepts an unlabeled fence and code pasted without fences', () => {
        expect(extractRuby('```\nmove(3)\n```')).toBe('move(3)\n');
        expect(extractRuby('when_flag_clicked do\n  move(4)\nend')).toBe('when_flag_clicked do\n  move(4)\nend\n');
    });

    test('returns null when there is no code', () => {
        expect(extractRuby('ヒント: くり返しを止める命令を考えてみよう')).toBeNull();
        expect(extractRuby('')).toBeNull();
    });
});

describe('buildRewritePrompt', () => {
    test('lists the problems and the failed code', () => {
        const prompt = buildRewritePrompt({ code: 'sleep 1 until x', problems: ['1 行目: ブロックにない書き方'] });
        expect(prompt).toContain('・1 行目: ブロックにない書き方');
        expect(prompt).toContain('```ruby\nsleep 1 until x\n```');
        expect(prompt).toContain(COPY_END);
    });
});
