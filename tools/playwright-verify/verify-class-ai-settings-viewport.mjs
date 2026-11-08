/**
 * 先生のクラス設定「このクラスで使う AI」が授業 PC (1300×600) でスクロールせずに収まるかの測定 (#1439)。
 *
 * クラス設定を 4 通り (AI なし / 生成AI だけ / ルビティーだけ / 両方) で開き、
 *   - 本文 (<main>) の scrollHeight / clientHeight
 *   - ［保存］([data-testid="classroom-class-settings-save"]) の getBoundingClientRect().bottom
 * を一覧で出す。どれか 1 つでも本文がスクロールするか［保存］が画面の外なら exit 1。
 * 確認のチェックは入れない (案内と理由が一番長く出る状態)。
 *
 * classroom API は route interception でスタブするので stg デプロイ不要（dev server だけが前提）。
 * スクショは tmp/class-ai-settings-viewport-*.png。
 *
 *   node verify-class-ai-settings-viewport.mjs                 # コンテナ内 (headless)
 *   BASE=http://localhost:8621 node verify-class-ai-settings-viewport.mjs
 *   DOCS_SHOTS=1 node verify-class-ai-settings-viewport.mjs    # docs/classroom/screenshots の 0230 / 0242 も撮り直す
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
// VIEWPORT=WxH で別サイズ (iPad など) の見た目も撮れる。判定は 1300x600 向け。
const [VW, VH] = (process.env.VIEWPORT || '1300x600').split('x').map(Number);
const VIEWPORT = { width: VW, height: VH };
const SAVE = '[data-testid="classroom-class-settings-save"]';
const MAIN = '[data-testid="classroom-teacher-modal"] main';

// 測定した状態 → docs/classroom/screenshots の撮り直し先 (ファイル名は変えない)。
// 0230 は両方を確認したところ (チェック済み・未保存)、0242 はルビティーのチェック前。
const CASES = [
    { key: 'none', genai: false, rubytee: false, docShot: '0231-class-ai-settings-service.png' },
    { key: 'genai', genai: true, rubytee: false },
    { key: 'rubytee', genai: false, rubytee: true, docShot: '0242-class-ai-settings-rubytee-confirm.png' },
    { key: 'both', genai: true, rubytee: true, docShot: '0230-class-ai-settings-confirm.png', checkForDoc: true },
    // 4 通りのほかに、docs に載せている状態: 「その他」(URL 欄が開く) と、確認の仕組みより前にルビティーを有効にしたクラス。
    { key: 'other', service: 'other', rubytee: false, docShot: '0232-class-ai-settings-other.png' },
    {
        key: 'rubytee-unconfirmed',
        genai: false,
        rubytee: false,
        stored: { rubytee: { enabled: true } },
        docShot: '0243-class-ai-settings-rubytee-unconfirmed.png',
    },
];

const group = {
    groupId: 'g1',
    name: '3年2組 技術・家庭科（情報の技術）',
    section: '情報',
    year: 2026,
    studentCount: 40,
    status: 'active',
    schemaVersion: 2,
    topics: [],
    role: 'owner',
    coTeacherEmails: [],
};

const browser = await chromium.launch({ headless: HEADLESS, channel: CHANNEL });
const rows = [];

for (const c of CASES) {
    const ctx = await browser.newContext({ viewport: VIEWPORT });
    const page = await ctx.newPage();
    await page.route('**/notifications', (r) => r.fulfill({ json: { notifications: [], unreadCount: 0 } }));
    await page.route('**/kick-requests/pending', (r) => r.fulfill({ json: { requests: [] } }));
    await page.route('**/classroom-groups', (r) => r.fulfill({ json: { groups: [{ ...group, ...c.stored }] } }));
    await page.route('**/classroom-groups/migrate', (r) => r.fulfill({ json: { migrated: 0 } }));
    await page.route('**/classrooms?**', (r) => r.fulfill({ json: { classrooms: [] } }));
    await page.route(/\/classrooms$/, (r) => r.fulfill({ json: { classrooms: [] } }));
    await page.goto(`${BASE}/?no_beforeunload=1&locale=ja&devlogin=stub-token`, { waitUntil: 'load' });
    await page.waitForTimeout(3000);
    // dev server の警告オーバーレイがクリックを奪うので隠す。
    await page.addStyleTag({
        content: '#webpack-dev-server-client-overlay { display: none !important; }',
    });

    await page.locator('[data-testid="settings-menu"]').click();
    await page.locator('[data-testid="settings-classroom-management"]').click();
    await page.locator('[data-testid="classroom-class-settings-open-g1"]').click();
    await page.locator(SAVE).waitFor({ state: 'visible', timeout: 10000 });
    if (c.genai || c.service) {
        await page.locator(`[data-testid="classroom-class-ai-service-${c.service || 'gemini'}"]`).click();
    }
    if (c.rubytee) await page.locator('[data-testid="classroom-class-ai-rubytee"]').click({ force: true });
    await page.waitForTimeout(400);

    const m = await page.evaluate(
        ({ main, save }) => {
            const body = document.querySelector(main);
            const btn = document.querySelector(save);
            return {
                scroll: body ? body.scrollHeight : null,
                client: body ? body.clientHeight : null,
                save: btn ? Math.round(btn.getBoundingClientRect().bottom) : null,
                vh: window.innerHeight,
            };
        },
        { main: MAIN, save: SAVE },
    );
    const ok = m.scroll !== null && m.scroll <= m.client && m.save !== null && m.save <= m.vh;
    rows.push({ ...c, ...m, ok });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${c.key}: main ${m.scroll}/${m.client}, save bottom ${m.save}/${m.vh}`);
    await page.screenshot({
        path: resolve(
            SHOT_DIR,
            `class-ai-settings-viewport-${process.env.VIEWPORT ? `${process.env.VIEWPORT}-` : ''}${c.key}.png`,
        ),
    });

    if (DOCS_SHOTS && c.docShot) {
        if (c.checkForDoc) {
            await page.locator('[data-testid="classroom-class-ai-confirm"]').check();
            await page.locator('[data-testid="classroom-class-ai-rubytee-confirm"]').check();
            await page.waitForTimeout(300);
        }
        await page.screenshot({
            path: resolve(REPO_ROOT, 'docs', 'classroom', 'screenshots', c.docShot),
        });
    }
    await ctx.close();
}

await browser.close();

console.log(`\nselectors: body = ${MAIN} / save = ${SAVE}`);
console.log('| AI | main scrollHeight / clientHeight | save bottom / vh | result |');
console.log('|---|---|---|---|');
for (const r of rows) {
    console.log(`| ${r.key} | ${r.scroll} / ${r.client} | ${r.save} / ${r.vh} | ${r.ok ? 'PASS' : 'FAIL'} |`);
}
process.exit(rows.every((r) => r.ok) ? 0 : 1);
