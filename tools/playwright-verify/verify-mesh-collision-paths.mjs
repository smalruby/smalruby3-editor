import { chromium } from 'playwright';
const URL = 'http://localhost:8601/?no_beforeunload=1&tab=ruby&ruby_version=2';
const log = (...a) => console.log('[all]', ...a);
let failed = false;
const fail = (m) => { console.error('[FAIL]', m); failed = true; };
const browser = await chromium.launch({ headless: process.env.HEADLESS !== "0", slowMo: process.env.HEADLESS === "0" ? 400 : 0 });

const fresh = async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForFunction(() => window.smalruby && window.smalruby.vm, { timeout: 30000 });
    return { ctx, page };
};

// Run Ruby through the real converter to build real-shape blocks/variables.
const convert = (page, code) =>
    page.evaluate(async (code) => {
        let req;
        await new Promise((r) => window.webpackChunkGUI.push([['__c__'], {}, (x) => { req = x; r(); }]));
        let tc;
        for (const id in req.c) {
            const e = req.c[id] && req.c[id].exports;
            if (e && typeof e.targetCodeToBlocks === 'function') { tc = e.targetCodeToBlocks; break; }
        }
        const vm = window.smalruby.vm;
        const t = vm.editingTarget || vm.runtime.targets.find((x) => !x.isStage);
        const conv = await tc(vm, t, code, { formatMessage: (m) => (m && m.defaultMessage) || '' }, {});
        if (conv.result) await conv.apply();
        return !!conv.result;
    }, code);

const bannerShows = (page) =>
    page.waitForSelector('[data-testid="mesh-self-sensor-notice"]', { timeout: 5000 }).then(() => true).catch(() => false);
const bannerCount = (page) => page.locator('[data-testid="mesh-self-sensor-notice"]').count();

// ---- Path 1: file load ----
{
    const { ctx, page } = await fresh();
    await convert(page, '$score = 0\nmove(mesh.sensor_value("score"))\n'); // collision built
    const b64 = await page.evaluate(async () => {
        const blob = await window.smalruby.vm.saveProjectSb3();
        const buf = await blob.arrayBuffer(); const bytes = new Uint8Array(buf);
        let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
        return btoa(s);
    });
    await page.reload();
    await page.waitForFunction(() => window.smalruby && window.smalruby.vm, { timeout: 30000 });
    await page.evaluate(() => localStorage.clear());
    await page.evaluate(async (b64) => {
        const bin = atob(b64); const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        await window.smalruby.vm.loadProject(bytes.buffer);
    }, b64);
    const ok = await bannerShows(page);
    log('1 file load → banner =', ok, ok ? 'OK' : 'FAIL');
    if (!ok) fail('path 1');
    await ctx.close();
}

// ---- Path 2: manual global variable add ----
{
    const { ctx, page } = await fresh();
    await convert(page, 'move(mesh.sensor_value("score"))\n'); // sensor 'score', no global 'score'
    await page.waitForTimeout(400);
    await page.evaluate(() => localStorage.clear());
    const pre = (await bannerCount(page)) === 0;
    await page.evaluate(() => {
        const vm = window.smalruby.vm;
        const t = vm.editingTarget || vm.runtime.targets.find((x) => !x.isStage);
        t.blocks.blocklyListen({ type: 'var_create', varId: 'v-score', varName: 'score', varType: '', isLocal: false, isCloud: false });
    });
    const ok = await bannerShows(page);
    log('2 var add → pre-clean =', pre, '| banner =', ok, pre && ok ? 'OK' : 'FAIL');
    if (!(pre && ok)) fail('path 2');
    await ctx.close();
}

// ---- Path 3: rename existing global variable ----
{
    const { ctx, page } = await fresh();
    await convert(page, 'move(mesh.sensor_value("score"))\n'); // sensor 'score'
    await page.evaluate(() => {
        const vm = window.smalruby.vm;
        const t = vm.editingTarget || vm.runtime.targets.find((x) => !x.isStage);
        t.blocks.blocklyListen({ type: 'var_create', varId: 'v-foo', varName: 'foo', varType: '', isLocal: false, isCloud: false });
    });
    await page.waitForTimeout(400);
    await page.evaluate(() => localStorage.clear());
    const pre = (await bannerCount(page)) === 0;
    await page.evaluate(() => {
        const vm = window.smalruby.vm;
        const t = vm.editingTarget || vm.runtime.targets.find((x) => !x.isStage);
        t.blocks.blocklyListen({ type: 'var_rename', varId: 'v-foo', newName: 'score', isLocal: false, isCloud: false });
    });
    const ok = await bannerShows(page);
    log('3 rename → pre-clean =', pre, '| banner =', ok, pre && ok ? 'OK' : 'FAIL');
    if (!(pre && ok)) fail('path 3');
    await ctx.close();
}

// ---- Path 4: sensor dropdown change (changes the menu shadow's field) ----
{
    const { ctx, page } = await fresh();
    await convert(page, '$score = 0\nmove(mesh.sensor_value("other"))\n'); // global 'score' + sensor 'other'
    await page.waitForTimeout(400);
    await page.evaluate(() => localStorage.clear());
    const pre = (await bannerCount(page)) === 0;
    const changed = await page.evaluate(() => {
        const vm = window.smalruby.vm;
        let menuId = null;
        for (const t of vm.runtime.targets) {
            const blks = t.blocks && t.blocks._blocks; if (!blks) continue;
            for (const id in blks) if (blks[id].opcode === 'meshV2_menu_variableNames') menuId = id;
            if (menuId) {
                const t2 = t;
                t2.blocks.changeBlock({ id: menuId, element: 'field', name: 'variableNames', value: 'score' });
                return true;
            }
        }
        return false;
    });
    const ok = await bannerShows(page);
    log('4 dropdown change → pre-clean =', pre, '| changed =', changed, '| banner =', ok, pre && changed && ok ? 'OK' : 'FAIL');
    if (!(pre && changed && ok)) fail('path 4');
    await ctx.close();
}

// ---- Path 5: Ruby tab edit (real conversion creating the collision) ----
{
    const { ctx, page } = await fresh();
    await page.evaluate(() => localStorage.clear());
    await convert(page, '$score = 0\nmove(mesh.sensor_value("score"))\n');
    const ok = await bannerShows(page);
    log('5 ruby edit → banner =', ok, ok ? 'OK' : 'FAIL');
    if (!ok) fail('path 5');
    await ctx.close();
}

await browser.close();
log(failed ? 'DONE WITH FAILURES' : 'ALL 5 PATHS PASSED');
process.exitCode = failed ? 1 : 0;
