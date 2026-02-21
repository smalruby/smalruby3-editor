import Blocks from '@smalruby/scratch-vm/src/engine/blocks';
import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import RubyGenerator from '../../../../src/lib/ruby-generator';

describe('Ruby Round Trip', () => {
    let converter;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null);
    });

    const expectRoundTrip = async (code, expectedRuby = null) => {
        const result = await converter.targetCodeToBlocks(null, code);
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

    test('operator >=', async () => {
        await expectRoundTrip('1 >= 50');
        await expectRoundTrip('@x >= @y');
        await expectRoundTrip('1.2 >= 3.4');
        await expectRoundTrip('1 + 2 >= 3 * 4');
    });

    test('operator <=', async () => {
        await expectRoundTrip('1 <= 50');
        await expectRoundTrip('@x <= @y');
        await expectRoundTrip('1.2 <= 3.4');
        await expectRoundTrip('1 + 2 <= 3 * 4');
    });

    test('mixed operators', async () => {
        await expectRoundTrip('@x >= @y && @a <= @b');
        await expectRoundTrip('@x >= @y || @a <= @b');
        await expectRoundTrip('!(@x >= @y)');
    });

    test('true / false', async () => {
        await expectRoundTrip('true');
        await expectRoundTrip('false');
        await expectRoundTrip('if true\n  move(10)\nend');
        await expectRoundTrip('if false\n  move(10)\nend');
        await expectRoundTrip('var_x = true');
        await expectRoundTrip('var_x = false');
        await expectRoundTrip('true && false');
        await expectRoundTrip('true || false');
        await expectRoundTrip('!true');
        await expectRoundTrip('!false');
    });

    test('sensing and boolean operators', async () => {
        await expectRoundTrip('touching?("_edge_")');
        await expectRoundTrip('!touching?("_edge_")');
        await expectRoundTrip('if touching?("_edge_")\n  move(10)\nend');
    });

    test('return statement in method', async () => {
        await expectRoundTrip(`
def self.add(a, b)
  return a + b
end
`.trim());

        await expectRoundTrip(`
def self.div(a, b)
  if b == 0
    return 0
  end
  return a / b
end
`.trim());

        await expectRoundTrip(`
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

    test('float literals with integer appearance (x.0) are preserved', async () => {
        await expectRoundTrip('1.0 + 1.0');
        await expectRoundTrip('move(1.0)');
        await expectRoundTrip('move(3435.0)');
        await expectRoundTrip('1.0 + 2.0');
        await expectRoundTrip('273.0 - 1.0');
    });

    test('complex expression with float literals is preserved', async () => {
        await expectRoundTrip('1.0 / ((1.0 / 3435.0) * Math.log(20.0) + 1.0 / 298.0) - 273.0');
    });
});
