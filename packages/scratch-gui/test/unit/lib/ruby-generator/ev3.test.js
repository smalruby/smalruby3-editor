// `ev3.button_pressed?(...)` puts PORT inside its own parentheses, so it asks for PORT with ORDER_NONE:
// a value of the order of a method call gets no second pair of parentheses (issue #1722).
import RubyGenerator from '../../../../src/lib/ruby-generator';
import Ev3Blocks from '../../../../src/lib/ruby-generator/ev3';
import KoshienBlocks from '../../../../src/lib/ruby-generator/koshien';

describe('RubyGenerator/EV3', () => {
    beforeEach(() => {
        RubyGenerator.cache_ = { comments: {}, targetCommentTexts: [] };
        RubyGenerator.definitions_ = {};
        RubyGenerator.functionNames_ = {};
        RubyGenerator.currentTarget = {
            comments: {},
            blocks: {
                getBlock: (id) => RubyGenerator.currentTarget.blocks._blocks[id],
                getInputs: (block) => block.inputs || {},
            },
        };
        Ev3Blocks(RubyGenerator);
        KoshienBlocks(RubyGenerator);
    });

    test('ev3_buttonPressed takes a method call as PORT without parentheses', () => {
        const blocks = {
            port: { id: 'port', opcode: 'koshien_mapAll', inputs: {}, fields: {} },
        };
        RubyGenerator.currentTarget.blocks._blocks = blocks;
        const block = { id: 'b', opcode: 'ev3_buttonPressed', inputs: { PORT: { name: 'PORT', block: 'port' } } };
        expect(RubyGenerator.ev3_buttonPressed(block)).toEqual([
            'ev3.button_pressed?(koshien.map_all)',
            RubyGenerator.ORDER_FUNCTION_CALL,
        ]);
    });
});
