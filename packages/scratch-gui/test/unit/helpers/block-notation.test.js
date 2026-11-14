import dedent from 'dedent';
import {
    buildBlocks,
    normalizeBlockNotation,
    parseBlockNotation,
    printBlockNotation,
    readBlocks,
} from './block-notation';
import { makeSpriteTarget, makeStageTarget } from './ruby-roundtrip-helper';

const num = (value) => ({ opcode: 'math_number', fields: { NUM: { value } }, inputs: {}, shadow: true });
const text = (value) => ({ opcode: 'text', fields: { TEXT: { value } }, inputs: {}, shadow: true });

describe('block notation', () => {
    describe('parseBlockNotation', () => {
        test('a block with a number input', () => {
            expect(parseBlockNotation('motion_movesteps(STEPS: 10)')).toEqual({
                scripts: [{ opcode: 'motion_movesteps', fields: {}, inputs: { STEPS: num('10') } }],
                targetComments: [],
            });
        });

        test('a block without parentheses, and negative and decimal numbers', () => {
            const { scripts } = parseBlockNotation('motion_ifonedgebounce\nmotion_changexby(DX: -3.5)');
            expect(scripts[0].opcode).toBe('motion_ifonedgebounce');
            expect(scripts[0].next.inputs.DX).toEqual(num('-3.5'));
        });

        test('statements in sequence, by new line or `;`', () => {
            const { scripts } = parseBlockNotation('event_whenflagclicked\nmotion_movesteps(STEPS: 1); looks_hide');
            expect(scripts).toHaveLength(1);
            expect(scripts[0].opcode).toBe('event_whenflagclicked');
            expect(scripts[0].next.opcode).toBe('motion_movesteps');
            expect(scripts[0].next.next.opcode).toBe('looks_hide');
        });

        test('a blank line starts a new script', () => {
            const { scripts } = parseBlockNotation('looks_show\n\n\nlooks_hide');
            expect(scripts.map((s) => s.opcode)).toEqual(['looks_show', 'looks_hide']);
            expect(scripts[0].next).toBeUndefined();
        });

        test('a C-shaped block, its substack and the blocks after it', () => {
            const { scripts } = parseBlockNotation(dedent`
                control_repeat(TIMES: 3) {
                  looks_say(MESSAGE: "hi")

                  looks_hide
                }
                looks_show
            `);
            const repeat = scripts[0];
            expect(repeat.inputs.TIMES).toEqual(num('3'));
            expect(repeat.inputs.SUBSTACK.opcode).toBe('looks_say');
            expect(repeat.inputs.SUBSTACK.inputs.MESSAGE).toEqual(text('hi'));
            expect(repeat.inputs.SUBSTACK.next.opcode).toBe('looks_hide');
            expect(repeat.next.opcode).toBe('looks_show');
        });

        test('if/else: two substacks, an empty one has no input', () => {
            const { scripts } = parseBlockNotation('control_if_else(CONDITION: sensing_mousedown) {} { looks_hide }');
            expect(scripts[0].inputs.CONDITION.opcode).toBe('sensing_mousedown');
            expect(scripts[0].inputs.SUBSTACK).toBeUndefined();
            expect(scripts[0].inputs.SUBSTACK2.opcode).toBe('looks_hide');
        });

        test('a stack in a named input', () => {
            const { scripts } = parseBlockNotation('foo_c(BODY: { looks_show; looks_hide })');
            expect(scripts[0].inputs.BODY.opcode).toBe('looks_show');
            expect(scripts[0].inputs.BODY.next.opcode).toBe('looks_hide');
        });

        test('nested reporters and booleans', () => {
            const { scripts } = parseBlockNotation(
                'control_if(CONDITION: operator_gt(OPERAND1: operator_add(NUM1: 1, NUM2: 2), OPERAND2: 3))',
            );
            const gt = scripts[0].inputs.CONDITION;
            expect(gt.opcode).toBe('operator_gt');
            expect(gt.inputs.OPERAND1.opcode).toBe('operator_add');
            expect(gt.inputs.OPERAND1.inputs.NUM2).toEqual(num('2'));
            expect(gt.inputs.OPERAND2).toEqual(num('3'));
        });

        test('fields, and menus as shadow blocks', () => {
            const { scripts } = parseBlockNotation(
                'motion_setrotationstyle(STYLE = "left-right")\nmotion_goto(TO: motion_goto_menu(TO = "_random_"))',
            );
            expect(scripts[0].fields).toEqual({ STYLE: { value: 'left-right' } });
            expect(scripts[0].inputs).toEqual({});
            const menu = scripts[0].next.inputs.TO;
            expect(menu).toEqual({
                opcode: 'motion_goto_menu',
                fields: { TO: { value: '_random_' } },
                inputs: {},
                shadow: true,
            });
        });

        test('variables and lists by name', () => {
            const { scripts } = parseBlockNotation(
                'data_setvariableto(VARIABLE = $score, VALUE: @x)\ndata_addtolist(LIST = @"my list", ITEM: "a")',
            );
            expect(scripts[0].fields.VARIABLE).toEqual({ variable: { scope: '$', name: 'score' } });
            expect(scripts[0].inputs.VALUE).toEqual({
                opcode: 'data_variable',
                fields: { VARIABLE: { variable: { scope: '@', name: 'x' } } },
                inputs: {},
            });
            expect(scripts[0].next.fields.LIST).toEqual({ variable: { scope: '@', name: 'my list' } });
        });

        test('block comments and sprite comments', () => {
            const { scripts, targetComments } = parseBlockNotation(dedent`
                #"@ruby:class:Cat"
                motion_turnright(DEGREES: 10) #"@ruby:operator:+="
                looks_say(MESSAGE: @_a_1_ #"@ruby:lvar:a:1")
            `);
            expect(targetComments).toEqual(['@ruby:class:Cat']);
            expect(scripts[0].comment).toBe('@ruby:operator:+=');
            expect(scripts[0].next.inputs.MESSAGE.comment).toBe('@ruby:lvar:a:1');
        });

        test('arguments over several lines', () => {
            const { scripts } = parseBlockNotation('operator_add(\n  NUM1: 1,\n  NUM2: 2\n)');
            expect(Object.keys(scripts[0].inputs)).toEqual(['NUM1', 'NUM2']);
        });

        test.each([
            ['motion_movesteps(STEPS 10)', /expected `:` \(input\) or `=` \(field\)/],
            ['motion_movesteps(STEPS: 10', /expected `,` or `\)`/],
            ['looks_say(MESSAGE: "hi)', /unterminated string/],
            ['looks_hide looks_show', /expected a new line or `;`/],
            ['motion_setx(X = motion_xposition)', /field X needs/],
            ['looks_hide }', /unexpected `}`/],
            ['looks_hide #hi', /`#` must be followed by a string/],
        ])('reports a mistake in %s', (source, message) => {
            expect(() => parseBlockNotation(source)).toThrow(message);
        });
    });

    describe('printBlockNotation', () => {
        test('prints the canonical form: sorted arguments, fields first, substacks indented', () => {
            const source = 'control_if_else(CONDITION: operator_lt(OPERAND2: 1, OPERAND1: $x)) {} {looks_hide}';
            expect(normalizeBlockNotation(source)).toBe(dedent`
                control_if_else(CONDITION: operator_lt(OPERAND1: $x, OPERAND2: 1)) {} {
                  looks_hide
                }
            `);
        });

        test('number shadows of every math opcode print as the number', () => {
            const parsed = parseBlockNotation('control_repeat(TIMES: math_whole_number(NUM = 3))');
            expect(printBlockNotation(parsed)).toBe('control_repeat(TIMES: 3)');
        });

        test('a number shadow without a number prints in full', () => {
            expect(normalizeBlockNotation('motion_movesteps(STEPS: math_number(NUM = ""))')).toBe(
                'motion_movesteps(STEPS: math_number(NUM = ""))',
            );
        });

        test('comments, sprite comments, names with spaces and escapes', () => {
            // Joined lines, not dedent: dedent would read the backslashes as escapes.
            const source = [
                'looks_say(MESSAGE: "a\\"b") #"c\\nd"',
                '',
                '#"@ruby:class:Cat"',
                'data_showvariable(VARIABLE = $"my var")',
            ].join('\n');
            const parsed = parseBlockNotation(source);
            expect(parsed.scripts[0].inputs.MESSAGE.fields.TEXT.value).toBe('a"b');
            expect(parsed.scripts[0].comment).toBe('c\nd');
            expect(printBlockNotation(parsed)).toBe(
                [
                    '#"@ruby:class:Cat"',
                    '',
                    'looks_say(MESSAGE: "a\\"b") #"c\\nd"',
                    '',
                    'data_showvariable(VARIABLE = $"my var")',
                ].join('\n'),
            );
        });

        test('printing is stable', () => {
            const source = dedent`
                event_whenflagclicked
                control_forever {
                  control_if(CONDITION: sensing_keypressed(KEY_OPTION: sensing_keyoptions(KEY_OPTION = "space"))) {
                    motion_movesteps(STEPS: 10)
                  }
                }
            `;
            const once = normalizeBlockNotation(source);
            expect(once).toBe(source);
            expect(normalizeBlockNotation(once)).toBe(once);
        });
    });

    describe('buildBlocks and readBlocks', () => {
        test('blocks written to a sprite read back the same', () => {
            const source = dedent`
                #"@ruby:class:Cat"

                event_whenflagclicked
                data_setvariableto(VARIABLE = $score, VALUE: 0)
                control_repeat(TIMES: 3) {
                  data_changevariableby(VARIABLE = $score, VALUE: @step)
                  data_addtolist(LIST = @items, ITEM: "a") #"note"
                }
                event_broadcast(BROADCAST_INPUT: event_broadcast_menu(BROADCAST_OPTION = "go"))

                looks_say(MESSAGE: operator_join(STRING1: "x", STRING2: $score))
            `;
            const { target, stage } = makeSpriteTarget();
            buildBlocks(source, target, stage);
            expect(printBlockNotation(readBlocks(target, stage))).toBe(normalizeBlockNotation(source));
        });

        test('variables go to the stage for `$` and to the sprite for `@`; lists and messages get their type', () => {
            const { target, stage } = makeSpriteTarget();
            buildBlocks(
                dedent`
                    data_setvariableto(VARIABLE = $g, VALUE: 1)
                    data_setvariableto(VARIABLE = @s, VALUE: @s)
                    data_addtolist(LIST = @l, ITEM: 1)
                    event_broadcast(BROADCAST_INPUT: event_broadcast_menu(BROADCAST_OPTION = "go"))
                `,
                target,
                stage,
            );
            const kinds = (t) =>
                Object.values(t.variables)
                    .map((v) => `${v.name}:${v.type}`)
                    .sort();
            expect(kinds(stage)).toEqual(['g:', 'go:broadcast_msg']);
            expect(kinds(target)).toEqual(['l:list', 's:']);
        });

        test('shadows: literals and menus are shadow blocks, input.shadow points at them', () => {
            const { target, stage } = makeSpriteTarget();
            buildBlocks(
                'motion_goto(TO: motion_goto_menu(TO = "_random_"))\nmotion_movesteps(STEPS: $x)',
                target,
                stage,
            );
            const blocks = Object.values(target.blocks._blocks);
            const goTo = blocks.find((b) => b.opcode === 'motion_goto');
            const menu = target.blocks.getBlock(goTo.inputs.TO.block);
            expect(menu.shadow).toBe(true);
            expect(goTo.inputs.TO.shadow).toBe(menu.id);
            const move = blocks.find((b) => b.opcode === 'motion_movesteps');
            expect(target.blocks.getBlock(move.inputs.STEPS.block).shadow).toBe(false);
            expect(move.inputs.STEPS.shadow).toBe(null);
        });

        test('on the stage every variable is `$`', () => {
            const { target, stage } = makeStageTarget();
            buildBlocks('data_setvariableto(VARIABLE = @a, VALUE: 1)', target, stage);
            expect(printBlockNotation(readBlocks(target, stage))).toBe('data_setvariableto(VARIABLE = $a, VALUE: 1)');
        });
    });
});
