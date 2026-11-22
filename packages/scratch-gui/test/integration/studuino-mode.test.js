import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';

const seleniumHelper = new SeleniumHelper();
const { clickText, clickXpath, findByXpath, getDriver, loadUri } = seleniumHelper;

const uri = path.resolve(__dirname, '../../build/index.html');

let driver;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const existsByTestId = (testId) =>
    driver.executeScript(`return document.querySelector('[data-testid="${testId}"]') !== null`);

const clickByTestId = (testId) => driver.executeScript(`document.querySelector('[data-testid="${testId}"]').click()`);

const categoryNames = () =>
    driver.executeScript(
        `const toolbox = document.querySelector('.blocklyToolbox');` +
            `if (!toolbox) return [];` +
            `return Array.from(toolbox.querySelectorAll('.blocklyToolboxCategory')).map(e => e.textContent.trim());`,
    );

const hasCategory = (names, name) => names.some((n) => n.includes(name));
const expectCategories = (names, shown, hidden) => {
    shown.forEach((name) => expect(hasCategory(names, name)).toBe(true));
    hidden.forEach((name) => expect(hasCategory(names, name)).toBe(false));
};

const activateSmalrubotS1Extension = async () => {
    await clickXpath('//button[@title="Add Extension"]');
    await clickText('ArtecRobo');
    await sleep(1000);
    // 接続のモーダルを閉じる
    try {
        const closeButton = await findByXpath(
            '//div[contains(@class, "modal_header-item")]//*[contains(@class, "close-button")]',
        );
        await closeButton.click();
    } catch (_) {
        // 出ていなければよい
    }
    await sleep(500);
};

const toggleStuduinoMode = async () => {
    await driver.wait(() => existsByTestId('menu-smalrubot-s1'), 5000, 'ArtecRobo menu is not shown');
    await clickByTestId('menu-smalrubot-s1');
    await driver.wait(
        () => existsByTestId('menu-smalrubot-s1-studuino-mode'),
        5000,
        'Studuino mode item is not shown',
    );
    await clickByTestId('menu-smalrubot-s1-studuino-mode');
    await sleep(1000);
};

