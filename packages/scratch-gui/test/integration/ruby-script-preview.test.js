/**
 * Integration tests for Ruby script preview panel.
 */
import path from 'path';
import RubyHelper from '../helpers/ruby-helper';
import SeleniumHelper from '../helpers/selenium-helper';

const seleniumHelper = new SeleniumHelper();
const { clickXpath, getDriver, loadUri } = seleniumHelper;

const rubyHelper = new RubyHelper(seleniumHelper);
const { fillInRubyProgram } = rubyHelper;

const uri = path.resolve(__dirname, '../../build/index.html');

let driver;

// CSS Module class selectors
const SEL = {
    menuItem: '[class*="moreMenuItem"]',
    panel: '[class*="panel-container"]',
    codeArea: '[class*="code-area"]',
    copyButton: '[class*="copy-button"]',
    headerButton: '[class*="header-button"]',
};

/**
 * Click a menu item by matching its textContent via JS.
 */
const clickMenuItem = async text => {
    await driver.executeScript(`
        const items = document.querySelectorAll('${SEL.menuItem}');
        for (const item of items) {
            if (item.textContent.includes('${text}')) {
                item.click();
                return;
            }
        }
        throw new Error('Menu item not found: ${text}');
    `);
};

/**
 * Wait for the preview panel to appear and contain code.
 */
const waitForPreviewCode = async () => {
    await driver.wait(
        async () => {
            const text = await driver.executeScript(`
            const pre = document.querySelector('${SEL.codeArea}');
            return pre ? pre.textContent : '';
        `);
            return text.includes('require');
        },
        15000,
        'Preview panel did not show generated code',
    );
};

describe('Ruby script preview panel', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('opens preview panel from More menu and shows generated code', async () => {
        await loadUri(uri);
        await clickXpath('//*[@role="tab" and contains(., "Ruby")]');
        await fillInRubyProgram('self.when(:flag_clicked) { move(10) }');

        // Open More menu
        await clickXpath('//button[@aria-label="More options"]');
        await driver.sleep(300);

        // Click preview menu item
        await clickMenuItem('Preview Ruby script');

        // Wait for preview panel with generated code
        await waitForPreviewCode();

        // Check that the preview panel contains expected code
        const previewText = await driver.executeScript(`
            const pre = document.querySelector('${SEL.codeArea}');
            return pre ? pre.textContent : '';
        `);
        expect(previewText).toMatch(/require "smalruby3"/);
        // Matches both v1 (Sprite.new) and v2 (class ... < ::Smalruby3::Sprite)
        expect(previewText).toMatch(/Sprite/);
        expect(previewText).toMatch(/move\(10\)/);
    });

    test('copy button copies code to clipboard', async () => {
        // Mock clipboard API
        await driver.executeScript(`
            window.__copiedText = null;
            navigator.clipboard.writeText = (text) => {
                window.__copiedText = text;
                return Promise.resolve();
            };
        `);

        // Click copy button
        await driver.executeScript(`
            const btn = document.querySelector('${SEL.copyButton}');
            if (btn) btn.click();
            else throw new Error('Copy button not found');
        `);
        await driver.sleep(500);

        // Verify clipboard content
        const copiedText = await driver.executeScript('return window.__copiedText;');
        expect(copiedText).toMatch(/require "smalruby3"/);

        // Verify button text changes to "Copied!"
        const buttonText = await driver.executeScript(`
            const btn = document.querySelector('${SEL.copyButton}');
            return btn ? btn.textContent : '';
        `);
        expect(buttonText).toMatch(/Copied/);
    });

    test('shrink and expand toggle works', async () => {
        // Click shrink button via the panel's header buttons
        await driver.executeScript(`
            const panel = document.querySelector('${SEL.panel}');
            const header = panel.querySelector('[class*="header-buttons"]');
            const buttons = header.querySelectorAll('button');
            buttons[0].click();
        `);
        await driver.sleep(500);

        // Code area should not be visible when collapsed
        const codeAreaGone = await driver.executeScript(`
            const pre = document.querySelector('${SEL.codeArea}');
            if (!pre) return true;
            const rect = pre.getBoundingClientRect();
            return rect.height === 0;
        `);
        expect(codeAreaGone).toBe(true);

        // Click expand button
        await driver.executeScript(`
            const panel = document.querySelector('${SEL.panel}');
            const header = panel.querySelector('[class*="header-buttons"]');
            const buttons = header.querySelectorAll('button');
            buttons[0].click();
        `);
        await driver.sleep(500);

        // Code area should be visible again
        const codeAreaVisible = await driver.executeScript(`
            const pre = document.querySelector('${SEL.codeArea}');
            return pre ? pre.textContent.length > 0 : false;
        `);
        expect(codeAreaVisible).toBe(true);
    });

    test('close button closes the panel', async () => {
        // Click close button (second button in header-buttons)
        await driver.executeScript(`
            const panel = document.querySelector('${SEL.panel}');
            const header = panel.querySelector('[class*="header-buttons"]');
            const buttons = header.querySelectorAll('button');
            buttons[1].click();
        `);
        await driver.sleep(500);

        // Panel should be gone
        const panelExists = await driver.executeScript(`
            return !!document.querySelector('${SEL.panel}');
        `);
        expect(panelExists).toBe(false);
    });
});
