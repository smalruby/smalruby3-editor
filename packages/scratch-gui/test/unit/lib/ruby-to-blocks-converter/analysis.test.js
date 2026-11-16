/**
 * The analysis stage (`analysis.js`, docs/ruby-editor/converter-stages.md): Ruby -> `Analysis`.
 *
 * The tables must be what the converter decides now in its pre-passes (`_collectVariableUses`,
 * `_countProcedureCallsInNode`, `_rejectRubyNameOfVariableAndList`), so that the conversion can read
 * them in place of the pre-passes. The Ruby of the existing converter tests is compared one by one.
 * The one difference on purpose: the calls in a `case` are counted (issue #2014).
 */
import dedent from 'dedent';
import fs from 'fs';
import path from 'path';
import { loadPrism } from '../../../../src/lib/prism-parser';
import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import { analyze } from '../../../../src/lib/ruby-to-blocks-converter/analysis';
import { forEachNode, nodeTypeName } from '../../../../src/lib/ruby-to-blocks-converter/node-walk';

let prism;

beforeAll(async () => {
    prism = await loadPrism();
});

const parse = (source) => prism.parse(source).value;
const analyzeRuby = (source) => analyze(parse(source), { source });

/**
 * What the converter decides now: run its pre-passes on a tree.
 * @param {string} source - The Ruby source.
 * @param {object} root - The tree of the source.
 * @returns {object} The context after the pre-passes, and the error of `_rejectRubyNameOfVariableAndList`.
 */
const converterPrePasses = (source, root) => {
    const converter = new RubyToBlocksConverter(null, { version: '2' });
    converter.reset();
    converter._context.sourceCode = source;
    converter._buildByteToCharMap();
    converter._context.rootNode = root;
    converter._countProcedureCallsInNode(root);
    converter._collectVariableUses(root);
    let rejected = null;
    try {
        converter._rejectRubyNameOfVariableAndList();
    } catch (e) {
        rejected = e;
    }
    return { context: converter._context, rejected, lineOf: (node) => converter._getLoc(node).line };
};

/**
 * The value of a single-quoted JavaScript string (the escapes that the tests use).
 * @param {string} text - The text between the quotes.
 * @returns {string} The value.
 */
const unescapeJs = (text) => text.replace(/\\(.)/g, (_m, c) => ({ n: '\n', t: '\t' })[c] || c);

/**
 * The Ruby of the existing tests: the template literals of the converter and round-trip tests that
 * prism parses without errors.
 * @returns {Array<{file: string, source: string}>} The sources.
 */
