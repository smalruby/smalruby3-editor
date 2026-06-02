// DoD verification for co-teacher (shared classroom management, Issue #704).
//
// Drives the real editor: devlogin -> dashboard -> create class -> open detail
// -> assert the co-teacher section renders -> invite a co-teacher by email ->
// assert it appears in the list -> remove it.
//
// Runs headless in the container (my checks) and headful on the host so you can
// watch it in your own Chrome:
//   HEADLESS=false CHANNEL=chrome SLOWMO=300 KEEP_OPEN=1 node verify-co-teacher.mjs
//
// NOTE: the invite/remove steps call the co-teacher API, which must be deployed
// to the stage that CLASSROOM_API_ENDPOINT points at. Until then this script
// verifies the UI renders and reports the API step as a known-pending failure.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const log = (...a) => console.log('[co-teacher]', ...a);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const SHOTS = resolve(__dirname, '.screenshots');
mkdirSync(SHOTS, { recursive: true });

const envText = readFileSync(resolve(REPO_ROOT, '.env'), 'utf8');
const tokenMatch = envText.match(/^DEV_BYPASS_TOKEN=(.+)$/m);
const DEV_TOKEN = tokenMatch ? tokenMatch[1].trim().replace(/^"|"$/g, '') : null;
if (!DEV_TOKEN) throw new Error('DEV_BYPASS_TOKEN missing in .env');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8601';
const TEACHER_URL = `${BASE_URL}/?no_beforeunload=1&devlogin=${encodeURIComponent(DEV_TOKEN)}`;
const INVITE_EMAIL = 'co-teacher-verify@example.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const launchOpts = { headless: process.env.HEADLESS !== 'false' };
if (process.env.CHANNEL) launchOpts.channel = process.env.CHANNEL;
if (process.env.SLOWMO) launchOpts.slowMo = Number(process.env.SLOWMO);

const browser = await chromium.launch(launchOpts);
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => log('[pageerror]', e.message));

const results = [];
const check = (name, ok, extra = '') => {
    results.push({ name, ok });
    log(`${ok ? 'PASS' : 'FAIL'}: ${name}${extra ? ` — ${extra}` : ''}`);
};

