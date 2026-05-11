// Generate step screenshots for the `ruby-basics-1-numbers` deck.
//
// Outputs to `packages/scratch-gui/src/lib/libraries/decks/steps/`:
//   ruby-basics-1-1-intro.png
//   ruby-basics-1-2-first-puts.png
//   ruby-basics-1-3-result.png
//   ruby-basics-1-4-more-math.png
//   ruby-basics-1-5-modify.png
//   ruby-basics-1-6-tryruby.png
//
// Each screenshot captures the Ruby tab in a different code state.

import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const STEPS_DIR = path.join(
    REPO_ROOT,
    'packages/scratch-gui/src/lib/libraries/decks/steps',
);

const URL = 'http://localhost:8601/?no_beforeunload=1&tab=ruby&rubyMode=ruby&ruby_version=2';

const log = (...args) => console.log('[gen]', ...args);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'ja-JP',
});
const page = await context.newPage();

page.on('pageerror', (err) => console.error('[pageerror]', err.message));

await page.goto(URL);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(2000);

// Dismiss welcome modal if visible
const laterBtn = page.locator('[data-testid="welcome-modal-later"]');
if (await laterBtn.count()) {
    await laterBtn.click();
    await page.waitForTimeout(500);
}

// Helper: set Monaco editor value and screenshot Ruby tab panel.
const setCodeAndScreenshot = async (code, filename) => {
    await page.evaluate((c) => {
        if (window.monaco && monaco.editor.getEditors().length > 0) {
            monaco.editor.getEditors()[0].setValue(c);
        }
    }, code);
    await page.waitForTimeout(700);
    const out = path.join(STEPS_DIR, filename);
    // Target the Ruby tab panel by role
    const panel = page.locator('[role="tabpanel"]').last();
    await panel.screenshot({ path: out });
    log(`wrote ${filename}`);
};

// Step 1 — intro: editor empty with a friendly comment
await setCodeAndScreenshot(
    '# Ruby で計算してみよう！\n# `puts` を使うとネコが結果をしゃべるよ\n',
    'ruby-basics-1-1-intro.png',
);

// Step 2 — first puts: simple addition
await setCodeAndScreenshot(
    'when_flag_clicked do\n  puts 2 + 6\nend\n',
    'ruby-basics-1-2-first-puts.png',
);

// Step 3 — result: cat will say "8" after flag press
// Take a screenshot focused on the stage with the code present.
// (We can't trigger a real flag click in the headless run easily, so show the
// code + stage layout. The stage cat is the default cat sprite.)
await setCodeAndScreenshot(
    'when_flag_clicked do\n  puts 2 + 6  # ← 緑の旗を押すとネコが「8」としゃべる\nend\n',
    'ruby-basics-1-3-result.png',
);

// Step 4 — more math: multiple puts
await setCodeAndScreenshot(
    'when_flag_clicked do\n  puts 4 * 10    # かけ算\n  puts 30 / 4    # わり算\n  puts 5 - 12    # ひき算\nend\n',
    'ruby-basics-1-4-more-math.png',
);

// Step 5 — modify: encourage editing the numbers
await setCodeAndScreenshot(
    'when_flag_clicked do\n  puts 100 + 50  # ← 数字を好きに変えてみよう！\n  puts 7 * 7\nend\n',
    'ruby-basics-1-5-modify.png',
);

// Step 6 — TryRuby link: closing message
await setCodeAndScreenshot(
    [
        '# 🎉 すごい！Ruby で計算ができるようになったね！',
        '#',
        '# ここで書いた `puts` のコードは',
        '# 本物の Ruby (TryRuby など) でも同じように動くよ。',
        '#',
        '# 👉 もっと深く Ruby を学ぶなら:',
        '#    https://try.ruby-lang.org/ja/',
        '',
        'puts "やったね！"\n',
    ].join('\n'),
    'ruby-basics-1-6-tryruby.png',
);

await browser.close();
log('done');
