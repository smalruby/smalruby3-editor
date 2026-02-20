import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    convertAndExpectRubyBlockError
} from '../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Mesh', () => {
    let converter;
    let target;
    let code;
    let expected;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null);
        target = null;
        code = null;
        expected = null;
    });

    test('mesh_getSensorValue', async () => {
        code = 'mesh_v1.sensor_value(" ")';
        expected = [
            {
                opcode: 'mesh_getSensorValue',
                inputs: [
                    {
                        name: 'NAME',
                        block: {
                            opcode: 'mesh_menu_variableNames',
                            fields: [
                                {
                                    name: 'variableNames',
                                    value: ' '
                                }
                            ],
                            shadow: true
                        }
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        { for (const s of [
            'mesh_v1.sensor_value()',
            'mesh_v1.sensor_value(1)',
            'mesh_v1.sensor_value("arg1", "arg2")'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });
});
