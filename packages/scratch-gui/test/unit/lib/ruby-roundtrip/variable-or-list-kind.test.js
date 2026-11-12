// === Smalruby: This file is Smalruby-specific (whether @a / $a is a variable or a list, issue #1622) ===
/**
 * Whether `@a` (or `$a`) is a variable or a list is decided from everything that is known:
 * how the code uses the name (`@a = []` / `push` are a list, `@a = 0` / `+= 1` a variable), and
 * what the sprite (or the stage) already has (only a list, or only a variable).
 *
 * Scratch can have a variable and a list of the same name, but Ruby has one `@a`. Only then the
 * list is `@_a_list_` in Ruby (`$_a_list_` on the stage), and it is the list `a` again in the blocks.
 */
import Variable from '@smalruby/scratch-vm/src/engine/variable';
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip,
} from '../../helpers/ruby-roundtrip-helper';

const SCALAR = Variable.SCALAR_TYPE;
const LIST = Variable.LIST_TYPE;

describe('Ruby to blocks: whether @a is a variable or a list (issue #1622)', () => {
    let target, stage, runtime;

    beforeEach(() => {
        ({ target, stage, runtime } = makeSpriteTarget());
        setupRubyGenerator();
    });

    const ownerOf = (onStage) => (onStage ? stage : target);
    const give = (owner, kinds, name = 'a') => {
        if (kinds.includes('variable')) owner.variables.v1 = new Variable('v1', name, SCALAR);
        if (kinds.includes('list')) owner.variables.l1 = new Variable('l1', name, LIST);
    };
    const namesAndTypes = (owner) =>
        Object.values(owner.variables)
            .map((v) => `${v.type || 'variable'}:${v.name}`)
            .sort();
    const blocksOf = () => Object.values(target.blocks._blocks);
    const opcodes = () => blocksOf().map((b) => b.opcode);
    const roundTrip = (code, expected = null) =>
        expectRoundTrip(makeConverter(target, runtime, { version: '2' }), target, code, expected);
    const convert = async (code) => {
        const converter = makeConverter(target, runtime, { version: '2' });
        const result = await converter.targetCodeToBlocks(target, code);
        return { result, errors: converter.errors };
    };

    describe('the example of the issue: a variable and a list of the same name', () => {
        test.each([
            ['in the sprite', false, '@'],
            ['on the stage', true, '$'],
        ])('%s: the list is _a_list_ in Ruby and the list a in the blocks', async (_name, onStage, p) => {
            const owner = ownerOf(onStage);
            give(owner, ['variable', 'list']);
            const code = dedent`
                ${p}a = 1
                ${p}_a_list_.push(2)
                say(${p}a)
                say(${p}_a_list_)
            `;
            await roundTrip(code);
            expect(namesAndTypes(owner)).toEqual(['list:a', 'variable:a']);
            const read = blocksOf().filter((b) => b.opcode === 'data_listcontents');
            expect(read.map((b) => b.fields.LIST.id)).toEqual(['l1']);
            const push = blocksOf().find((b) => b.opcode === 'data_addtolist');
            expect(push.fields.LIST.id).toBe('l1');
            const variableRead = blocksOf().find((b) => b.opcode === 'data_variable');
            expect(variableRead.fields.VARIABLE.id).toBe('v1');
            // and again
            await roundTrip(code);
            expect(namesAndTypes(owner)).toEqual(['list:a', 'variable:a']);
        });

        test('Ruby written from scratch with @a and @_a_list_ makes the variable a and the list a', async () => {
            await roundTrip('@a = 0\n@_a_list_ = [1]\nsay(@a)\nsay(@_a_list_)');
            expect(namesAndTypes(target)).toEqual(['list:a', 'variable:a']);
        });

        test('def initialize keeps both', async () => {
            target.sprite = { name: 'Sprite1', costumes: [] };
            runtime.targets = [stage, target];
            const code = dedent`
                class Sprite1
                  def initialize
                    @_a_list_ = [1, 2]
                    @a = 3
                  end

                  when_flag_clicked do
                    say(@a)
                    say(@_a_list_)
                  end
                end
            `;
            await roundTrip(code);
            expect(namesAndTypes(target)).toEqual(['list:a', 'variable:a']);
            const list = Object.values(target.variables).find((v) => v.type === LIST);
            expect(list.value).toEqual([1, 2]);
        });
    });

    describe('only reading the name: say(@a)', () => {
        test.each([
            ['only a list', ['list'], 'data_listcontents'],
            ['only a variable', ['variable'], 'data_variable'],
            ['a variable and a list', ['variable', 'list'], 'data_variable'],
            ['nothing', [], 'data_variable'],
        ])('with %s', async (_name, kinds, opcode) => {
            give(target, kinds);
            await roundTrip('say(@a)');
            expect(opcodes()).toContain(opcode);
            expect(namesAndTypes(target)).toEqual(kinds.length > 0 ? namesAndTypes(target) : ['variable:a']);
        });

        test.each([
            ['only a list', ['list'], 'data_listcontents'],
            ['only a variable', ['variable'], 'data_variable'],
            ['a variable and a list', ['variable', 'list'], 'data_variable'],
        ])('$a with %s on the stage', async (_name, kinds, opcode) => {
            give(stage, kinds);
            await roundTrip('say($a)');
            expect(opcodes()).toContain(opcode);
        });

        test('with a list only, no variable is made', async () => {
            give(target, ['list']);
            await roundTrip('say(@a)');
            expect(namesAndTypes(target)).toEqual(['list:a']);
        });
    });

    describe('what the code does with the name', () => {
        // [name, code, the Ruby that comes back (null: the same), an opcode it becomes]
        const cases = {
            'only a list': [
                ['@a[0]', 'say(@a[0])', null, 'data_itemoflist'],
                ['@a.push', '@a.push(1)', null, 'data_addtolist'],
                ['@a.length', 'say(@a.length)', null, 'data_lengthoflist'],
                ['@a = []', '@a = []', null, 'data_deletealloflist'],
                // a variable is made; the list stays in the sprite
                ['@a += 1', '@a += 1', null, 'data_changevariableby'],
            ],
            'only a variable': [
                ['@a[0]', 'say(@a[0])', null, 'operator_letter_of'],
                // a list is made, and now the sprite has both
                ['@a.push', '@a.push(1)', '@_a_list_.push(1)', 'data_addtolist'],
                ['@a.length', 'say(@a.length)', null, 'operator_length'],
                ['@a = []', '@a = []', '@_a_list_ = []', 'data_deletealloflist'],
                ['@a += 1', '@a += 1', null, 'data_changevariableby'],
            ],
            'a variable and a list': [
                ['@a[0]', 'say(@a[0])', null, 'operator_letter_of'],
                ['@a.push', '@a.push(1)', '@_a_list_.push(1)', 'data_addtolist'],
                ['@a.length', 'say(@a.length)', null, 'operator_length'],
                ['@a = []', '@a = []', '@_a_list_ = []', 'data_deletealloflist'],
                ['@a += 1', '@a += 1', null, 'data_changevariableby'],
                ['@_a_list_[0]', 'say(@_a_list_[0])', null, 'data_itemoflist'],
                ['@_a_list_.length', 'say(@_a_list_.length)', null, 'data_lengthoflist'],
            ],
        };
        const kindsOf = {
            'only a list': ['list'],
            'only a variable': ['variable'],
            'a variable and a list': ['variable', 'list'],
        };
        Object.keys(cases).forEach((situation) => {
            describe(`with ${situation}`, () => {
                test.each(cases[situation])('%s', async (_name, code, expected, opcode) => {
                    give(target, kindsOf[situation]);
                    await roundTrip(code, expected);
                    expect(opcodes()).toContain(opcode);
                    // the blocks point at what the sprite has: no other variable or list is made
                    expect(namesAndTypes(target).every((n) => /:a$/.test(n))).toBe(true);
                });
                test.each(cases[situation])('$ on the stage: %s', async (_name, code, expected, opcode) => {
                    give(stage, kindsOf[situation]);
                    const toStage = (s) => s && s.replace(/@/g, '$');
                    await roundTrip(toStage(code), toStage(expected));
                    expect(opcodes()).toContain(opcode);
                    expect(namesAndTypes(stage).every((n) => /:a$/.test(n))).toBe(true);
                });
            });
        });

        test('with nothing, @a = [] then say(@a) is the list', async () => {
            await roundTrip('@a = []\nsay(@a)');
            expect(namesAndTypes(target)).toEqual(['list:a']);
        });
    });

    describe('@_a_list_ written in Ruby', () => {
        test('with the list a only, it is the list a', async () => {
            give(target, ['list']);
            await roundTrip('@_a_list_.push(1)', '@a.push(1)');
            expect(namesAndTypes(target)).toEqual(['list:a']);
        });

        test('with the variable a only, it is the list a', async () => {
            give(target, ['variable']);
            await roundTrip('@_a_list_.push(1)\nsay(@a)');
            expect(namesAndTypes(target)).toEqual(['list:a', 'variable:a']);
        });

        test('with nothing and no @a in the code, it is a list of that name', async () => {
            await roundTrip('@_a_list_.push(1)\nsay(@_a_list_)');
            expect(namesAndTypes(target)).toEqual(['list:_a_list_']);
        });

        // The code names the list `a` beside the variable `a`, so `@a` is the variable even when the
        // code only reads it: it does not become the list `a` too.
        test.each([
            ['in the sprite', false, '@'],
            ['on the stage', true, '$'],
        ])('%s with nothing, a read of @a beside @_a_list_ is the variable a', async (_name, onStage, p) => {
            await roundTrip(`say(${p}a)\nsay(${p}_a_list_)`);
            expect(namesAndTypes(ownerOf(onStage))).toEqual(['list:a', 'variable:a']);
            expect(opcodes()).toEqual(expect.arrayContaining(['data_variable', 'data_listcontents']));
        });

        test('with nothing, @a.length beside @_a_list_ is the length of the variable a', async () => {
            await roundTrip('say(@a.length)\n@_a_list_.push(1)');
            expect(opcodes()).toContain('operator_length');
            expect(opcodes()).not.toContain('data_lengthoflist');
            expect(namesAndTypes(target)).toEqual(['list:a', 'variable:a']);
        });

        test('set to a number, it is a variable of that name', async () => {
            await roundTrip('@_a_list_ = 1\nsay(@a)');
            expect(namesAndTypes(target)).toEqual(['variable:_a_list_', 'variable:a']);
        });
    });

    describe('a name that the user gave: _x_list_', () => {
        test('a list _x_list_ with a variable x stays the list _x_list_', async () => {
            give(target, ['variable'], 'x');
            target.variables.l2 = new Variable('l2', '_x_list_', LIST);
            await roundTrip('@x = 1\n@_x_list_.push(2)\nsay(@_x_list_)');
            expect(namesAndTypes(target)).toEqual(['list:_x_list_', 'variable:x']);
            const push = blocksOf().find((b) => b.opcode === 'data_addtolist');
            expect(push.fields.LIST.id).toBe('l2');
        });

        test('a variable _x_list_ stays the variable _x_list_', async () => {
            target.variables.v2 = new Variable('v2', '_x_list_', SCALAR);
            give(target, ['list'], 'x');
            await roundTrip('say(@_x_list_)');
            expect(opcodes()).toContain('data_variable');
            expect(namesAndTypes(target)).toEqual(['list:x', 'variable:_x_list_']);
        });

        test('$_x_list_ on the stage stays the list _x_list_', async () => {
            stage.variables.v1 = new Variable('v1', 'x', SCALAR);
            stage.variables.l2 = new Variable('l2', '_x_list_', LIST);
            await roundTrip('$x = 1\n$_x_list_.push(2)');
            expect(namesAndTypes(stage)).toEqual(['list:_x_list_', 'variable:x']);
        });
    });

    describe('one name used as both a variable and a list in the code is an error', () => {
        test.each([
            ['with nothing', []],
            ['with a variable and a list of the same name', ['variable', 'list']],
        ])('%s', async (_name, kinds) => {
            give(target, kinds);
            const { result, errors } = await convert('@a = 0\n@a.push(1)');
            expect(result).toBe(false);
            expect(errors).toHaveLength(1);
            expect(errors[0].row).toBe(0);
            expect(errors[0].text).toContain('"@a" is used as a list on line 2 and as a variable on line 1.');
        });

        test('@a and @_a_list_ are not the same name', async () => {
            await roundTrip('@a = 0\n@_a_list_.push(1)');
            expect(namesAndTypes(target)).toEqual(['list:a', 'variable:a']);
        });
    });
});
