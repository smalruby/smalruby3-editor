import dedent from 'dedent';
import SeleniumHelper from '../../helpers/selenium-helper';
import RubyHelper from '../../helpers/ruby-helper';

const seleniumHelper = new SeleniumHelper();
const {
    clickText,
    clickXpath,
    scope,
    getDriver,
    loadUri,
    notExistsByXpath,
    urlFor
} = seleniumHelper;

const rubyHelper = new RubyHelper(seleniumHelper);
const {
    expectInterconvertBetweenCodeAndRuby
} = rubyHelper;

let driver;

describe('Ruby Tab: Motion category blocks', () => {
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
        await clickText('Sprite1', scope.spriteItems);

        const code = dedent`
            move(10)
            turn_right(15)
            turn_left(15)
            go_to("_random_")
            go_to("_mouse_")
            go_to("Abby")
            go_to([0, 0])
            glide("_random_", secs: 1)
            glide("_mouse_", secs: 1)
            glide("Abby", secs: 1)
            glide([0, 0], secs: 1)
            self.direction = 90
            point_towards("_mouse_")
            point_towards("Abby")
            self.x += 10
            self.x = 0
            self.y += 10
            self.y = 0
            bounce_if_on_edge
            self.rotation_style = "left-right"
            self.rotation_style = "don't rotate"
            self.rotation_style = "all around"

            x

            y

            direction
        `;
        await expectInterconvertBetweenCodeAndRuby(code);
    });
});
