/**
 * Book code round-trip compatibility tests (v1).
 *
 * These tests verify that code from published Smalruby books survives
 * a Ruby -> Blocks -> Ruby round trip unchanged.
 *
 * Version: v1 only (book code uses v1 API).
 * Related issue: #363
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: Book code compatibility (v1)', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({target, runtime} = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    // --- Motion / Sensing / Looks (no extensions) ---

    test('Program 1: mouse tracking with say', async () => {
        await expectRoundTrip(converter, target, dedent`
            self.when(:flag_clicked) do
              loop do
                point_towards("_mouse_")
                move(10)
                if touching?("_mouse_")
                  say("こんにちは！", 2)
                end
                wait
              end
            end
        `);
    });

    test('Program 2: Mouse1 follows mouse, points at sprite', async () => {
        await expectRoundTrip(converter, target, dedent`
            self.when(:flag_clicked) do
              loop do
                go_to("_mouse_")
                point_towards("スプライト1")
                wait
              end
            end
        `);
    });

    test('Program 3: sprite chases Mouse1', async () => {
        await expectRoundTrip(converter, target, dedent`
            self.when(:flag_clicked) do
              loop do
                point_towards("Mouse1")
                move(10)
                if touching?("Mouse1")
                  say("つかまえた", 2)
                end
                wait
              end
            end
        `);
    });

    // --- Music extension ---

    test('Program 4: drum pattern', async () => {
        await expectRoundTrip(converter, target, dedent`
            self.when(:flag_clicked) do
              2.times do
                play_drum(drum: 1, beats: 0.25)
                play_drum(drum: 1, beats: 0.25)
                play_drum(drum: 1, beats: 0.125)
                play_drum(drum: 1, beats: 0.125)
                rest(0.25)
                wait
              end
              play_drum(drum: 1, beats: 0.25)
              play_drum(drum: 1, beats: 0.25)
              play_drum(drum: 1, beats: 0.25)
              play_drum(drum: 1, beats: 0.25)
              play_drum(drum: 1, beats: 0.25)
              play_drum(drum: 1, beats: 0.125)
              play_drum(drum: 1, beats: 0.125)
              play_drum(drum: 1, beats: 0.25)
              rest(0.25)
            end
        `);
    });

    test('Program 5: instrument setting', async () => {
        await expectRoundTrip(converter, target, dedent`
            self.when(:clicked) do
              self.instrument = 5
            end
        `);
    });

    // --- Lists / Variables ---

    test('Program 6: prefecture quiz with list()', async () => {
        // v1 known incompatibility: list("$xxx")[index] is accepted by the converter
        // but the generator outputs $xxx[index - 1] (0-based array access).
        // TODO: #363 - make v1 generator preserve list() function format
        await expectRoundTrip(converter, target, dedent`
            self.when(:flag_clicked) do
              loop do
                $えらんだけんめい = rand(1..18)
                ask(list("$けんめい")[$えらんだけんのばんごう] + "のけんちょうしょざいちのけんはどこかな")
                if answer == list("$けんちょうしょざいち")[$えらんだけんのばんごう]
                  say("正解！", 2)
                else
                  say(list("$けんちょうしょざいち")[$えらんだけんのばんごう] + "がせいかいだよ", 2)
                end
                wait
              end
            end
        `, dedent`
            self.when(:flag_clicked) do
              loop do
                $えらんだけんめい = rand(1..18)
                ask($けんめい[$えらんだけんのばんごう - 1] + "のけんちょうしょざいちのけんはどこかな")
                if answer == $けんちょうしょざいち[$えらんだけんのばんごう - 1]
                  say("正解！", 2)
                else
                  say($けんちょうしょざいち[$えらんだけんのばんごう - 1] + "がせいかいだよ", 2)
                end
                wait
              end
            end
        `);
    });

    // --- Looks only ---

    test('Program 7: Matsue Castle introduction', async () => {
        await expectRoundTrip(converter, target, dedent`
            self.when(:clicked) do
              say("私は松江城（まつえじょう）だ", 2)
              say("関ヶ原の戦いの後に作られた城だ", 2)
              say("天守閣（てんしゅかく）は国宝にも指定されている", 2)
              say("5城のうちの一つであるぞ", 2)
              say("建て替えられたことがなく、当時もままなのだ", 2)
              say("ぜひ一度我が元へ来るがよい", 2)
            end
        `);
    });

    // --- Key events / Properties ---

    test('Program 8: up/down arrow key movement', async () => {
        // Book uses `self.y += -10` but the system normalizes to `self.y -= 10`
        await expectRoundTrip(converter, target, dedent`
            self.when(:key_pressed, "up arrow") do
              self.y += 10
            end

            self.when(:key_pressed, "down arrow") do
              self.y += -10
            end
        `, dedent`
            self.when(:key_pressed, "up arrow") do
              self.y += 10
            end

            self.when(:key_pressed, "down arrow") do
              self.y -= 10
            end
        `);
    });

    // --- Arrow shooting game ---

    test('Program 9: Arrow1 shoots on space (single)', async () => {
        await expectRoundTrip(converter, target, dedent`
            self.when(:flag_clicked) do
              hide
            end

            self.when(:key_pressed, "space") do
              go_to("スプライト1")
              show
              until touching?("_edge_")
                self.x += 10
                wait
              end
              hide
            end
        `);
    });

    test('Program 10: sprite1 moves until hit by Arrow1', async () => {
        await expectRoundTrip(converter, target, dedent`
            self.when(:flag_clicked) do
              show
              self.rotation_style = "left-right"
              until touching?("Arrow1")
                move(10)
                bounce_if_on_edge
                wait
              end
              hide
            end
        `);
    });

    test('Program 11: Arrow1 with clone', async () => {
        await expectRoundTrip(converter, target, dedent`
            self.when(:flag_clicked) do
              hide
            end

            self.when(:key_pressed, "space") do
              create_clone("_myself_")
            end

            self.when(:start_as_a_clone) do
              go_to("スプライト1")
              show
              until touching?("_edge_")
                self.x += 10
                wait
              end
              hide
            end
        `);
    });

    test('Program 12: sprite1 spawns clones, moves until hit', async () => {
        await expectRoundTrip(converter, target, dedent`
            self.when(:flag_clicked) do
              hide
              loop do
                sleep(1)
                create_clone("_myself_")
                wait
              end
            end

            self.when(:start_as_a_clone) do
              go_to([149, rand(-217..186)])
              show
              self.rotation_style = "left-right"
              until touching?("Arrow1")
                move(10)
                bounce_if_on_edge
                wait
              end
              delete_this_clone
            end
        `);
    });

    // --- Pen extension ---

    test('Program 13: triangle with pen', async () => {
        await expectRoundTrip(converter, target, dedent`
            self.when(:flag_clicked) do
              pen_down
              move(50)
              turn_left(180)
              turn_right(60)
              move(50)
              turn_left(180)
              turn_right(60)
              move(50)
              turn_left(180)
              turn_right(60)
            end
        `);
    });

    test('Program 14: pen clear', async () => {
        await expectRoundTrip(converter, target, dedent`
            self.when(:flag_clicked) do
              pen_clear
            end
        `);
    });

    test('Program 15: triangle with loop', async () => {
        await expectRoundTrip(converter, target, dedent`
            self.when(:flag_clicked) do
              pen_down
              3.times do
                move(50)
                turn_left(180)
                turn_right(60)
                wait
              end
            end
        `);
    });

    test('Program 16: square', async () => {
        await expectRoundTrip(converter, target, dedent`
            self.when(:flag_clicked) do
              pen_down
              4.times do
                move(50)
                turn_left(180)
                turn_right(90)
                wait
              end
            end
        `);
    });

    test('Program 17: hexagon', async () => {
        await expectRoundTrip(converter, target, dedent`
            self.when(:flag_clicked) do
              pen_down
              6.times do
                move(50)
                turn_left(180)
                turn_right(120)
                wait
              end
            end
        `);
    });

    test('Program 18: heptagon', async () => {
        // The outer parens around `(180 * (7 - 2))` are dropped on
        // round-trip because the generator now omits unnecessary parens
        // for the LEFT side of left-associative `*` / `/` (Issue #640
        // Phase 1). `180 * (7 - 2) / 7` is semantically identical:
        // both forms parse as `((180 * (7 - 2)) / 7)` left-to-right.
        await expectRoundTrip(
            converter,
            target,
            dedent`
                self.when(:flag_clicked) do
                  pen_down
                  7.times do
                    move(50)
                    turn_left(180)
                    turn_right((180 * (7 - 2)) / 7)
                    wait
                  end
                end
            `,
            dedent`
                self.when(:flag_clicked) do
                  pen_down
                  7.times do
                    move(50)
                    turn_left(180)
                    turn_right(180 * (7 - 2) / 7)
                    wait
                  end
                end
            `,
        );
    });

    test('Program 19: N-gon with variable', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                self.when(:flag_clicked) do
                  pen_down
                  $へんのかず = 5
                  $へんのかず.times do
                    move(70)
                    turn_right(180)
                    turn_right((180 * ($へんのかず - 2)) / $へんのかず)
                    wait
                  end
                end
            `,
            dedent`
                self.when(:flag_clicked) do
                  pen_down
                  $へんのかず = 5
                  $へんのかず.times do
                    move(70)
                    turn_right(180)
                    turn_right(180 * ($へんのかず - 2) / $へんのかず)
                    wait
                  end
                end
            `,
        );
    });

    test('Program 20: nested N-gon with color change', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                self.when(:flag_clicked) do
                  pen_down
                  $へんのかず = 8
                  $へんのかず.times do
                    $へんのかず.times do
                      self.color += 10
                      move(70)
                      turn_left(180)
                      turn_right((180 * ($へんのかず - 2)) / $へんのかず)
                      wait
                    end
                    turn_left(180)
                    turn_right((180 * ($へんのかず - 2)) / $へんのかず)
                    wait
                  end
                end
            `,
            dedent`
                self.when(:flag_clicked) do
                  pen_down
                  $へんのかず = 8
                  $へんのかず.times do
                    $へんのかず.times do
                      self.color += 10
                      move(70)
                      turn_left(180)
                      turn_right(180 * ($へんのかず - 2) / $へんのかず)
                      wait
                    end
                    turn_left(180)
                    turn_right(180 * ($へんのかず - 2) / $へんのかず)
                    wait
                  end
                end
            `,
        );
    });

    // --- micro:bit ---

    test('Program 21: micro:bit hello', async () => {
        await expectRoundTrip(converter, target, dedent`
            self.when(:flag_clicked) do
              microbit.display_text("Hello!")
            end
        `);
    });

    test('Program 22: micro:bit heart on jump', async () => {
        await expectRoundTrip(converter, target, dedent`
            self.when(:microbit_gesture, "jumped") do
              microbit.display(
                ".1.1.",
                "1.1.1",
                "1...1",
                ".1.1.",
                "..1.."
              )
              sleep(1)
              microbit.clear_display
            end
        `);
    });

    test('Program 23: darumasan ga koronda', async () => {
        await expectRoundTrip(converter, target, dedent`
            self.when(:flag_clicked) do
              self.rotation_style = "left-right"
              loop do
                self.direction = 90
                say("だるまさんがころんだ", 4)
                self.direction = -90
                sleep(2)
                wait
              end
            end

            self.when(:microbit_gesture, "shaken") do
              if direction == -90
                say("うごいたなあ", 2)
                stop("all")
              end
            end
        `);
    });

    test('Program 24: micro:bit shake to move', async () => {
        await expectRoundTrip(converter, target, dedent`
            self.when(:microbit_gesture, "shaken") do
              move(5)
            end

            self.when(:flag_clicked) do
              go_to([-180, 0])
            end
        `);
    });
});
