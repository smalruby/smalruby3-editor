/**
 * Exception handling (`rescue` / `else` / `ensure`) has no block in Scratch (issue #1620).
 * The clauses used to be dropped without an error, so `begin move(10) rescue move(20) end` came back
 * as `move(10)`. Now they are an error on the line of the clause. `begin ... end` with no clause, and
 * `begin ... end while` (issue #1610), still work.
 */
import en from '../../../../src/locales/en';
import ja from '../../../../src/locales/ja';
import jaHira from '../../../../src/locales/ja-Hira';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip,
} from '../../helpers/ruby-roundtrip-helper';

const MESSAGE_ID = 'gui.smalruby3.rubyToBlocksConverter.exceptionHandlingNotSupported';

describe('Ruby to blocks: rescue / else / ensure (issue #1620)', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    const rowOf = (code, text) => code.split('\n').findIndex((line) => line.trim() === text);

    test.each([
        ['begin ... rescue', 'begin\n  move(10)\nrescue\n  move(20)\nend', 'rescue'],
        ['rescue => e', 'begin\n  move(10)\nrescue => e\n  move(20)\nend', 'rescue => e'],
        ['rescue StandardError', 'begin\n  move(10)\nrescue StandardError\n  move(20)\nend', 'rescue StandardError'],
        [
            'rescue / else / ensure',
            'begin\n  move(10)\nrescue\n  move(20)\nelse\n  move(25)\nensure\n  move(30)\nend',
            'rescue',
        ],
        ['rescue with retry', 'begin\n  move(10)\nrescue\n  retry\nend', 'rescue'],
        ['ensure only', 'begin\n  move(10)\nensure\n  move(30)\nend', 'ensure'],
        ['def ... rescue', 'def self.foo\n  move(1)\nrescue\n  move(2)\nend', 'rescue'],
        ['def ... rescue retry', 'def self.foo\n  move(1)\nrescue\n  retry\nend', 'rescue'],
        ['def ... ensure', 'def self.foo\n  move(1)\nensure\n  move(2)\nend', 'ensure'],
        ['block do ... rescue', 'self.when(:flag_clicked) do\n  move(1)\nrescue\n  move(2)\nend', 'rescue'],
        ['block do ... ensure', '10.times do\n  move(1)\nensure\n  move(2)\nend', 'ensure'],
        ['begin ... rescue ... end while', 'a = 0\nbegin\n  a += 1\nrescue\n  move(2)\nend while a < 3', 'rescue'],
        ['modifier rescue', 'move(10) rescue move(20)', 'move(10) rescue move(20)'],
        ['modifier rescue in assignment', 'a = bar rescue 1', 'a = bar rescue 1'],
    ])('%s is an error on the line of the clause', async (_name, code, line) => {
        const result = await converter.targetCodeToBlocks(target, code);
        expect(result).toBeFalsy();
        expect(converter.errors).toHaveLength(1);
        expect(converter.errors[0].row).toBe(rowOf(code, line));
        expect(converter.errors[0].text).toMatch(/exception handling[\s\S]*Delete rescue/);
        expect(converter.errors[0].text).toContain(`"${line}"`);
    });

    test('else alone (with a rescue) points at rescue, the first clause', async () => {
        const code = 'begin\n  move(10)\nrescue\n  move(20)\nelse\n  move(25)\nend';
        await converter.targetCodeToBlocks(target, code);
        expect(converter.errors).toHaveLength(1);
        expect(converter.errors[0].row).toBe(2);
        expect(converter.errors[0].text).toMatch(/exception handling/);
    });

    test.each([
        [
            'class body',
            'class Sprite1 < ::Smalruby3::Sprite\n  def self.foo\n    move(1)\n  end\nrescue\n  move(2)\nend',
        ],
        [
            'def in a class',
            'class Sprite1 < ::Smalruby3::Sprite\n  def foo\n    move(1)\n  rescue\n    retry\n  end\nend',
        ],
        [
            'initialize',
            'class Sprite1 < ::Smalruby3::Sprite\n  def initialize\n    self.x = 1\n  rescue\n    self.x = 2\n  end\nend',
        ],
        ['module body', 'module Foo\n  def foo\n    move(1)\n  end\nensure\n  move(2)\nend'],
    ])('%s with rescue / ensure is an error on the line of the clause (version 2)', async (_name, code) => {
        converter = makeConverter(target, runtime, { version: '2' });
        const result = await converter.targetCodeToBlocks(target, code);
        expect(result).toBeFalsy();
        expect(converter.errors).toHaveLength(1);
        const row = code.split('\n').findIndex((line) => /^\s*(rescue|ensure)$/.test(line));
        expect(converter.errors[0].row).toBe(row);
        expect(converter.errors[0].text).toMatch(/exception handling/);
    });

    test('begin ... end with no clause still converts to its body', async () => {
        const result = await converter.targetCodeToBlocks(target, 'begin\n  move(10)\n  move(20)\nend');
        expect(result).toBeTruthy();
        expect(converter.errors).toHaveLength(0);
        const opcodes = Object.values(converter._context.blocks).map((b) => b.opcode);
        expect(opcodes.filter((o) => o === 'motion_movesteps')).toHaveLength(2);
    });

    test('begin ... end while still comes back as written', async () => {
        await expectRoundTrip(converter, target, 'a = 0\nbegin\n  a = a + 1\nend while a < 3');
    });

    test('a method with no rescue still comes back as written', async () => {
        await expectRoundTrip(converter, target, 'def self.foo\n  move(1)\nend');
    });

    test('`rescue` written as a word in a string is not an error', async () => {
        await expectRoundTrip(converter, target, 'say("rescue")');
    });
});

describe('Messages of rescue / else / ensure (issue #1620)', () => {
    test.each([
        ['en', en],
        ['ja', ja],
        ['ja-Hira', jaHira],
    ])('%s has the message, with the source', (_name, locale) => {
        expect(locale[MESSAGE_ID]).toContain('{ SOURCE }');
        expect(locale[MESSAGE_ID]).toContain('rescue');
    });
});
