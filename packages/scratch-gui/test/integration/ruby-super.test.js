/**
 * Integration tests for Ruby super keyword feature.
 * Tests round-trip conversion: Ruby → Blocks → Ruby
 */
import path from 'path';
import RubyHelper from '../helpers/ruby-helper';
import SeleniumHelper from '../helpers/selenium-helper';

const seleniumHelper = new SeleniumHelper();
const { clickText, getDriver, loadUri } = seleniumHelper;
const rubyHelper = new RubyHelper(seleniumHelper);
const { expectInterconvertBetweenCodeAndRuby } = rubyHelper;

const uri = `${path.resolve(__dirname, '../../build/index.html')}?ruby_version=2`;

let driver;

describe('Ruby super keyword round-trip', () => {
    beforeAll(() => {
        driver = getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('super(args) with module include', async () => {
        await loadUri(uri);
        await expectInterconvertBetweenCodeAndRuby(
            'module Mod\n' +
                '  def func(a, b)\n' +
                '    a + b\n' +
                '  end\n' +
                'end\n' +
                '\n' +
                'class Sprite1\n' +
                '  include Mod\n' +
                '\n' +
                '  def func(a)\n' +
                '    super(a, a)\n' +
                '  end\n' +
                '\n' +
                '  when_flag_clicked do\n' +
                '    move(func(5))\n' +
                '  end\n' +
                'end',
        );
    });

    test('forwarding super with module include', async () => {
        await loadUri(uri);
        await expectInterconvertBetweenCodeAndRuby(
            'module Mod\n' +
                '  def func(a)\n' +
                '    say(a)\n' +
                '  end\n' +
                'end\n' +
                '\n' +
                'class Sprite1\n' +
                '  include Mod\n' +
                '\n' +
                '  def func(a)\n' +
                '    super\n' +
                '  end\n' +
                'end',
            // Generator adds an extra blank line before class end
            'module Mod\n' +
                '  def func(a)\n' +
                '    say(a)\n' +
                '  end\n' +
                'end\n' +
                '\n' +
                'class Sprite1\n' +
                '  include Mod\n' +
                '\n' +
                '  def func(a)\n' +
                '    super\n' +
                '  end\n' +
                '\n' +
                'end',
        );
    });
});
