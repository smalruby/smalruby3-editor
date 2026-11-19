const test = require('tap').test;

const Runtime = require('../../src/engine/runtime');
const SmalrubyConsoleBlocks = require('../../src/extensions/smalruby_console/index.js');

const makeRuntime = () => {
    const runtime = new Runtime();
    const blocks = new SmalrubyConsoleBlocks(runtime);
    return { runtime, blocks };
};

test('getInfo has the two blocks of the console', (t) => {
    const { blocks } = makeRuntime();
    const info = blocks.getInfo();
    t.equal(info.id, 'smalrubyConsole');
    t.same(
        info.blocks.map((b) => [b.opcode, b.blockType]),
        [
            ['print', 'command'],
            ['input', 'reporter'],
        ],
    );
    t.ok(info.translationMap.ja);
    t.ok(info.translationMap['ja-Hira']);
    t.end();
});

test('print emits the line as a string', (t) => {
    const { runtime, blocks } = makeRuntime();
    const lines = [];
    runtime.on(SmalrubyConsoleBlocks.PRINT_EVENT, (text) => lines.push(text));
    blocks.print({ TEXT: 'こんにちは' });
    blocks.print({ TEXT: 3 });
    t.same(lines, ['こんにちは', '3']);
    t.end();
});

test('input asks a question with no words and reports the answer', (t) => {
    const { runtime, blocks } = makeRuntime();
    const target = { visible: false, isStage: false };
    const questions = [];
    runtime.on('QUESTION', (question) => {
        questions.push(question);
        if (question !== null) runtime.emit('ANSWER', 'ルビー');
    });
    blocks.input({}, { target }).then((answer) => {
        t.same(questions, ['']);
        t.equal(answer, 'ルビー');
        t.equal(runtime._primitives.sensing_answer(), 'ルビー');
        t.end();
    });
});

test('inputs and questions of 聞いて待つ wait in the one queue', (t) => {
    const { runtime, blocks } = makeRuntime();
    const target = { visible: false, isStage: false };
    const questions = [];
    runtime.on('QUESTION', (question) => questions.push(question));
    const first = runtime._primitives.sensing_askandwait({ QUESTION: '名前は？' }, { target });
    const second = blocks.input({}, { target });
    t.same(questions, ['名前は？']);
    runtime.emit('ANSWER', 'a');
    t.same(questions, ['名前は？', '']);
    runtime.emit('ANSWER', 'b');
    Promise.all([first, second]).then(([, answer]) => {
        t.equal(answer, 'b');
        t.end();
    });
});

test('the extension is registered as a builtin', (t) => {
    const builtins = {};
    require('../../src/extension-support/smalruby-extensions')(builtins);
    t.equal(builtins.smalrubyConsole(), SmalrubyConsoleBlocks);
    t.end();
});
