import RubyGenerator from '../../../../src/lib/ruby-generator';
import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import LooksConverter from '../../../../src/lib/ruby-to-blocks-converter/looks';
import MotionConverter from '../../../../src/lib/ruby-to-blocks-converter/motion';
import SoundConverter from '../../../../src/lib/ruby-to-blocks-converter/sound';
import { numberArg, registerSendTable } from '../../../../src/lib/ruby-to-blocks-converter/send-table';

/**
 * The opcodes that the rows of a send table make, menus included.
 * @param {Array<object>} rows - The rows.
 * @returns {Array<string>} The opcodes.
 */
const opcodesOf = (rows) =>
    rows.flatMap((row) => [
        row.opcode,
        ...(row.args || []).filter((arg) => arg.kind === 'menu').map((arg) => arg.menuOpcode),
    ]);

describe('RubyToBlocksConverter/send table', () => {
    const tables = {
        motion: MotionConverter,
        looks: LooksConverter,
        sound: SoundConverter,
    };

    test.each(Object.keys(tables))('every opcode of the %s table has a generator', (area) => {
        const missing = opcodesOf(tables[area].sends).filter((opcode) => typeof RubyGenerator[opcode] !== 'function');
        expect(missing).toEqual([]);
    });

    test('a row with an unknown kind of argument is an error, not a block without the argument', async () => {
        const converter = new RubyToBlocksConverter(null, { version: '2' });
        registerSendTable(converter, [
            { receiver: 'sprite', name: 'jump', opcode: 'motion_movesteps', args: [{ kind: 'paint', input: 'C' }] },
        ]);

        expect(await converter.targetCodeToBlocks(null, 'jump(3)')).toBe(false);
        expect(converter.errors.map((error) => error.text)).toEqual(['unknown kind of argument: paint']);
    });

    test('a row gives way to the next handler when an argument is of another kind', async () => {
        const converter = new RubyToBlocksConverter(null, { version: '2' });
        registerSendTable(converter, [
            { receiver: 'sprite', name: 'jump', opcode: 'motion_movesteps', args: [numberArg('STEPS', 10)] },
        ]);
        converter.registerOnSend('sprite', 'jump', 1, () =>
            converter._createBlock('motion_ifonedgebounce', 'statement'),
        );

        await converter.targetCodeToBlocks(null, 'jump("far")');
        expect(Object.values(converter.blocks).map((block) => block.opcode)).toEqual(['motion_ifonedgebounce']);

        await converter.targetCodeToBlocks(null, 'jump(3)');
        expect(Object.values(converter.blocks).map((block) => block.opcode)).toEqual([
            'motion_movesteps',
            'math_number',
        ]);
    });
});
