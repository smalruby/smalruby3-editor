import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    expectedInfo
} from '../../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Variables/dataType', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, {version: '2'});
        target = null;
    });

    describe('global variable ($a)', () => {
        test('string literal assignment records dataType string', async () => {
            const code = '$a = "hello"';
            const expected = [
                {
                    opcode: 'data_setvariableto',
                    fields: [{ name: 'VARIABLE', variable: '$a' }],
                    inputs: [{ name: 'VALUE', block: expectedInfo.makeText('hello') }]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
            expect(converter.variables['a'].dataType).toBe('string');
        });

        test('number literal assignment records dataType number', async () => {
            const code = '$a = 42';
            const expected = [
                {
                    opcode: 'data_setvariableto',
                    fields: [{ name: 'VARIABLE', variable: '$a' }],
                    inputs: [{ name: 'VALUE', block: expectedInfo.makeText('42') }]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
            expect(converter.variables['a'].dataType).toBe('number');
        });

        test('true literal assignment records dataType boolean', async () => {
            const code = '$a = true';
            await converter.targetCodeToBlocks(target, code);
            expect(converter.variables['a'].dataType).toBe('boolean');
        });

        test('false literal assignment records dataType boolean', async () => {
            const code = '$a = false';
            await converter.targetCodeToBlocks(target, code);
            expect(converter.variables['a'].dataType).toBe('boolean');
        });
    });

    describe('local variable (a)', () => {
        test('string literal assignment records dataType string', async () => {
            const code = 'a = "He"';
            await converter.targetCodeToBlocks(target, code);
            const localVars = converter._context.localVariables;
            const varEntry = Object.values(localVars).find(v => v.originalName === 'a');
            expect(varEntry).toBeDefined();
            expect(varEntry.dataType).toBe('string');
        });

        test('number literal assignment records dataType number', async () => {
            const code = 'a = 1';
            await converter.targetCodeToBlocks(target, code);
            const localVars = converter._context.localVariables;
            const varEntry = Object.values(localVars).find(v => v.originalName === 'a');
            expect(varEntry).toBeDefined();
            expect(varEntry.dataType).toBe('number');
        });

        test('true assignment records dataType boolean', async () => {
            const code = 'a = true';
            await converter.targetCodeToBlocks(target, code);
            const localVars = converter._context.localVariables;
            const varEntry = Object.values(localVars).find(v => v.originalName === 'a');
            expect(varEntry).toBeDefined();
            expect(varEntry.dataType).toBe('boolean');
        });

        test('operator_join result assignment records dataType string', async () => {
            const code = 'a = "He" + "llo"';
            await converter.targetCodeToBlocks(target, code);
            const localVars = converter._context.localVariables;
            const varEntry = Object.values(localVars).find(v => v.originalName === 'a');
            expect(varEntry).toBeDefined();
            expect(varEntry.dataType).toBe('string');
        });

        test('to_s result assignment records dataType string', async () => {
            const code = 'a = 1.to_s';
            await converter.targetCodeToBlocks(target, code);
            const localVars = converter._context.localVariables;
            const varEntry = Object.values(localVars).find(v => v.originalName === 'a');
            expect(varEntry).toBeDefined();
            expect(varEntry.dataType).toBe('string');
        });

        test('to_i result assignment records dataType number', async () => {
            const code = 'a = "1".to_i';
            await converter.targetCodeToBlocks(target, code);
            const localVars = converter._context.localVariables;
            const varEntry = Object.values(localVars).find(v => v.originalName === 'a');
            expect(varEntry).toBeDefined();
            expect(varEntry.dataType).toBe('number');
        });

        test('unknown block result assignment records dataType null', async () => {
            const code = 'a = touching?("edge")';
            await converter.targetCodeToBlocks(target, code);
            const localVars = converter._context.localVariables;
            const varEntry = Object.values(localVars).find(v => v.originalName === 'a');
            expect(varEntry).toBeDefined();
            expect(varEntry.dataType).toBeNull();
        });
    });
});
