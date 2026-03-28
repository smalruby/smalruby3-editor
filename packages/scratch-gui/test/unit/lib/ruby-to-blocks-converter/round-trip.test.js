import Blocks from '@smalruby/scratch-vm/src/engine/blocks';
import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import RubyGenerator from '../../../../src/lib/ruby-generator';

describe('Ruby Round Trip', () => {
    let converter;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, {version: '2'});
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
            // Lists must also be in variables for variableName/listName lookup
            variables[v.id] = v;
        });

        // Separate global (stage) and instance (sprite) variables
        const stageVars = {};
        const spriteVars = {};
        Object.keys(variables).forEach(id => {
            const v = variables[id];
            if (v.scope === 'global') {
                stageVars[id] = v;
            } else {
                spriteVars[id] = v;
            }
        });

        const stage = {
            id: 'stage-id',
            isStage: true,
            variables: stageVars,
            lookupVariableById: id => stageVars[id],
            lookupVariableByNameAndType: (name, type) => {
                return Object.values(stageVars).find(v => v.name === name && v.type === type);
            }
        };

        const target = {
            id: 'target-id',
            blocks: blocks,
            variables: spriteVars,
            lists: lists,
            comments: converter._context.comments,
            isStage: false,
            // Mocking some methods needed by RubyGenerator or Blocks
            lookupVariableById: id => spriteVars[id] || stageVars[id],
            lookupVariableByNameAndType: (name, type) => {
                return Object.values(spriteVars).find(v => v.name === name && v.type === type) ||
                    Object.values(stageVars).find(v => v.name === name && v.type === type);
            },
            runtime: {
                targets: [stage, null],
                getTargetForStage: () => stage
            }
        };

        RubyGenerator.init({version: '2'});
        RubyGenerator.currentTarget = target;

        const generatedRuby = RubyGenerator.targetToCode(target, {version: '2'});
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

    test('string variable concatenation uses operator_join (regression for #181)', async () => {
        await expectRoundTrip('a = "He"\nb = "llo"\na + b', 'a = "He"\nb = "llo"\n\na + b');
        await expectRoundTrip('a = "He"\na + "llo"', 'a = "He"\n\na + "llo"');
        await expectRoundTrip('a = 1.to_s\na + "!"', 'a = 1.to_s\n\na + "!"');
    });

    test('compound assignment operators (-=, *=, /=, %=)', async () => {
        await expectRoundTrip('@a = 10\n@a -= 1');
        await expectRoundTrip('@a = 10\n@a *= 2');
        await expectRoundTrip('@a = 10\n@a /= 3');
        await expectRoundTrip('@a = 10\n@a %= 4');
    });

    test('string variable += uses operator_join', async () => {
        await expectRoundTrip('@a = "hello"\n@a += "!"');
    });

    test('local variable compound assignment operators', async () => {
        await expectRoundTrip('a = 1\na += 2');
        await expectRoundTrip('a = 1\na -= 3');
        await expectRoundTrip('a = 1\na *= 4');
        await expectRoundTrip('a = 1\na /= 5');
        await expectRoundTrip('a = 1\na %= 6');
    });

    test('return statement in method', async () => {
        await expectRoundTrip(`
def add(a, b)
  return a + b
end
`.trim());

        await expectRoundTrip(`
def div(a, b)
  if b == 0
    return 0
  end
  return a / b
end
`.trim());

        await expectRoundTrip(`
def check(x)
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

    test('unless...end round-trip', async () => {
        await expectRoundTrip(
            'unless touching?("_edge_")\n  move(10)\nend'
        );
    });

    test('unless...else...end round-trip', async () => {
        await expectRoundTrip(
            'unless touching?("_edge_")\n  move(10)\nelse\n  turn_right(180)\nend'
        );
        await expectRoundTrip(
            'unless touching?("_edge_")\n  move(10)\nelse\nend'
        );
        await expectRoundTrip(
            'unless touching?("_edge_")\nelse\n  move(10)\nend'
        );
        await expectRoundTrip(
            'unless touching?("_edge_")\nelse\nend'
        );
    });

    test('if modifier round-trip', async () => {
        await expectRoundTrip('move(10) if true');
        await expectRoundTrip('move(10) if touching?("_edge_")');
    });

    test('unless modifier round-trip', async () => {
        await expectRoundTrip('move(10) unless true');
        await expectRoundTrip('move(10) unless touching?("_edge_")');
    });

    test('-= operator on motion x/y round-trips correctly', async () => {
        await expectRoundTrip('self.x -= 10');
        await expectRoundTrip('self.y -= 10');
        await expectRoundTrip('self.x -= 3.5');
        await expectRoundTrip('self.y -= 3.5');
    });

    test('-= operator on looks size round-trips correctly', async () => {
        await expectRoundTrip('self.size -= 10');
        await expectRoundTrip('self.size -= 5.5');
    });

    test('-= operator on sound volume round-trips correctly', async () => {
        await expectRoundTrip('self.volume -= 10');
        await expectRoundTrip('self.volume -= 2.5');
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

    test('Japanese local variable names round-trip correctly', async () => {
        await expectRoundTrip('価格 = 100');
        await expectRoundTrip('価格 = 100\n売値 = 価格 * 0.7\nputs 売値',
            '価格 = 100\n売値 = 価格 * 0.7\nputs(売値)');
        await expectRoundTrip('ねこ = "にゃー"\nputs ねこ',
            'ねこ = "にゃー"\nputs(ねこ)');
        await expectRoundTrip('スコア = 0\nスコア = スコア + 10');
    });

    test('Japanese local variable compound assignment round-trips correctly', async () => {
        await expectRoundTrip('価格 = 100\n価格 += 10');
        await expectRoundTrip('価格 = 100\n価格 -= 10');
        await expectRoundTrip('価格 = 2\n価格 *= 3');
        await expectRoundTrip('価格 = 100\n価格 /= 2');
        await expectRoundTrip('価格 = 7\n価格 %= 3');
    });

    test('while...end round-trip', async () => {
        await expectRoundTrip(
            'while touching?("_edge_")\n  move(10)\nend'
        );
    });

    test('while with comparison round-trip', async () => {
        await expectRoundTrip(
            '@shikin = 30000\nwhile @shikin >= 0\n  say(@shikin, 1)\n  @shikin = @shikin - 5080\nend'
        );
    });

    describe('variable as condition (@ruby:variable: round-trip)', () => {
        test('while with instance variable', async () => {
            await expectRoundTrip('while @game_on\n  move(10)\nend');
        });

        test('until with instance variable', async () => {
            await expectRoundTrip('until @done\n  move(10)\nend');
        });

        test('if with instance variable', async () => {
            await expectRoundTrip('if @flag\n  move(10)\nend');
        });

        test('if with instance variable and else', async () => {
            await expectRoundTrip('if @flag\n  move(10)\nelse\n  turn_right(180)\nend');
        });

        test('unless with instance variable', async () => {
            await expectRoundTrip('unless @flag\n  move(10)\nend');
        });

        test('if_modifier with instance variable', async () => {
            await expectRoundTrip('move(10) if @flag');
        });

        test('global variable as while condition', async () => {
            await expectRoundTrip('while $running\n  move(10)\nend');
        });

        test('complex program with while and boolean variable', async () => {
            await expectRoundTrip(
                'when_flag_clicked do\n  @game_on = true\n  while @game_on\n    go_to("_random_")\n    @game_on = false\n  end\nend'
            );
        });
    });

    describe('class syntax round trip', () => {
        let converterV2;

        beforeEach(() => {
            converterV2 = new RubyToBlocksConverter(null, {version: 2});
        });

        const expectClassRoundTrip = async (code, expectedRuby = null, spriteOptions = {}) => {
            const result = await converterV2.targetCodeToBlocks(null, code);
            expect(converterV2.errors).toHaveLength(0);
            expect(result).toBeTruthy();

            const blocks = new Blocks();
            blocks.forceNoGlow = true;
            Object.keys(converterV2.blocks).forEach(blockId => {
                blocks.createBlock(converterV2.blocks[blockId]);
            });

            const variables = {};
            [converterV2.variables, converterV2._context.localVariables].forEach(vars => {
                Object.values(vars).forEach(v => {
                    variables[v.id] = v;
                });
            });

            const lists = {};
            Object.values(converterV2.lists).forEach(v => {
                lists[v.id] = v;
            });

            const spriteName = spriteOptions.name || 'Sprite1';
            const target = {
                id: 'target-id',
                blocks: blocks,
                variables: variables,
                lists: lists,
                comments: converterV2._context.comments,
                isStage: false,
                sprite: {name: spriteName, costumes: []},
                x: spriteOptions.x || 0,
                y: spriteOptions.y || 0,
                direction: spriteOptions.direction || 90,
                visible: spriteOptions.visible !== false,
                size: spriteOptions.size || 100,
                currentCostume: spriteOptions.currentCostume || 0,
                rotationStyle: spriteOptions.rotationStyle || 'all around',
                lookupVariableById: id => variables[id],
                lookupVariableByNameAndType: (name, type) => {
                    return Object.values(variables).find(v => v.name === name && v.type === type);
                }
            };

            // Set up runtime.targets mock
            const stage = {isStage: true};
            target.runtime = {targets: [stage, target]};

            RubyGenerator.currentTarget = target;

            const generatedRuby = RubyGenerator.targetToCode(target, {version: '2'});
            expect(generatedRuby.trim()).toEqual((expectedRuby || code).trim());
        };

        test('basic class Sprite1 round trip', async () => {
            await expectClassRoundTrip(
                `class Sprite1\n  when_flag_clicked do\n    move(10)\n  end\nend`
            );
        });

        test('class Cat round trip', async () => {
            await expectClassRoundTrip(
                `class Cat\n  when_flag_clicked do\n    move(10)\n  end\nend`,
                null,
                {name: 'Cat'}
            );
        });

        test('class with set_name round trip', async () => {
            await expectClassRoundTrip(
                `class Sprite1\n  set_name "ネコ"\n\n  when_flag_clicked do\n    move(10)\n  end\nend`,
                null,
                {name: 'ネコ'}
            );
        });

        test('class with set_x and set_y round trip', async () => {
            await expectClassRoundTrip(
                `class Sprite1\n  set_x 100\n  set_y -50\n\n  when_flag_clicked do\n    move(10)\n  end\nend`,
                null,
                {x: 100, y: -50}
            );
        });

        test('class with name and set_x round trip', async () => {
            await expectClassRoundTrip(
                `class Cat\n  set_x 90\n\n  when_flag_clicked do\n    move(10)\n  end\nend`,
                null,
                {name: 'Cat', x: 90}
            );
        });

        test('class Cat with set_name round trip preserves class name', async () => {
            await expectClassRoundTrip(
                `class Cat\n  set_name "ネコ"\n\n  when_flag_clicked do\n    move(10)\n  end\nend`,
                null,
                {name: 'ネコ'}
            );
        });

        test('class Cat with set_name and set_x round trip', async () => {
            await expectClassRoundTrip(
                `class Cat\n  set_name "ネコ"\n  set_x 100\n\n  when_flag_clicked do\n    move(10)\n  end\nend`,
                null,
                {name: 'ネコ', x: 100}
            );
        });

        test('class without set_xxx does not output attributes', async () => {
            // Even though sprite has non-default x,y, they should NOT appear
            // because the class had no set_xxx calls (comment is @ruby:class)
            await expectClassRoundTrip(
                `class Sprite1\n  when_flag_clicked do\n    move(10)\n  end\nend`,
                null,
                {x: 100, y: -50}
            );
        });

        test('class with only set_name round trip', async () => {
            await expectClassRoundTrip(
                `class Sprite1\n  set_name "ネコ"\nend`,
                `class Sprite1\n  set_name "ネコ"\nend`,
                {name: 'ネコ'}
            );
        });

        test('class with only set_x and set_y round trip', async () => {
            await expectClassRoundTrip(
                `class Sprite1\n  set_x 100\n  set_y -50\nend`,
                `class Sprite1\n  set_x 100\n  set_y -50\nend`,
                {x: 100, y: -50}
            );
        });

        test('class with all set_xxx only round trip', async () => {
            // currentCostume is 0-based internally, generator outputs 1-based (currentCostume + 1)
            await expectClassRoundTrip(
                `class Sprite1\n  set_name "ネコ"\n  set_x 100\n  set_y -50\n  set_direction 180\n  set_visible false\n  set_size 50\n  set_current_costume 3\n  set_rotation_style "left-right"\nend`,
                `class Sprite1\n  set_name "ネコ"\n  set_x 100\n  set_y -50\n  set_direction 180\n  set_visible false\n  set_size 50\n  set_current_costume 3\n  set_rotation_style "left-right"\nend`,
                {name: 'ネコ', x: 100, y: -50, direction: 180, visible: false, size: 50, currentCostume: 2, rotationStyle: 'left-right'}
            );
        });
    });

    describe('array syntax round trip', () => {
        test('push via method call', async () => {
            await expectRoundTrip('$a.push("hello")');
        });

        test('push via << operator', async () => {
            await expectRoundTrip('$a << "hello"', '$a.push("hello")');
        });

        test('delete_at with 0-indexed', async () => {
            await expectRoundTrip('$a.delete_at(0)');
        });

        test('clear', async () => {
            await expectRoundTrip('$a.clear');
        });

        test('insert with 0-indexed', async () => {
            await expectRoundTrip('$a.insert(0, "thing")');
        });

        test('replace item with 0-indexed', async () => {
            await expectRoundTrip('$a[0] = "thing"');
        });

        test('item access with 0-indexed', async () => {
            await expectRoundTrip('$a[0]');
        });

        test('index method', async () => {
            // Parentheses from operator_subtract wrapper (valid Ruby)
            await expectRoundTrip('$a.index("thing")', '($a.index("thing"))');
        });

        test('length', async () => {
            await expectRoundTrip('$a.length');
        });

        test('include?', async () => {
            await expectRoundTrip('$a.include?("thing")');
        });

        test('array literal assignment', async () => {
            await expectRoundTrip('$a = [1, 2, 3]');
        });

        test('empty array literal', async () => {
            await expectRoundTrip('$a = []');
        });

        test('instance variable array operations', async () => {
            await expectRoundTrip('@items.push("apple")');
            await expectRoundTrip('@items[0]');
            await expectRoundTrip('@items.length');
        });

        test('delete_at(-1) round-trips as last', async () => {
            await expectRoundTrip('$a.delete_at(-1)');
        });

        test('empty? method', async () => {
            await expectRoundTrip('$a.empty?');
        });

        test('show_list and hide_list', async () => {
            await expectRoundTrip('show_list("@items")');
            await expectRoundTrip('hide_list("@items")');
        });
    });

    test('symbol .to_s round-trip', async () => {
        await expectRoundTrip('say(:foo.to_s)');
        await expectRoundTrip('say(:bar_baz.to_s)');
    });

    test('symbol variable assignment round-trip', async () => {
        await expectRoundTrip('$a = :foo');
        await expectRoundTrip('@x = :bar');
        await expectRoundTrip('a = :baz');
    });

    test('symbol comparison round-trip', async () => {
        await expectRoundTrip(':foo == :bar');
    });

    test('symbol say implicit round-trip', async () => {
        await expectRoundTrip('say(:foo)');
        await expectRoundTrip('think(:foo)');
    });

    test('symbol variable say round-trip', async () => {
        await expectRoundTrip('$a = :foo\nsay($a)');
        await expectRoundTrip('$a = :foo\nthink($a)');
    });
});
