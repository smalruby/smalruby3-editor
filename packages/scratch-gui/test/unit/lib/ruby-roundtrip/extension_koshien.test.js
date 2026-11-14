/**
 * Unit test replacing test/integration/ruby-tab/extension_koshien.test.js
 */
import dedent from 'dedent';
import log from '../../../../src/lib/log';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip,
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: Koshien extension blocks', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    test('Ruby -> Code -> Ruby', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            koshien.connect_game(name: "player1")
            koshien.get_map_area("0:1")
            koshien.move_to("2:3")
            koshien.calc_route(result: list("$最短経路"))
            koshien.calc_route(result: list("$最短経路"), src: "4:5", dst: "6:7", except_cells: list("$通らない座標"))
            koshien.calc_route(result: nil, src: "4:5", dst: "6:7", except_cells: nil)
            koshien.set_dynamite("8:9")
            koshien.set_bomb("10:11")
            $マップ情報 = koshien.map("12:13")
            $すべてのマップ情報 = koshien.map_all
            $マップ情報 = koshien.map_from("14:0", $すべてのマップ情報)
            $マップ情報 = koshien.map_from("14:0", nil)
            koshien.locate_objects(result: list("$地形・アイテム"), sq_size: 3, cent: "1:2", objects: "ABCD")
            koshien.locate_objects(result: nil, sq_size: 3, cent: "1:2", objects: "ABCD")
            koshien.turn_over
            koshien.set_message("こんにちは")

            koshien.position_of_x("0:1")

            koshien.position_of_y("2:3")

            koshien.position(4, 5)

            koshien.player

            koshien.player_x

            koshien.player_y

            koshien.other_player

            koshien.other_player_x

            koshien.other_player_y

            koshien.goal

            koshien.goal_x

            koshien.goal_y

            koshien.enemy

            koshien.enemy_x

            koshien.enemy_y

            koshien.object("unknown")

            koshien.object("space")

            koshien.object("wall")

            koshien.object("storehouse")

            koshien.object("goal")

            koshien.object("water")

            koshien.object("breakable wall")

            koshien.object("tea")

            koshien.object("sweets")

            koshien.object("coin")

            koshien.object("dolphin")

            koshien.object("sword")

            koshien.object("poison")

            koshien.object("snake")

            koshien.object("trap")

            koshien.object("bomb")
        `,
        );
    });

    // Issue #1722: the value blocks return ORDER_FUNCTION_CALL, so putting one into another block's
    // input logs no "Expecting valid order" error, and an index or a receiver gets no extra parentheses.
    test('value blocks inside other blocks keep the Ruby and log no order error', async () => {
        const errorSpy = jest.spyOn(log, 'error').mockImplementation(() => {});
        try {
            await expectRoundTrip(
                converter,
                target,
                dedent`
                $a = koshien.map(koshien.position(1, 2))
                $b = koshien.position_of_x(koshien.goal) + koshien.player_x
                say(koshien.object("wall"))
                $c = koshien.map_all[0]
                $d = koshien.map_from(koshien.enemy, $b)
                $e = koshien.player_y.to_s
                $f = -koshien.player_x
                $g = koshien.map_all.length
                `,
            );
            const orderErrors = errorSpy.mock.calls.filter(([message]) =>
                String(message).includes('Expecting valid order'),
            );
            expect(orderErrors).toEqual([]);
        } finally {
            errorSpy.mockRestore();
        }
    });
});
