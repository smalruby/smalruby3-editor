/**
 * Integration tests for hiding Monaco's built-in iPad show-keyboard widget.
 *
 * Monaco's IPadShowKeyboard contribution adds a textarea.iPadShowKeyboard
 * overlay widget at the editor's bottom-right corner on iOS, which overlaps
 * the Smalruby zoom controls (issue #727). The widget is hidden via CSS in
 * ruby-tab.css. Selenium runs desktop Chrome where Monaco never creates the
 * widget, so the test injects the same DOM node and asserts the CSS applies.
 */
import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';

const seleniumHelper = new SeleniumHelper();
const { clickText, getDriver, loadUri } = seleniumHelper;

const uri = path.resolve(__dirname, '../../build/index.html');

let driver;

describe('Ruby tab Monaco iPad keyboard widget', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('iPadShowKeyboard widget is hidden by CSS inside the Ruby editor', async () => {
        await loadUri(uri);
        await clickText('Ruby', '*[@role="tab"]');

        const display = await driver.executeScript(`
            const editor = document.querySelector('.monaco-editor');
            if (!editor) return 'no-editor';
            const widget = document.createElement('textarea');
            widget.className = 'iPadShowKeyboard';
            editor.appendChild(widget);
            const display = window.getComputedStyle(widget).display;
            widget.remove();
            return display;
        `);

        expect(display).toEqual('none');
    });
});
