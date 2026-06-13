/**
 * Ruby v2 roundtrip for Koshien list-argument blocks (#743).
 *
 * In v2, lists are plain global array variables ($名前), not list("$名前").
 * calc_route / calc_goal_route / locate_objects must round-trip with $名前 syntax.
 */
import dedent from 'dedent';
import {makeSpriteTarget, makeConverter, setupRubyGenerator, expectRoundTrip} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip (v2): Koshien list-argument blocks', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({target, runtime} = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime, {version: 2});
    });

    test('calc_route / calc_goal_route / locate_objects use $array syntax in v2', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                koshien.connect_game(name: "player1")
                koshien.calc_route(result: $最短経路)
                koshien.calc_route(result: $最短経路, src: "4:5", dst: "6:7", except_cells: $通らない座標)
                koshien.locate_objects(result: $地形, sq_size: 3, cent: "1:2", objects: "ABCD")
                koshien.move_to($最短経路[1])
                koshien.turn_over
            `,
            null,
            {version: 2}
        );
    });
});