describe('Studuino mode', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('entering the mode narrows the palette and leaving it restores the palette', async () => {
        await loadUri(uri);
        await activateSmalrubotS1Extension();

        expectCategories(await categoryNames(), ['Motion', 'Looks', 'Sound', 'My Blocks'], []);

        await toggleStuduinoMode();
        // 入った直後に入出力の設定を 1 回開く
        await driver.wait(() => existsByTestId('studuino-port-settings-modal'), 5000, 'Port settings did not open');
        await clickByTestId('studuino-port-settings-assign');
        await driver.wait(
            async () => !(await existsByTestId('studuino-port-settings-modal')),
            5000,
            'Port settings did not close',
        );
        await driver.wait(
            async () => !hasCategory(await categoryNames(), 'Motion'),
            5000,
            'The palette was not narrowed in the Studuino mode',
        );
        expectCategories(
            await categoryNames(),
            ['ArtecRobo', 'Events', 'Control', 'Sensing', 'Operators', 'Variables'],
            ['Motion', 'Looks', 'Sound', 'My Blocks', 'Pen'],
        );

        await toggleStuduinoMode();
        await driver.wait(
            async () => hasCategory(await categoryNames(), 'Motion'),
            5000,
            'The palette was not restored after leaving the Studuino mode',
        );
        expectCategories(await categoryNames(), ['Looks', 'Sound', 'My Blocks'], []);
    });

    test('the port settings keep the assigned parts', async () => {
        await loadUri(uri);
        await activateSmalrubotS1Extension();
        await driver.wait(() => existsByTestId('menu-smalrubot-s1'), 5000, 'ArtecRobo menu is not shown');
        await clickByTestId('menu-smalrubot-s1');
        await driver.wait(
            () => existsByTestId('menu-smalrubot-s1-port-settings'),
            5000,
            'Port settings item missing',
        );
        await clickByTestId('menu-smalrubot-s1-port-settings');
        await driver.wait(() => existsByTestId('studuino-port-settings-modal'), 5000, 'Port settings did not open');

        // React の onChange に届くように、ネイティブの setter で値を入れて change を送る
        await driver.executeScript(
            `const s = document.querySelector('[data-testid="studuino-port-settings-port-d9"]');` +
                `Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'servo_motor');` +
                `s.dispatchEvent(new Event('change', { bubbles: true }));`,
        );
        await clickByTestId('studuino-port-settings-assign');
        await sleep(500);

        await clickByTestId('menu-smalrubot-s1');
        await driver.wait(
            () => existsByTestId('menu-smalrubot-s1-port-settings'),
            5000,
            'Port settings item missing',
        );
        await clickByTestId('menu-smalrubot-s1-port-settings');
        await driver.wait(() => existsByTestId('studuino-port-settings-modal'), 5000, 'Port settings did not reopen');
        const value = await driver.executeScript(
            `return document.querySelector('[data-testid="studuino-port-settings-port-d9"]').value`,
        );
        expect(value).toBe('servo_motor');
        // 本文は不透明（青いオーバーレイが透けない）
        const background = await driver.executeScript(
            `return getComputedStyle(document.querySelector('[data-testid="studuino-port-settings-modal"]')).backgroundColor`,
        );
        expect(background).toBe('rgb(255, 255, 255)');
    });
    test('a block that can not be used keeps the mode and the dialog can show it (#2214)', async () => {
        await loadUri(`${uri}?no_beforeunload=1`);
        await activateSmalrubotS1Extension();
        // 見た目のブロック（Studuino モードでは使えない）を置く
        await driver.executeScript(`
            window.smalruby.vm.editingTarget.blocks.createBlock({
                id: 'studuino-unusable-test', opcode: 'looks_nextcostume', next: null, parent: null,
                inputs: {}, fields: {}, topLevel: true, shadow: false, x: 0, y: 0,
            });
        `);
        await toggleStuduinoMode();
        await driver.wait(() => existsByTestId('studuino-mode-switch-dialog'), 5000, 'Switch dialog did not open');
        const text = await driver.executeScript(
            `return document.querySelector('[data-testid="studuino-mode-switch-dialog"]').textContent`,
        );
        expect(text).toContain('1 blocks can not be used');
        // 本文は不透明
        const background = await driver.executeScript(
            `return getComputedStyle(document.querySelector('[data-testid="studuino-mode-switch-dialog"]')).backgroundColor`,
        );
        expect(background).toBe('rgb(255, 255, 255)');
        // やめる → モードは変わらない（パレットはそのまま）
        await clickByTestId('studuino-mode-switch-dialog-cancel');
        await sleep(500);
        expect(await existsByTestId('studuino-mode-switch-dialog')).toBe(false);
        expect(hasCategory(await categoryNames(), 'Motion')).toBe(true);
    });
    test('the green flag opens the write modal in the Studuino mode (#2219)', async () => {
        await loadUri(`${uri}?no_beforeunload=1`);
        await activateSmalrubotS1Extension();
        await toggleStuduinoMode();
        await driver.wait(() => existsByTestId('studuino-port-settings-modal'), 5000, 'Port settings did not open');
        await clickByTestId('studuino-port-settings-assign');
        await driver.wait(
            async () => !(await existsByTestId('studuino-port-settings-modal')),
            5000,
            'Port settings did not close',
        );
        await driver.executeScript(`
            window.smalruby.vm.editingTarget.blocks.createBlock({
                id: 'studuino-write-flag', opcode: 'event_whenflagclicked', next: null, parent: null,
                inputs: {}, fields: {}, topLevel: true, shadow: false, x: 0, y: 0,
            });
        `);
        // ほかの表示（メニューなど）が旗に重なってもクリックが届くよう、JS で押す
        await driver.executeScript(`document.querySelector('img[title="Go"]').click()`);
        await driver.wait(() => existsByTestId('studuino-write-modal'), 5000, 'Write modal did not open');
        // 検査は通る（CI のビルドには API の場所が無いので、hex を作るところで止まる）
        await driver.wait(
            () =>
                driver.executeScript(
                    `return document.querySelector('[data-testid="studuino-write-step-check"]').dataset.status === 'done'`,
                ),
            5000,
            'The check step did not finish',
        );
        const background = await driver.executeScript(
            `return getComputedStyle(document.querySelector('[data-testid="studuino-write-modal"]')).backgroundColor`,
        );
        expect(background).toBe('rgb(255, 255, 255)');
        expect(await existsByTestId('studuino-write-license')).toBe(true);
        await clickByTestId('studuino-write-close');
        await sleep(300);
        expect(await existsByTestId('studuino-write-modal')).toBe(false);
    });

    test('two green flags: the write modal lists the unused script and a click colors it (#2353)', async () => {
        await loadUri(`${uri}?no_beforeunload=1`);
        await activateSmalrubotS1Extension();
        await toggleStuduinoMode();
        await driver.wait(() => existsByTestId('studuino-port-settings-modal'), 5000, 'Port settings did not open');
        await clickByTestId('studuino-port-settings-assign');
        await driver.wait(
            async () => !(await existsByTestId('studuino-port-settings-modal')),
            5000,
            'Port settings did not close',
        );
        await driver.executeScript(`
            const blocks = window.smalruby.vm.editingTarget.blocks;
            ['studuino-flag-a', 'studuino-flag-b'].forEach((id, i) => blocks.createBlock({
                id, opcode: 'event_whenflagclicked', next: null, parent: null,
                inputs: {}, fields: {}, topLevel: true, shadow: false, x: 0, y: i * 200,
            }));
            window.smalruby.vm.emitWorkspaceUpdate();
        `);
        await sleep(500);
        await driver.executeScript(`document.querySelector('img[title="Go"]').click()`);
        await driver.wait(() => existsByTestId('studuino-write-notices'), 5000, 'Notices did not show');
        const notices = await driver.executeScript(
            `return [...document.querySelectorAll('[data-testid^="studuino-write-notice-"]')]` +
                `.map((e) => e.dataset.reason)`,
        );
        expect(notices).toEqual(['used_flag', 'unused_flag']);
        await clickByTestId('studuino-write-notice-1');
        await sleep(500);
        expect(await existsByTestId('studuino-write-modal')).toBe(false);
        const colored = await driver.executeScript(
            `return [...document.querySelectorAll('.studuinoNoticeBlock')].map((e) => e.getAttribute('data-id'))`,
        );
        expect(colored).toEqual(['studuino-flag-b']);
    });
});
