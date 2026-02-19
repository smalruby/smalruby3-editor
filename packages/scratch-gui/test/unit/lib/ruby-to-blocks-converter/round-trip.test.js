import Blocks from '@smalruby/scratch-vm/src/engine/blocks';
import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import RubyGenerator from '../../../../src/lib/ruby-generator';

describe('Ruby Round Trip', () => {
    let converter;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null);
    });

    const expectRoundTrip = (code, expectedRuby = null) => {
        const result = converter.targetCodeToBlocks(null, code);
        expect(converter.errors).toHaveLength(0);
        expect(result).toBeTruthy();

        const blocks = new Blocks();
        blocks.forceNoGlow = true;
        Object.keys(converter.blocks).forEach(blockId => {
            blocks.createBlock(converter.blocks[blockId]);
        });

        const variables = {};
        [converter.variables, converter._context.localVariables].forEach(vars => {
            Object.values(vars).forEach(v => {
                variables[v.id] = v;
            });
        });

        const lists = {};
        Object.values(converter.lists).forEach(v => {
            lists[v.id] = v;
        });

        const target = {
            id: 'target-id',
            blocks: blocks,
            variables: variables,
            lists: lists,
            comments: converter._context.comments,
            isStage: false,
            // Mocking some methods needed by RubyGenerator or Blocks
            lookupVariableById: id => variables[id],
            lookupVariableByNameAndType: (name, type) => {
                return Object.values(variables).find(v => v.name === name && v.type === type);
            }
        };

        RubyGenerator.init();
        RubyGenerator.currentTarget = target;
        
        const generatedRuby = RubyGenerator.targetToCode(target);
        expect(generatedRuby.trim()).toEqual((expectedRuby || code).trim());
    };

    test('operator >=', () => {
        expectRoundTrip('1 >= 50');
        expectRoundTrip('@x >= @y');
        expectRoundTrip('1.2 >= 3.4');
        expectRoundTrip('1 + 2 >= 3 * 4');
    });

    test('operator <=', () => {
        expectRoundTrip('1 <= 50');
        expectRoundTrip('@x <= @y');
        expectRoundTrip('1.2 <= 3.4');
        expectRoundTrip('1 + 2 <= 3 * 4');
    });

    test('mixed operators', () => {
        expectRoundTrip('@x >= @y && @a <= @b');
        expectRoundTrip('@x >= @y || @a <= @b');
        expectRoundTrip('!(@x >= @y)');
    });

    test('true / false', () => {
        expectRoundTrip('true');
        expectRoundTrip('false');
        expectRoundTrip('if true\n  move(10)\nend');
        expectRoundTrip('if false\n  move(10)\nend');
        expectRoundTrip('x = true');
        expectRoundTrip('x = false');
        expectRoundTrip('true && false');
        expectRoundTrip('true || false');
        expectRoundTrip('!true');
        expectRoundTrip('!false');
    });

    test('sensing and boolean operators', () => {
        expectRoundTrip('touching?("_edge_")');
        expectRoundTrip('!touching?("_edge_")');
        expectRoundTrip('if touching?("_edge_")\n  move(10)\nend');
    });

    test('return statement in method', () => {
        expectRoundTrip(`
def self.add(a, b)
  return a + b
end
`.trim());

        expectRoundTrip(`
def self.div(a, b)
  if b == 0
    return 0
  end
  return a / b
end
`.trim());

        expectRoundTrip(`
def self.check(x)
  if x < 0
    return "negative"
  end
  if x == 0
    return "zero"
  end
  return "positive"
end
`.trim());
    });
});
