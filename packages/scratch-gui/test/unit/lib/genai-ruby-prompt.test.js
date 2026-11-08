import {
    CODE_TAB_KINDS,
    PROBLEM_KINDS,
    RUBY_TAB_KINDS,
    buildGenaiPrompt,
    buildRubyTabPrompt,
} from '../../../src/lib/genai-prompt.js';

const params = (mode) => ({
    mode,
    kindLabel: 'エラーが出る',
    text: '動かすと止まる',
    editingName: 'Abby',
    code: 'when_flag_clicked do\n  move(10)\nend\n',
    sounds: ['Pop'],
    costumes: ['abby-a'],
    others: [
        { name: 'Dee', code: 'when_receive("合図") do\n  say("やあ")\nend\n', sounds: [], costumes: ['dee-a'] },
        { name: 'ステージ', code: '', sounds: [], costumes: ['背景1'] },
    ],
    errors: ['2 行目: undefined method'],
    assignmentName: null,
});

describe('the kinds of trouble of each tab', () => {
    test('the code tab keeps its five kinds', () => {
        expect(CODE_TAB_KINDS).toEqual(['not-working', 'error', 'next', 'how', 'more-fun']);
    });

    test('the Ruby tab asks about commands instead of blocks', () => {
        expect(RUBY_TAB_KINDS).toEqual(['not-working', 'error', 'next', 'how-command', 'more-fun']);
        const how = PROBLEM_KINDS.find((k) => k.id === 'how-command');
        expect(how.label).toBe('命令の書き方がわからない');
    });
});

describe('buildRubyTabPrompt', () => {
    test('fixes only the sprite in the editor, with the code in the editor', () => {
        const prompt = buildRubyTabPrompt(params('ruby'));
        expect(prompt).toContain('直すのは「Abby」のプログラムだけ');
        expect(prompt).toContain('```ruby\nwhen_flag_clicked do\n  move(10)\nend\n```');
        expect(prompt).toContain('「Abby」（音: "Pop"／コスチューム: "abby-a"）');
        expect(prompt).toContain('「Abby」の分だけ、直したプログラムをください');
    });

    test('adds the other sprites as reference, saying not to change them', () => {
        const prompt = buildRubyTabPrompt(params('ruby'));
        expect(prompt).toContain('【参考：ほかのスプライトのプログラム（直さないでください）】');
        expect(prompt).toContain('「Dee」');
        expect(prompt).toContain('when_receive("合図")');
        // A sprite without code is left out of the reference.
        expect(prompt).not.toContain('「ステージ」（音');
    });

    test('asks for one ruby block between the markers without sprite headings', () => {
        const prompt = buildRubyTabPrompt(params('ruby'));
        expect(prompt).toContain('▼▼ ここから下をコピーして、スモウルビーにもどろう ▼▼');
        expect(prompt).toContain('1 つの ```ruby');
        expect(prompt).toContain('「# 「スプライト名」」の見出しは書かないでください');
    });

    test('in Ruby mode explains the change in the words of Ruby', () => {
        const prompt = buildRubyTabPrompt(params('ruby'));
        expect(prompt).toContain('Ruby の書き方で 1〜3 行');
        expect(prompt).not.toContain('日本語の意味');
    });

    test('in furigana mode explains in easy words, with the meaning of the commands, keeping Ruby', () => {
        const prompt = buildRubyTabPrompt(params('furigana'));
        expect(prompt).toContain('やさしいことば');
        expect(prompt).toContain('loop（ずっと）');
        expect(prompt).toContain('答えのコードは Ruby のまま');
    });

    test('puts the errors of the editor in', () => {
        const prompt = buildRubyTabPrompt(params('ruby'));
        expect(prompt).toContain('【エディタに出ているエラー】');
        expect(prompt).toContain('2 行目: undefined method');
        expect(buildRubyTabPrompt({ ...params('ruby'), errors: [] })).not.toContain('【エディタに出ているエラー】');
    });

    test('has the same command examples as the code tab', () => {
        const prompt = buildRubyTabPrompt(params('ruby'));
        expect(prompt).toContain('【使える命令の例】');
        expect(prompt).toContain('loop do … end … ずっと');
    });

    test('says when the sprite has no code yet', () => {
        expect(buildRubyTabPrompt({ ...params('ruby'), code: '  \n' })).toContain('（まだプログラムはありません）');
    });

    test('leaves the code tab question as it was', () => {
        const prompt = buildGenaiPrompt({
            kindLabel: 'x',
            text: 'y',
            programs: [],
            editingName: 'Abby',
            assignmentName: null,
        });
        expect(prompt).toContain('生徒は Ruby ではなく、命令ブロックを組み合わせて');
    });
});
