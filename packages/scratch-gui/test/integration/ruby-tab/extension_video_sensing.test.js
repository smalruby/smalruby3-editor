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

describe('Ruby Tab: Video Sensing extension blocks', () => {
    beforeAll(() => {
        driver = getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('Ruby -> Code -> Ruby', async () => {
        await loadUri(urlFor('/'));

        const code = dedent`
            video_sensing.when_video_motion_greater_than(10) do
            end

            video_sensing.when_video_motion_greater_than(x) do
            end

            video_sensing.video_on("motion", "this sprite")

            video_sensing.video_on("direction", "this sprite")

            video_sensing.video_on("direction", "Stage")

            video_sensing.video_turn("on")
            video_sensing.video_turn("off")
            video_sensing.video_turn("on-flipped")
            video_sensing.video_transparency = 50
        `;
        await expectInterconvertBetweenCodeAndRuby(code);
    });
});
