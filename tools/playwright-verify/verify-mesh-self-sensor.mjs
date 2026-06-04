// Issue #707 browser verification: Mesh v2 self-inclusive sensor value.
// Part A: upgrade modal flow (keep / switch / persistence) — no live backend.
// Part B: live AppSync round-trip — own variable readable in new mode + peer read.
import { chromium } from 'playwright';

const URL = 'http://localhost:8601/?no_beforeunload=1&tab=ruby&ruby_version=2';
const log = (...a) => console.log('[verify]', ...a);
const fail = (m) => {
    console.error('[FAIL]', m);
    process.exitCode = 1;
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
page.on('console', (m) => {
    const t = m.text();
    if (t.includes('Mesh') || t.includes('mesh')) log('page:', t);
});

await page.goto(URL);
await page.evaluate(() => localStorage.clear());
await page.reload();
// Wait for the VM debug global exposed by the Ruby tab.
await page.waitForFunction(() => window.smalruby && window.smalruby.vm, { timeout: 30000 });
log('VM ready');

// ============================================================
// Part A: upgrade modal flow
// ============================================================
const before = await page.evaluate(() => !!window.smalruby.vm.runtime.meshSelfInclusive);
log('A0 runtime.meshSelfInclusive before enable =', before, before === false ? 'OK' : 'UNEXPECTED');
if (before !== false) fail('flag should default to false');

// Enable the mesh extension → EXTENSION_ADDED → modal should appear (flag falsy).
await page.evaluate(() => window.smalruby.vm.extensionManager.loadExtensionURL('meshV2'));
let modal = await page.waitForSelector('[data-testid="mesh-v2-upgrade-modal"]', { timeout: 10000 }).catch(() => null);
log('A1 modal visible on enable =', !!modal, modal ? 'OK' : 'FAIL');
if (!modal) fail('modal did not appear on mesh enable');
await page.screenshot({ path: 'tmp/mesh-self-sensor-A1-modal.png' });

// "Keep going as is" → closes, persists nothing.
await page.click('[data-testid="mesh-v2-upgrade-keep"]');
await page.waitForTimeout(300);
let present = await page.locator('[data-testid="mesh-v2-upgrade-modal"]').count();
let flagAfterKeep = await page.evaluate(() => !!window.smalruby.vm.runtime.meshSelfInclusive);
log('A2 after keep: modal gone =', present === 0, '| flag still false =', flagAfterKeep === false, present === 0 && !flagAfterKeep ? 'OK' : 'FAIL');
if (present !== 0 || flagAfterKeep) fail('keep should close modal without setting flag');

// Re-trigger enable (keep path keeps prompting) → modal reappears.
await page.evaluate(() => {
    const ci = window.smalruby.vm.runtime._blockInfo.find((c) => c.id === 'meshV2');
    window.smalruby.vm.emit('EXTENSION_ADDED', ci);
});
modal = await page.waitForSelector('[data-testid="mesh-v2-upgrade-modal"]', { timeout: 5000 }).catch(() => null);
log('A3 modal reappears after re-enable (keep path) =', !!modal, modal ? 'OK' : 'FAIL');
if (!modal) fail('modal should reappear while still legacy');

// "Switch to the new behavior" → closes, sets the flag.
await page.click('[data-testid="mesh-v2-upgrade-switch"]');
await page.waitForTimeout(300);
present = await page.locator('[data-testid="mesh-v2-upgrade-modal"]').count();
let flagAfterSwitch = await page.evaluate(() => !!window.smalruby.vm.runtime.meshSelfInclusive);
log('A4 after switch: modal gone =', present === 0, '| flag true =', flagAfterSwitch === true, present === 0 && flagAfterSwitch ? 'OK' : 'FAIL');
if (present !== 0 || !flagAfterSwitch) fail('switch should close modal and set flag');

// Re-trigger enable now that flag is true → modal must NOT appear.
await page.evaluate(() => {
    const ci = window.smalruby.vm.runtime._blockInfo.find((c) => c.id === 'meshV2');
    window.smalruby.vm.emit('EXTENSION_ADDED', ci);
});
await page.waitForTimeout(800);
present = await page.locator('[data-testid="mesh-v2-upgrade-modal"]').count();
log('A5 modal suppressed once flag set =', present === 0, present === 0 ? 'OK' : 'FAIL');
if (present !== 0) fail('modal should be suppressed when flag is true');

// learn-more opens the explanation page in a new tab. Reset the flag so the
// modal shows again, then re-fire the real categoryInfo.
await page.evaluate(() => {
    window.smalruby.vm.runtime.meshSelfInclusive = false;
    const ci = window.smalruby.vm.runtime._blockInfo.find((c) => c.id === 'meshV2');
    window.smalruby.vm.emit('EXTENSION_ADDED', ci);
});
await page.waitForSelector('[data-testid="mesh-v2-upgrade-modal"]', { timeout: 5000 }).catch(() => null);
const popupP = context.waitForEvent('page', { timeout: 5000 }).catch(() => null);
await page.click('[data-testid="mesh-v2-upgrade-learn-more"]');
const popup = await popupP;
const popupUrl = popup ? popup.url() : '(none)';
log('A6 learn-more opened =', popupUrl, popupUrl.includes('mesh-self-sensor.html') ? 'OK' : 'FAIL');
if (!popupUrl.includes('mesh-self-sensor.html')) fail('learn-more should open mesh-self-sensor.html');
if (popup) await popup.close();

// ============================================================
// Part B: live AppSync round-trip (new mode)
// ============================================================
log('--- Part B: live AppSync round-trip ---');
const result = await page.evaluate(async () => {
    // Obtain webpack require and locate MeshV2Service.
    let req;
    await new Promise((resolve) => {
        window.webpackChunkGUI.push([['__probe707__'], {}, (r) => { req = r; resolve(); }]);
    });
    let MeshV2Service = null;
    for (const id in req.c) {
        const exp = req.c[id] && req.c[id].exports;
        if (typeof exp === 'function' && exp.prototype &&
            typeof exp.prototype.createGroup === 'function' &&
            typeof exp.prototype.getRemoteVariable === 'function' &&
            typeof exp.prototype.handleDataUpdate === 'function') {
            MeshV2Service = exp;
            break;
        }
    }
    if (!MeshV2Service) return { error: 'MeshV2Service not found in bundle' };

    const vm = window.smalruby.vm;
    vm.runtime.meshSelfInclusive = true; // new mode for this round-trip
    const ts = Date.now();
    const domain = `v707-${ts}`;
    const blocks = { runtime: vm.runtime, opcodeFunctions: { event_broadcast: () => {} } };

    const host = new MeshV2Service(blocks, `host-${ts}`, domain);
    host.testWebSocket = () => Promise.resolve(true);
    const node = new MeshV2Service(blocks, `node-${ts}`, domain);
    node.testWebSocket = () => Promise.resolve(true);

    const out = { useWebSocketHost: null, ownReadable: null, peerReadable: null, nodeOwn: null, nodePeer: null, error: null };
    try {
        await host.createGroup(`grp-${ts}`);
        await node.joinGroup(host.groupId, host.domain, `grp-${ts}`);
        out.useWebSocketHost = host.useWebSocket;

        await host.sendData([{ key: 'ownH', value: '100' }]);
        await node.sendData([{ key: 'ownN', value: '7' }]);
        await host.dataRateLimiter.waitForCompletion();
        await node.dataRateLimiter.waitForCompletion();
        // Wait for subscription echoes to arrive.
        await new Promise((r) => setTimeout(r, 4500));

        out.ownReadable = host.getRemoteVariable('ownH'); // NEW: own var via round-trip
        out.peerReadable = host.getRemoteVariable('ownN'); // peer var (regression check)
        out.nodeOwn = node.getRemoteVariable('ownN');
        out.nodePeer = node.getRemoteVariable('ownH');
    } catch (e) {
        out.error = String(e && e.message ? e.message : e);
    } finally {
        try { host.cleanup(); } catch (_e) {}
        try { node.cleanup(); } catch (_e) {}
    }
    return out;
});

log('B result =', JSON.stringify(result));
if (result.error) {
    fail(`Part B errored (likely no live AppSync endpoint): ${result.error}`);
} else {
    const okOwn = result.ownReadable === '100';
    const okPeer = result.peerReadable === '7';
    const okNodeOwn = result.nodeOwn === '7';
    const okNodePeer = result.nodePeer === '100';
    log('B1 host reads OWN var (new behavior) =', result.ownReadable, okOwn ? 'OK' : 'FAIL');
    log('B2 host reads PEER var (no regression) =', result.peerReadable, okPeer ? 'OK' : 'FAIL');
    log('B3 node reads OWN var =', result.nodeOwn, okNodeOwn ? 'OK' : 'FAIL');
    log('B4 node reads PEER var =', result.nodePeer, okNodePeer ? 'OK' : 'FAIL');
    if (!(okOwn && okPeer && okNodeOwn && okNodePeer)) fail('Part B assertions failed');
}

await browser.close();
log(process.exitCode ? 'DONE WITH FAILURES' : 'ALL CHECKS PASSED');
