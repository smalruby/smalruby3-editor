// Render step images + thumbnails for the `ruby-basics-2-strings` and
// `ruby-basics-3-variables` decks using Playwright (headless Chromium).
//
// Deck 1 was rendered with ImageMagick on a macOS host (Hiragino / SF-NS-Mono
// fonts). Those fonts and `magick` are not available inside the devpod
// container, so this generator reproduces the same "editor card" look with an
// HTML template screenshotted by Playwright — which runs anywhere and keeps
// the images reproducible from CI/containers.
//
// The palette matches deck 1 (Catppuccin Mocha):
//   bg #1e1e2e / bar #313244 / dots #f38ba8 #f9e2af #a6e3a1
//   header #cdd6f4 / line-number #6c7086 / comment #94e2d5 / keyword #cba6f7
//
// Usage (from repo root, inside the container):
//   node tools/playwright-verify/generate-ruby-basics-2-3-steps.mjs

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

// Whole-line coloring heuristic — identical to the deck 1 generator so decks
// 1/2/3 look uniform.
const lineColor = raw => {
    if (raw.trim().startsWith('#')) return '#94e2d5'; // comment
    if (/\b(puts|when_flag_clicked|do|end)\b/.test(raw)) return '#cba6f7'; // keyword
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
            font-family: 'DejaVu Sans Mono', 'Noto Sans Mono', 'IPAGothic', monospace;
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
            font-family: 'DejaVu Sans Mono', 'Noto Sans Mono', 'IPAGothic', monospace;
        }
        .topic { color: #cba6f7; font-size: 52px; font-weight: 700; margin-bottom: 44px; }
        .l1 { color: #a6e3a1; font-size: 44px; margin-bottom: 20px; white-space: pre; }
        .l2 { color: #fab387; font-size: 36px; white-space: pre; }
    </style></head><body>
        <div class="topic">${escapeHtml(topic)}</div>
        <div class="l1">${escapeHtml(line1)}</div>
        <div class="l2">${escapeHtml(line2)}</div>
    </body></html>`;

const STEPS = [
    // ── Deck 2: 文字列で遊ぼう ──────────────────────────────────────────────
    {
        file: 'ruby-basics-2-1-intro.png',
        header: 'ruby-basics-2 · Step 1: イントロ',
        lines: [
            '# 文字列（もじれつ）を使ってみよう！',
            '# "..." で囲むと文字になるよ',
            '',
            '# 次のステップで puts "こんにちは" を実行しよう',
        ],
    },
    {
        file: 'ruby-basics-2-2-first-puts.png',
        header: 'ruby-basics-2 · Step 2: 最初の文字列',
        lines: ['when_flag_clicked do', '  puts "こんにちは"', 'end'],
    },
    {
        file: 'ruby-basics-2-3-result.png',
        header: 'ruby-basics-2 · Step 3: 実行',
        lines: [
            'when_flag_clicked do',
            '  puts "こんにちは"',
            'end',
            '',
            '# → ネコが「こんにちは」としゃべるよ',
        ],
    },
    {
        file: 'ruby-basics-2-4-methods.png',
        header: 'ruby-basics-2 · Step 4: 文字列メソッド',
        lines: [
            'when_flag_clicked do',
            '  puts "スモウルビー".reverse  # → ービルウモス',
            '  puts "ruby".upcase         # → RUBY',
            'end',
        ],
    },
    {
        file: 'ruby-basics-2-5-modify.png',
        header: 'ruby-basics-2 · Step 5: 自由に編集',
        lines: [
            'when_flag_clicked do',
            '  puts "すきなことば".reverse  # ← 好きな言葉に変えてみよう！',
            'end',
        ],
    },
    // ── Deck 3: 変数を使ってみよう ──────────────────────────────────────────
    {
        file: 'ruby-basics-3-1-intro.png',
        header: 'ruby-basics-3 · Step 1: イントロ',
        lines: [
            '# 変数（へんすう）を使ってみよう！',
            '# 名前をつけて、ことばや数を入れておけるよ',
            '',
            '# 次のステップで name = "ネコ" を作ってみよう',
        ],
    },
    {
        file: 'ruby-basics-3-2-first-var.png',
        header: 'ruby-basics-3 · Step 2: 変数をつくる',
        lines: ['when_flag_clicked do', '  name = "ネコ"', '  puts name', 'end'],
    },
    {
        file: 'ruby-basics-3-3-result.png',
        header: 'ruby-basics-3 · Step 3: 実行',
        lines: [
            'when_flag_clicked do',
            '  name = "ネコ"',
            '  puts name',
            'end',
            '',
            '# → ネコが「ネコ」としゃべるよ',
        ],
    },
    {
        file: 'ruby-basics-3-4-sentence.png',
        header: 'ruby-basics-3 · Step 4: 文をつくる',
        lines: [
            'when_flag_clicked do',
            '  name = "スモウルビー"',
            '  puts "わたしは" + name + "です"  # → わたしはスモウルビーです',
            'end',
        ],
    },
    {
        file: 'ruby-basics-3-5-modify.png',
        header: 'ruby-basics-3 · Step 5: 自由に編集',
        lines: [
            'when_flag_clicked do',
            '  name = "あなたのなまえ"  # ← 好きな名前に変えてみよう！',
            '  puts name + "、こんにちは！"',
            'end',
        ],
    },
];

const THUMBS = [
    {
        file: 'ruby-basics-2-strings.jpg',
        topic: '文字列で遊ぼう',
        l1: '"ruby".upcase',
        l2: '=> "RUBY"',
    },
    {
        file: 'ruby-basics-3-variables.jpg',
        topic: '変数を使おう',
        l1: 'name = "ネコ"',
        l2: 'puts name',
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
