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
    findByXpath,
    scope,
    getDriver,
    loadUri,
    notExistsByXpath,
    urlFor
} = seleniumHelper;

const rubyHelper = new RubyHelper(seleniumHelper);
const {
    fillInRubyProgram,
    currentRubyProgram,
    expectInterconvertBetweenCodeAndRuby
} = rubyHelper;

let driver;

describe('Ruby Tab: Control category blocks', () => {
    beforeAll(() => {
        driver = getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('Ruby -> Code -> Ruby', async () => {
        await loadUri(urlFor('/'));
        await notExistsByXpath('//*[div[contains(@class, "loader_background")]]');
        await clickXpath('//button[@aria-label="Choose a Sprite"]');
        await clickText('Abby', scope.modal);
        await findByXpath(
            '//div[contains(@class, "sprite-selector-item_is-selected")]' +
                '/*/div[contains(@class, "sprite-selector-item_sprite-name") and text()="Abby"]'
        );
        await clickText('Sprite1', scope.spriteItems);

        const ruby = dedent`
            sleep(1)
            sleep(x)
            sleep(touching?("_edge_"))
            10.times do
              move(10)
            end
            x.times do
              move(10)
            end
            (touching?("_edge_")).times do
              move(10)
            end
            loop do
              move(10)
            end

            if false
            end
            if touching?("_edge_")
              turn_right(180)
            end
            if false
            else
            end
            if touching?("_edge_")
              turn_right(180)
            else
              move(10)
            end
            if touching?("_edge_")
            else
              move(10)
            end
            if touching?("_edge_")
              turn_right(180)
            else
            end
            wait until false
            wait until touching?("_edge_")
            until false
              move(10)
            end
            until touching?("_edge_")
              move(10)
            end
            stop("all")

            stop("this script")

            stop("other scripts in sprite")

            when_start_as_a_clone do
            end

            create_clone("_myself_")
            create_clone("Abby")
            delete_this_clone
        `;
        await expectInterconvertBetweenCodeAndRuby(ruby);
    });

    test('Ruby -> Code -> Ruby (backward compatibility) ', async () => {
        await loadUri(urlFor('/'));

        const oldRuby = dedent`
            self.when(:start_as_a_clone) do
            end
        `;

        const newRuby = dedent`
            when_start_as_a_clone do
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

    test('Ruby -> Code -> Ruby (remove wait) ', async () => {
        await loadUri(urlFor('/'));

        const beforeRuby = dedent`
            10.times { wait; move(10) }
            10.times { wait; wait; move(10) }
            10.times { move(10); wait }
            10.times { move(10); wait; wait }
            10.times { wait; move(10); wait }
            10.times { wait; wait; move(10); wait; wait }
            repeat(10) { move(10); wait }
            loop { wait }
            loop { wait; wait }
            loop { wait; wait; wait }
            until touching?("_edge_")
              wait; move(10)
            end
            until touching?("_edge_")
              wait; wait; move(10)
            end
            until touching?("_edge_")
              wait; move(10); wait
            end
            until touching?("_edge_")
              move(10); wait
            end
            until touching?("_edge_")
              move(10); wait; wait
            end
        `;

        const afterRuby = dedent`
            10.times do
              move(10)
            end
            10.times do
              move(10)
            end
            10.times do
              move(10)
            end
            10.times do
              move(10)
            end
            10.times do
              move(10)
            end
            10.times do
              move(10)
            end
            10.times do
              move(10)
            end
            loop do
            end

            loop do
            end

            loop do
            end

            until touching?("_edge_")
              move(10)
            end
            until touching?("_edge_")
              move(10)
            end
            until touching?("_edge_")
              move(10)
            end
            until touching?("_edge_")
              move(10)
            end
            until touching?("_edge_")
              move(10)
            end
        `;

        await clickText('Ruby', '*[@role="tab"]');
        await fillInRubyProgram(beforeRuby);
        await clickText('Code', '*[@role="tab"]');
        await clickXpath(EDIT_MENU_XPATH);
        await clickText('Generate Ruby from Code');
        await clickText('Ruby', '*[@role="tab"]');
        expect(await currentRubyProgram()).toEqual(`${afterRuby}\n`);
    });

    test('Ruby -> Code -> Ruby (alias) ', async () => {
        await loadUri(urlFor('/'));

        const beforeRuby = dedent`
            repeat(10) { move(10); wait }
            repeat(x) { move(10) }
            repeat(touching?("_edge_")) { move(10) }
            forever { move(10); wait }
        `;

        const afterRuby = dedent`
            10.times do
              move(10)
            end
            x.times do
              move(10)
            end
            (touching?("_edge_")).times do
              move(10)
            end
            loop do
              move(10)
            end
        `;

        await clickText('Ruby', '*[@role="tab"]');
        await fillInRubyProgram(beforeRuby);
        await clickText('Code', '*[@role="tab"]');
        await clickXpath(EDIT_MENU_XPATH);
        await clickText('Generate Ruby from Code');
        await clickText('Ruby', '*[@role="tab"]');
        expect(await currentRubyProgram()).toEqual(`${afterRuby}\n`);
    });

    test('Ruby -> Code -> Ruby (etc) ', async () => {
        await loadUri(urlFor('/'));

        const beforeRuby = dedent`
            if (touching?("_edge_"))
              turn_right(180)
            end
            unless touching?("_edge_")
              turn_right(180)
            else
              move(10)
            end
            unless touching?("_edge_")
            else
              move(10)
            end
            unless touching?("_edge_")
              turn_right(180)
            else
            end
            unless touching?("_edge_")
            else
            end
            wait until (touching?("_edge_"))
        `;

        const afterRuby = dedent`
            if touching?("_edge_")
              turn_right(180)
            end
            if touching?("_edge_")
              move(10)
            else
              turn_right(180)
            end
            if touching?("_edge_")
              move(10)
            else
            end
            if touching?("_edge_")
            else
              turn_right(180)
            end
            if touching?("_edge_")
            else
            end
            wait until touching?("_edge_")
        `;

        await clickText('Ruby', '*[@role="tab"]');
        await fillInRubyProgram(beforeRuby);
        await clickText('Code', '*[@role="tab"]');
        await clickXpath(EDIT_MENU_XPATH);
        await clickText('Generate Ruby from Code');
        await clickText('Ruby', '*[@role="tab"]');
        expect(await currentRubyProgram()).toEqual(`${afterRuby}\n`);
    });

    test('Ruby -> Code -> Ruby (if...elsif...end) ', async () => {
        await loadUri(urlFor('/'));

        const ruby = dedent`
            if x == 1
              move(10)
            elsif x == 2
              move(20)
            end
            if x == 1
              move(10)
            elsif x == 2
              move(20)
            else
              move(30)
            end
            if x == 1
              move(10)
            elsif x == 2
              move(20)
            elsif x == 3
              move(30)
            else
              move(40)
            end
        `;

        await clickText('Ruby', '*[@role="tab"]');
        await fillInRubyProgram(ruby);
        await clickText('Code', '*[@role="tab"]');
        await clickXpath(EDIT_MENU_XPATH);
        await clickText('Generate Ruby from Code');
        await clickText('Ruby', '*[@role="tab"]');
        expect(await currentRubyProgram()).toEqual(`${ruby}\n`);
    });

    test('Ruby -> Code -> Ruby (case...when...end) ', async () => {
        await loadUri(urlFor('/'));

        const ruby = dedent`
            case x
            when 1
              move(10)
            end
            case x
            when 1
              move(10)
            else
              move(20)
            end
            case x
            when 1
              move(10)
            when 2
              move(20)
            else
              move(30)
            end
            case @a
            when 1
              move(10)
            end
            case @b
            when 2
              move(20)
            end
        `;

        await clickText('Ruby', '*[@role="tab"]');
        await fillInRubyProgram(ruby);
        await clickText('Code', '*[@role="tab"]');
        await clickXpath(EDIT_MENU_XPATH);
        await clickText('Generate Ruby from Code');
        await clickText('Ruby', '*[@role="tab"]');
        expect(await currentRubyProgram()).toEqual(`${ruby}\n`);
    });
});
