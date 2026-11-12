// === Smalruby: This file is Smalruby-specific (a hash assignment makes no unused variable, issue #1666) ===
/**
 * A hash is kept in two lists (`_hash_h_keys_` / `_hash_h_values_`). Setting a variable to a hash
 * literal makes those two lists only, not also a plain variable of the same name that nothing uses
 * (issue #1666). A variable of that name that the project already has is kept.
 */
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    rubyToBlocksToRuby,
} from '../../helpers/ruby-roundtrip-helper';

const inFlag = (lines) => `when_flag_clicked do\n${lines.map((line) => `  ${line}`).join('\n')}\nend`;

const namesOf = (owner) =>
    Object.values(owner.variables)
        .map((v) => `${v.type === 'list' ? 'list' : 'var'}:${v.name}`)
        .sort();

describe('Ruby Roundtrip: V2 hash assignment makes no unused variable (#1666)', () => {
    let target, stage, runtime, converter;

    beforeEach(() => {
        ({ target, stage, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime, { version: '2' });
    });

    const convert = async (code) => {
        const ruby = await rubyToBlocksToRuby(converter, target, code);
        expect(ruby).toBe(code);
        return ruby;
    };

    test.each([
        ['@h', ['list:_hash_h_keys_', 'list:_hash_h_values_'], []],
        ['$h', [], ['list:_hash_h_keys_', 'list:_hash_h_values_']],
        ['h', ['list:__hash_h_keys__1_', 'list:__hash_h_values__1_'], []],
    ])('%s = {a: 1} makes only the two lists of the hash', async (name, spriteNames, stageNames) => {
        await convert(inFlag([`${name} = {a: 1}`]));
        expect(namesOf(target)).toEqual(spriteNames);
        expect(namesOf(stage)).toEqual(stageNames);
    });

    test.each([
        'say(H.keys)',
        'say(H.values)',
        'say(H[:a])',
        'H[:a] = 2',
        'say(H.length)',
        'say(H.empty?)',
        'say(H.key?(:a))',
    ])('@h, $h and h: %s still makes no variable', async (op) => {
        for (const name of ['@h', '$h', 'h']) {
            ({ target, stage, runtime } = makeSpriteTarget());
            converter = makeConverter(target, runtime, { version: '2' });
            await convert(inFlag([`${name} = {a: 1}`, op.replace(/H/g, name)]));
            const all = [...namesOf(target), ...namesOf(stage)];
            expect(all.filter((n) => n.startsWith('var:'))).toEqual([]);
        }
    });

    // The block of `@h.each` reads `@h` as its receiver (a variable reporter), so the variable is used.
    test('each over a hash keeps the variable that its block reads as the receiver', async () => {
        await convert(inFlag(['@h = {a: 1}', '@h.each do |k, v|', '  say(k)', '  say(v)', 'end']));
        expect(namesOf(target)).toContain('var:h');
    });

    test('a variable read as a value is still made', async () => {
        await convert(inFlag(['@h = {a: 1}', '@x = 1', 'say(@x)']));
        expect(namesOf(target)).toEqual(['list:_hash_h_keys_', 'list:_hash_h_values_', 'var:x']);
    });

    test('a variable set to a number as well as a hash is kept', async () => {
        await convert(inFlag(['@h = {a: 1}', '@h = 0']));
        expect(namesOf(target)).toContain('var:h');
    });

    test('a variable h that the project already has is kept and still converts', async () => {
        target.createVariable('existing-h', 'h', '');
        await convert(inFlag(['@h = {a: 1}', 'say(@h.keys)']));
        expect(namesOf(target)).toEqual(['list:_hash_h_keys_', 'list:_hash_h_values_', 'var:h']);
        expect(target.variables['existing-h'].name).toBe('h');

        // Back to blocks once more: the same.
        await convert(inFlag(['@h = {a: 1}', 'say(@h.keys)']));
        expect(namesOf(target)).toEqual(['list:_hash_h_keys_', 'list:_hash_h_values_', 'var:h']);
    });

    test('a global h that the stage already has is kept', async () => {
        stage.createVariable('existing-gh', 'h', '');
        await convert(inFlag(['$h = {a: 1}', 'say($h[:a])']));
        expect(namesOf(stage)).toEqual(['list:_hash_h_keys_', 'list:_hash_h_values_', 'var:h']);
    });

    test('a saved local _h_1_ is not made again', async () => {
        target.createVariable('saved-local', '_h_1_', '');
        target.deleteVariable = function (id) {
            delete this.variables[id];
        };
        await convert(inFlag(['h = {x: 1}', 'say(h[:x])']));
        expect(namesOf(target)).toEqual(['list:__hash_h_keys__1_', 'list:__hash_h_values__1_']);
    });
});
