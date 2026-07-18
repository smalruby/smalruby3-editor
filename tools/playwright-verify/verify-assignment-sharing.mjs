// みんなの課題 (shared assignment library, EPIC #1066) regression:
// share -> catalog -> filter -> detail (CC BY credit) -> import -> my posts
// (unlist / republish).
//
// Requires the dev server + the stg classroom API with the S1 endpoints
// (#1068) deployed. When the API is missing the share step fails fast.
//
//   # In the container (headless, default):
//   node verify-assignment-sharing.mjs
//
//   # On the host (watch it):
//   HEADLESS=false CHANNEL=chrome SLOWMO=200 node verify-assignment-sharing.mjs
//
// Env: HEADLESS / CHANNEL / SLOWMO / KEEP_OPEN / BASE_URL / LOCALE
// (LOCALE=ja-JP renders the UI in Japanese for docs screenshots)
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const log = (...a) => console.log('[shared]', ...a);
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
if (process.env.CHANNEL) launchOpts.channel = process.env.CHANNEL;
if (process.env.SLOWMO) launchOpts.slowMo = Number(process.env.SLOWMO);

const STAMP = `${Date.now()}`.slice(-6);
const CLASS_NAME = `共有検証${STAMP}`;
const ASSIGNMENT_NAME = `共有課題${STAMP}`;
const SHARED_TITLE = `ねこあつめ入門${STAMP}`;

const browser = await chromium.launch(launchOpts);
const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    ...(process.env.LOCALE ? { locale: process.env.LOCALE } : {}),
});
page.on('pageerror', (e) => log('[pageerror]', e.message));

const tid = (id) => `[data-testid="${id}"]`;
const shot = async (name) => {
    const p = resolve(SHOTS, `shared-${name}.png`);
    await page.screenshot({ path: p });
    log('screenshot:', p);
};
const assert = (cond, msg) => {
    if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
    log('OK:', msg);
};

