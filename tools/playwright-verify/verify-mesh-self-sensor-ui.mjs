// Issue #707: drive the REAL extension-library UI to add Mesh (meshV2) and
// confirm the upgrade modal appears via genuine user clicks (not loadExtensionURL).
// This mirrors what a Playwright-MCP interactive session would do.
// HEADLESS=0 for a visible (headful) run on a machine with a display.
import { chromium } from 'playwright';

const URL = 'http://localhost:8601/?no_beforeunload=1';
const log = (...a) => console.log('[verify-ui]', ...a);
const fail = (m) => { console.error('[FAIL]', m); process.exitCode = 1; };

const headful = process.env.HEADLESS === '0';
const browser = await chromium.launch({ headless: !headful, slowMo: headful ? 600 : 0 });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();

await page.goto(URL);
await page.evaluate(() => localStorage.clear());
await page.reload();

// 1) Open the extension library via the bottom-left "+" button.
await page.waitForSelector('[data-testid="extension-button"]', { timeout: 30000 });
await page.click('[data-testid="extension-button"]');
await page.waitForSelector('#meshV2', { timeout: 10000 });
log('1 extension library opened OK (Mesh tile present)');
await page.screenshot({ path: 'tmp/mesh-ui-1-library.png' });

// 2) Click the Mesh tile (extensionId becomes the button id).
await page.waitForSelector('#meshV2', { timeout: 10000 });
await page.click('#meshV2');
log('2 clicked Mesh tile');

// 3) The upgrade modal should appear from the genuine EXTENSION_ADDED path.
const modal = await page.waitForSelector('[data-testid="mesh-v2-upgrade-modal"]', { timeout: 10000 }).catch(() => null);
log('3 upgrade modal appears via real UI add =', !!modal, modal ? 'OK' : 'FAIL');
if (!modal) fail('upgrade modal did not appear after adding Mesh from the library');
await page.waitForTimeout(500);
await page.screenshot({ path: 'tmp/mesh-ui-2-upgrade-modal.png' });

// Observe whether the peripheral connection modal also opened (meshV2 has
// launchPeripheralConnectionFlow: true) — both overlays may be present.
const connCount = await page.evaluate(() => {
    const hits = [];
    document.querySelectorAll('[class*="connection" i], [data-testid*="mesh-v2-"]').forEach((el) => {
        const tid = el.getAttribute('data-testid');
        if (tid && tid !== 'mesh-v2-upgrade-modal' && !tid.startsWith('mesh-v2-upgrade')) hits.push(tid);
    });
    return [...new Set(hits)].slice(0, 8);
});
log('   other mesh/connection elements present:', JSON.stringify(connCount));

// 4) Click "Switch to the new behavior" → modal closes, flag set.
await page.click('[data-testid="mesh-v2-upgrade-switch"]');
await page.waitForTimeout(400);
const flag = await page.evaluate(() => !!(window.smalruby && window.smalruby.vm.runtime.meshSelfInclusive));
const gone = (await page.locator('[data-testid="mesh-v2-upgrade-modal"]').count()) === 0;
log('4 after switch: modal gone =', gone, '| flag true =', flag, gone && flag ? 'OK' : 'FAIL');
if (!(gone && flag)) fail('switch did not close modal / set flag');
await page.screenshot({ path: 'tmp/mesh-ui-3-after-switch.png' });

if (headful) await page.waitForTimeout(2500);
await browser.close();
log(process.exitCode ? 'DONE WITH FAILURES' : 'ALL UI CHECKS PASSED');
