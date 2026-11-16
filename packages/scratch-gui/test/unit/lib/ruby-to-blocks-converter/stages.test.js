/**
 * The parts of the four stages (`stages.js`, docs/ruby-editor/converter-stages.md).
 */
import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import { STAGES, mixStages } from '../../../../src/lib/ruby-to-blocks-converter/stages';

describe('RubyToBlocksConverter/stages', () => {
    test('the stages are in the order that targetCodeToBlocks calls them', () => {
        expect(STAGES.map((stage) => stage.name)).toEqual(['shared', 'parse', 'analyze', 'convert', 'finish']);
    });

    test.each([
        ['parse', ['_indexSource', '_parse']],
        ['analyze', ['_analyze']],
        ['convert', ['_convert', 'visit', 'visitClassNode', 'visitModuleNode', '_processInitialize']],
        ['finish', ['_finish', 'applyTargetBlocks', 'getBlockIdForLine']],
    ])('the %s stage has its methods', (name, methods) => {
        const stage = STAGES.find((s) => s.name === name);
        const keys = Object.values(stage.parts).flatMap((part) => Object.keys(part));
        expect(keys).toEqual(expect.arrayContaining(methods));
    });

    test('every method of the parts is on the converter, from its part', () => {
        STAGES.forEach(({ parts }) => {
            Object.values(parts).forEach((part) => {
                Object.keys(part).forEach((key) => {
                    expect(RubyToBlocksConverter.prototype[key]).toBe(part[key]);
                });
            });
        });
    });

    test('a method defined in two parts is an error', () => {
        const stages = [
            { name: 'a', parts: { One: { m() {} } } },
            { name: 'b', parts: { Two: { m() {} } } },
        ];
        expect(() => mixStages({}, stages)).toThrow('m of b/Two is already defined (a/One)');
    });

    test('a method of a part that the class defines is an error', () => {
        class Converter {
            m() {}
        }
        const stages = [{ name: 'a', parts: { One: { m() {} } } }];
        expect(() => mixStages(Converter.prototype, stages)).toThrow('m of a/One is already defined (the class)');
    });
});
