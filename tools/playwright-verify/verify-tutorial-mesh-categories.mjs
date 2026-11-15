import { chromium } from 'playwright';

// The welcome CTA now opens the lessons library, so open the tutorials list directly.
const URL = 'http://localhost:8601/?no_beforeunload=1&tutorial=all';
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

// tipsLibrary opens from ?tutorial=all (the welcome CTA now opens the lessons library).

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
