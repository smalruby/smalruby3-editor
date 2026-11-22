// Issue #1149: the Google sign-in button must live inside the modal and must
// never be left behind (or duplicated) when the login is abandoned.
//
// Google Identity Services is stubbed (the real GIS cannot run unattended and
// the container has no Google session), so this verifies OUR lifecycle:
// where the button is mounted, that repeated attempts do not stack up, and
// that closing the modal takes the button with it.
//
//   # In the container (default) — headless:
//   node verify-issue-1149-google-signin-cleanup.mjs
//
//   # On the HOST (macOS) — visible Chrome window:
//   HEADLESS=false CHANNEL=chrome SLOWMO=300 node verify-issue-1149-google-signin-cleanup.mjs
//
// Env: HEADLESS=false / CHANNEL=chrome / SLOWMO=<ms> / KEEP_OPEN=1 / BASE_URL=...
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const log = (...a) => console.log('[1149]', ...a);
const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOTS = resolve(__dirname, '.screenshots');
mkdirSync(SHOTS, { recursive: true });

const BASE_URL = process.env.BASE_URL || 'http://localhost:8601';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const assert = (cond, message) => {
    if (!cond) throw new Error(`assertion failed: ${message}`);
    log(`ok: ${message}`);
};

// Minimal GIS stub. The login no longer asks for One Tap, so `prompt()` is
// only counted to check that it stays unused.
const GIS_STUB = () => {
    window.__gis = { cancelCount: 0, promptCount: 0, callback: null };
    window.google = {
        accounts: {
            id: {
                initialize: (config) => {
                    window.__gis.config = config;
                    window.__gis.callback = config.callback;
                },
                prompt: (cb) => {
                    window.__gis.promptCount += 1;
                    window.__gis.promptCallback = cb || null;
                },
                renderButton: (element) => {
                    const button = document.createElement('button');
                    button.className = 'fake-gis-button';
                    button.textContent = 'Sign in with Google (stub)';
                    element.appendChild(button);
                },
                cancel: () => {
                    window.__gis.cancelCount += 1;
                },
            },
        },
    };
};

const HEADLESS = process.env.HEADLESS !== 'false';
const launchOpts = { headless: HEADLESS };
if (process.env.CHANNEL) launchOpts.channel = process.env.CHANNEL;
if (process.env.SLOWMO) launchOpts.slowMo = Number(process.env.SLOWMO);

const browser = await chromium.launch(launchOpts);
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => log('[pageerror]', e.message));

// Keep the real GIS script from replacing the stub (and from needing network).
await page.route('https://accounts.google.com/gsi/client', (route) => route.fulfill({ body: '' }));
await page.addInitScript(GIS_STUB);

const countStubButtons = () => page.locator('.fake-gis-button').count();
const countBodyOverlays = () =>
    page.evaluate(() => document.querySelectorAll('body > div[style*="z-index: 10000"]').length);

const openLoginPhase = async () => {
    await page.click('[data-testid="settings-menu"]');
    await sleep(300);
    await page.click('[data-testid="settings-classroom-management"]');
    await page.waitForSelector('[data-testid="classroom-phase-teacher-login"]', { timeout: 20000 });
};

let ok = false;
try {
    log('loading the editor...');
    await page.goto(`${BASE_URL}/?no_beforeunload=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[class*="gui_editor-wrapper"]', { timeout: 90000 });
    await sleep(1500);

    log('opening Settings -> Classroom management...');
    await openLoginPhase();
    await page.screenshot({ path: `${SHOTS}/1149-1-login-phase.png` });

    log('waiting for Google\'s button (it is the entry point from the start)...');
    await page.waitForSelector('.fake-gis-button', { timeout: 10000 });
    await page.screenshot({ path: `${SHOTS}/1149-2-button-in-modal.png` });

    assert(
        await page.locator('[data-testid="google-signin-slot"] .fake-gis-button').count(),
        'the sign-in button is rendered inside the modal slot',
    );
    assert((await countBodyOverlays()) === 0, 'no fixed overlay was appended to <body>');
    assert(
        (await page.locator('[data-testid="classroom-google-login"]').count()) === 0,
        'our own Google button is not shown next to Google\'s',
    );
    assert(await page.evaluate(() => window.__gis.promptCount === 0), 'One Tap prompt is never asked for');
    assert(
        await page.evaluate(() => window.__gis.config.use_fedcm_for_button === true),
        'Google\'s button uses the FedCM button mode',
    );

    log('closing the modal (abandoning the login)...');
    await page.keyboard.press('Escape');
    await sleep(800);
    assert((await countStubButtons()) === 0, 'closing the modal removes the sign-in button');
    assert((await countBodyOverlays()) === 0, 'nothing is left behind under <body>');
    assert(await page.evaluate(() => window.__gis.cancelCount > 0), 'the GIS login was cancelled on teardown');
    await page.screenshot({ path: `${SHOTS}/1149-3-after-close.png` });

    log('re-opening and completing the login with a stubbed credential...');
    await openLoginPhase();
    await page.waitForSelector('.fake-gis-button', { timeout: 10000 });
    assert((await countStubButtons()) === 1, 're-opening does not accumulate buttons');
    await page.evaluate(() => window.__gis.callback({ credential: 'stub.id.token' }));
    await sleep(800);
    assert((await countStubButtons()) === 0, 'a completed login removes the sign-in button');
    assert((await countBodyOverlays()) === 0, 'a completed login leaves nothing under <body>');
    await page.screenshot({ path: `${SHOTS}/1149-4-after-login.png` });

    // The bug report's login lives in a portal that mounts after its container,
    // so check that Google's button shows up there too.
    log('opening the bug report login...');
    await page.goto(`${BASE_URL}/?no_beforeunload=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="bug-report-link"]', { timeout: 90000 });
    await page.evaluate(() => window.localStorage.removeItem('smalruby:bugReportConsent'));
    await page.click('[data-testid="bug-report-link"]');
    const consent = page.locator('[data-testid="bug-report-consent-accept"]');
    if (await consent.count()) await consent.click();
    await page.waitForSelector('[data-testid="google-signin-slot"] .fake-gis-button', { timeout: 10000 });
    assert(
        (await page.locator('[data-testid="bug-report-login-google"]').count()) === 0,
        'the bug report shows Google\'s button in place of ours',
    );
    await page.screenshot({ path: `${SHOTS}/1149-5-bug-report-login.png` });

    ok = true;
    log(`PASS — screenshots in ${SHOTS}`);
} catch (e) {
    log('FAIL', e.message);
    await page.screenshot({ path: `${SHOTS}/1149-failure.png` }).catch(() => {});
} finally {
    if (!process.env.KEEP_OPEN) await browser.close();
}

process.exit(ok ? 0 : 1);
