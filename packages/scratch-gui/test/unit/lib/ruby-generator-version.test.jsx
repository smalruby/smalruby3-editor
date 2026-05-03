import RubyGenerator from '../../../src/lib/ruby-generator';

describe('RubyGenerator Versioning', () => {
    let renderedTarget;

    beforeEach(() => {
        RubyGenerator.cache_ = {};
        RubyGenerator.definitions_ = {};
        RubyGenerator.functionNames_ = {};

        renderedTarget = {
            id: 'target1',
            sprite: {
                name: 'Sprite1',
            },
            comments: {},
            variables: {},
            blocks: {
                getScripts: () => ['block1'],
                getBlock: (id) => {
                    if (id === 'block1') {
                        return {
                            id: 'block1',
                            opcode: 'procedures_definition',
                            inputs: {
                                custom_block: {
                                    block: 'block2',
                                },
                            },
                            next: null,
                        };
                    }
                    if (id === 'block2') {
                        return {
                            id: 'block2',
                            opcode: 'procedures_prototype',
                            mutation: {
                                proccode: 'my_method',
                            },
                            inputs: {},
                        };
                    }
                    return null;
                },
                getInputs: (block) => block.inputs || {},
                getProcedureParamNamesIdsAndDefaults: () => [[], [], []],
            },
            runtime: {
                getTargetForStage: () => null,
            },
        };
        RubyGenerator.currentTarget = renderedTarget;
    });

    test('v1 generates def self.method_name', async () => {
        const code = RubyGenerator.targetToCode(renderedTarget, { version: '1' });
        expect(code).toContain('def self.my_method');
        expect(code).not.toContain('def my_method');
    });

    test('v2 generates def method_name', async () => {
        const code = RubyGenerator.targetToCode(renderedTarget, { version: '2' });
        expect(code).toContain('def my_method');
        expect(code).not.toContain('def self.my_method');
    });

    test('default (no version) generates def self.method_name', async () => {
        const code = RubyGenerator.targetToCode(renderedTarget);
        expect(code).toContain('def self.my_method');
    });
});
