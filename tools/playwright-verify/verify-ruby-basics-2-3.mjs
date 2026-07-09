// Verify the `ruby-basics-2-strings` and `ruby-basics-3-variables` decks:
//   1) Library shows the "Ruby のきほん" category with both new deck cards
//   2) Clicking a card opens the tutorial and auto-switches to the Ruby tab
//      (setup.tab='ruby') with DNCL mode OFF (setup.rubyMode='ruby')
//   3) Each deck's step titles advance
//   4) Each deck's closing step exposes the TryRuby external link + image
//
// Headless by default (devpod has no display). Run from repo root with the
// dev server up on :8601:  node tools/playwright-verify/verify-ruby-basics-2-3.mjs
import {chromium} from 'playwright';

const URL = 'http://localhost:8601/?no_beforeunload=1';
const browser = await chromium.launch({headless: process.env.HEADLESS !== 'false'});
const context = await browser.newContext({
    viewport: {width: 1280, height: 800},
    locale: 'ja-JP',
});
const page = await context.newPage();
const log = (...args) => console.log('[ruby2-3]', ...args);
const fail = msg => {
    console.error('FAIL:', msg);
    process.exit(1);
};

page.on('pageerror', err => console.error('[pageerror]', err.message));

// Probe the deck JSON in the bundle — structural assertions independent of UI.
const probeDeck = async deckId =>
    page.evaluate(
        id =>
            new Promise(resolve => {
                window.webpackChunkGUI.push([
                    ['__probe__'],
                    {},
                    req => {
                        for (const mid in req.c) {
                            const m = req.c[mid]?.exports?.default;
                            if (m && typeof m === 'object' && m[id]) {
                                const deck = m[id];
                                const last = deck.steps.slice(-1)[0];
                                const ext = last?.externalResources || {};
                                resolve({
                                    category: deck.category,
                                    urlId: deck.urlId,
                                    stepCount: deck.steps.length,
                                    codeSteps: deck.steps.filter(s => s.code).length,
                                    imagesPresent: deck.steps
                                        .filter(s => s.image)
                                        .every(s => typeof s.image === 'string'),
                                    tryRubyUrl: ext.tryruby?.url || null,
                                    tryRubyHasImg: !!ext.tryruby?.img,
                                });
                                return;
                            }
                        }
                        resolve(null);
                    },
                ]);
            }),
        deckId,
    );

const launchAndCheckSetup = async (deckName, deckId) => {
    // Open the tips library fresh each time via the menu-bar tutorials button.
    await page.goto(URL);
    await page.waitForTimeout(1200);
    // Open the "チュートリアル" library. The how-to button lives in the menu bar.
    await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('div,button,span')).find(n =>
            /チュートリアル|Tutorials/.test(n.textContent || ''),
        );
        if (btn) btn.click();
    });
    await page.waitForTimeout(1500);

    const cats = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[class*="library-category-title"]')).map(n =>
            n.textContent.trim(),
        ),
    );
    if (!cats.includes('Ruby のきほん')) fail('"Ruby のきほん" category not visible');
    log(`OK: category visible (launching ${deckId})`);

    await page.locator(`text="${deckName}"`).first().click();
    await page.waitForTimeout(2500);

    const cardOpen = await page.evaluate(
        () => document.querySelectorAll('[class*="card_card"]').length > 0,
    );
    if (!cardOpen) fail(`card did not open for ${deckId}`);

    const activeTab = await page.evaluate(() => {
        const sel = Array.from(document.querySelectorAll('[role="tab"]')).find(
            t => t.getAttribute('aria-selected') === 'true',
        );
        return sel ? sel.textContent.trim() : null;
    });
    if (!activeTab || !/ルビー|Ruby/i.test(activeTab)) {
        fail(`Ruby tab not auto-activated for ${deckId} (got ${activeTab})`);
    }
    const dnclMode = await page.evaluate(() => window.localStorage.getItem('smalruby:dnclMode'));
    if (dnclMode === 'true') fail(`dnclMode should be off for ${deckId}`);
    log(`OK: ${deckId} opens Ruby tab, DNCL off`);

    // Advance through steps, collecting distinct titles.
    const titles = [];
    for (let i = 0; i < 7; i++) {
        const cur = await page.evaluate(() => {
            const el = document.querySelector(
                '[class*="card_step-title"], [class*="card_stepTitle"]',
            );
            return el ? el.textContent.trim() : null;
        });
        if (cur) titles.push(cur);
        const startBtn = page.locator('[data-card-action="start-tutorial"]');
        const nextBtn = page.locator('[class*="right-button"]:not([class*="glow"])');
        if ((await startBtn.count()) > 0) {
            await startBtn.first().click({force: true});
        } else if ((await nextBtn.count()) > 0) {
            await nextBtn.first().click({force: true});
        } else {
            break;
        }
        await page.waitForTimeout(500);
    }
    const distinct = new Set(titles.filter(Boolean));
    log(`${deckId} distinct step titles surfaced: ${distinct.size}`);
    if (distinct.size < 2) fail(`${deckId} steps did not advance`);
};

const DECKS = [
    {id: 'ruby-basics-2-strings', name: '文字列（もじれつ）で遊ぼう'},
    {id: 'ruby-basics-3-variables', name: '変数（へんすう）を使ってみよう'},
];

// Structural probe first (needs the bundle loaded once).
await page.goto(URL);
await page.waitForTimeout(1500);
for (const {id} of DECKS) {
    const info = await probeDeck(id);
    if (!info) fail(`${id} not found in bundle`);
    log(`${id} =`, JSON.stringify(info));
    if (info.category !== 'rubyBasics') fail(`${id} wrong category`);
    if (info.stepCount < 6) fail(`${id} too few steps`);
    if (info.codeSteps < 1) fail(`${id} has no code steps`);
    if (!info.imagesPresent) fail(`${id} missing step images`);
    if (info.tryRubyUrl !== 'https://try.ruby-lang.org/') fail(`${id} bad TryRuby url`);
    if (!info.tryRubyHasImg) fail(`${id} TryRuby card has no image`);
}
log('OK: both decks structurally verified in bundle');

// UI launch check for each deck.
for (const {id, name} of DECKS) {
    await launchAndCheckSetup(name, id);
}

await page.screenshot({path: 'tmp/ruby2-3-final.png', fullPage: true});
log('PASS: ruby-basics 2 & 3 decks verified');
await browser.close();