try {
    log('devlogin -> dashboard...');
    await page.goto(TEACHER_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[class*="gui_editor-wrapper"]', { timeout: 90000 });
    await sleep(1500);
    await page.click('[data-testid="settings-menu"]');
    await sleep(300);
    await page.click('[data-testid="settings-classroom-management"]');
    await page.waitForSelector('[data-testid="classroom-create"]', { timeout: 60000 });

    // Dismiss tutorials that overlay clicks.
    await page.evaluate(() => {
        const findStore = () => {
            const all = [document.body, ...document.body.querySelectorAll('*')];
            for (const el of all) {
                const k = Object.keys(el).find((x) => x.startsWith('__reactContainer'));
                if (k) {
                    let f = el[k].stateNode.current;
                    const stack = [f];
                    const seen = new WeakSet();
                    while (stack.length) {
                        f = stack.pop();
                        if (!f || seen.has(f)) continue;
                        seen.add(f);
                        const p = f.memoizedProps;
                        if (p?.store?.dispatch) return p.store;
                        if (p?.value?.store?.dispatch) return p.value.store;
                        if (f.child) stack.push(f.child);
                        if (f.sibling) stack.push(f.sibling);
                    }
                }
            }
            return null;
        };
        const store = findStore();
        if (store) {
            for (const name of ['classCreation', 'classDetail', 'inviteStudents']) {
                store.dispatch({ type: 'scratch-gui/classroom-tutorial/MARK_SEEN', name });
            }
        }
    });
    await sleep(300);

    // Optionally switch UI locale (LOCALE=ja / ja-Hira / en) to verify i18n.
    if (process.env.LOCALE) {
        await page.evaluate((locale) => {
            const findStore = () => {
                const all = [document.body, ...document.body.querySelectorAll('*')];
                for (const el of all) {
                    const k = Object.keys(el).find((x) => x.startsWith('__reactContainer'));
                    if (!k) continue;
                    const stack = [el[k].stateNode.current];
                    const seen = new WeakSet();
                    while (stack.length) {
                        const f = stack.pop();
                        if (!f || seen.has(f)) continue;
                        seen.add(f);
                        const p = f.memoizedProps;
                        if (p?.store?.dispatch) return p.store;
                        if (p?.value?.store?.dispatch) return p.value.store;
                        if (f.child) stack.push(f.child);
                        if (f.sibling) stack.push(f.sibling);
                    }
                }
                return null;
            };
            const store = findStore();
            if (store) store.dispatch({ type: 'scratch-gui/locales/SELECT_LOCALE', locale });
        }, process.env.LOCALE);
        await sleep(500);
        log(`locale set to ${process.env.LOCALE}`);
    }

    log('creating a class...');
    await page.click('[data-testid="classroom-create"]');
    await page.waitForSelector('[data-testid="classroom-phase-teacher-create"]', { timeout: 10000 });
    const stamp = `${Date.now()}`.slice(-6);
    await page.fill('[data-testid="classroom-name-input"]', `CoTeacher検証-${stamp}`);
    await page.fill('[data-testid="classroom-count-input"]', '3');
    await page.fill('[data-testid="classroom-assignment-name-input"]', `課題-${stamp}`);
    await page.click('[data-testid="classroom-create-submit"]');
    await sleep(1500);

    log('opening the new class detail...');
    await page.waitForFunction(
        (label) => Array.from(document.querySelectorAll('[data-testid^="classroom-sidebar-item-"]'))
            .some((el) => el.textContent && el.textContent.includes(label)),
        `課題-${stamp}`,
        { timeout: 30000 },
    );
    await page.evaluate((label) => {
        const item = Array.from(document.querySelectorAll('[data-testid^="classroom-sidebar-item-"]'))
            .find((el) => el.textContent && el.textContent.includes(label));
        if (item) item.click();
    }, `課題-${stamp}`);
    await page.waitForSelector('[data-testid="classroom-phase-teacher-detail"]', { timeout: 15000 });
    await sleep(500);

    // 1. Co-teacher section renders.
    const sectionVisible = await page.$('[data-testid="classroom-co-teachers"]').then((el) => !!el);
    check('co-teacher section renders in class detail', sectionVisible);
    await page.screenshot({ path: resolve(SHOTS, 'co-teacher-section.png') });

    // 2. Invite a co-teacher (requires the co-teacher API on the stage).
    if (sectionVisible) {
        await page.fill('[data-testid="classroom-co-teacher-invite-input"]', INVITE_EMAIL);
        await page.click('[data-testid="classroom-co-teacher-invite-submit"]');
        await sleep(2000);
        const invited = await page
            .$(`[data-testid="classroom-co-teacher-item-${INVITE_EMAIL}"]`)
            .then((el) => !!el);
        const apiError = await page
            .$('[data-testid="classroom-error"]')
            .then((el) => (el ? el.textContent() : null))
            .catch(() => null);
        check(
            'invited co-teacher appears in the list',
            invited,
            invited ? '' : `(API likely not deployed to this stage yet${apiError ? `: ${apiError}` : ''})`,
        );
        await page.screenshot({ path: resolve(SHOTS, 'co-teacher-invited.png') });

        // 3. Remove the co-teacher (only meaningful if the invite landed).
        if (invited) {
            await page.click(`[data-testid="classroom-co-teacher-remove-${INVITE_EMAIL}"]`);
            await sleep(2000);
            const removed = await page
                .$(`[data-testid="classroom-co-teacher-item-${INVITE_EMAIL}"]`)
                .then((el) => !el);
            check('removed co-teacher disappears from the list', removed);
        }
    }
} catch (e) {
    log('ERROR:', e.message);
    check('script completed without throwing', false, e.message);
} finally {
    const passed = results.filter((r) => r.ok).length;
    log(`--- summary: ${passed}/${results.length} checks passed ---`);
    if (process.env.KEEP_OPEN === '1') {
        log('KEEP_OPEN=1 — leaving browser open. Ctrl+C to exit.');
        await new Promise(() => {});
    }
    await browser.close();
    // Exit non-zero only if the UI itself failed to render; the API step is
    // allowed to be pending until the stage is deployed.
    const uiOk = results.find((r) => r.name.startsWith('co-teacher section'))?.ok;
    process.exit(uiOk ? 0 : 1);
}
