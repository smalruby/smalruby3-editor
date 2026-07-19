// Smalruby Admin SPA (EPIC #1073) regression:
// login gate -> devlogin bypass -> section nav -> shared-assignments queue ->
// classrooms search -> restore tab -> bug-reports list (read-only).
//
// Requires the stg AdminStack + bug-report stack (with ADMIN_GOOGLE_CLIENT_ID
// audience patch) deployed, and the dev bypass identity dev-admin@example.com
// registered in SmalrubyAdmins-stg (see docs/admin/operations.md).
//
//   # In the container (headless, default) — starts its own SPA dev server:
//   node verify-admin.mjs
//
//   # Reuse an already-running 8602 server:
//   REUSE_SERVER=1 node verify-admin.mjs
//
// Env: HEADLESS / CHANNEL / SLOWMO / KEEP_OPEN / BASE_URL / ADMIN_API /
// BUG_REPORT_API / REUSE_SERVER
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const log = (...a) => console.log('[admin]', ...a);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const SHOTS = resolve(__dirname, '.screenshots');
mkdirSync(SHOTS, { recursive: true });

const envText = readFileSync(resolve(REPO_ROOT, '.env'), 'utf8');
const tokenMatch = envText.match(/^DEV_BYPASS_TOKEN=(.+)$/m);
const DEV_TOKEN = tokenMatch ? tokenMatch[1].trim().replace(/^"|"$/g, '') : null;
if (!DEV_TOKEN) throw new Error('DEV_BYPASS_TOKEN missing in .env');

const ADMIN_API = process.env.ADMIN_API || 'https://stg.admin.api.smalruby.app';
const BUG_REPORT_API = process.env.BUG_REPORT_API || 'https://stg.bug-report.api.smalruby.app';
const BASE_URL = process.env.BASE_URL || 'http://localhost:8602';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const assert = (cond, msg) => {
    if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
    log('OK:', msg);
};

// --- Preflight: the API must accept the bypass identity (403 = unregistered) ---
{
    const res = await fetch(`${ADMIN_API}/admin/me`, {
        headers: { Authorization: `Bearer ${DEV_TOKEN}` },
    });
    if (res.status === 403) {
        throw new Error(
            'dev-admin@example.com is not in SmalrubyAdmins-stg — register it first (docs/admin/operations.md)',
        );
    }
    assert(res.status === 200, `preflight /admin/me is 200 (got ${res.status})`);
    const garbage = await fetch(`${ADMIN_API}/admin/me`, {
        headers: { Authorization: 'Bearer not-a-real-token' },
    });
    assert(garbage.status === 401, 'a garbage token is rejected with 401');
}

// --- SPA dev server (spawned unless REUSE_SERVER=1) ---
let serverProc = null;
const serverUp = async () => {
    try {
        const res = await fetch(`${BASE_URL}/admin/`);
        return res.ok;
    } catch {
        return false;
    }
};
if (!(await serverUp())) {
    if (process.env.REUSE_SERVER === '1') throw new Error(`no server at ${BASE_URL}`);
    log('starting SPA dev server on 8602...');
    serverProc = spawn('npm', ['start'], {
        cwd: resolve(REPO_ROOT, 'packages/admin'),
        env: {
            ...process.env,
            ADMIN_API_ENDPOINT: ADMIN_API,
            BUG_REPORT_API_ENDPOINT: BUG_REPORT_API,
        },
        stdio: 'ignore',
        detached: true,
    });
    const t0 = Date.now();
    while (!(await serverUp())) {
        if (Date.now() - t0 > 120000) throw new Error('SPA dev server did not come up in 120s');
        await sleep(2000);
    }
    log('dev server is up');
}

const HEADLESS = process.env.HEADLESS !== 'false';
const launchOpts = { headless: HEADLESS };
if (process.env.CHANNEL) launchOpts.channel = process.env.CHANNEL;
if (process.env.SLOWMO) launchOpts.slowMo = Number(process.env.SLOWMO);

