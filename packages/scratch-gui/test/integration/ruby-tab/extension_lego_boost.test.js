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

describe('Ruby Tab: LEGO BOOST extension blocks', () => {
    beforeAll(() => {
        driver = getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('Ruby -> Code -> Ruby', async () => {
        await loadUri(urlFor('/'));

        const code = dedent`
            boost_motor_turn_on_for("A", 1)
            boost_motor_turn_on_for("B", 1)
            boost_motor_turn_on_for("C", 1)
            boost_motor_turn_on_for("D", 1)
            boost_motor_turn_on_for("AB", 1)
            boost_motor_turn_on_for("ABCD", 1)
            boost_motor_turn_this_way_for("A", 1)
            boost_motor_turn_on_for("A")
            boost_motor_turn_off_for("A")
            boost_motor_set_power_for("ABCD", 100)
            boost_motor_set_direction_for("A", "this way")
            boost_motor_set_direction_for("A", "that way")
            boost_motor_set_direction_for("A", "reverse")

            boost_motor_get_position("A")

            self.when(:boost_color, "any") do
            end

            self.when(:boost_color, "red") do
            end

            self.when(:boost_color, "blue") do
            end

            self.when(:boost_color, "green") do
            end

            self.when(:boost_color, "yellow") do
            end

            self.when(:boost_color, "white") do
            end

            self.when(:boost_color, "black") do
            end

            boost_seeing_color?("any")

            self.when(:boost_tilted, "any") do
            end

            self.when(:boost_tilted, "up") do
            end

            self.when(:boost_tilted, "down") do
            end

            self.when(:boost_tilted, "left") do
            end

            self.when(:boost_tilted, "right") do
            end

            boost_get_tilt_angle("up")

            boost_set_light_color(50)
        `;
        await expectInterconvertBetweenCodeAndRuby(code);
    });
});
