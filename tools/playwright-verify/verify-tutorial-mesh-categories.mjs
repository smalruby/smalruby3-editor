import { chromium } from 'playwright';

const URL = 'http://localhost:8601/?no_beforeunload=1&welcome=1';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'ja-JP',
});
const page = await context.newPage();
const log = (...args) => console.log('[verify]', ...args);

page.on('pageerror', (err) => console.error('[pageerror]', err.message));

await page.goto(URL);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(800);

// Welcome modal exposes a 'Start the first tutorial' CTA that opens tipsLibrary.
// First close any welcome tooltip balloon, then click the modal's start CTA.
const tooltipDismiss = page.locator('[data-testid="welcome-tooltip"] [aria-label*="閉じる"], [data-testid="welcome-tooltip"] [aria-label*="dismiss"]');
if (await tooltipDismiss.count()) {
    try { await tooltipDismiss.first().click({ force: true }); } catch {}
}

const startBtn = page.locator('[data-testid="welcome-modal-start-tutorial"]');
if (await startBtn.count()) {
    log('clicking welcome-modal-start-tutorial');
    await startBtn.click();
} else {
    log('welcome modal CTA not found, dismiss it and use menu bar');
    const laterBtn = page.locator('[data-testid="welcome-modal-later"]');
    if (await laterBtn.count()) {
        await laterBtn.click();
        await page.waitForTimeout(300);
    }
    // Click About menu (?) → use Tutorials in dropdown, or directly find tutorials button.
    // Smalruby has a question-mark button that opens the About menu containing Tutorials.
    const aboutBtn = page.locator('[aria-label="About"], [aria-label="アバウト"], [class*=menuBarItem][class*=about]').first();
    if (await aboutBtn.count()) {
        await aboutBtn.click();
        await page.waitForTimeout(300);
        const tutItems = await page.locator('[role=menuitem]').allTextContents();
        log('about menu items:', JSON.stringify(tutItems));
    }
}

await page.waitForTimeout(3000);

// Take screenshot regardless for debugging
await page.screenshot({ path: 'tmp/tutorial-mesh-categories-debug.png', fullPage: true });

// CSS Modules emits classes like `library_library-category-title_<hash>`.
// Find by partial match on `library-category-title`.
const titles = await page.evaluate(() => {
    const nodes = document.querySelectorAll('[class*="library-category-title"]');
    return Array.from(nodes).map((n) => n.textContent.trim());
});
log('category titles =', JSON.stringify(titles));

await page.screenshot({ path: 'tmp/tutorial-mesh-categories.png', fullPage: true });

const expected = [
    '通信入門 ① メッセージを送ってみよう',
    '通信入門 ② ふたりで会話しよう',
    '通信入門 ③ みんなで会話しよう (メッシュ)',
];
const missing = expected.filter((t) => !titles.includes(t));
if (missing.length) {
    console.error('MISSING titles:', missing);
    await page.screenshot({ path: 'tmp/tutorial-mesh-categories-failed.png', fullPage: true });
    await browser.close();
    process.exit(1);
}

log('OK: all 3 mesh-step categories visible');
await page.screenshot({ path: 'tmp/tutorial-mesh-categories.png', fullPage: true });
await browser.close();
