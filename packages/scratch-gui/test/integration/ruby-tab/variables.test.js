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

describe('Ruby Tab: Variables category blocks', () => {
    beforeAll(() => {
        driver = getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('Ruby -> Code -> Ruby', async () => {
        await loadUri(urlFor('/'));

        const code = dedent`
            $my_variable = 0
            @sprite_only_variable = 0
            $my_variable += 1
            @sprite_only_variable += 1
            show_variable("$my_variable")
            show_variable("@sprite_only_variable")
            hide_variable("$my_variable")
            hide_variable("@sprite_only_variable")
            list("$my_list").push("thing")
            list("$sprite_only_list").push("thing")
            list("$my_list").delete_at(1)
            list("$sprite_only_list").delete_at(1)
            list("$my_list").clear
            list("$sprite_only_list").clear
            list("$my_list").insert(1, "thing")
            list("$sprite_only_list").insert(1, "thing")
            list("$my_list")[1] = "thing"
            list("$sprite_only_list")[1] = "thing"

            list("$my_list")[1]

            list("$sprite_only_list")[1]

            list("$my_list").index("thing")

            list("$sprite_only_list").index("thing")

            list("$my_list").length

            list("$sprite_only_list").length

            list("$my_list").include?("thing")

            list("$sprite_only_list").include?("thing")

            show_list("$my_list")
            show_list("$sprite_only_list")
            hide_list("$my_list")
            hide_list("$sprite_only_list")

            $my_variable

            @sprite_only_variable

            list("$my_list")

            list("$sprite_only_list")
        `;
        await expectInterconvertBetweenCodeAndRuby(code);
    });
});
