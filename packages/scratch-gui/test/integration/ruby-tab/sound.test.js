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

describe('Ruby Tab: Sound category blocks', () => {
    beforeAll(() => {
        driver = getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('Ruby -> Code -> Ruby', async () => {
        await loadUri(urlFor('/'));

        const code = dedent`
            play_until_done("Meow")
            play("Meow")
            stop_all_sounds
            change_sound_effect_by("PITCH", 10)
            change_sound_effect_by("PAN", 10)
            set_sound_effect("PITCH", 100)
            clear_sound_effects
            self.volume += -10
            self.volume = 100

            volume
        `;
        await expectInterconvertBetweenCodeAndRuby(code);
    });
});
