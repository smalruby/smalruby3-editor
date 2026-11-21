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
        await driver.wait(
            async () => !hasCategory(await categoryNames(), 'Motion'),
            5000,
            'The palette was not narrowed in the Studuino mode',
        );
        expectCategories(
            await categoryNames(),
            ['Events', 'Control', 'Sensing', 'Operators', 'Variables'],
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
});
