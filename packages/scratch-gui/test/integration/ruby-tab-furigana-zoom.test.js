/**
 * Integration tests for furigana zoom follow behavior.
 * Verifies that furigana annotations are re-rendered when zoom level changes.
 *
 * Note: In headless Chrome, Monaco's lineHeight may not scale proportionally
 * to fontSize, so we verify zone existence and label correctness rather than
 * exact pixel dimensions.
 */
import path from 'path';
import RubyHelper from '../helpers/ruby-helper';
import SeleniumHelper from '../helpers/selenium-helper';

const seleniumHelper = new SeleniumHelper();
const { clickText, clickXpath, getDriver, loadUri } = seleniumHelper;

const rubyHelper = new RubyHelper(seleniumHelper);
const { fillInRubyProgram } = rubyHelper;

const uri = path.resolve(__dirname, '../../build/index.html');

let driver;

/**
 * Get furigana zone count and labels from the editor DOM.
 */
const getFuriganaInfo = async () => {
    return driver.executeScript(`
        const editor = window.monacoEditor;
        const editorFontSize = editor.getOption(monaco.editor.EditorOption.fontSize);
        const container = document.querySelector('.view-zones');
        if (!container) return { zoneCount: 0, labels: [], editorFontSize };
        const nodes = container.querySelectorAll('div[style*="pointer-events: none"]');
        const labels = [];
        nodes.forEach(node => {
            node.querySelectorAll('span').forEach(s => labels.push(s.textContent));
        });
        return {
            zoneCount: nodes.length,
            labels,
            editorFontSize
        };
    `);
};

/**
 * Click the zoom-in button in the Ruby tab.
 */
const clickZoomIn = async () => {
    await clickXpath('//button[@data-testid="ruby-zoom-in"]');
};

/**
 * Click the zoom-reset button in the Ruby tab.
 */
const clickZoomReset = async () => {
    await clickXpath('//button[@data-testid="ruby-zoom-reset"]');
};

describe('Ruby tab furigana zoom follow', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('furigana zones persist with correct labels after zoom in', async () => {
        // locale=ja is required because furigana mode is only available in Japanese locales
        // tab=ruby to open Ruby tab directly (avoids locale-dependent tab label)
        await loadUri(`${uri}?locale=ja&tab=ruby`);
        await fillInRubyProgram('x = 10\nputs(x)');

        // Wait for furigana to render
        await driver.sleep(1000);

        const beforeInfo = await getFuriganaInfo();
        expect(beforeInfo.zoneCount).toBeGreaterThan(0);
        expect(beforeInfo.labels.some((l) => l.includes('変数'))).toBe(true);
        expect(beforeInfo.editorFontSize).toBe(16); // default

        // Zoom in 3 times (16 → 18 → 20 → 24)
        await clickZoomIn();
        await clickZoomIn();
        await clickZoomIn();
        await driver.sleep(500);

        const afterInfo = await getFuriganaInfo();

        // Editor font size must have increased
        expect(afterInfo.editorFontSize).toBe(24);

        // Furigana zones must still exist with correct labels
        // (Before the fix, zones would become stale/misaligned)
        expect(afterInfo.zoneCount).toBeGreaterThan(0);
        expect(afterInfo.labels.some((l) => l.includes('変数'))).toBe(true);
        expect(afterInfo.labels.some((l) => l.includes('表示する'))).toBe(true);
    });

    test('furigana zones persist after zoom reset', async () => {
        // Continue from previous test (zoomed in state at fontSize 24)
        await clickZoomReset();
        await driver.sleep(500);

        const resetInfo = await getFuriganaInfo();

        // Editor font size should return to default
        expect(resetInfo.editorFontSize).toBe(16);

        // Furigana zones must still exist with correct labels
        expect(resetInfo.zoneCount).toBeGreaterThan(0);
        expect(resetInfo.labels.some((l) => l.includes('変数'))).toBe(true);
    });
});
