import dedent from 'dedent';
import SeleniumHelper from '../../helpers/selenium-helper';
import RubyHelper from '../../helpers/ruby-helper';
const SETTINGS_MENU_XPATH = '//div[contains(@class, "menu-bar_menu-bar-item")]' + '[*[contains(@class, "settings-menu_dropdown-label")]//*[text()="Settings"]]';
const FILE_MENU_XPATH = '//div[contains(@class, "menu-bar_menu-bar-item")]' + '[*[contains(@class, "menu-bar_collapsible-label")]//*[text()="File"]]';
const EDIT_MENU_XPATH = '//div[contains(@class, "menu-bar_menu-bar-item")]' + '[*[contains(@class, "menu-bar_collapsible-label")]//*[text()="Edit"]]';

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

describe('Ruby Tab: micro:bit extension blocks', () => {
    beforeAll(() => {
        driver = getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('Ruby -> Code -> Ruby', async () => {
        await loadUri(urlFor('/'));

        const ruby = dedent`
            microbit_v1.when_button_pressed("A") do
            end

            microbit_v1.when_button_pressed("B") do
            end

            microbit_v1.when_button_pressed("any") do
            end

            microbit_v1.button_pressed?("A")

            microbit_v1.when("moved") do
            end

            microbit_v1.when("shaken") do
            end

            microbit_v1.when("jumped") do
            end

            microbit_v1.display(
              ".1.1.",
              "1.1.1",
              "1...1",
              ".1.1.",
              "..1.."
            )
            microbit_v1.display(x)
            microbit_v1.display_text("Hello!")
            microbit_v1.clear_display

            microbit_v1.when_tilted("any") do
            end

            microbit_v1.when_tilted("front") do
            end

            microbit_v1.when_tilted("back") do
            end

            microbit_v1.when_tilted("left") do
            end

            microbit_v1.when_tilted("right") do
            end

            microbit_v1.tilted?("any")

            microbit_v1.tilt_angle("front")

            microbit_v1.when_pin_connected(0) do
            end

            microbit_v1.when_pin_connected(1) do
            end

            microbit_v1.when_pin_connected(2) do
            end
        `;
        await expectInterconvertBetweenCodeAndRuby(ruby);
    });

    test('Ruby -> Code -> Ruby (backward compatibility) ', async () => {
        await loadUri(urlFor('/'));

        const oldRuby = dedent`
            self.when(:microbit_button_pressed, "A") do
            end

            self.when(:microbit_button_pressed, "B") do
            end

            self.when(:microbit_button_pressed, "any") do
            end

            self.when(:microbit_gesture, "moved") do
            end

            self.when(:microbit_gesture, "shaken") do
            end

            self.when(:microbit_gesture, "jumped") do
            end

            self.when(:microbit_tilted, "any") do
            end

            self.when(:microbit_tilted, "front") do
            end

            self.when(:microbit_tilted, "back") do
            end

            self.when(:microbit_tilted, "left") do
            end

            self.when(:microbit_tilted, "right") do
            end

            self.when(:microbit_pin_connected, 0) do
            end

            self.when(:microbit_pin_connected, 1) do
            end

            self.when(:microbit_pin_connected, 2) do
            end
        `;

        const newRuby = dedent`
            microbit_v1.when_button_pressed("A") do
            end

            microbit_v1.when_button_pressed("B") do
            end

            microbit_v1.when_button_pressed("any") do
            end

            microbit_v1.when("moved") do
            end

            microbit_v1.when("shaken") do
            end

            microbit_v1.when("jumped") do
            end

            microbit_v1.when_tilted("any") do
            end

            microbit_v1.when_tilted("front") do
            end

            microbit_v1.when_tilted("back") do
            end

            microbit_v1.when_tilted("left") do
            end

            microbit_v1.when_tilted("right") do
            end

            microbit_v1.when_pin_connected(0) do
            end

            microbit_v1.when_pin_connected(1) do
            end

            microbit_v1.when_pin_connected(2) do
            end
        `;

        await clickText('Ruby', '*[@role="tab"]');
        await fillInRubyProgram(oldRuby);
        await clickText('Code', '*[@role="tab"]');
        await clickXpath(EDIT_MENU_XPATH);
        await clickText('Generate Ruby from Code');
        await clickText('Ruby', '*[@role="tab"]');
        expect(await currentRubyProgram()).toEqual(`${newRuby}\n`);
    });
});
