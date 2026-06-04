// Issue #707 (collision-notice approach): verify the one-time notice wiring.
// Introduces a global-variable / sensor-value collision in VM state, fires the
// same PROJECT_CHANGED event the real edits fire, and checks the banner shows
// once per browser (localStorage guard).
import { chromium } from 'playwright';

const URL = 'http://localhost:8601/?no_beforeunload=1&tab=ruby&ruby_version=2';
const log = (...a) => console.log('[notice]', ...a);
const fail = (m) => { console.error('[FAIL]', m); process.exitCode = 1; };

const headful = process.env.HEADLESS === '0';
const browser = await chromium.launch({ headless: !headful, slowMo: headful ? 500 : 0 });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

await page.goto(URL);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => window.smalruby && window.smalruby.vm, { timeout: 30000 });

// Introduce a collision: a global scalar variable "score" + a meshV2 sensor
// value block reading "score" on a sprite, then fire PROJECT_CHANGED.
const introduceCollision = () =>
    page.evaluate(() => {
        const vm = window.smalruby.vm;
        const stage = vm.runtime.getTargetForStage();
        stage.variables['score-id'] = { id: 'score-id', name: 'score', type: '', value: 0 };
        const sprite = vm.runtime.targets.find((t) => !t.isStage);
        sprite.blocks._blocks['sensor-blk'] = {
            id: 'sensor-blk',
            opcode: 'meshV2_getSensorValue',
            fields: { NAME: { name: 'NAME', value: 'score' } },
            inputs: {},
        };
        vm.runtime.emitProjectChanged();
    });

// 0: no banner before any collision.
await page.waitForTimeout(500);
let pre = await page.locator('[data-testid="mesh-self-sensor-notice"]').count();
log('0 no banner initially =', pre === 0, pre === 0 ? 'OK' : 'FAIL');
if (pre !== 0) fail('banner should not show without a collision');

// 1: collision → banner appears (after debounce).
await introduceCollision();
const banner = await page.waitForSelector('[data-testid="mesh-self-sensor-notice"]', { timeout: 5000 }).catch(() => null);
log('1 banner appears on collision =', !!banner, banner ? 'OK' : 'FAIL');
if (!banner) fail('banner did not appear on collision');
await page.screenshot({ path: 'tmp/mesh-notice-1-shown.png' });

// localStorage guard set.
const shownFlag = await page.evaluate(() => localStorage.getItem('smalruby:meshSelfSensorNoticeShown'));
log('2 localStorage guard set =', shownFlag === 'true', shownFlag === 'true' ? 'OK' : 'FAIL');
if (shownFlag !== 'true') fail('localStorage guard not set');

// 3: dismiss closes the banner.
await page.click('[data-testid="mesh-self-sensor-notice-dismiss"]');
await page.waitForTimeout(300);
let afterDismiss = await page.locator('[data-testid="mesh-self-sensor-notice"]').count();
log('3 dismiss closes banner =', afterDismiss === 0, afterDismiss === 0 ? 'OK' : 'FAIL');
if (afterDismiss !== 0) fail('dismiss did not close banner');

// 4: another collision change does NOT re-show (guard, same session).
await introduceCollision();
await page.waitForTimeout(600);
let reshow = await page.locator('[data-testid="mesh-self-sensor-notice"]').count();
log('4 not re-shown after guard (same session) =', reshow === 0, reshow === 0 ? 'OK' : 'FAIL');
if (reshow !== 0) fail('banner re-shown despite guard');

// 5: reload (localStorage persists) → collision → still not shown.
await page.reload();
await page.waitForFunction(() => window.smalruby && window.smalruby.vm, { timeout: 30000 });
await introduceCollision();
await page.waitForTimeout(600);
let afterReload = await page.locator('[data-testid="mesh-self-sensor-notice"]').count();
log('5 not shown after reload (once per browser) =', afterReload === 0, afterReload === 0 ? 'OK' : 'FAIL');
if (afterReload !== 0) fail('banner shown again after reload despite once-per-browser guard');

if (headful) await page.waitForTimeout(2000);
await browser.close();
log(process.exitCode ? 'DONE WITH FAILURES' : 'ALL NOTICE CHECKS PASSED');
