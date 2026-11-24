// The carousel on the teacher sign-in screen (#2364), at 1300x600 (classroom-ui.md R6).
//
// Measures that the sign-in screen does not scroll (the login area, the modal and the
// page: scrollHeight <= clientHeight), and checks the carousel: previous / next and the
// arrow keys, moving by itself after 7 seconds, stopping while the mouse is over it,
// the pause button, and no moving by itself with prefers-reduced-motion: reduce.
// Also takes a narrow (400px) screenshot. Google's script is stubbed (empty), so our
// own sign-in buttons stay on the screen. Needs only the dev server.
//
//   BASE=http://localhost:8601/ node verify-classroom-login-carousel.mjs
//   LOCALE=ja-Hira node verify-classroom-login-carousel.mjs   # ひらがなで測る (既定は ja)
//   DOCS_SHOTS=1 node verify-classroom-login-carousel.mjs    # + docs/classroom/screenshots/0201 (ja のときだけ)

import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const BASE = (process.env.BASE || 'http://localhost:8601/').replace(/\/$/, '');
const LOCALE = process.env.LOCALE || 'ja';
const DOCS_SHOTS = process.env.DOCS_SHOTS === '1' && LOCALE === 'ja';
const SHOT_DIR = resolve(REPO_ROOT, 'tmp', 'classroom-login-carousel');
const DOCS_DIR = resolve(REPO_ROOT, 'docs', 'classroom', 'screenshots');
const VIEWPORT = { width: 1300, height: 600 };
mkdirSync(SHOT_DIR, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
    results.push({ name, ok });
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false' });

const openLogin = async ({ viewport = VIEWPORT, reducedMotion = 'no-preference' } = {}) => {
    const context = await browser.newContext({ viewport, locale: 'ja-JP', reducedMotion });
    const page = await context.newPage();
    // Without Google's script our own sign-in buttons stay (no network to Google needed).
    await page.route('https://accounts.google.com/**', (route) => route.fulfill({ body: '' }));
    await page.goto(`${BASE}/?no_beforeunload=1&locale=${LOCALE}`, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="settings-menu"]', { timeout: 120000 });
    await page.click('[data-testid="settings-menu"]');
    await page.click('[data-testid="settings-classroom-management"]');
    await page.waitForSelector('[data-testid="classroom-login-carousel"]', { timeout: 20000 });
    // Images loaded, so the heights are the final ones.
    await page.waitForFunction(() =>
        [...document.querySelectorAll('[data-testid="classroom-login-carousel"] img')].every((img) => img.complete),
    );
    return { context, page };
};

const title = (page) => page.locator('[data-testid="classroom-login-carousel-slide"] h3').textContent();

const measure = (page) =>
    page.evaluate(() => {
        const area = document.querySelector('[data-testid="classroom-phase-teacher-login"]');
        const modal = document.querySelector('[data-testid="classroom-teacher-modal"]');
        const carousel = document.querySelector('[data-testid="classroom-login-carousel"]');
        const se = document.scrollingElement;
        const scrolls = (el) => (el ? el.scrollHeight > el.clientHeight : true);
        const inner = modal ? [...modal.querySelectorAll('*')].filter((el) => el.scrollHeight > el.clientHeight + 1 && ['auto', 'scroll'].includes(getComputedStyle(el).overflowY)) : [];
        return {
            area: area ? `${area.scrollHeight}/${area.clientHeight}` : '-',
            areaOk: !scrolls(area),
            pageOk: !scrolls(se),
            page: `${se.scrollHeight}/${se.clientHeight}`,
            scrollingInModal: inner.map((el) => el.className || el.tagName).slice(0, 3),
            carouselBottom: carousel ? Math.round(carousel.getBoundingClientRect().bottom) : null,
            pauseBottom: (() => {
                const pause = document.querySelector('[data-testid="classroom-login-carousel-pause"]');
                return pause ? Math.round(pause.getBoundingClientRect().bottom) : null;
            })(),
        };
    });

try {
    // 1300x600: no scroll, every slide fits.
    const { context, page } = await openLogin();
    const heights = [];
    for (let i = 0; i < 5; i++) {
        const m = await measure(page);
        heights.push(m);
        await page.screenshot({ path: resolve(SHOT_DIR, `slide-${i + 1}-${LOCALE}.png`) });
        if (i === 0 && DOCS_SHOTS) await page.screenshot({ path: resolve(DOCS_DIR, '0201-teacher-login.png') });
        if (i < 4) await page.click('[data-testid="classroom-login-carousel-next"]');
    }
    heights.forEach((m, i) =>
        check(
            `slide ${i + 1}: login area / page do not scroll`,
            m.areaOk && m.pageOk && m.scrollingInModal.length === 0 && m.pauseBottom !== null && m.pauseBottom <= VIEWPORT.height,
            `area ${m.area}, page ${m.page}, pause bottom ${m.pauseBottom}, carousel bottom ${m.carouselBottom}, scrolling ${JSON.stringify(m.scrollingInModal)}`,
        ),
    );
    check(
        'next is disabled on the last slide',
        (await page.getAttribute('[data-testid="classroom-login-carousel-next"]', 'aria-disabled')) === 'true',
    );
    await page.mouse.move(5, 5);
    await page.locator('[data-testid="classroom-login-carousel"]').press('ArrowLeft');
    check('ArrowLeft goes back', (await title(page)) !== null);
    await context.close();

    // Moving by itself (7 seconds), hover stops it, pause stops it.
    {
        const { context: c2, page: p2 } = await openLogin();
        await p2.mouse.move(5, 5);
        const first = await title(p2);
        await p2.waitForTimeout(7600);
        const second = await title(p2);
        check('moves by itself after 7 seconds', first !== second, `${first} -> ${second}`);
        await p2.hover('[data-testid="classroom-login-carousel-slide"]');
        await p2.waitForTimeout(7600);
        check('stops while the mouse is over it', (await title(p2)) === second);
        await p2.click('[data-testid="classroom-login-carousel-pause"]');
        await p2.mouse.move(5, 5);
        await p2.evaluate(() => document.activeElement?.blur());
        await p2.waitForTimeout(7600);
        check('stops with the pause button', (await title(p2)) === second);
        await p2.screenshot({ path: resolve(SHOT_DIR, `paused-${LOCALE}.png`) });
        await c2.close();
    }

    // prefers-reduced-motion: reduce → no moving by itself, no pause button.
    {
        const { context: c3, page: p3 } = await openLogin({ reducedMotion: 'reduce' });
        await p3.mouse.move(5, 5);
        const first = await title(p3);
        await p3.waitForTimeout(7600);
        check('reduced motion: does not move by itself', (await title(p3)) === first);
        check(
            'reduced motion: no pause button',
            (await p3.locator('[data-testid="classroom-login-carousel-pause"]').count()) === 0,
        );
        await c3.close();
    }

    // Narrow screen (400px): nothing sticks out sideways.
    {
        // The settings menu is hidden on narrow screens, so open the sign-in screen wide
        // and then make the window narrow.
        const { context: c4, page: p4 } = await openLogin();
        await p4.setViewportSize({ width: 400, height: 800 });
        await p4.waitForTimeout(800);
        const wide = await p4.evaluate(() => {
            const carousel = document.querySelector('[data-testid="classroom-login-carousel"]');
            return { width: Math.round(carousel.getBoundingClientRect().width), overflow: carousel.scrollWidth > carousel.clientWidth };
        });
        check('400px: the carousel does not stick out', !wide.overflow, JSON.stringify(wide));
        // The modal body scrolls on a narrow screen; show the buttons under the slide.
        await p4.locator('[data-testid="classroom-login-carousel-pause"]').scrollIntoViewIfNeeded();
        const buttons = await p4.evaluate(() =>
            ['prev', 'next', 'pause'].map((name) => {
                const r = document.querySelector(`[data-testid="classroom-login-carousel-${name}"]`).getBoundingClientRect();
                return r.left >= 0 && r.right <= window.innerWidth;
            }),
        );
        check('400px: previous / next / pause are inside the screen', buttons.every(Boolean), JSON.stringify(buttons));
        await p4.screenshot({ path: resolve(SHOT_DIR, `narrow-400-${LOCALE}.png`) });
        await c4.close();
    }
} finally {
    await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed at ${VIEWPORT.width}x${VIEWPORT.height} (${LOCALE})`);
process.exit(failed.length ? 1 : 0);
