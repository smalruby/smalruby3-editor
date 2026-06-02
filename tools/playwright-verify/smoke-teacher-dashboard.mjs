// Smoke test: navigate with devlogin, open classroom management, reach the
// teacher dashboard, screenshot, and exit (does NOT hang).
//
// Runs both headless (in the container) and headful (on the host, so you can
// WATCH it in your own Chrome). Controlled by env vars:
//
//   # In the container (my quick checks) — headless, default:
//   node smoke-teacher-dashboard.mjs
//
//   # On the HOST (macOS) — visible Google Chrome window you can watch:
//   #   port 8601 is already forwarded to the host (devcontainer forwardPorts),
//   #   so the dev server in the container is reachable at localhost:8601.
//   HEADLESS=false CHANNEL=chrome SLOWMO=300 node smoke-teacher-dashboard.mjs
//
// Env:
//   HEADLESS=false  -> show the browser window (default true)
//   CHANNEL=chrome  -> use the installed Google Chrome instead of bundled Chromium
//   SLOWMO=<ms>     -> slow each action down so it's easy to follow by eye
//   KEEP_OPEN=1     -> leave the browser open at the end for inspection
//   BASE_URL=...    -> override http://localhost:8601
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const log = (...a) => console.log('[smoke]', ...a);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const ENV_PATH = resolve(REPO_ROOT, '.env');
const SHOTS = resolve(__dirname, '.screenshots');
mkdirSync(SHOTS, { recursive: true });

const envText = readFileSync(ENV_PATH, 'utf8');
const tokenMatch = envText.match(/^DEV_BYPASS_TOKEN=(.+)$/m);
const DEV_TOKEN = tokenMatch ? tokenMatch[1].trim().replace(/^"|"$/g, '') : null;
if (!DEV_TOKEN) throw new Error('DEV_BYPASS_TOKEN missing in .env');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8601';
const TEACHER_URL = `${BASE_URL}/?no_beforeunload=1&devlogin=${encodeURIComponent(DEV_TOKEN)}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const HEADLESS = process.env.HEADLESS !== 'false';
const launchOpts = { headless: HEADLESS };
if (process.env.CHANNEL) launchOpts.channel = process.env.CHANNEL; // e.g. 'chrome'
if (process.env.SLOWMO) launchOpts.slowMo = Number(process.env.SLOWMO);
log(`launching browser (headless=${HEADLESS}, channel=${process.env.CHANNEL || 'bundled-chromium'})`);

const browser = await chromium.launch(launchOpts);
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => log('[pageerror]', e.message));

let ok = false;
try {
    log('navigating with devlogin...');
    await page.goto(TEACHER_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[class*="gui_editor-wrapper"]', { timeout: 90000 });
    await sleep(1500);

    log('opening Settings -> Classroom management...');
    await page.click('[data-testid="settings-menu"]');
    await sleep(300);
    await page.click('[data-testid="settings-classroom-management"]');

    log('waiting for classroom modal (login or dashboard)...');
    await page.waitForSelector(
        '[data-testid="classroom-phase-teacher-login"], [data-testid="classroom-create"]',
        { timeout: 20000 },
    );

    log('polling for teacher dashboard (devlogin auto-login, up to 60s)...');
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
        if (await page.$('[data-testid="classroom-create"]')) {
            ok = true;
            break;
        }
        await sleep(1500);
    }

    const shot = resolve(SHOTS, 'smoke-teacher-dashboard.png');
    await page.screenshot({ path: shot });
    log('screenshot saved:', shot);

    if (ok) {
        const classCount = await page.$$eval(
            '[data-testid^="classroom-sidebar-item-"]',
            (els) => els.length,
        ).catch(() => 0);
        log(`PASS: teacher dashboard reached. sidebar classes visible: ${classCount}`);
    } else {
        const phase = await page
            .evaluate(() => {
                const el = document.querySelector('[data-testid^="classroom-phase-"]');
                return el ? el.getAttribute('data-testid') : '(none)';
            })
            .catch(() => '(unknown)');
        log(`FAIL: dashboard not reached. current phase: ${phase}`);
    }
} catch (e) {
    log('ERROR:', e.message);
} finally {
    if (process.env.KEEP_OPEN === '1') {
        log('KEEP_OPEN=1 set — leaving browser open. Ctrl+C to exit.');
        await new Promise(() => {});
    }
    await browser.close();
    process.exit(ok ? 0 : 1);
}
