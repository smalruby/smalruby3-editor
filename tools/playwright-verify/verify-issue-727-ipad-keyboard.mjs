// Verify issue #727: Monaco's iPad show-keyboard widget is hidden and the
// Ruby toolbar keyboard toggle button replaces it on touch devices.
//
// Emulates an iPad (UA contains "iPad" + hasTouch) so that Monaco's isIOS
// detection (UA Macintosh/iPad/iPhone && maxTouchPoints > 0) creates the
// IPadShowKeyboard overlay widget, then checks:
//   1. The widget is display:none (hidden by ruby-tab.css)
//   2. All 4 zoom-corner buttons are clickable (nothing overlaps them)
//   3. ruby-toolbar-keyboard button is rendered
//   4. Clicking it focuses Monaco's textarea (keyboard would appear)
//   5. Clicking it again blurs the textarea (keyboard would dismiss)
// Then with a desktop context (no touch), checks the button is absent.
//
// Usage: node tools/playwright-verify/verify-issue-727-ipad-keyboard.mjs
import {chromium} from 'playwright';

const URL = 'http://localhost:8601?no_beforeunload=1&tab=ruby&ruby_version=2';
const results = [];
const check = (name, ok, detail = '') => {
    results.push({name, ok, detail});
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch();

// --- iPad context -----------------------------------------------------------
const ipad = await browser.newContext({
    userAgent:
        'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
        '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    viewport: {width: 1180, height: 820},
    hasTouch: true,
});
const page = await ipad.newPage();
await page.goto(URL);
await page.waitForFunction(() => window.monaco && monaco.editor.getEditors().length > 0);
// IPadShowKeyboard is registered with "Eventually" instantiation; give it time.
await page.waitForTimeout(3000);

const widget = await page.evaluate(() => {
    const el = document.querySelector('.monaco-editor .iPadShowKeyboard');
    if (!el) return {exists: false};
    return {exists: true, display: window.getComputedStyle(el).display};
});
check(
    'Monaco iPad keyboard widget is created (emulation works) and hidden',
    widget.exists && widget.display === 'none',
    JSON.stringify(widget)
);

// Zoom corner buttons: visible, enabled, and topmost at their center point.
for (const testid of ['ruby-screenshot', 'ruby-zoom-in', 'ruby-zoom-out', 'ruby-zoom-reset']) {
    const r = await page.evaluate(id => {
        const btn = document.querySelector(`[data-testid="${id}"]`);
        if (!btn) return {found: false};
        const rect = btn.getBoundingClientRect();
        const topEl = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2
        );
        return {
            found: true,
            visible: rect.width > 0 && rect.height > 0,
            unobstructed: btn.contains(topEl) || topEl === btn,
            topEl: topEl && `${topEl.tagName}.${topEl.className}`.slice(0, 60),
        };
    }, testid);
    check(`${testid} is clickable (not covered)`, r.found && r.visible && r.unobstructed,
        JSON.stringify(r));
}

// Zoom in/out/reset actually work (fontSize changes and resets).
const zoomWorks = await (async () => {
    const fontSize = () => page.evaluate(
        () => monaco.editor.getEditors()[0].getOption(monaco.editor.EditorOption.fontSize));
    const before = await fontSize();
    await page.getByTestId('ruby-zoom-in').click();
    const zoomedIn = await fontSize();
    await page.getByTestId('ruby-zoom-reset').click();
    const reset = await fontSize();
    return {before, zoomedIn, reset, ok: zoomedIn > before && reset === before};
})();
check('zoom in/reset buttons function', zoomWorks.ok, JSON.stringify(zoomWorks));

// Keyboard toggle button shown on touch device.
const kb = page.getByTestId('ruby-toolbar-keyboard');
check('ruby-toolbar-keyboard is rendered on iPad', await kb.count() === 1);

// Monaco 0.55+ focuses div.native-edit-context (EditContext strategy);
// older versions focus textarea.inputarea. Accept either.
const activeIsMonacoInput = () => page.evaluate(() => {
    const a = document.activeElement;
    if (!a || !a.closest('.monaco-editor')) return false;
    return a.classList.contains('native-edit-context') || a.classList.contains('inputarea');
});

// Start unfocused.
await page.evaluate(() => document.activeElement && document.activeElement.blur());
await page.waitForTimeout(300);

await kb.click();
await page.waitForTimeout(300);
check('1st tap focuses Monaco input element (keyboard shows)', await activeIsMonacoInput());
check('button reflects pressed state', await kb.getAttribute('aria-pressed') === 'true');

await kb.click();
await page.waitForTimeout(300);
check('2nd tap blurs Monaco input element (keyboard hides)', !(await activeIsMonacoInput()));
check('button reflects unpressed state', await kb.getAttribute('aria-pressed') === 'false');

await page.screenshot({path: 'tools/playwright-verify/tmp/issue-727-ipad-ruby-tab.png'});
await ipad.close();

// --- Desktop context --------------------------------------------------------
const desktop = await browser.newContext({viewport: {width: 1280, height: 800}});
const dpage = await desktop.newPage();
await dpage.goto(URL);
await dpage.waitForFunction(() => window.monaco && monaco.editor.getEditors().length > 0);
await dpage.waitForTimeout(2000);

const desktopState = await dpage.evaluate(() => ({
    keyboardButton: Boolean(document.querySelector('[data-testid="ruby-toolbar-keyboard"]')),
    monacoWidget: Boolean(document.querySelector('.monaco-editor .iPadShowKeyboard')),
}));
check('desktop: keyboard toggle button is absent', !desktopState.keyboardButton);
check('desktop: Monaco widget is absent (no iOS detection)', !desktopState.monacoWidget);
await dpage.screenshot({path: 'tools/playwright-verify/tmp/issue-727-desktop-ruby-tab.png'});
await desktop.close();

await browser.close();

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
