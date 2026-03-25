/**
 * Integration tests for Ruby module/include feature.
 * Tests round-trip conversion: Ruby → Blocks → Ruby
 */
import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';
import RubyHelper from '../helpers/ruby-helper';

const seleniumHelper = new SeleniumHelper();
const {
    clickText,
    getDriver,
    loadUri
} = seleniumHelper;
const rubyHelper = new RubyHelper(seleniumHelper);
const {
    expectInterconvertBetweenCodeAndRuby
} = rubyHelper;

const uri = `${path.resolve(__dirname, '../../build/index.html')}?ruby_version=2`;

let driver;

/**
 * Stub window.confirm to return false, preventing the v1 detection
 * prompt from blocking Selenium. The test code uses v1 syntax
 * (self.when(:flag_clicked)) which triggers a native confirm dialog
 * in v2 mode; declining it allows conversion to proceed in v2 mode.
 */
const stubConfirmToDecline = () => driver.executeScript('window.confirm = () => false;');

describe('Ruby module/include round-trip', () => {
    beforeAll(() => {
        driver = getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('module with single method', async () => {
        await loadUri(uri);
        await stubConfirmToDecline();
        await expectInterconvertBetweenCodeAndRuby(
            'module Utils\n' +
            '  def add(a, b)\n' +
            '    a + b\n' +
            '  end\n' +
            'end\n' +
            '\n' +
            'class Sprite1\n' +
            '  include Utils\n' +
            '\n' +
            '  self.when(:flag_clicked) do\n' +
            '    say(add(1, 5))\n' +
            '  end\n' +
            'end',
            // Generator outputs when_flag_clicked instead of self.when(:flag_clicked)
            'module Utils\n' +
            '  def add(a, b)\n' +
            '    a + b\n' +
            '  end\n' +
            'end\n' +
            '\n' +
            'class Sprite1\n' +
            '  include Utils\n' +
            '\n' +
            '  when_flag_clicked do\n' +
            '    say(add(1, 5))\n' +
            '  end\n' +
            'end'
        );
    });

    test('module with multiple methods', async () => {
        await loadUri(uri);
        await stubConfirmToDecline();
        await expectInterconvertBetweenCodeAndRuby(
            'module Utils\n' +
            '  def add(a, b)\n' +
            '    a + b\n' +
            '  end\n' +
            '\n' +
            '  def multiply(a, b)\n' +
            '    a * b\n' +
            '  end\n' +
            'end\n' +
            '\n' +
            'class Sprite1\n' +
            '  include Utils\n' +
            '\n' +
            '  self.when(:flag_clicked) do\n' +
            '    say(add(1, 5))\n' +
            '  end\n' +
            'end',
            'module Utils\n' +
            '  def add(a, b)\n' +
            '    a + b\n' +
            '  end\n' +
            '\n' +
            '  def multiply(a, b)\n' +
            '    a * b\n' +
            '  end\n' +
            'end\n' +
            '\n' +
            'class Sprite1\n' +
            '  include Utils\n' +
            '\n' +
            '  when_flag_clicked do\n' +
            '    say(add(1, 5))\n' +
            '  end\n' +
            'end'
        );
    });

    test('multiple modules with include', async () => {
        await loadUri(uri);
        await stubConfirmToDecline();
        await expectInterconvertBetweenCodeAndRuby(
            'module Utils\n' +
            '  def add(a, b)\n' +
            '    a + b\n' +
            '  end\n' +
            'end\n' +
            '\n' +
            'module Helpers\n' +
            '  def greet\n' +
            '    say("hello")\n' +
            '  end\n' +
            'end\n' +
            '\n' +
            'class Sprite1\n' +
            '  include Utils\n' +
            '  include Helpers\n' +
            '\n' +
            '  self.when(:flag_clicked) do\n' +
            '    move(10)\n' +
            '  end\n' +
            'end',
            'module Utils\n' +
            '  def add(a, b)\n' +
            '    a + b\n' +
            '  end\n' +
            'end\n' +
            '\n' +
            'module Helpers\n' +
            '  def greet\n' +
            '    say("hello")\n' +
            '  end\n' +
            'end\n' +
            '\n' +
            'class Sprite1\n' +
            '  include Utils\n' +
            '  include Helpers\n' +
            '\n' +
            '  when_flag_clicked do\n' +
            '    move(10)\n' +
            '  end\n' +
            'end'
        );
    });

    test('module method with no arguments', async () => {
        await loadUri(uri);
        await stubConfirmToDecline();
        await expectInterconvertBetweenCodeAndRuby(
            'module Utils\n' +
            '  def greet\n' +
            '    say("hello")\n' +
            '  end\n' +
            'end\n' +
            '\n' +
            'class Sprite1\n' +
            '  include Utils\n' +
            'end'
        );
    });

    test('module sync: adding sprite with same module gets synced definition', async () => {
        await loadUri(uri);
        await stubConfirmToDecline();

        // Set module code on Sprite1 and convert
        await clickText('Ruby', '*[@role="tab"]');
        await rubyHelper.fillInRubyProgram(
            'module Utils\n' +
            '  def add(a, b)\n' +
            '    a + b\n' +
            '  end\n' +
            'end\n' +
            '\n' +
            'class Sprite1\n' +
            '  include Utils\n' +
            '\n' +
            '  self.when(:flag_clicked) do\n' +
            '    say(add(1, 5))\n' +
            '  end\n' +
            'end'
        );
        await clickText('Code', '*[@role="tab"]');

        // Wait for conversion
        await driver.sleep(3000);

        // Add Sprite2 programmatically
        await driver.executeScript(`
            const vm = window.smalruby ? window.smalruby.vm : null;
            if (!vm) throw new Error('smalruby.vm not available');
            return vm.addSprite(JSON.stringify({
                isStage: false,
                name: "Sprite2",
                variables: {}, lists: {}, broadcasts: {},
                blocks: {}, comments: {},
                currentCostume: 0,
                costumes: [{ name: "コスチューム1", bitmapResolution: 1,
                    dataFormat: "svg", assetId: "bcf454acf82e4504149f7ffe07081571",
                    md5ext: "bcf454acf82e4504149f7ffe07081571.svg",
                    rotationCenterX: 48, rotationCenterY: 50 }],
                sounds: [], volume: 100, visible: true,
                x: 0, y: 0, size: 100, direction: 90,
                draggable: false, rotationStyle: "all around"
            }));
        `);

        // Select Sprite2
        await driver.executeScript(`
            const vm = window.smalruby.vm;
            const sprite2 = vm.runtime.targets.find(t => t.sprite && t.sprite.name === 'Sprite2');
            vm.setEditingTarget(sprite2.id);
        `);

        // Set module code on Sprite2 and convert
        await clickText('Ruby', '*[@role="tab"]');
        await rubyHelper.fillInRubyProgram(
            'module Utils\n' +
            '  def add(a, b)\n' +
            '    a + b\n' +
            '  end\n' +
            'end\n' +
            '\n' +
            'class Sprite2\n' +
            '  include Utils\n' +
            '\n' +
            '  self.when(:flag_clicked) do\n' +
            '    say(add(1, 5))\n' +
            '  end\n' +
            'end'
        );
        await clickText('Code', '*[@role="tab"]');
        await driver.sleep(3000);

        // Verify Sprite2 has the add procedure
        const sprite2Procs = await driver.executeScript(`
            const vm = window.smalruby.vm;
            const sprite2 = vm.runtime.targets.find(t => t.sprite && t.sprite.name === 'Sprite2');
            const blocks = Object.values(sprite2.blocks._blocks);
            return blocks.filter(b => b.opcode === 'procedures_definition').length;
        `);
        expect(sprite2Procs).toBe(1);

        // Now modify Sprite1's module: add multiply method
        await driver.executeScript(`
            const vm = window.smalruby.vm;
            const sprite1 = vm.runtime.targets.find(t => t.sprite && t.sprite.name === 'Sprite1');
            vm.setEditingTarget(sprite1.id);
        `);
        // Need to wait for target switch
        await driver.sleep(500);

        await clickText('Ruby', '*[@role="tab"]');
        await rubyHelper.fillInRubyProgram(
            'module Utils\n' +
            '  def add(a, b)\n' +
            '    a + b\n' +
            '  end\n' +
            '\n' +
            '  def multiply(a, b)\n' +
            '    a * b\n' +
            '  end\n' +
            'end\n' +
            '\n' +
            'class Sprite1\n' +
            '  include Utils\n' +
            '\n' +
            '  self.when(:flag_clicked) do\n' +
            '    say(add(1, 5))\n' +
            '  end\n' +
            'end'
        );
        await clickText('Code', '*[@role="tab"]');
        await driver.sleep(3000);

        // Verify Sprite2 now has 2 procedures (synced multiply)
        const sprite2ProcsAfterSync = await driver.executeScript(`
            const vm = window.smalruby.vm;
            const sprite2 = vm.runtime.targets.find(t => t.sprite && t.sprite.name === 'Sprite2');
            const blocks = Object.values(sprite2.blocks._blocks);
            return blocks.filter(b => b.opcode === 'procedures_definition').length;
        `);
        expect(sprite2ProcsAfterSync).toBe(2);
    });
});
