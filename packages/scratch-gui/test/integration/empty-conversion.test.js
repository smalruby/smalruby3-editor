import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';
import RubyHelper from '../helpers/ruby-helper';
import {
    EDIT_MENU_XPATH
} from '../helpers/menu-xpaths';

const seleniumHelper = new SeleniumHelper();
const {
    clickText,
    clickXpath,
    getDriver,
    loadUri
} = seleniumHelper;
const rubyHelper = new RubyHelper(seleniumHelper);
const {
    fillInRubyProgram,
    currentRubyProgram
} = rubyHelper;

const uri = path.resolve(__dirname, '../../build/index.html');

let driver;

describe('empty? conversion integration', () => {
    beforeAll(() => {
        driver = getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('empty? round-trip conversion', async () => {
        await loadUri(uri);

        await clickText('Ruby', '*[@role="tab"]');
        const rubyCode = [
            '@text = ""',
            'if @text.empty?',
            '  say("empty")',
            'else',
            '  say("not empty")',
            'end',
            ''
        ].join('\n');
        await fillInRubyProgram(rubyCode);

        // Convert to Code tab (Ruby to Blocks)
        await clickText('Code', '*[@role="tab"]');

        // Convert back to Ruby (Blocks to Ruby)
        await clickXpath(EDIT_MENU_XPATH);
        await clickText('Generate Ruby from Code');

        await clickText('Ruby', '*[@role="tab"]');

        const expectedRubyCode = [
            '@text = ""',
            'if @text.empty?',
            '  say("empty")',
            'else',
            '  say("not empty")',
            'end',
            ''
        ].join('\n');
        expect(await currentRubyProgram()).toEqual(expectedRubyCode);
    });

    test('multiple empty? round-trip conversion', async () => {
        await loadUri(uri);

        await clickText('Ruby', '*[@role="tab"]');
        const rubyCode = [
            '@text1 = ""',
            '@text2 = "a"',
            'if @text1.empty? || @text2.empty?',
            '  say("at least one is empty")',
            'end',
            ''
        ].join('\n');
        await fillInRubyProgram(rubyCode);

        // Convert to Code tab (Ruby to Blocks)
        await clickText('Code', '*[@role="tab"]');

        // Convert back to Ruby (Blocks to Ruby)
        await clickXpath(EDIT_MENU_XPATH);
        await clickText('Generate Ruby from Code');

        await clickText('Ruby', '*[@role="tab"]');

        const expectedRubyCode = [
            '@text1 = ""',
            '@text2 = "a"',
            'if @text1.empty? || @text2.empty?',
            '  say("at least one is empty")',
            'end',
            ''
        ].join('\n');
        expect(await currentRubyProgram()).toEqual(expectedRubyCode);
    });
});
