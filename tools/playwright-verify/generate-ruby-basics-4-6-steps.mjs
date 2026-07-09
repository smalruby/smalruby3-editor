// Render step images + thumbnails for the `ruby-basics-4-arrays`,
// `ruby-basics-5-blocks` and `ruby-basics-6-methods` decks using Playwright
// (headless Chromium). Same "editor card" HTML-template approach as
// generate-ruby-basics-2-3-steps.mjs (issue #852) so decks 1-6 look uniform.
//
// The palette matches decks 1-3 (Catppuccin Mocha):
//   bg #1e1e2e / bar #313244 / dots #f38ba8 #f9e2af #a6e3a1
//   header #cdd6f4 / line-number #6c7086 / comment #94e2d5 / keyword #cba6f7
//
// Usage (from repo root, inside the container):
//   node tools/playwright-verify/generate-ruby-basics-4-6-steps.mjs

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

// Whole-line coloring heuristic — identical to the deck 1-3 generators so
// decks 1-6 look uniform.
const lineColor = raw => {
    if (raw.trim().startsWith('#')) return '#94e2d5'; // comment
    if (/\b(puts|when_flag_clicked|do|end|def|times|move)\b/.test(raw)) return '#cba6f7'; // keyword
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
        .l1 { color: #a6e3a1; font-size: 40px; margin-bottom: 20px; white-space: pre; }
        .l2 { color: #fab387; font-size: 34px; white-space: pre; }
    </style></head><body>
        <div class="topic">${escapeHtml(topic)}</div>
        <div class="l1">${escapeHtml(line1)}</div>
        <div class="l2">${escapeHtml(line2)}</div>
    </body></html>`;

const STEPS = [
    // ── Deck 4: 配列で遊ぼう ────────────────────────────────────────────────
    {
        file: 'ruby-basics-4-1-intro.png',
        header: 'ruby-basics-4 · Step 1: イントロ',
        lines: [
            '# 配列（はいれつ）を使ってみよう！',
            '# [ ] で囲むと、複数のことばを1つにまとめられるよ',
            '',
            '# 次のステップで ticket = ["赤", "青", "黄"] を作ってみよう',
        ],
    },
    {
        file: 'ruby-basics-4-2-first-array.png',
        header: 'ruby-basics-4 · Step 2: 最初の配列',
        lines: [
            'when_flag_clicked do',
            '  ticket = ["赤", "青", "黄"]',
            '  puts ticket',
            'end',
        ],
    },
    {
        file: 'ruby-basics-4-3-result.png',
        header: 'ruby-basics-4 · Step 3: 実行',
        lines: [
            'when_flag_clicked do',
            '  ticket = ["赤", "青", "黄"]',
            '  puts ticket',
            'end',
            '',
            '# → ネコが「["赤", "青", "黄"]」としゃべるよ',
        ],
    },
    {
        file: 'ruby-basics-4-4-methods.png',
        header: 'ruby-basics-4 · Step 4: 配列のメソッド',
        lines: [
            'when_flag_clicked do',
            '  ticket = ["赤", "青", "黄"]',
            '  puts ticket.reverse  # → ["黄", "青", "赤"]',
            '  puts ticket[0]       # → "赤"',
            'end',
        ],
    },
    {
        file: 'ruby-basics-4-5-modify.png',
        header: 'ruby-basics-4 · Step 5: 自由に編集',
        lines: [
            'when_flag_clicked do',
            '  ticket = ["いぬ", "ねこ", "とり"]  # ← 好きなことばに変えてみよう！',
            '  puts ticket.reverse',
            'end',
        ],
    },
    // ── Deck 5: ブロック（times）を使ってみよう ───────────────────────────────
    {
        file: 'ruby-basics-5-1-intro.png',
        header: 'ruby-basics-5 · Step 1: イントロ',
        lines: [
            '# ブロック（times）を使ってみよう！',
            '# N.times do |i| ... end で同じ処理をN回くり返せるよ',
            '',
            '# 次のステップで 5.times do |i| ... end を実行しよう',
        ],
    },
    {
        file: 'ruby-basics-5-2-first-times.png',
        header: 'ruby-basics-5 · Step 2: くり返し',
        lines: [
            'when_flag_clicked do',
            '  5.times do |i|',
            '    puts i',
            '  end',
            'end',
        ],
    },
    {
        file: 'ruby-basics-5-3-result.png',
        header: 'ruby-basics-5 · Step 3: 実行',
        lines: [
            'when_flag_clicked do',
            '  5.times do |i|',
            '    puts i',
            '  end',
            'end',
            '',
            '# → ネコが「0」「1」「2」「3」「4」と順番にしゃべるよ',
        ],
    },
    {
        file: 'ruby-basics-5-4-move.png',
        header: 'ruby-basics-5 · Step 4: move と組み合わせる',
        lines: [
            'when_flag_clicked do',
            '  5.times do |i|',
            '    puts i',
            '    move(20)',
            '  end',
            'end',
        ],
    },
    {
        file: 'ruby-basics-5-5-modify.png',
        header: 'ruby-basics-5 · Step 5: 自由に編集',
        lines: [
            'when_flag_clicked do',
            '  10.times do |i|  # ← くり返す回数を変えてみよう！',
            '    puts i',
            '    move(10)',
            '  end',
            'end',
        ],
    },
    // ── Deck 6: メソッドをつくってみよう ─────────────────────────────────────
    {
        file: 'ruby-basics-6-1-intro.png',
        header: 'ruby-basics-6 · Step 1: イントロ',
        lines: [
            '# メソッドをつくってみよう！',
            '# def 名前(引数) ... end で自分だけの命令をつくれるよ',
            '',
            '# 次のステップで def hello(name) ... end を作ってみよう',
        ],
    },
    {
        file: 'ruby-basics-6-2-first-def.png',
        header: 'ruby-basics-6 · Step 2: メソッドをつくる',
        lines: [
            'def hello(name)',
            '  puts "こんにちは、" + name',
            'end',
            '',
            'when_flag_clicked do',
            '  hello("ネコ")',
            'end',
        ],
    },
    {
        file: 'ruby-basics-6-3-result.png',
        header: 'ruby-basics-6 · Step 3: 実行',
        lines: [
            'def hello(name)',
            '  puts "こんにちは、" + name',
            'end',
            '',
            'when_flag_clicked do',
            '  hello("ネコ")',
            'end',
            '',
            '# → ネコが「こんにちは、ネコ」としゃべるよ',
        ],
    },
    {
        file: 'ruby-basics-6-4-multiple-calls.png',
        header: 'ruby-basics-6 · Step 4: 何度も呼び出す',
        lines: [
            'def hello(name)',
            '  puts "こんにちは、" + name',
            'end',
            '',
            'when_flag_clicked do',
            '  hello("ネコ")',
            '  hello("イヌ")',
            'end',
        ],
    },
    {
        file: 'ruby-basics-6-5-modify.png',
        header: 'ruby-basics-6 · Step 5: 自由に編集',
        lines: [
            'def hello(name)',
            '  puts "やあ、" + name + "！"  # ← あいさつを変えてみよう！',
            'end',
            '',
            'when_flag_clicked do',
            '  hello("あなたのなまえ")',
            'end',
        ],
    },
];

const THUMBS = [
    {
        file: 'ruby-basics-4-arrays.jpg',
        topic: '配列で遊ぼう',
        l1: 'ticket = ["赤","青","黄"]',
        l2: 'puts ticket.reverse',
    },
    {
        file: 'ruby-basics-5-blocks.jpg',
        topic: 'ブロックを使おう',
        l1: '5.times do |i|',
        l2: '  puts i',
    },
    {
        file: 'ruby-basics-6-methods.jpg',
        topic: 'メソッドをつくろう',
        l1: 'def hello(name)',
        l2: '  puts name',
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
