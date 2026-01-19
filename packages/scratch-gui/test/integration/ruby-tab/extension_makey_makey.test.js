import dedent from 'dedent';
import SeleniumHelper from '../../helpers/selenium-helper';
import RubyHelper from '../../helpers/ruby-helper';
const SETTINGS_MENU_XPATH = '//div[contains(@class, "menu-bar_menu-bar-item")]' + '[*[contains(@class, "settings-menu_dropdown-label")]//*[text()="Settings"]]';
const FILE_MENU_XPATH = '//div[contains(@class, "menu-bar_menu-bar-item")]' + '[*[contains(@class, "menu-bar_collapsible-label")]//*[text()="File"]]';
const EDIT_MENU_XPATH = '//div[contains(@class, "menu-bar_menu-bar-item")]' + '[*[contains(@class, "menu-bar_collapsible-label")]//*[text()="Edit"]]';

const seleniumHelper = new SeleniumHelper();
const {
    getDriver,
    loadUri,
    urlFor,
    clickText,
    clickXpath
} = seleniumHelper;

const rubyHelper = new RubyHelper(seleniumHelper);
const {
    expectInterconvertBetweenCodeAndRuby,
    fillInRubyProgram,
    currentRubyProgram
} = rubyHelper;

let driver;

describe('Ruby Tab: Makey Makey extension blocks', () => {
    beforeAll(() => {
        driver = getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    const code = dedent`
        makey.when_key_pressed("SPACE") do
        end

        makey.when_pressed_in_oder("LEFT UP RIGHT") do
        end

        makey.when_pressed_in_oder("RIGHT UP LEFT") do
        end

        makey.when_key_pressed("w") do
        end
    `;

    const oldCode = dedent`
        self.when(:makey_key_pressed, "SPACE") do
        end

        self.when(:makey_pressed_in_oder, "LEFT UP RIGHT") do
        end

        self.when(:makey_pressed_in_oder, "RIGHT UP LEFT") do
        end

        self.when(:makey_key_pressed, "w") do
        end
    `;

    test('Ruby -> Code -> Ruby', async () => {
        await loadUri(urlFor('/'));

        await expectInterconvertBetweenCodeAndRuby(code);
    });

    test('Ruby -> Code -> Ruby (backward compatibility)', async () => {
        await loadUri(urlFor('/'));

        await clickText('Ruby', '*[@role="tab"]');
        await fillInRubyProgram(oldCode);
        await clickText('Code', '*[@role="tab"]');
        await clickXpath(EDIT_MENU_XPATH);
        await clickText('Generate Ruby from Code');
        await clickText('Ruby', '*[@role="tab"]');
        expect(await currentRubyProgram()).toEqual(`${code}\n`);
    });
});
