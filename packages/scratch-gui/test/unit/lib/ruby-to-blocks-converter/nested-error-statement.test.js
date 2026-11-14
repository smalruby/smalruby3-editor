// An expression that is not converted inside another expression (`say(wait(1).to_s)`) used to give an
// error that quoted the inner expression ("wait(1)"), as the outer call took it as its receiver. The error
// now quotes the statement that holds it, as it does when the outer call does not take it
// (`say(foo.bar)` / `say(a = 2)`), when the statement is on one line. The row and the column stay on the
// expression that failed, and a statement on more lines quotes the expression (issue #1704).
import RubyParser from '../../../../src/lib/ruby-parser';
import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';

const convert = async (code) => {
    const converter = new RubyToBlocksConverter(null, { version: '2' });
    const ok = await converter.targetCodeToBlocks(null, code);
    return { ok, errors: converter.errors };
};

const wrongInstruction = (source) => `"${source}" is the wrong instruction.`;

const expectError = async (code, { row, column, source }) => {
    const { ok, errors } = await convert(code);
    expect(ok).toBe(false);
    expect(errors).toHaveLength(1);
    expect(errors[0].text).toContain(wrongInstruction(source));
    expect([errors[0].row, errors[0].column]).toEqual([row, column]);
};

describe('RubyToBlocksConverter/an error inside an expression quotes the statement', () => {
    // The table of issue #1704 and the cases without parentheses it is compared with.
    test.each([
        ['say(((a = 2) + 1).to_s)', 5],
        ['say((a = 2).to_s.length)', 4],
        ['say(wait(1).to_s)', 4],
        ['say((a = 2).to_s)', 0],
        ['say(a = 2)', 0],
        ['say(foo.bar)', 0],
    ])('%s', async (code, column) => {
        await expectError(`a = 1\n${code}`, { row: 1, column, source: code });
    });

    test.each([
        ['an assignment', 'b = wait(1).to_s', 4, 'b = wait(1).to_s'],
        ['a statement alone', 'wait(1).to_s', 0, 'wait(1).to_s'],
        ['an argument of an argument', 'move(wait(1).to_s.length)', 5, 'move(wait(1).to_s.length)'],
        ['an operand', 'say(1 + wait(1).to_s.length)', 8, 'say(1 + wait(1).to_s.length)'],
        ['an element of an array', 'x = [wait(1).to_s]', 5, 'x = [wait(1).to_s]'],
        [
            'a statement in parentheses',
            'say((move(10); wait(1).to_s).to_s)',
            15,
            'say((move(10); wait(1).to_s).to_s)',
        ],
        ['a modifier if', 'move(10) if wait(1).to_s == "x"', 12, 'move(10) if wait(1).to_s == "x"'],
    ])('%s', async (_name, code, column, source) => {
        await expectError(code, { row: 0, column, source });
    });

    // A statement on more lines quotes the expression that failed: the first line of the statement
    // (`if a == 1...`, `say(...`) would not tell what is wrong.
    test.each([
        ['the condition of if', 'if foo.bar == 1\n  move(10)\nend', 0, 3, 'foo.bar'],
        ['the count of times', 'wait(1).to_s.length.times do\n  move(10)\nend', 0, 0, 'wait(1)'],
        ['an argument on its own line', 'say(\n  a,\n  wait(1).to_s\n)', 2, 2, 'wait(1)'],
        [
            'the condition of elsif',
            'if a == 1\n  move(10)\nelsif wait(1).to_s == "x"\n  move(20)\nend',
            2,
            6,
            'wait(1)',
        ],
        ['the condition of when', 'case a\nwhen 1\n  move(1)\nwhen wait(1).to_s\n  move(2)\nend', 3, 5, 'wait(1)'],
    ])('%s', async (_name, code, row, column, source) => {
        await expectError(`a = 1\n${code}`, { row: row + 1, column, source });
    });

    // A statement inside a body is the statement quoted, not the statement that holds the body.
    test.each([
        ['the body of if', 'if a == 1\n  say(wait(1).to_s)\nend', 1],
        ['the body of elsif', 'if a == 1\n  move(10)\nelsif a == 2\n  say(wait(1).to_s)\nend', 3],
        ['the body of else', 'if a == 1\n  move(10)\nelse\n  say(wait(1).to_s)\nend', 3],
        ['the body of a method', 'def foo\n  say(wait(1).to_s)\nend', 1],
        ['the body of an event', 'self.when_flag_clicked do\n  say(wait(1).to_s)\nend', 1],
        ['the body of when', 'case a\nwhen 1\n  move(1)\nwhen 2\n  move(2)\n  say(wait(1).to_s)\nend', 5],
        ['the body of case else', 'case a\nwhen 1\n  move(1)\nelse\n  say(wait(1).to_s)\nend', 4],
        [
            'the body of when in an event',
            'self.when_flag_clicked do\n  case a\n  when 1\n    say(wait(1).to_s)\n  end\nend',
            3,
        ],
    ])('%s', async (_name, code, row) => {
        const lines = code.split('\n');
        const column = lines[row].indexOf('wait(1)');
        await expectError(`a = 1\n${code}`, { row: row + 1, column, source: 'say(wait(1).to_s)' });
    });

    // The statement is found also through the children in arrays (the `when`s of a `case`, the
    // exceptions of a `rescue`, the targets of a multiple assignment), which `compactChildNodes()` of
    // `@ruby/prism` 1.9.0 drops. These are not converted, so `_statementNodeOf` is called directly.
    describe('_statementNodeOf', () => {
        const statementSourceOf = async (code) => {
            const prism = RubyParser.getPrism() || (await RubyParser.loadPrism());
            const converter = new RubyToBlocksConverter(null, { version: '2' });
            converter._context.sourceCode = code;
            converter._buildByteToCharMap();
            const root = prism.parse(code).value;
            converter._context.rootNode = root;
            const findWait = (node) => {
                if (!node) return null;
                if (converter._getNodeTypeName(node) === 'CallNode' && node.name === 'wait') return node;
                for (const child of node.childNodes()) {
                    const found = findWait(child);
                    if (found) return found;
                }
                return null;
            };
            return converter._getSource(converter._statementNodeOf(findWait(root)));
        };

        test.each([
            ['the body of when', 'case a\nwhen 1\n  move(1)\nwhen 2\n  say(wait(1).to_s)\nend', 'say(wait(1).to_s)'],
            [
                'the condition of when',
                'case a\nwhen 1, wait(1).to_s\n  move(1)\nend',
                'when 1, wait(1).to_s\n  move(1)',
            ],
            [
                'the body of rescue',
                'begin\n  move(1)\nrescue StandardError\n  say(wait(1).to_s)\nend',
                'say(wait(1).to_s)',
            ],
            [
                'the exception of rescue',
                'begin\n  move(1)\nrescue wait(1).class\n  move(2)\nend',
                'begin\n  move(1)\nrescue wait(1).class\n  move(2)\nend',
            ],
            ['a multiple assignment', 'b, c = wait(1).to_s, 1', 'b, c = wait(1).to_s, 1'],
            ['a target of a multiple assignment', 'b, wait(1).x = 1, 2', 'b, wait(1).x = 1, 2'],
        ])('%s', async (_name, code, source) => {
            expect(await statementSourceOf(code)).toBe(source);
        });
    });
});
