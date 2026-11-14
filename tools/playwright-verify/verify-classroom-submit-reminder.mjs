/**
 * 「提出しよう」の吹き出し (#1835) の収まりの確認。
 *
 *   1. PC・iPad: メニューバーの「提出する」の下に吹き出しが出て、画面からはみ出さず、
 *      ほかの見えている操作（ボタン・タブ・入力欄・メニューバーの項目）と重ならないか（3 言語）
 *   2. スマホ: ☰ に点が出て、☰ を開くとドロワーの「提出する」の下に吹き出しが出て、
 *      ドロワーのほかの項目と重ならないか
 *   3. メニューバーでは、しっぽの先と「提出する」の下端の縦の距離・横のずれを出す
 *      （下へずらすのは 56px まで。置けないときは吹き出しの代わりに「提出する」の右上の点）
 *   4. × で消すと、吹き出し（と ☰ の点）が消えるか
 *
 * 参加して 30 分たった状態を sessionStorage（smalruby:classroomSubmitReminder）と
 * localStorage（smalruby:classroom の joinedAt）に入れて開く。classroom API はスタブ（dev server だけが前提）。
 *
 *   node verify-classroom-submit-reminder.mjs                  # コンテナ内 (headless)
 *   BASE=http://localhost:8635 node verify-classroom-submit-reminder.mjs
 *   DOCS_SHOTS=1 node verify-classroom-submit-reminder.mjs     # docs/classroom/screenshots も撮る
 */
import { chromium } from 'playwright';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HEADLESS = process.env.HEADLESS !== 'false';
const CHANNEL = process.env.CHANNEL || undefined;
const BASE = process.env.BASE || 'http://localhost:8601';
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOT_DIR = process.env.SHOT_DIR || resolve(REPO_ROOT, 'tmp');
const DOCS_SHOTS = process.env.DOCS_SHOTS === '1';
const DOCS_DIR = resolve(REPO_ROOT, 'docs', 'classroom', 'screenshots');

const VIEWPORTS = [
    { name: 'pc-1300x600', width: 1300, height: 600 },
    { name: 'ipad-landscape-1024x768', width: 1024, height: 768 },
    { name: 'ipad-portrait-768x1024', width: 768, height: 1024 },
    { name: 'ipad-mini-744x1133', width: 744, height: 1133 },
    { name: 'phone-844x390', width: 844, height: 390, phone: true },
    { name: 'phone-667x375', width: 667, height: 375, phone: true },
    { name: 'phone-740x360', width: 740, height: 360, phone: true },
];
const LOCALES = ['ja', 'ja-Hira', 'en'];

