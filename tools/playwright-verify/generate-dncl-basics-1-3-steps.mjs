// Render step images + thumbnails for the three `dncl-basics-*` decks
// (issue #964) using Playwright (headless Chromium).
//
// Same "editor card" look as the ruby-basics generators
// (generate-ruby-basics-2-3-steps.mjs) so the tutorial library stays visually
// uniform, but the code shown is DNCL — that is what the learner actually sees
// in the editor, because these decks open the Ruby tab in DNCL mode
// (`setup.rubyMode: 'dncl'`) and the inserted Ruby snippet is rendered through
// `rubyToDncl`.
//
// Keep the DNCL text here in sync with what `rubyToDncl` produces for the
// deck's `code` field (see categories/dncl.jsx); the unit test
// test/unit/lib/libraries/decks/dncl-basics-decks.test.js guards the code
// side, these images are the human-facing side of the same snippet.
//
// The snippets are hat-less on purpose: `when_flag_clicked do ... end` has no
// DNCL representation and breaks the DNCL -> Ruby direction (see the comment
// at the top of categories/dncl.jsx). A hat-less script is run from the Ruby
// toolbar's run-all button, which is what the cards tell the learner.
//
// Usage (from repo root, inside the container):
//   node tools/playwright-verify/generate-dncl-basics-1-3-steps.mjs

import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const STEPS_DIR = path.join(
    REPO_ROOT,
    'packages/scratch-gui/src/lib/libraries/decks/steps',
);
const THUMBS_DIR = path.join(
    REPO_ROOT,
    'packages/scratch-gui/src/lib/libraries/decks/thumbnails',
);

const W = 720;
const H = 420;

const escapeHtml = s =>
    s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

// Whole-line coloring heuristic (Catppuccin Mocha), extended with the DNCL
// keywords that replace the Ruby ones.
const lineColor = raw => {
    if (raw.trim().startsWith('#')) return '#94e2d5'; // comment
    if (/(表示する|もし|ならば|そうでなければ|そうでなくもし|を実行する)/.test(raw)) {
        return '#cba6f7'; // keyword
    }
    return '#cdd6f4'; // foreground
};

const cardHtml = (codeLines, headerText) => {
    const rows = codeLines
        .map((raw, i) => {
            const num = String(i + 1).padStart(2, ' ');
            const color = lineColor(raw);
            // A blank line still needs height.
            const content = raw === '' ? '&nbsp;' : escapeHtml(raw);
            return `<div class="row">
                <span class="ln">${num}</span>
                <span class="code" style="color:${color}">${content}</span>
            </div>`;
        })
        .join('');
    return `<!doctype html><html><head><meta charset="utf-8"><style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: ${W}px; height: ${H}px; }
        body {
            background: #1e1e2e;
            font-family: 'DejaVu Sans Mono', 'Noto Sans Mono', 'Noto Sans CJK JP', 'IPAGothic', monospace;
        }
        .bar {
            height: 44px; background: #313244;
            display: flex; align-items: center; padding-left: 16px;
        }
        .dot { width: 12px; height: 12px; border-radius: 50%; margin-right: 8px; }
        .dot.r { background: #f38ba8; }
        .dot.y { background: #f9e2af; }
        .dot.g { background: #a6e3a1; }
        .title {
            margin-left: 20px; color: #cdd6f4; font-size: 16px; font-weight: 600;
        }
        .body { padding: 24px 0 0 0; }
        .row { display: flex; height: 28px; line-height: 28px; }
        .ln {
            width: 44px; text-align: right; padding-right: 16px;
            color: #6c7086; font-size: 14px; white-space: pre;
        }
        .code { font-size: 16px; white-space: pre; }
    </style></head><body>
        <div class="bar">
            <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
            <span class="title">${escapeHtml(headerText)}</span>
        </div>
        <div class="body">${rows}</div>
    </body></html>`;
};

const thumbHtml = (topic, line1, line2) =>
    `<!doctype html><html><head><meta charset="utf-8"><style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 600px; height: 375px; }
        body {
            background: #1e1e2e; padding: 48px 40px;
            font-family: 'DejaVu Sans Mono', 'Noto Sans Mono', 'Noto Sans CJK JP', 'IPAGothic', monospace;
        }
        .topic { color: #cba6f7; font-size: 46px; font-weight: 700; margin-bottom: 44px; }
        .l1 { color: #a6e3a1; font-size: 36px; margin-bottom: 20px; white-space: pre; }
        .l2 { color: #fab387; font-size: 30px; white-space: pre; }
    </style></head><body>
        <div class="topic">${escapeHtml(topic)}</div>
        <div class="l1">${escapeHtml(line1)}</div>
        <div class="l2">${escapeHtml(line2)}</div>
    </body></html>`;

