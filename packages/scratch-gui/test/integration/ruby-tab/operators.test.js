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

describe('Ruby Tab: Operators category blocks', () => {
    beforeAll(() => {
        driver = getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('Ruby -> Code -> Ruby', async () => {
        await loadUri(urlFor('/'));

        const code = dedent`
            0 + 0

            0 - 0

            0 * 0

            0 / 0.0

            rand(1..10)

            "" > 50

            "" < 50

            "" == 50

            false && false

            false || false

            !false

            "apple " + "banana"

            "apple"[0]

            "apple".length

            "apple".include?("a")

            0 % 0

            0.round

            0.abs

            0.floor

            0.ceil

            Math.sqrt(0)

            Math.sin(0)

            Math.cos(0)

            Math.tan(0)

            Math.asin(0)

            Math.acos(0)

            Math.atan(0)

            Math.log(0)

            Math.log10(0)

            Math::E ** 0

            10 ** 0
        `;
        await expectInterconvertBetweenCodeAndRuby(code);
    });
});
