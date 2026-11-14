/**
 * Motion blocks ⇔ Ruby, as a table (block notation: test/unit/helpers/block-notation.js).
 * It replaces ruby-generator/motion.test.js (generator only, with a mocked valueToCode) and
 * ruby-roundtrip/motion.test.js (one long round trip): each row now checks both directions.
 */
import { defineBlockRubyTable } from '../../helpers/block-ruby-table';

defineBlockRubyTable(
    'Motion blocks ⇔ Ruby',
    [
        { blocks: 'motion_movesteps(STEPS: 10)', ruby: 'move(10)' },
        { blocks: 'motion_turnright(DEGREES: 15)', ruby: 'turn_right(15)' },
        { blocks: 'motion_turnleft(DEGREES: 15)', ruby: 'turn_left(15)' },
        { blocks: 'motion_turnright(DEGREES: 10) #"@ruby:operator:+="', ruby: 'self.direction += 10' },
        { blocks: 'motion_turnright(DEGREES: $x) #"@ruby:operator:+="', ruby: 'self.direction += $x' },
        { blocks: 'motion_turnleft(DEGREES: 10) #"@ruby:operator:-="', ruby: 'self.direction -= 10' },
        { blocks: 'motion_turnleft(DEGREES: $x) #"@ruby:operator:-="', ruby: 'self.direction -= $x' },
        { blocks: 'motion_changexby(DX: 10)', ruby: 'self.x += 10' },
        { blocks: 'motion_changexby(DX: -10)', ruby: 'self.x -= 10' },
        { blocks: 'motion_changexby(DX: -3.5)', ruby: 'self.x -= 3.5' },
        { blocks: 'motion_changexby(DX: 0)', ruby: 'self.x += 0' },
        { blocks: 'motion_changexby(DX: $y)', ruby: 'self.x += $y' },
        { blocks: 'motion_changeyby(DY: 10)', ruby: 'self.y += 10' },
        { blocks: 'motion_changeyby(DY: -10)', ruby: 'self.y -= 10' },
        { blocks: 'motion_changeyby(DY: 0)', ruby: 'self.y += 0' },
        { blocks: 'motion_setx(X: 0)', ruby: 'self.x = 0' },
        { blocks: 'motion_sety(Y: 0)', ruby: 'self.y = 0' },
        { blocks: 'motion_pointindirection(DIRECTION: math_angle(90))', ruby: 'self.direction = 90' },
        { blocks: 'motion_goto(TO: motion_goto_menu(TO = "_random_"))', ruby: 'go_to("_random_")' },
        { blocks: 'motion_goto(TO: motion_goto_menu(TO = "_mouse_"))', ruby: 'go_to("_mouse_")' },
        { blocks: 'motion_goto(TO: motion_goto_menu(TO = "Abby"))', ruby: 'go_to("Abby")' },
        { blocks: 'motion_gotoxy(X: 0, Y: 0)', ruby: 'go_to([0, 0])' },
        {
            blocks: 'motion_glideto(SECS: 1, TO: motion_glideto_menu(TO = "_mouse_"))',
            ruby: 'glide("_mouse_", secs: 1)',
        },
        {
            blocks: 'motion_glideto(SECS: 1, TO: motion_glideto_menu(TO = "_random_"))',
            ruby: 'glide("_random_", secs: 1)',
        },
        { blocks: 'motion_glideto(SECS: 1, TO: motion_glideto_menu(TO = "Abby"))', ruby: 'glide("Abby", secs: 1)' },
        { blocks: 'motion_glidesecstoxy(SECS: 1, X: 0, Y: 0)', ruby: 'glide([0, 0], secs: 1)' },
        {
            blocks: 'motion_pointtowards(TOWARDS: motion_pointtowards_menu(TOWARDS = "_mouse_"))',
            ruby: 'point_towards("_mouse_")',
        },
        {
            blocks: 'motion_pointtowards(TOWARDS: motion_pointtowards_menu(TOWARDS = "Abby"))',
            ruby: 'point_towards("Abby")',
        },
        { blocks: 'motion_ifonedgebounce', ruby: 'bounce_if_on_edge' },
        { blocks: 'motion_setrotationstyle(STYLE = "left-right")', ruby: 'self.rotation_style = "left-right"' },
        { blocks: 'motion_setrotationstyle(STYLE = "don\'t rotate")', ruby: 'self.rotation_style = "don\'t rotate"' },
        { blocks: 'motion_setrotationstyle(STYLE = "all around")', ruby: 'self.rotation_style = "all around"' },
        { blocks: 'motion_xposition', ruby: 'x' },
        { blocks: 'motion_yposition', ruby: 'y' },
        { blocks: 'motion_direction', ruby: 'direction' },
        {
            name: 'several scripts in one target',
            blocks: `
            motion_xposition

            motion_yposition

            motion_direction
        `,
            ruby: `
            x

            y

            direction
        `,
        },
        {
            name: 'statements in sequence and a hat',
            // v1 writes the hat as self.when(:flag_clicked).
            versions: ['2'],
            blocks: `
            event_whenflagclicked
            motion_movesteps(STEPS: 10)
            motion_turnright(DEGREES: 15)
        `,
            ruby: `
            when_flag_clicked do
              move(10)
              turn_right(15)
            end
        `,
        },
    ],
    { versions: ['1', '2'] },
);