const STEPS = [
    // ── Deck 1: 文字や数字を表示しよう ──────────────────────────────────────
    {
        file: 'dncl-basics-1-1-intro.png',
        header: 'dncl-basics-1 · Step 1: イントロ',
        lines: [
            '# 日本語のプログラム（DNCL）を書いてみよう！',
            '# 表示する(...) で画面にことばを出せるよ',
            '',
            '表示する("こんにちは")',
        ],
    },
    {
        file: 'dncl-basics-1-2-first-display.png',
        header: 'dncl-basics-1 · Step 2: 表示する',
        lines: [
            '表示する("こんにちは")',
        ],
    },
    {
        file: 'dncl-basics-1-3-result.png',
        header: 'dncl-basics-1 · Step 3: 実行結果',
        lines: [
            '表示する("こんにちは")',
            '',
            '# → ネコが「こんにちは」としゃべるよ',
        ],
    },
    {
        file: 'dncl-basics-1-4-numbers.png',
        header: 'dncl-basics-1 · Step 4: 数字も表示',
        lines: [
            '表示する("こんにちは")',
            '表示する(2 + 6)                    # → 8',
            '表示する("こたえは", (2 + 6), "です")',
        ],
    },
    {
        file: 'dncl-basics-1-5-modify.png',
        header: 'dncl-basics-1 · Step 5: 自由に編集',
        lines: [
            '表示する("すきなことば")  # ← 好きなことばに変えてみよう！',
            '表示する(12 * 8)',
        ],
    },
    // ── Deck 2: 変数を使おう ────────────────────────────────────────────────
    {
        file: 'dncl-basics-2-1-intro.png',
        header: 'dncl-basics-2 · Step 1: イントロ',
        lines: [
            '# 変数に値を入れて使ってみよう！',
            '# tensuu = 80  （tensuu ← 80 と書いてもOK）',
            '',
            'tensuu = 80',
            '表示する(tensuu)',
        ],
    },
    {
        file: 'dncl-basics-2-2-first-var.png',
        header: 'dncl-basics-2 · Step 2: 代入する',
        lines: [
            'tensuu = 80',
            '表示する(tensuu)',
        ],
    },
    {
        file: 'dncl-basics-2-3-result.png',
        header: 'dncl-basics-2 · Step 3: 実行結果',
        lines: [
            'tensuu = 80',
            '表示する(tensuu)',
            '',
            '# → ネコが「80」としゃべるよ',
        ],
    },
    {
        file: 'dncl-basics-2-4-update.png',
        header: 'dncl-basics-2 · Step 4: 値を変える',
        lines: [
            'tensuu = 80',
            'tensuu = tensuu + 15                       # → 95',
            '表示する("てんすうは", tensuu, "てんです")',
        ],
    },
    {
        file: 'dncl-basics-2-5-modify.png',
        header: 'dncl-basics-2 · Step 5: 自由に編集',
        lines: [
            'nedan = 120   # ← 好きな数に変えてみよう！',
            'kosuu = 3',
            '表示する("ごうけいは", (nedan * kosuu), "えんです")',
        ],
    },
    // ── Deck 3: もし〜ならば ────────────────────────────────────────────────
    {
        file: 'dncl-basics-3-1-intro.png',
        header: 'dncl-basics-3 · Step 1: イントロ',
        lines: [
            '# 「もし〜ならば」で処理を分けてみよう！',
            '',
            'もし tensuu >= 60 ならば',
            '  表示する("ごうかく")',
            'を実行する',
        ],
    },
    {
        file: 'dncl-basics-3-2-if.png',
        header: 'dncl-basics-3 · Step 2: もし〜ならば',
        lines: [
            'tensuu = 80',
            'もし tensuu >= 60 ならば',
            '  表示する("ごうかく")',
            'を実行する',
        ],
    },
    {
        file: 'dncl-basics-3-3-result.png',
        header: 'dncl-basics-3 · Step 3: 実行結果',
        lines: [
            'tensuu = 80',
            'もし tensuu >= 60 ならば',
            '  表示する("ごうかく")   # → 80 は 60 以上なので表示される',
            'を実行する',
        ],
    },
    {
        file: 'dncl-basics-3-4-else.png',
        header: 'dncl-basics-3 · Step 4: そうでなければ',
        lines: [
            'tensuu = 45',
            'もし tensuu >= 60 ならば',
            '  表示する("ごうかく")',
            'そうでなければ',
            '  表示する("ふごうかく")   # → 45 なのでこちら',
            'を実行する',
        ],
    },
    {
        file: 'dncl-basics-3-5-elsif.png',
        header: 'dncl-basics-3 · Step 5: 3つに分ける',
        lines: [
            'tensuu = 95',
            'もし tensuu >= 90 ならば',
            '  表示する("たいへんよくできました")',
            'そうでなくもし tensuu >= 60 ならば',
            '  表示する("ごうかく")',
            'そうでなければ',
            '  表示する("ふごうかく")',
            'を実行する',
        ],
    },
];

const THUMBS = [
    {
        file: 'dncl-basics-1-display.jpg',
        topic: '文字や数字を表示',
        l1: '表示する("こんにちは")',
        l2: '=> こんにちは',
    },
    {
        file: 'dncl-basics-2-variables.jpg',
        topic: '変数を使おう',
        l1: 'tensuu = 80',
        l2: '表示する(tensuu)',
    },
    {
        file: 'dncl-basics-3-conditionals.jpg',
        topic: 'もし〜ならば',
        l1: 'もし tensuu >= 60 ならば',
        l2: '表示する("ごうかく")',
    },
];

const run = async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({viewport: {width: W, height: H}});

    for (const step of STEPS) {
        await page.setViewportSize({width: W, height: H});
        await page.setContent(cardHtml(step.lines, step.header));
        await page.screenshot({
            path: path.join(STEPS_DIR, step.file),
            clip: {x: 0, y: 0, width: W, height: H},
        });
        console.log('wrote', step.file);
    }

    for (const t of THUMBS) {
        await page.setViewportSize({width: 600, height: 375});
        await page.setContent(thumbHtml(t.topic, t.l1, t.l2));
        await page.screenshot({
            path: path.join(THUMBS_DIR, t.file),
            type: 'jpeg',
            quality: 92,
            clip: {x: 0, y: 0, width: 600, height: 375},
        });
        console.log('wrote', t.file);
    }

    await browser.close();
    console.log('done');
};

run().catch(err => {
    console.error(err);
    process.exit(1);
});