let ok = false;
try {
    log('navigating with devlogin...');
    await page.goto(TEACHER_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[class*="gui_editor-wrapper"]', { timeout: 90000 });
    await sleep(1500);

    await page.click(tid('settings-menu'));
    await sleep(300);
    await page.click(tid('settings-classroom-management'));
    await page.waitForSelector(tid('classroom-phase-teacher-class-list'), { timeout: 60000 });

    // --- 1. class + assignment with content ---
    log(`creating class "${CLASS_NAME}" + assignment...`);
    await page.click(tid('classroom-class-create'));
    await page.fill(tid('classroom-class-create-name'), CLASS_NAME);
    await page.fill(tid('classroom-class-create-count'), '5');
    await page.fill(tid('classroom-class-create-assignment'), ASSIGNMENT_NAME);
    await page.click(tid('classroom-class-create-submit'));
    await page.waitForSelector(tid('classroom-board'), { timeout: 30000 });
    await sleep(800);

    log('adding assignment pages (share requires content)...');
    await page.click('[data-testid^="classroom-board-open-"]');
    await page.waitForSelector(tid('classroom-description-editor'), { timeout: 20000 });
    await page.fill(tid('classroom-assignment-page-text-0'), 'ねこを10歩動かすプログラムを作ろう');
    await page.click(tid('classroom-assignment-save'));
    await sleep(1500);

    // --- 2. share ---
    log('sharing the assignment...');
    await page.click(tid('classroom-share-assignment'));
    await page.waitForSelector(tid('shared-form'), { timeout: 10000 });
    await page.fill(tid('shared-form-title'), SHARED_TITLE);
    await page.fill(tid('shared-form-summary'), 'E2E 検証用の共有課題');
    await page.selectOption(tid('shared-form-level'), 'junior-high');
    await page.selectOption(tid('shared-form-subject'), '技術・家庭（技術分野）');
    await page.click(tid('shared-form-grade-1'));
    await page.fill(tid('shared-form-tags'), '甲子園, E2E');
    await page.fill(tid('shared-form-url'), 'https://docs.google.com/document/d/e2e/view');
    await page.fill(tid('shared-form-author-name'), 'E2E検証太郎');
    await page.fill(tid('shared-form-author-affiliation'), '島根県 検証中学校');
    await shot('form');
    await page.click(tid('shared-form-consent'));
    await page.click(tid('shared-form-submit'));
    await page.waitForSelector(tid('shared-form-success'), { timeout: 30000 });
    const successText = await page.textContent(tid('shared-form-success'));
    assert(/CC BY 4\.0/.test(successText || ''), `publish confirmation carries the CC BY credit ("${successText}")`);

    // --- 3. catalog: filter + detail ---
    log('browsing the catalog...');
    await page.click(tid('classroom-breadcrumb-assignments'));
    await page.waitForSelector(tid('classroom-board'), { timeout: 20000 });
    await page.click(tid('classroom-board-shared-catalog'));
    await page.waitForSelector(tid('shared-catalog'), { timeout: 20000 });
    await page.selectOption(tid('shared-catalog-filter-level'), 'junior-high');
    await page.fill(tid('shared-catalog-filter-tag'), 'E2E');
    await page.click(tid('shared-catalog-filter-apply'));
    await sleep(1500);

    const card = await page.waitForSelector(
        `${tid('shared-catalog-list')} >> text=${SHARED_TITLE}`,
        { timeout: 20000 },
    );
    assert(card, 'the shared item appears in the filtered catalog');
    await shot('catalog');

    // Open the specific card that carries our title.
    const cardButton = await page.evaluateHandle((title) => {
        const buttons = Array.from(document.querySelectorAll('[data-testid^="shared-catalog-open-"]'));
        return buttons.find((b) => b.textContent.includes(title)) || null;
    }, SHARED_TITLE);
    await cardButton.asElement().click();
    await page.waitForSelector(tid('shared-catalog-detail'), { timeout: 20000 });
    const credit = await page.textContent(tid('shared-detail-credit'));
    assert(/© E2E検証太郎（島根県 検証中学校） \/ CC BY 4\.0/.test(credit || ''), `detail shows the credit line ("${credit}")`);

    // Supplement URL sits behind the external-domain confirmation (D4).
    await page.click(tid('shared-detail-url'));
    const urlConfirm = await page.textContent(tid('shared-detail-url-confirm'));
    assert((urlConfirm || '').includes('docs.google.com'), 'external link confirmation names the domain');
    await page.click(tid('shared-detail-url-cancel'));
    await shot('detail');

    // --- 4. import into this class ---
    log('importing into the class...');
    await page.click(tid('shared-detail-import'));
    await page.waitForSelector(tid('shared-import-success'), { timeout: 30000 });
    await sleep(1000);
    const rows = await page.$$eval('[data-testid^="classroom-board-open-"]', (els) =>
        els.map((el) => el.textContent),
    );
    assert(
        rows.some((text) => text.includes(SHARED_TITLE)),
        'the imported assignment appears on the board as a new row',
    );
    await shot('imported');

    // --- 5. my posts: unlist -> republish ---
    log('managing my posts...');
    await page.click(tid('classroom-board-shared-catalog'));
    await page.waitForSelector(tid('shared-catalog'), { timeout: 20000 });
    await page.click(tid('shared-catalog-tab-mine'));
    await sleep(1500);
    const mineButton = await page.evaluateHandle((title) => {
        const buttons = Array.from(document.querySelectorAll('[data-testid^="shared-catalog-open-"]'));
        return buttons.find((b) => b.textContent.includes(title)) || null;
    }, SHARED_TITLE);
    await mineButton.asElement().click();
    await page.waitForSelector(tid('shared-detail-unlist'), { timeout: 20000 });
    await page.click(tid('shared-detail-unlist'));
    await sleep(1500);

    const unlistedCard = await page.evaluateHandle((title) => {
        const buttons = Array.from(document.querySelectorAll('[data-testid^="shared-catalog-open-"]'));
        return buttons.find((b) => b.textContent.includes(title)) || null;
    }, SHARED_TITLE);
    await unlistedCard.asElement().click();
    await page.waitForSelector(tid('shared-detail-republish'), { timeout: 20000 });
    await page.click(tid('shared-detail-republish'));
    await sleep(1500);
    assert(true, 'unlist -> republish round-trip completed');

    // Keep stg tidy: withdraw the E2E item at the end (it stays restorable).
    const cleanupCard = await page.evaluateHandle((title) => {
        const buttons = Array.from(document.querySelectorAll('[data-testid^="shared-catalog-open-"]'));
        return buttons.find((b) => b.textContent.includes(title)) || null;
    }, SHARED_TITLE);
    await cleanupCard.asElement().click();
    await page.waitForSelector(tid('shared-detail-unlist'), { timeout: 20000 });
    await page.click(tid('shared-detail-unlist'));
    await sleep(1000);
    log('cleanup: E2E item unlisted');

    ok = true;
} catch (e) {
    log('ERROR:', e.message);
    await shot('failure').catch(() => {});
} finally {
    log(ok ? 'PASS' : 'FAIL');
    if (process.env.KEEP_OPEN === '1') {
        log('KEEP_OPEN=1 — leaving browser open. Ctrl+C to exit.');
        await new Promise(() => {});
    }
    await browser.close();
    process.exit(ok ? 0 : 1);
}
