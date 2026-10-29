import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    convertAndExpectRubyBlockError,
    rubyToExpected,
    expectedInfo
} from '../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Koshien', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, {version: '2'});
        target = null;
    });

    test('koshien_setMessage', async () => {
        let code;
        let expected;

        code = 'koshien.set_message("hello")';
        expected = [
            {
                opcode: 'koshien_setMessage',
                inputs: [
                    {
                        name: 'MESSAGE',
                        block: expectedInfo.makeText('hello')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'koshien.set_message(x)';
        expected = [
            {
                opcode: 'koshien_setMessage',
                inputs: [
                    {
                        name: 'MESSAGE',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeText('hello')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        { for (const s of [
            'koshien.set_message()',
            'koshien.set_message("hello", "world")'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    describe('coordinates on the 17x17 map', () => {
        const convertAndExpectErrorText = async (code, pattern) => {
            await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].text).toMatch(pattern);
        };

        for (const version of ['1', '2']) {
            describe(`version ${version}`, () => {
                beforeEach(() => {
                    converter = new RubyToBlocksConverter(null, {version});
                });

                test('accepts coordinates from 0 to 16', async () => {
                    for (const position of ['0:0', '7:15', '15:7', '7:16', '16:16']) {
                        const code = `koshien.get_map_area("${position}")`;
                        const expected = [
                            {
                                opcode: 'koshien_getMapArea',
                                inputs: [
                                    {
                                        name: 'POSITION',
                                        block: expectedInfo.makeText(position)
                                    }
                                ]
                            }
                        ];
                        await convertAndExpectToEqualBlocks(converter, target, code, expected);
                    }
                });

                test('accepts 16 in every method that takes a coordinate', async () => {
                    for (const code of [
                        'koshien.move_to("16:16")',
                        'koshien.set_dynamite("16:16")',
                        'koshien.set_bomb("16:16")',
                        'koshien.map("16:16")',
                        'koshien.position_of_x("16:16")',
                        'koshien.map_from("16:16", nil)',
                        'koshien.calc_route(src: "16:16", dst: "0:16", except_cells: nil, result: nil)',
                        'koshien.locate_objects(sq_size: 5, cent: "16:16", objects: "A", result: nil)',
                        'koshien.position(16, 16)'
                    ]) {
                        await converter.targetCodeToBlocks(target, code);
                        expect(converter.errors).toHaveLength(0);
                    }
                });

                test('explains an out-of-range coordinate', async () => {
                    for (const code of [
                        'koshien.get_map_area("17:0")',
                        'koshien.get_map_area("0:17")',
                        'koshien.get_map_area("-1:0")',
                        'koshien.get_map_area("abc")',
                        'koshien.move_to("17:17")',
                        'koshien.set_dynamite("17:0")',
                        'koshien.set_bomb("17:0")',
                        'koshien.map("17:0")',
                        'koshien.position_of_x("17:0")',
                        'koshien.map_from("17:0", nil)',
                        'koshien.calc_route(src: "17:16", dst: "0:16", except_cells: nil, result: nil)',
                        'koshien.calc_route(src: "0:0", dst: "0:17", except_cells: nil, result: nil)',
                        'koshien.locate_objects(sq_size: 5, cent: "17:16", objects: "A", result: nil)'
                    ]) {
                        await convertAndExpectErrorText(code, /is an invalid coordinate\..*0 to 16/s);
                    }
                    await convertAndExpectErrorText('koshien.position(17, 0)', /is an invalid coordinate\..*0 to 16/s);
                    await convertAndExpectErrorText('koshien.position(0, -1)', /is an invalid coordinate\..*0 to 16/s);
                });
            });
        }
    });
});