const corpus = () => {
    const dirs = [__dirname, path.join(__dirname, '..', 'ruby-roundtrip')];
    const seen = new Set();
    const sources = [];
    dirs.forEach((dir) => {
        fs.readdirSync(dir)
            .filter((file) => file.endsWith('.test.js') && file !== 'analysis.test.js')
            .sort()
            .forEach((file) => {
                const text = fs.readFileSync(path.join(dir, file), 'utf8');
                const add = (source) => {
                    if (!source.trim() || seen.has(source)) return;
                    seen.add(source);
                    sources.push({ file, source });
                };
                for (const match of text.matchAll(/`([^`\\$]*)`/g)) add(dedent(match[1]));
                // One-line strings such as `ruby: 'move(10)'` and `'3.times do\n  say("hi")\nend'`.
                for (const match of text.matchAll(/'((?:[^'\\\n]|\\.)*)'/g)) add(unescapeJs(match[1]));
            });
    });
    return sources;
};

const ownUnit = (groups, unit) => groups[unit] === unit;

/**
 * The differences between the analysis and the converter for one source.
 * @param {string} source - The Ruby source.
 * @returns {Array<string>} The differences (empty when they agree).
 */
const differences = (source) => {
    const parsed = prism.parse(source);
    if (parsed.errors.length > 0) return null;
    const root = parsed.value;
    const analysis = analyze(root, { source });
    const { context, rejected, lineOf } = converterPrePasses(source, root);
    const diffs = [];
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

    if (!same(sortKeys(analysis.variables.uses), sortKeys(context.variableUses))) diffs.push('variables.uses');
    if (!same(analysis.variables.rubyNames, [...context.rubyVariableNames].sort())) {
        diffs.push('variables.rubyNames');
    }
    const firstLines = (firstUses) =>
        sortKeys(
            Object.fromEntries(
                Object.keys(firstUses).map((name) => [
                    name,
                    sortKeys(Object.fromEntries(Object.entries(firstUses[name]).map(([use, v]) => [use, v.line]))),
                ]),
            ),
        );
    if (!same(firstLines(analysis.variables.firstUses), firstLines(context.firstVariableUses))) {
        diffs.push('variables.firstUses');
    }

    const units = context.localVariableUnits;
    if (analysis.locals.unitOfNode.size !== units.unitOfNode.size) diffs.push('locals.units');
    if (!same(sortKeys(analysis.locals.uses[0]), sortKeys(units.localUses[0]))) diffs.push('locals.uses[0]');
    units.unitOfNode.forEach((unit, node) => {
        const own = analysis.locals.unitOfNode.get(node);
        if (typeof own === 'undefined') {
            diffs.push('locals.unitOfNode');
            return;
        }
        if (ownUnit(analysis.locals.groups, own) !== ownUnit(units.unitGroups, unit)) diffs.push('locals.groups');
        if (!same(sortKeys(analysis.locals.uses[own]), sortKeys(units.localUses[unit]))) diffs.push('locals.uses');
    });
    if (!same(analysis.locals.splitNames, [...units.splitNames].sort())) diffs.push('locals.splitNames');

    const counts = analysis.procedures.valueCallCounts;
    if (!same(sortKeys(counts), sortKeys(context.methodCallCounts))) {
        // The converter does not count the calls in a `case` (issue #2014): more is expected there.
        let hasCase = false;
        forEachNode(root, {
            enter: (node, type) => {
                if (type === 'CaseNode') hasCase = true;
            },
        });
        const onlyMore = Object.keys(context.methodCallCounts).every(
            (name) => (counts[name] || 0) >= context.methodCallCounts[name],
        );
        if (!hasCase || !onlyMore) diffs.push('procedures.valueCallCounts');
    }

    const firstError = analysis.errors[0];
    if (Boolean(firstError) !== Boolean(rejected)) {
        diffs.push('errors');
    } else if (firstError && lineOf(firstError.node) !== lineOf(rejected.node)) {
        diffs.push('errors.line');
    }
    return [...new Set(diffs)];
};

/**
 * An object with its keys in order (to compare as JSON).
 * @param {object} obj - An object of objects.
 * @returns {object} The object.
 */
function sortKeys(obj) {
    return Object.fromEntries(
        Object.keys(obj || {})
            .sort()
            .map((key) => [key, obj[key] && typeof obj[key] === 'object' ? sortKeys(obj[key]) : obj[key]]),
    );
}

describe('RubyToBlocksConverter/Analysis', () => {
    describe('the same as the pre-passes of the converter, for the Ruby of the existing tests', () => {
        // One test for each test file, so that a slow machine does not hit the timeout of one test.
        const sources = corpus();
        const files = [...new Set(sources.map(({ file }) => file))];

        test('has enough Ruby to mean something', () => {
            expect(sources.length).toBeGreaterThan(3000);
        });

        test.each(files)('%s', (file) => {
            const mismatches = [];
            sources
                .filter((s) => s.file === file)
                .forEach(({ source }) => {
                    const diffs = differences(source);
                    if (diffs && diffs.length > 0) mismatches.push({ diffs, source });
                });
            expect(mismatches).toEqual([]);
        });
    });

    describe('variables', () => {
        test('decides `@a.length` before `@a = "abc"` from the whole code', () => {
            const analysis = analyzeRuby(dedent`
                when_flag_clicked do
                  say(@a.length)
                end
                @a = "abc"
                @b = []
                @c = {}
            `);
            expect(analysis.variables.uses['@a']).toEqual({
                list: false,
                scalar: true,
                hash: false,
                string: true,
                notString: false,
            });
            expect(analysis.variables.uses['@b'].list).toBe(true);
            expect(analysis.variables.uses['@c'].hash).toBe(true);
            expect(analysis.variables.rubyNames).toEqual(['@a', '@b', '@c']);
            expect(analysis.variables.firstUses['@a'].scalar.line).toBe(4);
        });

        test('reports one `@a` used as both a variable and a list', () => {
            const analysis = analyzeRuby('@a = []\n@a = 0\n@a.push(1)\n');
            expect(analysis.errors).toHaveLength(1);
            expect(analysis.errors[0]).toMatchObject({
                kind: 'variableAndList',
                name: '@a',
                listLine: 1,
                variableLine: 2,
            });
        });
    });

    describe('locals', () => {
        test('splits a local that the blocks of the script use as different things', () => {
            const analysis = analyzeRuby(dedent`
                when_flag_clicked do
                  a = "x"
                end
                when_clicked do
                  a = []
                end
                def foo
                  b = 1
                end
            `);
            expect(analysis.locals.splitNames).toEqual(['a']);
            expect(analysis.locals.unitOfNode.size).toBe(3);
            const units = Object.keys(analysis.locals.groups).map(Number);
            expect(units.filter((u) => analysis.locals.groups[u] === u && u !== 0)).toHaveLength(1);
        });
    });

    describe('procedures', () => {
        test('counts the calls whose value is used, also in a `case` (issue #2014)', () => {
            const source = dedent`
                def foo(a)
                  return a * 2
                end

                when_flag_clicked do
                  case @x
                  when 1
                    say(foo(1) + foo(2))
                  else
                    say(foo(3))
                  end
                end
            `;
            const analysis = analyzeRuby(source);
            expect(analysis.procedures.valueCallCounts.foo).toBe(3);
            // The converter does not see them yet.
            const { context } = converterPrePasses(source, parse(source));
            expect(context.methodCallCounts.foo || 0).toBe(0);
        });

        test('collects the methods made with `def`', () => {
            const analysis = analyzeRuby(dedent`
                def foo(a, b = 1)
                  return a + b
                end

                def bar
                  say("hi")
                end
            `);
            expect(analysis.procedures.definitions.map(({ node, ...d }) => d)).toEqual([
                {
                    name: 'foo',
                    line: 1,
                    onSelf: false,
                    requireds: ['a'],
                    optionals: ['b'],
                    returnsValue: true,
                    usesSuper: false,
                },
                {
                    name: 'bar',
                    line: 5,
                    onSelf: false,
                    requireds: [],
                    optionals: [],
                    returnsValue: false,
                    usesSuper: false,
                },
            ]);
        });
    });

    describe('classes', () => {
        test('collects what is directly in the body of a class and a module', () => {
            const analysis = analyzeRuby(dedent`
                module Greet
                  def hello
                    say("hello")
                  end
                end

                class Cat < ::Smalruby3::Sprite
                  include Greet
                  attr_accessor :speed
                  attr_reader :name

                  def initialize
                    super
                  end

                  def hello
                    super
                  end
                end
            `);
            const [cat] = analysis.classes.classes;
            expect(cat).toMatchObject({
                name: 'Cat',
                superclass: '::Smalruby3::Sprite',
                line: 7,
                attrs: { speed: 'accessor', name: 'reader' },
                includes: ['Greet'],
                methods: ['initialize', 'hello'],
                hasInitialize: true,
            });
            expect(analysis.classes.modules.map((m) => [m.name, m.methods])).toEqual([['Greet', ['hello']]]);
            expect(analysis.procedures.definitions.filter((d) => d.usesSuper).map((d) => d.name)).toEqual([
                'initialize',
                'hello',
            ]);
        });
    });

    describe('symbols', () => {
        test('lists every symbol of the code once', () => {
            const analysis = analyzeRuby('@a = :b\nsay(:a)\nsay(:b)\n');
            expect(analysis.symbols).toEqual([':a', ':b']);
        });

        test('has the symbols that the converter puts in `$_symbols_`', async () => {
            const source = '@a = :b\nsay(@a)\nsay(:c)\n';
            const converter = new RubyToBlocksConverter(null, { version: '2' });
            await converter.targetCodeToBlocks(null, source);
            const collected = [...converter._context.symbols];
            expect(collected.length).toBeGreaterThan(0);
            expect(analyzeRuby(source).symbols).toEqual(expect.arrayContaining(collected));
        });
    });

    describe('the table', () => {
        test('is frozen', () => {
            const analysis = analyzeRuby('@a = 1\n');
            expect(Object.isFrozen(analysis)).toBe(true);
            expect(Object.isFrozen(analysis.variables.uses['@a'])).toBe(true);
            expect(() => {
                'use strict';
                analysis.variables.uses['@b'] = {};
            }).toThrow();
            expect(analysis.locals.unitOfNode.set).toBeUndefined();
        });
    });
});

describe('forEachNode', () => {
    test('visits every node once, a node before its children and in the order of the source', () => {
        const root = parse(dedent`
            case @x
            when foo(1)
              say(bar(2))
            else
              say(baz(3))
            end
        `);
        const entered = [];
        const left = [];
        forEachNode(root, {
            enter: (node, type) => {
                if (type === 'CallNode') entered.push(String(node.name));
            },
            leave: (node, type) => {
                if (type === 'CallNode') left.push(String(node.name));
            },
        });
        expect(entered).toEqual(['foo', 'say', 'bar', 'say', 'baz']);
        expect(left).toEqual(['foo', 'bar', 'say', 'baz', 'say']);
    });

    test('finds the type name of a node once for each class', () => {
        const root = parse('say(1)\nsay(2)\n');
        const calls = root.statements.body;
        expect(nodeTypeName(calls[0])).toBe('CallNode');
        expect(nodeTypeName(calls[1])).toBe('CallNode');
        expect(nodeTypeName({})).toBeNull();
    });
});
