import dedent from 'dedent';
import SeleniumHelper from '../../helpers/selenium-helper';
import RubyHelper from '../../helpers/ruby-helper';
import {EDIT_MENU_XPATH} from '../../helpers/menu-xpaths';

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

        try {
            await expectInterconvertBetweenCodeAndRuby(codeWithUppercaseArg, expectedCodeWithLowercaseArg);
        } catch (e) {
            const logs = await seleniumHelper.getLogs({includeAllLevels: true});
            console.log('Browser logs (Procedure arguments):', logs);
            throw e;
        }
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

    test('Method with return value should be convertible', async () => {
        await loadUri(urlFor('/'));

        const code = dedent`
            def self.add(a, b)
              a + b
            end

            when_flag_clicked do
              say(add(1, 5))
            end
        `;
        try {
            await expectInterconvertBetweenCodeAndRuby(code);
        } catch (e) {
            const logs = await seleniumHelper.getLogs({includeAllLevels: true});
            console.log('Browser logs (Method with return value):', logs);
            throw e;
        }
    });

    test('Method call with return value at top-level should be convertible', async () => {
        await loadUri(urlFor('/'));

        const code = dedent`
            def self.add(a, b)
              a + b
            end

            say(add(1, 5))
        `;
        try {
            await expectInterconvertBetweenCodeAndRuby(code);
        } catch (e) {
            const logs = await seleniumHelper.getLogs({includeAllLevels: true});
            console.log('Browser logs (Top-level method call):', logs);
            throw e;
        }
    });

    test('Method with explicit return variable assignment should be convertible', async () => {
        await loadUri(urlFor('/'));

        const code = dedent`
            def self.add(a, b)
              @_return_add = a + b
            end

            when_flag_clicked do
              add(1, 5)
              say(@_return_add)
            end
        `;
        try {
            await expectInterconvertBetweenCodeAndRuby(code);
        } catch (e) {
            const logs = await seleniumHelper.getLogs({includeAllLevels: true});
            console.log('Browser logs (Explicit return variable):', logs);
            throw e;
        }
    });

    test('Double conversion should not lose method body: minimal', async () => {
        await loadUri(urlFor('/'));

        const code = dedent`
            def self.add
              move(10)
            end
        `;

        try {
            // First conversion: Ruby -> Code -> Ruby
            await rubyHelper.clickText('Ruby', '*[@role="tab"]');
            await rubyHelper.fillInRubyProgram(code);
            await rubyHelper.clickText('Code', '*[@role="tab"]');

            // Dismiss any alerts
            await rubyHelper.dismissAlertsIfPresent();

            await rubyHelper.clickXpath(EDIT_MENU_XPATH);
            await rubyHelper.clickText('Generate Ruby from Code');
            await rubyHelper.clickText('Ruby', '*[@role="tab"]');

            // Check first conversion result
            const firstResult = await rubyHelper.currentRubyProgram();
            expect(firstResult).toContain('def self.add');
            expect(firstResult).toContain('move(10)');
            expect(firstResult).not.toMatch(/def self\.add\s*end/);

            // Second conversion: Ruby -> Code -> Ruby (THIS IS WHERE THE BUG OCCURS)
            // Without changing the Ruby code, go to Code tab again
            await rubyHelper.clickText('Code', '*[@role="tab"]');

            // Dismiss any alerts
            await rubyHelper.dismissAlertsIfPresent();

            // Convert back to Ruby
            await rubyHelper.clickXpath(EDIT_MENU_XPATH);
            await rubyHelper.clickText('Generate Ruby from Code');
            await rubyHelper.clickText('Ruby', '*[@role="tab"]');

            // Check second conversion result - method body should still be present
            const secondResult = await rubyHelper.currentRubyProgram();
            expect(secondResult).toContain('def self.add');
            expect(secondResult).toContain('move(10)');
            expect(secondResult).not.toMatch(/def self\.add\s*end/);
        } catch (e) {
            const logs = await seleniumHelper.getLogs({includeAllLevels: true});
            console.log('Browser logs (Double conversion):', logs);
            throw e;
        }
    });

    test('Double conversion should not lose method body: return value', async () => {
        await loadUri(urlFor('/'));

        // Use the minimal reproduction case from memo.md
        const code = dedent`
            def self.add(a, b)
              a + b
            end
        `;

        try {
            // First conversion: Ruby -> Code -> Ruby
            await rubyHelper.clickText('Ruby', '*[@role="tab"]');
            await rubyHelper.fillInRubyProgram(code);
            await rubyHelper.clickText('Code', '*[@role="tab"]');

            // Dismiss any alerts
            await rubyHelper.dismissAlertsIfPresent();

            await rubyHelper.clickXpath(EDIT_MENU_XPATH);
            await rubyHelper.clickText('Generate Ruby from Code');
            await rubyHelper.clickText('Ruby', '*[@role="tab"]');

            // Check first conversion result
            const firstResult = await rubyHelper.currentRubyProgram();
            expect(firstResult).toContain('def self.add');
            expect(firstResult).toContain('a + b');
            expect(firstResult).not.toMatch(/def self\.add\([^)]*\)\s*end/);

            // Second conversion: Ruby -> Code -> Ruby (THIS IS WHERE THE BUG OCCURS)
            // Without changing the Ruby code, go to Code tab again
            await rubyHelper.clickText('Code', '*[@role="tab"]');

            // Dismiss any alerts
            await rubyHelper.dismissAlertsIfPresent();

            // Convert back to Ruby
            await rubyHelper.clickXpath(EDIT_MENU_XPATH);
            await rubyHelper.clickText('Generate Ruby from Code');
            await rubyHelper.clickText('Ruby', '*[@role="tab"]');

            // Check second conversion result - method body should still be present
            const secondResult = await rubyHelper.currentRubyProgram();
            expect(secondResult).toContain('def self.add');
            expect(secondResult).toContain('a + b');
            expect(secondResult).not.toMatch(/def self\.add\([^)]*\)\s*end/);
        } catch (e) {
            const logs = await seleniumHelper.getLogs({includeAllLevels: true});
            console.log('Browser logs (Double conversion):', logs);
            throw e;
        }
    });
});