const rows = [];
const tails = [];
const record = (ok, name, note = '') => {
    rows.push({ ok, name });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${note ? ` — ${note}` : ''}`);
};

const browser = await chromium.launch({ headless: HEADLESS, channel: CHANNEL });

const studentPage = async ({ viewport, locale }) => {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    await page.route('**/classrooms/verify-session', (r) =>
        r.fulfill({ json: { valid: true, hasAssignment: false, submission: null } }).catch(() => {}),
    );
    await page.route('**/continuable-submissions', (r) => r.fulfill({ json: {} }));
    await page.route('**/classrooms/c1/assignment', (r) => r.fulfill({ json: { assignment: null, lesson: null } }));
    await page.route('**/lesson-progress', (r) => r.fulfill({ json: { challenges: {}, current: null, updatedAt: null } }));
    const now = Date.now();
    const started = now - 30 * 60 * 1000;
    await page.addInitScript(
        ({ startedAt, nowAt }) => {
            if (window.sessionStorage.getItem('__seeded')) return;
            window.sessionStorage.setItem('__seeded', '1');
            window.localStorage.setItem(
                'smalruby:classroom',
                JSON.stringify({
                    role: 'student',
                    classroomId: 'c1',
                    className: '2年1組',
                    assignmentName: 'ねこの迷路ゲーム',
                    joinCode: 'abc234',
                    seatNumber: 7,
                    memberId: 'seat-07',
                    sessionToken: 'stub',
                    joinedAt: new Date(startedAt).toISOString(),
                    submissionStatus: null,
                    lastSubmittedAt: null,
                }),
            );
            window.sessionStorage.setItem(
                'smalruby:classroomSubmitReminder',
                JSON.stringify({ tabStartedAt: startedAt, lastVisibleAt: nowAt }),
            );
            window.localStorage.setItem('smalruby:mobileModeNoticeDismissed', 'true');
        },
        { startedAt: started, nowAt: now },
    );
    await page.goto(`${BASE}/?no_beforeunload=1&locale=${locale}`, { waitUntil: 'load' });
    await page
        .locator('[data-testid="classroom-menu-button"]:visible, [data-testid="mobile-side-rail-menu"]:visible')
        .first()
        .waitFor({ state: 'visible', timeout: 60000 });
    await page.waitForTimeout(800);
    return { ctx, page };
};

/**
 * 見えている吹き出しが画面の中にあって、ほかの見えている操作と重ならないかを測る。
 * @param {import('playwright').Page} page - 対象ページ
 * @returns {Promise<object>} 測定値
 */
const measureBalloon = (page) =>
    page.evaluate(() => {
        const el = [...document.querySelectorAll('[data-testid="classroom-submit-reminder"]')].find(
            (x) => x.getClientRects().length > 0,
        );
        if (!el) {
            const dot = [...document.querySelectorAll('[data-testid="classroom-submit-reminder-dot"]')].find(
                (x) => x.getClientRects().length > 0,
            );
            return dot ? { compact: true } : { missing: true };
        }
        const r = el.getBoundingClientRect();
        const overlaps = (a, b) =>
            a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
        const drawer = el.closest('[data-testid="mobile-drawer"]');
        const scope = drawer || document;
        const candidates = [
            ...scope.querySelectorAll(
                'button, [role="tab"], [role="button"], input, select, textarea, a[href], [class*="menu-bar_menu-bar-item"]',
            ),
        ];
        const hits = candidates
            .filter((x) => !el.contains(x) && !x.contains(el))
            .filter((x) => x.getClientRects().length > 0 && getComputedStyle(x).visibility !== 'hidden')
            .filter((x) => {
                const b = x.getBoundingClientRect();
                return b.width > 0 && b.height > 0 && overlaps(r, b);
            })
            .map((x) => x.getAttribute('data-testid') || x.getAttribute('aria-label') || String(x.className).slice(0, 50));
        const se = document.scrollingElement;
        const btn = [...document.querySelectorAll('[data-testid="classroom-menu-submit"]')].find(
            (x) => x.getClientRects().length > 0,
        );
        const bb = btn && btn.getBoundingClientRect();
        const arrow = el.querySelector('[data-balloon-arrow]');
        const ab = arrow && arrow.getBoundingClientRect();
        return {
            // しっぽの先（回した四角のいちばん上）と「提出する」の下端の距離、しっぽの中心と「提出する」の中心の横のずれ
            tailGap: bb && ab ? Math.round(ab.top - bb.bottom) : null,
            tailOffsetX: bb && ab ? Math.round((ab.left + ab.right) / 2 - (bb.left + bb.right) / 2) : null,
            box: `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`,
            inView: r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight,
            below: !!bb && r.top >= bb.bottom - 1,
            hits,
            text: el.textContent,
            inDrawer: !!drawer,
            pageScrollX: se.scrollWidth > se.clientWidth,
        };
    });

const visibleCount = (page, testId) =>
    page.evaluate(
        (id) => [...document.querySelectorAll(`[data-testid="${id}"]`)].filter((x) => x.getClientRects().length > 0).length,
        testId,
    );

const DOCS = {
    'pc-1300x600 ja': '0346-menu-bar-submit-reminder.png',
    'phone-844x390 ja': '0347-mobile-drawer-submit-reminder.png',
};

for (const vp of VIEWPORTS) {
    for (const locale of LOCALES) {
        const name = `${vp.name} ${locale}`;
        const { ctx, page } = await studentPage({ viewport: vp, locale });
        if (vp.phone) {
            const dot = await visibleCount(page, 'mobile-side-rail-menu-dot');
            record(dot === 1, `${name} dot on ☰`, `dots=${dot}`);
            await page.locator('[data-testid="mobile-side-rail-menu"]').click();
            await page.locator('[data-testid="mobile-drawer"][data-state="open"]').waitFor({ timeout: 10000 });
            await page.waitForTimeout(400);
        }
        const m = await measureBalloon(page);
        if (m.missing) {
            record(false, name, 'balloon not found');
        } else if (m.compact) {
            // 置ける場所が無いときは点だけ（スマホでは起きない）
            record(!vp.phone, name, 'compact (dot on the submit button)');
            tails.push({ name, tailGap: 'dot', tailOffsetX: '-' });
        } else {
            const ok = m.inView && m.below && m.hits.length === 0 && !m.pageScrollX && m.inDrawer === !!vp.phone;
            record(
                ok,
                name,
                `box=${m.box} below=${m.below} tailGap=${m.tailGap} tailOffsetX=${m.tailOffsetX} ` +
                    `hits=${JSON.stringify(m.hits)} text=${m.text}`,
            );
            tails.push({ name, tailGap: m.tailGap, tailOffsetX: m.tailOffsetX });
        }
        await page.screenshot({ path: resolve(SHOT_DIR, `classroom-submit-reminder-${vp.name}-${locale}.png`) });
        if (DOCS_SHOTS && DOCS[name]) await page.screenshot({ path: resolve(DOCS_DIR, DOCS[name]) });
        // × で消す
        if (m.compact) {
            await page.mouse.click(5, vp.height - 5);
        } else {
            await page.locator('[data-testid="classroom-submit-reminder-close"]:visible').first().click();
        }
        await page.waitForTimeout(200);
        const left =
            (await visibleCount(page, 'classroom-submit-reminder')) +
            (await visibleCount(page, 'classroom-submit-reminder-dot'));
        const dots = await visibleCount(page, 'mobile-side-rail-menu-dot');
        record(left === 0 && dots === 0, `${name} close`, `balloons=${left} dots=${dots}`);
        await ctx.close();
    }
}

await browser.close();
console.log('\nしっぽの先と「提出する」の下端の距離（px）・横のずれ（px）');
tails.forEach((t) => console.log(`  ${t.name}: gap=${t.tailGap} offsetX=${t.tailOffsetX}`));
const failed = rows.filter((r) => !r.ok);
console.log(`\n${rows.length - failed.length}/${rows.length} passed`);
process.exit(failed.length ? 1 : 0);
