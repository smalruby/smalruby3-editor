import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    convertAndExpectRubyBlockError,
} from '../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/MeshV2', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, { version: '2' });
        target = null;
    });

    test('meshV2_getSensorValue', async () => {
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
                                    value: ' ',
                                },
                            ],
                            shadow: true,
                        },
                    },
                ],
            },
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        {
            for (const s of ['mesh.sensor_value()', 'mesh.sensor_value(1)', 'mesh.sensor_value("arg1", "arg2")']) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }
        }
    });

    test('meshV2_messageValue (#1843)', async () => {
        await convertAndExpectToEqualBlocks(converter, target, 'mesh.message_value', [
            { opcode: 'meshV2_messageValue' },
        ]);
        await convertAndExpectRubyBlockError(converter, target, 'mesh.message_value(1)');
    });

    const broadcastExpected = (message, valueBlock) => [
        {
            opcode: 'meshV2_broadcastWithValue',
            inputs: [
                {
                    name: 'BROADCAST_INPUT',
                    block: {
                        opcode: 'event_broadcast_menu',
                        fields: [{ name: 'BROADCAST_OPTION', broadcastMsg: message }],
                        shadow: true,
                    },
                },
                { name: 'VALUE', block: valueBlock },
            ],
        },
    ];
    const text = (value) => ({ opcode: 'text', fields: [{ name: 'TEXT', value }], shadow: true });

    test('meshV2_broadcastWithValue (#1843)', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'mesh.broadcast("chat", "hello")',
            broadcastExpected('chat', text('hello')),
        );
        // 数は数字の文字列として送る
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'mesh.broadcast("chat", 42)',
            broadcastExpected('chat', text('42')),
        );
        for (const s of ['mesh.broadcast("chat")', 'mesh.broadcast(1, "x")', 'mesh.broadcast("a", "b", "c")']) {
            await convertAndExpectRubyBlockError(converter, target, s);
        }
    });
});
