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

describe('Ruby Tab: My Blocks category blocks', () => {
    beforeAll(() => {
        driver = getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('Procedure arguments should be converted to snake_case lowercase', async () => {
        await loadUri(urlFor('/'));

        // Test case: ARG1 -> arg1 (most common case from the issue)
        const codeWithUppercaseArg = dedent`
            def self.procedure(aRG1)
              move(aRG1)
            end

            procedure(10)
        `;

        // Expected: both method definition and usage should use lowercase snake_case
        const expectedCodeWithLowercaseArg = dedent`
            def self.procedure(a_rg1)
              move(a_rg1)
            end

            procedure(10)
        `;

        await expectInterconvertBetweenCodeAndRuby(codeWithUppercaseArg, expectedCodeWithLowercaseArg);
    });

    test('Ruby -> Code -> Ruby', async () => {
        await loadUri(urlFor('/'));

        const code = dedent`
            def self.block_name
            end

            block_name
        `;
        await expectInterconvertBetweenCodeAndRuby(code);
    });
});
