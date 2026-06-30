/**
 * Ruby v2 roundtrip for Koshien (#743).
 *
 * v2 では:
 * - ゲーム接続はイベント hat `koshien.when_connect_game(name:) do ... end` で表現し、
 *   AI 本体を do...end のサブスタックに包む（クラス表現の中に置けるようにする）。
 * - フラットな `koshien.connect_game(name:)` はエラー（v1 専用）。
 * - リストはグローバル配列変数 `$名前`（`list("$名前")` ではない）。
 *
 * v1 は従来どおりフラット出力（後方互換）。
 */
import dedent from 'dedent';
import {makeSpriteTarget, makeConverter, setupRubyGenerator, expectRoundTrip} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip (v2): Koshien when_connect_game + list syntax', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({target, runtime} = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime, {version: 2});
    });

    test('when_connect_game wraps the AI body; list args use $array syntax', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                koshien.when_connect_game(name: "player1") do
                  koshien.get_map_area("0:0")
                  koshien.calc_route(result: $最短経路)
                  koshien.calc_route(result: $最短経路, src: "4:5", dst: "6:7", except_cells: $通らない座標)
                  koshien.locate_objects(result: $地形, sq_size: 3, cent: "1:2", objects: "ABCD")
                  koshien.move_to($最短経路[1])
                  koshien.turn_over
                end
            `,
            null,
            {version: 2}
        );
    });

    test('flat koshien.connect_game is an error in v2', async () => {
        const result = await converter.targetCodeToBlocks(
            target,
            'koshien.connect_game(name: "player1")'
        );
        expect(result).toBeFalsy();
        expect(converter.errors.length).toBeGreaterThan(0);
        expect(converter.errors[0].text).toMatch(/when_connect_game/);
    });
});

describe('Ruby Roundtrip (v1): Koshien stays flat (backward compatible)', () => {
    test('flat koshien.connect_game parses and round-trips in v1', async () => {
        const {target, runtime} = makeSpriteTarget();
        setupRubyGenerator();
        const converter = makeConverter(target, runtime, {version: 1});
        await expectRoundTrip(
            converter,
            target,
            dedent`
                koshien.connect_game(name: "player1")
                koshien.get_map_area("0:0")
                koshien.turn_over
            `,
            null,
            {version: 1}
        );
    });

    // #839: v1 list element read must round-trip using list("$name")[1-indexed],
    // not the v2 array syntax $name[0-indexed] (which the v1 converter rejects).
    test('list element read round-trips with list() syntax (1-indexed)', async () => {
        const {target, runtime} = makeSpriteTarget();
        setupRubyGenerator();
        const converter = makeConverter(target, runtime, {version: 1});
        await expectRoundTrip(
            converter,
            target,
            dedent`
                koshien.connect_game(name: "player1")
                koshien.calc_route(result: list("$最短経路"))
                koshien.move_to(list("$最短経路")[2])
                koshien.turn_over
            `,
            null,
            {version: 1}
        );
    });
});
