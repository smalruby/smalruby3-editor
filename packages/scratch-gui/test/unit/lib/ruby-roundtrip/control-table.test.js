/**
 * Control blocks ⇔ Ruby, as a table (block notation: test/unit/helpers/block-notation.js).
 * The loops and if/else of ruby-roundtrip/control.test.js moved here, so each now checks
 * both directions; the rest of that file stays as it is.
 */
import { defineBlockRubyTable } from '../../helpers/block-ruby-table';

const EDGE = 'sensing_touchingobject(TOUCHINGOBJECTMENU: sensing_touchingobjectmenu(TOUCHINGOBJECTMENU = "_edge_"))';

defineBlockRubyTable('Control blocks ⇔ Ruby', [
    { blocks: 'control_wait(DURATION: 1)', ruby: 'sleep(1)' },
    { blocks: 'control_wait(DURATION: $x)', ruby: 'sleep($x)' },
    { blocks: `control_wait(DURATION: ${EDGE})`, ruby: 'sleep(touching?("_edge_"))' },
    {
        blocks: 'control_repeat(TIMES: 10) { motion_movesteps(STEPS: 10) }',
        ruby: `
            10.times do
              move(10)
            end
        `,
    },
    {
        blocks: 'control_repeat(TIMES: $x) { motion_movesteps(STEPS: 10) }',
        ruby: `
            $x.times do
              move(10)
            end
        `,
    },
    {
        blocks: 'control_forever { motion_movesteps(STEPS: 10); control_wait(DURATION: 0) }',
        ruby: `
            loop do
              move(10)
              sleep(0)
            end
        `,
    },
    {
        blocks: `control_repeat(TIMES: ${EDGE}) { motion_movesteps(STEPS: 10) }`,
        ruby: `
            touching?("_edge_").times do
              move(10)
            end
        `,
    },
    {
        name: 'if false: no condition, no body',
        blocks: 'control_if',
        ruby: `
            if false
            end
        `,
    },
    {
        name: 'if false with an empty else',
        blocks: 'control_if_else',
        ruby: `
            if false
            else
            end
        `,
    },
    { name: 'wait until false', blocks: 'control_wait_until', ruby: 'wait until false' },
    {
        name: 'until false',
        blocks: 'control_repeat_until { motion_movesteps(STEPS: 10) }',
        ruby: `
            until false
              move(10)
            end
        `,
    },
    {
        name: 'repeat with an empty body',
        blocks: 'control_repeat(TIMES: 3) {}',
        ruby: `
            3.times do
            end
        `,
    },
    {
        blocks: `control_if(CONDITION: ${EDGE}) { motion_turnright(DEGREES: 180) }`,
        ruby: `
            if touching?("_edge_")
              turn_right(180)
            end
        `,
    },
    {
        blocks: `control_if_else(CONDITION: ${EDGE}) { motion_turnright(DEGREES: 180) } { motion_movesteps(STEPS: 10) }`,
        ruby: `
            if touching?("_edge_")
              turn_right(180)
            else
              move(10)
            end
        `,
    },
    {
        name: 'if/else with an empty then',
        blocks: `control_if_else(CONDITION: ${EDGE}) {} { motion_movesteps(STEPS: 10) }`,
        ruby: `
            if touching?("_edge_")
            else
              move(10)
            end
        `,
    },
    {
        name: 'if/else with an empty else',
        blocks: `control_if_else(CONDITION: ${EDGE}) { motion_turnright(DEGREES: 180) } {}`,
        ruby: `
            if touching?("_edge_")
              turn_right(180)
            else
            end
        `,
    },
    { blocks: `control_wait_until(CONDITION: ${EDGE})`, ruby: 'wait until touching?("_edge_")' },
    {
        blocks: `control_repeat_until(CONDITION: ${EDGE}) { motion_movesteps(STEPS: 10) }`,
        ruby: `
            until touching?("_edge_")
              move(10)
            end
        `,
    },
    {
        name: 'nested C-shaped blocks in a hat',
        blocks: `
            event_whenflagclicked
            control_forever {
              control_if(CONDITION: operator_gt(OPERAND1: $x, OPERAND2: "1")) {
                motion_movesteps(STEPS: 10)
              }
            }
        `,
        ruby: `
            when_flag_clicked do
              loop do
                if $x > 1
                  move(10)
                end
              end
            end
        `,
    },
]);
