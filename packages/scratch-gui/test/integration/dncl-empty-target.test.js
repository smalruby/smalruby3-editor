import path from 'path';
import RubyHelper from '../helpers/ruby-helper';
import SeleniumHelper from '../helpers/selenium-helper';

const seleniumHelper = new SeleniumHelper();
const { getDriver, loadUri } = seleniumHelper;
const rubyHelper = new RubyHelper(seleniumHelper);
const { fillInRubyProgram } = rubyHelper;

const uri = path.resolve(__dirname, '../../build/index.html');

const SPRITE_PROGRAM = 'x = 3\n表示する(x)\n';

const getEditorValue = (d) => d.executeScript('return window.monacoEditor && window.monacoEditor.getValue()');

const waitForEditorValue = (d, predicate, message) =>
    d.wait(async () => predicate((await getEditorValue(d)) || ''), 10000, message);

const waitForMonacoLanguage = (d, expected) =>
    d.wait(
        () =>
            d.executeScript(
                `return window.monacoEditor && window.monacoEditor.getModel().getLanguageId() === '${expected}'`,
            ),
        10000,
        `Monaco language did not become "${expected}"`,
    );

const scriptCountOf = (d, targetId) =>
    d.executeScript(
        `const t = window.smalruby.vm.runtime.getTargetById('${targetId}');` + 'return t.blocks.getScripts().length;',
    );

let driver;

describe('A target without a program empties the Japanese tab (Issue #2576)', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('selecting the stage empties the editor and writing there does not copy the sprite', async () => {
        await loadUri(`${uri}?locale=ja&tab=japanese`);
        await waitForMonacoLanguage(driver, 'dncl');
        await fillInRubyProgram(SPRITE_PROGRAM);
        await waitForEditorValue(driver, (v) => v.includes('表示する(x)'), 'The sprite program was not shown');
        const spriteId = await driver.executeScript('return window.smalruby.vm.editingTarget.id');

        const stageId = await driver.executeScript(
            'const vm = window.smalruby.vm; const id = vm.runtime.getTargetForStage().id;' +
                'vm.setEditingTarget(id); return id;',
        );
        await driver.wait(
            async () => (await driver.executeScript('return window.smalruby.vm.editingTarget.id')) === stageId,
            10000,
            'The stage was not selected',
        );
        await waitForEditorValue(driver, (v) => v.trim() === '', 'The editor was not emptied for the stage');

        await fillInRubyProgram('表示する("ステージ")\n');
        await driver.executeScript(`const vm = window.smalruby.vm; vm.setEditingTarget('${spriteId}');`);
        await driver.wait(
            async () => (await driver.executeScript('return window.smalruby.vm.editingTarget.id')) === spriteId,
            10000,
            'The sprite was not selected again',
        );
        await waitForEditorValue(driver, (v) => v.includes('表示する(x)'), 'The sprite program did not come back');

        expect(await scriptCountOf(driver, stageId)).toBe(1);
        expect(await scriptCountOf(driver, spriteId)).toBe(1);
        expect(await getEditorValue(driver)).not.toContain('ステージ');
    });
});
