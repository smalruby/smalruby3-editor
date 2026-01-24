import dedent from 'dedent';
import SeleniumHelper from '../../helpers/selenium-helper';
import RubyHelper from '../../helpers/ruby-helper';
import {
    SETTINGS_MENU_XPATH,
    FILE_MENU_XPATH,
    EDIT_MENU_XPATH
} from '../../helpers/menu-xpaths';

const seleniumHelper = new SeleniumHelper();
const {
    clickText,
    clickXpath,
    getDriver,
    loadUri,
    urlFor
} = seleniumHelper;

const rubyHelper = new RubyHelper(seleniumHelper);
const {
    fillInRubyProgram,
    currentRubyProgram,
    expectInterconvertBetweenCodeAndRuby
} = rubyHelper;

let driver;

describe('Ruby Tab: LEGO Education WeDo 2.0 extension blocks', () => {
    beforeAll(() => {
        driver = getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('Ruby -> Code -> Ruby', async () => {
        await loadUri(urlFor('/'));

        const ruby = dedent`
            wedo2.turn_on_for("motor", 1)
            wedo2.turn_on_for("motor A", 1)
            wedo2.turn_on_for("motor B", 1)
            wedo2.turn_on_for("all motors", 1)
            wedo2.turn_on("motor")
            wedo2.turn_off("motor")
            wedo2.set_power("motor", 100)
            wedo2.set_direction("motor", "this way")
            wedo2.set_direction("motor", "that way")
            wedo2.set_direction("motor", "reverse")
            wedo2.light_color = 50

            wedo2.when_distance("<", 50) do
            end

            wedo2.when_distance(">", 50) do
            end

            wedo2.when_tilted("any") do
            end

            wedo2.when_tilted("up") do
            end

            wedo2.when_tilted("down") do
            end

            wedo2.when_tilted("left") do
            end

            wedo2.when_tilted("right") do
            end

            wedo2.distance

            wedo2.tilted?("any")

            wedo2.tilt_angle("up")
        `;
        await expectInterconvertBetweenCodeAndRuby(ruby);
    });

    test('Ruby -> Code -> Ruby (etc) ', async () => {
        await loadUri(urlFor('/'));

        const beforeRuby = dedent`
            wedo2.turn_on_for("MOTOR", 1)
            wedo2.turn_on_for("motor a", 1)
            wedo2.turn_on("motor a")
            wedo2.turn_off("motor a")
            wedo2.set_power("motor a", 100)
            wedo2.set_direction("motor a", "THIS WAY")

            wedo2.when_tilted("ANY") do
            end

            wedo2.tilted?("ANY")

            wedo2.tilt_angle("UP")
        `;

        const afterRuby = dedent`
            wedo2.turn_on_for("motor", 1)
            wedo2.turn_on_for("motor A", 1)
            wedo2.turn_on("motor A")
            wedo2.turn_off("motor A")
            wedo2.set_power("motor A", 100)
            wedo2.set_direction("motor A", "this way")

            wedo2.when_tilted("any") do
            end

            wedo2.tilted?("any")

            wedo2.tilt_angle("up")
        `;

        await clickText('Ruby', '*[@role="tab"]');
        await fillInRubyProgram(beforeRuby);
        await clickText('Code', '*[@role="tab"]');
        await clickXpath(EDIT_MENU_XPATH);
        await clickText('Generate Ruby from Code');
        await clickText('Ruby', '*[@role="tab"]');
        expect(await currentRubyProgram()).toEqual(`${afterRuby}\n`);
    });
});
