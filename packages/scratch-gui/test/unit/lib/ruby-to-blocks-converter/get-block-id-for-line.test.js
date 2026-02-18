import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';

describe('RubyToBlocksConverter.getBlockIdForLine', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null);
        target = {
            isStage: false,
            variables: {},
            blocks: {
                _blocks: {},
                deleteBlock: jest.fn(),
                createBlock: jest.fn(),
                getBlock: (id) => converter.blocks[id]
            },
            lookupVariableByNameAndType: jest.fn(),
            createVariable: jest.fn(),
            deleteVariable: jest.fn()
        };
        converter.vm = {
            runtime: {
                getTargetForStage: () => ({
                    lookupVariableByNameAndType: jest.fn(),
                    createVariable: jest.fn(),
                    variables: {}
                })
            },
            extensionManager: {
                isExtensionLoaded: () => true
            },
            emitWorkspaceUpdate: jest.fn()
        };
    });

    test('should return block ID for end line of if statement', () => {
        const code = [
            'text = "ハロー！"',
            'if text.empty?',
            '  say("empty")',
            'end'
        ].join('\n');
        
        const result = converter.targetCodeToBlocks(target, code);
        if (!result) {
            console.error(converter.errors);
        }
        expect(result).toBeTruthy();
        
        const line4BlockId = converter.getBlockIdForLine(4);
        expect(line4BlockId).not.toBeNull();
        expect(line4BlockId).toBeDefined();

        // Line 2 (if) and Line 4 (end) should return the same block ID
        const line2BlockId = converter.getBlockIdForLine(2);
        expect(line2BlockId).toBe(line4BlockId);
    });

    test('should return block ID for trailing empty lines after if statement', () => {
        const code = [
            'text = "ハロー！"',
            'if text.empty?',
            '  say("true")',
            'end',
            '',
            ''
        ].join('\n');
        
        const result = converter.targetCodeToBlocks(target, code);
        if (!result) {
            console.error(converter.errors);
        }
        expect(result).toBeTruthy();
        
        // Line 4 (end)
        const line4BlockId = converter.getBlockIdForLine(4);
        expect(line4BlockId).not.toBeNull();

        // Line 5 (empty)
        const line5BlockId = converter.getBlockIdForLine(5);
        expect(line5BlockId).toBe(line4BlockId);

        // Line 6 (empty)
        const line6BlockId = converter.getBlockIdForLine(6);
        expect(line6BlockId).toBe(line4BlockId);
    });
});