const browser = await chromium.launch(launchOpts);
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('pageerror', (e) => log('[pageerror]', e.message));

const tid = (id) => `[data-testid="${id}"]`;
const shot = async (name) => {
    const p = resolve(SHOTS, `admin-${name}.png`);
    await page.screenshot({ path: p });
    log('screenshot:', p);
};

let ok = false;
try {
    // --- 1. login gate (no token → sign-in screen, no dashboard) ---
    await page.goto(`${BASE_URL}/admin/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(tid('admin-login'), { timeout: 30000 });
    assert(!(await page.$(tid('admin-dashboard'))), 'without a token only the login screen renders');
    await shot('login');

    // --- 2. devlogin bypass → dashboard ---
    await page.goto(`${BASE_URL}/admin/?devlogin=${encodeURIComponent(DEV_TOKEN)}`, {
        waitUntil: 'domcontentloaded',
    });
    await page.waitForSelector(tid('admin-dashboard'), { timeout: 30000 });
    const email = await page.textContent(tid('admin-me-email'));
    assert(email.includes('dev-admin@example.com'), `dashboard shows the operator email (${email})`);

    // --- 3. みんなの課題 (default section): queue or empty state loads ---
    await page.waitForSelector(tid('shared-admin-view'), { timeout: 20000 });
    await page.waitForSelector(
        `${tid('shared-admin-queue')}, ${tid('shared-admin-queue-empty')}`,
        { timeout: 20000 },
    );
    assert(true, 'shared-assignments queue loads');
    await shot('shared-queue');

    // --- 4. クラス・課題: list loads, restore tab needs a query ---
    await page.click(tid('admin-nav-classrooms'));
    await page.waitForSelector(tid('classroom-admin-view'), { timeout: 20000 });
    await page.waitForSelector(
        `${tid('classroom-admin-list')}, ${tid('classroom-admin-empty')}`,
        { timeout: 20000 },
    );
    assert(true, 'classroom list loads');
    await shot('classrooms');

    await page.click(tid('classroom-admin-tab-restore'));
    await page.waitForSelector(tid('classroom-admin-hint'), { timeout: 10000 });
    assert(true, 'the restore tab waits for an explicit query');
    await page.fill(tid('classroom-admin-query'), `e2e-${Date.now()}`);
    await page.click(tid('classroom-admin-search'));
    await page.waitForSelector(
        `${tid('classroom-admin-list')}, ${tid('classroom-admin-empty')}`,
        { timeout: 30000 },
    );
    assert(true, 'snapshot search answers (most likely empty for a random query)');
    await shot('restore-search');

    // --- 5. バグ報告 (read-only) ---
    await page.click(tid('admin-nav-bug-reports'));
    await page.waitForSelector(tid('bug-admin-view'), { timeout: 20000 });
    await page.waitForSelector(`${tid('bug-admin-list')}, ${tid('bug-admin-empty')}`, {
        timeout: 20000,
    });
    const reportButtons = await page.$$('[data-testid^="bug-admin-item-"]');
    if (reportButtons.length > 0) {
        await reportButtons[0].click();
        await page.waitForSelector(tid('bug-admin-detail'), { timeout: 20000 });
        // Respond section: status select + reply comment, save armed only on
        // change (the E2E does NOT save — keep stg reports untouched).
        await page.waitForSelector(tid('bug-admin-status-select'), { timeout: 10000 });
        await page.waitForSelector(tid('bug-admin-reply-input'), { timeout: 10000 });
        const saveDisabled = await page.getAttribute(tid('bug-admin-save'), 'disabled');
        assert(saveDisabled !== null, 'save stays disabled until something changes');
        await shot('bug-report-detail');
        await page.click(tid('bug-admin-back'));
    } else {
        assert(true, 'bug-report list is empty (nothing to open)');
    }
    await shot('bug-reports');

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
    if (serverProc) {
        try {
            process.kill(-serverProc.pid);
        } catch {
            /* already gone */
        }
    }
    process.exit(ok ? 0 : 1);
}
