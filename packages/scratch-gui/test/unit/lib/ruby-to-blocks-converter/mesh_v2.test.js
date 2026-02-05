import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    convertAndExpectRubyBlockError
} from '../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/MeshV2', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null);
        target = null;
    });

    test('meshV2_getSensorValue', () => {
        const code = 'mesh.sensor_value(" ")';
        const expected = [
            {
                opcode: 'meshV2_getSensorValue',
                inputs: [
                    {
                        name: 'NAME',
                        block: {
                            opcode: 'meshV2_menu_variableNames',
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
        convertAndExpectToEqualBlocks(converter, target, code, expected);

        [
            'mesh.sensor_value()',
            'mesh.sensor_value(1)',
            'mesh.sensor_value("arg1", "arg2")'
        ].forEach(s => {
            convertAndExpectRubyBlockError(converter, target, s);
        });
    });
});
