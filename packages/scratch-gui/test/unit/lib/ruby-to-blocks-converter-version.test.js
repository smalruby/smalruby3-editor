import { targetCodeToBlocks } from '../../../src/lib/ruby-to-blocks-converter';

describe('RubyToBlocksConverter Versioning', () => {
    let vm;
    let target;

    beforeEach(() => {
        vm = {
            runtime: {
                getTargetForStage: () => ({
                    variables: {},
                    lookupVariableByNameAndType: () => null,
                }),
            },
        };
        target = {
            isStage: false,
            variables: {},
            lookupVariableByNameAndType: () => null,
            blocks: {
                getProcedureParamNamesIdsAndDefaults: () => [[], [], []],
            },
        };
    });

    test('converts v1 (def self.method_name) to blocks', async () => {
        const code = `def self.my_method
end`;
        const converter = await targetCodeToBlocks(vm, target, code);
        expect(converter.result).toBe(true);
        expect(converter.errors).toHaveLength(0);

        const blocks = Object.values(converter.blocks);
        expect(blocks.some(b => b.opcode === 'procedures_definition')).toBe(true);
    });

    test('converts v2 (def method_name) to blocks', async () => {
        const code = `def my_method
end`;
        const converter = await targetCodeToBlocks(vm, target, code);
        expect(converter.result).toBe(true);
        expect(converter.errors).toHaveLength(0);

        const blocks = Object.values(converter.blocks);
        expect(blocks.some(b => b.opcode === 'procedures_definition')).toBe(true);
    });
});
