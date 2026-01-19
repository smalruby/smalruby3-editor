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

describe('Ruby Tab: Text to Speech extension blocks', () => {
    beforeAll(() => {
        driver = getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('Ruby -> Code -> Ruby', async () => {
        await loadUri(urlFor('/'));

        const code = dedent`
            text2speech.speak("hello")
            text2speech.voice = "ALTO"
            text2speech.voice = "TENOR"
            text2speech.voice = "SQUEAK"
            text2speech.voice = "GIANT"
            text2speech.voice = "KITTEN"
            text2speech.language = "en"
            text2speech.language = "ja"
            text2speech.language = "de"
        `;
        await expectInterconvertBetweenCodeAndRuby(code);
    });

    test('Ruby -> Code -> Ruby (etc) ', async () => {
        await loadUri(urlFor('/'));

        const beforeRuby = dedent`
            text2speech.voice = "alto"
            text2speech.voice = "Alto"
            text2speech.language = "EN"
            text2speech.language = "En"
        `;

        const afterRuby = dedent`
            text2speech.voice = "ALTO"
            text2speech.voice = "ALTO"
            text2speech.language = "en"
            text2speech.language = "en"
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
