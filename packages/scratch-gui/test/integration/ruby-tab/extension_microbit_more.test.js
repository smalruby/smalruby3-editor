import dedent from 'dedent';
import SeleniumHelper from '../../helpers/selenium-helper';
import RubyHelper from '../../helpers/ruby-helper';

const seleniumHelper = new SeleniumHelper();
const {
    getDriver,
    loadUri,
    urlFor
} = seleniumHelper;

const rubyHelper = new RubyHelper(seleniumHelper);
const {
    expectInterconvertBetweenCodeAndRuby
} = rubyHelper;

let driver;

describe('Ruby Tab: Microbit More v2 extension blocks', () => {
    beforeAll(() => {
        driver = getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('Ruby -> Code -> Ruby', async () => {
        await loadUri(urlFor('/'));

        const code = dedent`
            microbit.when_microbit("connected") do
            end

            microbit.when_microbit("disconnected") do
            end

            microbit.when_button_is("A", "down") do
            end

            microbit.when_button_is("B", "click") do
            end

            microbit.button_pressed?("A")

            microbit.button_pressed?("B")

            microbit.when_pin_is("LOGO", "touched") do
            end

            microbit.when_pin_is("P2", "tapped") do
            end

            microbit.when_pin_connected(0) do
            end

            microbit.when_pin_connected(1) do
            end

            microbit.when_pin_connected(2) do
            end

            microbit.pin_is_touched?("LOGO")

            microbit.pin_is_touched?("P2")

            microbit.when("shake") do
            end

            microbit.when("jumped") do
            end

            microbit.when("6G") do
            end

            microbit.when("moved") do
            end

            microbit.when("tilted_any") do
            end

            microbit.when("tilted_front") do
            end

            microbit.when_tilted("any") do
            end

            microbit.when_tilted("front") do
            end

            microbit.when_tilted("back") do
            end

            microbit.when_tilted("left") do
            end

            microbit.when_tilted("right") do
            end

            microbit.when("tilted_back") do
            end

            microbit.when("tilted_left") do
            end

            microbit.when("tilted_right") do
            end

            microbit.tilted?("any")

            microbit.tilted?("front")

            microbit.tilted?("back")

            microbit.tilted?("left")

            microbit.tilted?("right")

            microbit.display_pattern(
              ".1.1.",
              "1.1.1",
              "1...1",
              ".1.1.",
              "..1.."
            )
            microbit.display_pattern(
              "1...1",
              ".1.1.",
              "..1..",
              ".1.1.",
              "1...1"
            )
            microbit.display_text_delay("Hello!", 120)
            microbit.display_text_delay("Test", 60)
            microbit.clear_display

            microbit.light_intensity

            microbit.temperature

            microbit.angle_with_north

            microbit.pitch

            microbit.roll

            microbit.tilt_angle("front")

            microbit.tilt_angle("back")

            microbit.tilt_angle("left")

            microbit.tilt_angle("right")

            microbit.sound_level

            microbit.magnetic_force("absolute")

            microbit.magnetic_force("x")

            microbit.acceleration("x")

            microbit.acceleration("absolute")

            microbit.analog_value("P0")

            microbit.analog_value("P2")

            microbit.set_pin_to_input_pull("P0", "up")
            microbit.set_pin_to_input_pull("P16", "down")

            microbit.is_pin_high?("P0")

            microbit.is_pin_high?("P16")

            microbit.set_digital("P0", "Low")
            microbit.set_digital("P16", "High")
            microbit.set_analog("P0", 0)
            microbit.set_analog("P16", 100)
            microbit.set_servo("P0", 0)
            microbit.set_servo("P16", 100)
            microbit.play_tone(440, 100)
            microbit.play_tone(220, 50)
            microbit.stop_tone
            microbit.listen_event_on("none", "P0")
            microbit.listen_event_on("edge", "P16")

            microbit.when_catch_at_pin("low pulse", "P0") do
            end

            microbit.when_catch_at_pin("rise", "P16") do
            end

            microbit.value_of("low pulse", "P0")

            microbit.value_of("rise", "P16")

            microbit.when_data_received_from_microbit("label-01") do
            end

            microbit.when_data_received_from_microbit("label-02") do
            end

            microbit.data["label-01"]

            microbit.data["label-02"]

            microbit.send_data_to_microbit("data", "label-01")
            microbit.send_data_to_microbit("123456", "label-02")
        `;

        await expectInterconvertBetweenCodeAndRuby(code);
    });
});
