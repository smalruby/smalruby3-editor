import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';

describe('RubyToBlocksConverter/Variables', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null);
        target = null;
    });

    describe('Variable Scope Validation', () => {
        let mockTarget;
        let stageTarget;

        beforeEach(() => {
            stageTarget = {
                id: 'stage',
                isStage: true,
                variables: {
                    'global_var_id': {
                        id: 'global_var_id',
                        name: 'global_variable',
                        type: ''
                    }
                }
            };
            mockTarget = {
                id: 'sprite1',
                isStage: false,
                variables: {
                    'instance_var_id': {
                        id: 'instance_var_id',
                        name: 'instance_variable',
                        type: ''
                    }
                }
            };
            const vm = {
                runtime: {
                    getTargetForStage: () => stageTarget,
                    getEditingTarget: () => mockTarget
                }
            };
            converter = new RubyToBlocksConverter(vm);
        });

        test('should error when changing global variable to instance variable', async () => {
            const code = '@global_variable = 0';
            const res = await converter.targetCodeToBlocks(mockTarget, code);
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].text).toBe('"@global_variable", can\'t change variable scope');
            expect(res).toBeFalsy();
        });

        test('should error when changing instance variable to global variable', async () => {
            const code = '$instance_variable = 0';
            const res = await converter.targetCodeToBlocks(mockTarget, code);
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].text).toBe('"$instance_variable", can\'t change variable scope');
            expect(res).toBeFalsy();
        });

        test('should allow same scope variable reuse', async () => {
            const code = '$global_variable = 0';
            const res = await converter.targetCodeToBlocks(mockTarget, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();
        });

        test('should allow same instance scope variable reuse', async () => {
            const code = '@instance_variable = 0';
            const res = await converter.targetCodeToBlocks(mockTarget, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();
        });

        test('should error when reading variable with wrong scope', async () => {
            const code = '@global_variable';
            const res = await converter.targetCodeToBlocks(mockTarget, code);
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].text).toBe('"@global_variable", can\'t change variable scope');
            expect(res).toBeFalsy();
        });

        test('should allow creating new variables with different names', async () => {
            const code = '@new_variable = 0';
            const res = await converter.targetCodeToBlocks(mockTarget, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();
        });
    });

    describe('Pseudo-Local Variable Naming', () => {
        test('local variable should have leading and trailing underscores and scope index', async () => {
            const code = 'var_x = 10';
            const res = await converter.targetCodeToBlocks(target, code);
            expect(res).toBeTruthy();
            const setVarBlock = Object.values(converter.blocks).find(b => b.opcode === 'data_setvariableto');
            expect(setVarBlock).toBeDefined();
            expect(setVarBlock.fields.VARIABLE.value).toBe('_var_x_1_');
        });

        test('local variable in method should have scope index 2', async () => {
            const code = 'def test; var_y = 20; end';
            const res = await converter.targetCodeToBlocks(target, code);
            expect(res).toBeTruthy();
            const setVarBlock = Object.values(converter.blocks).find(b => b.opcode === 'data_setvariableto');
            expect(setVarBlock).toBeDefined();
            expect(setVarBlock.fields.VARIABLE.value).toBe('_var_y_2_');
        });
    });
});
