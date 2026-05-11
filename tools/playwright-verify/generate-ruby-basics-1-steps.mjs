// Render step images for the `ruby-basics-1-numbers` deck using ImageMagick.
//
// We render the Ruby code as a stylized "editor" block (dark background,
// monospace font, syntax-ish colors) rather than relying on the live Monaco
// editor. Monaco 0.55.1 has an internal `_acceptDeleteRange` crash that's
// triggered by certain rapid setValue calls during automated runs, which
// leaves visible ERROR markers in screenshots.
//
// This generator is deterministic and produces clean, focused images.

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const FONT_BOLD = '.Hiragino-Kaku-Gothic-Interface-W6';
const FONT_REG = '.Hiragino-Kaku-Gothic-Interface-W3';

// 16:9-ish editor card at 720x420 — matches Mesh step image aspect roughly
const W = 720;
const H = 420;

const render = (codeLines, headerText, outFile) => {
    const args = [
        '-size', `${W}x${H}`,
        'canvas:#1e1e2e',
        // Top bar
        '-fill', '#313244',
        '-draw', `rectangle 0,0 ${W},44`,
        // 3 traffic-light dots
        '-fill', '#f38ba8', '-draw', 'circle 22,22 22,32',
        '-fill', '#f9e2af', '-draw', 'circle 46,22 46,32',
        '-fill', '#a6e3a1', '-draw', 'circle 70,22 70,32',
        // Header label
        '-fill', '#cdd6f4', '-font', FONT_BOLD, '-pointsize', '16',
        '-gravity', 'NorthWest',
        '-annotate', '+110+12', headerText,
    ];

    // Render code lines starting from y=70
    const lineY0 = 80;
    const lineH = 28;
    const xLineNum = 16;
    const xCode = 60;
    codeLines.forEach((rawLine, idx) => {
        const y = lineY0 + idx * lineH;
        // Line number
        args.push(
            '-fill', '#6c7086',
            '-font', '.SF-NS-Mono',
            '-pointsize', '14',
            '-gravity', 'NorthWest',
            '-annotate', `+${xLineNum}+${y}`,
            String(idx + 1).padStart(2, ' '),
        );

        // Color tokens: simple heuristic
        // - words starting with `#`: comment (gray-green)
        // - `puts`/`when_flag_clicked`/`do`/`end`: keyword (purple)
        // - numbers: number (orange)
        // - strings "...": green
        // - everything else: foreground
        // For simplicity we render the whole line in one color picked by
        // whether it starts with `#` (comment) or has a keyword.
        let color = '#cdd6f4';
        if (rawLine.trim().startsWith('#')) {
            color = '#94e2d5';
        } else if (/\b(puts|when_flag_clicked|do|end)\b/.test(rawLine)) {
            color = '#cba6f7';
        }
        args.push(
            '-fill', color,
            '-font', '.SF-NS-Mono', '-pointsize', '16',
            '-gravity', 'NorthWest',
            '-annotate', `+${xCode}+${y}`,
            rawLine.replace(/\\/g, '\\\\'),
        );
    });

    args.push(outFile);
    execFileSync('magick', args, { stdio: 'inherit' });
    console.log('wrote', path.relative(REPO_ROOT, outFile));
};

// Step 1 — intro
render(
    [
        '# Ruby で計算してみよう！',
        '# puts を使うと結果を表示できるよ',
        '',
        '# 次のステップで puts 2 + 6 を実行してみよう',
    ],
    'ruby-basics-1 · Step 1: イントロ',
    path.join(STEPS_DIR, 'ruby-basics-1-1-intro.png'),
);

// Step 2 — first puts
render(
    [
        'when_flag_clicked do',
        '  puts 2 + 6',
        'end',
    ],
    'ruby-basics-1 · Step 2: 最初の計算',
    path.join(STEPS_DIR, 'ruby-basics-1-2-first-puts.png'),
);

// Step 3 — run, cat says 8
render(
    [
        'when_flag_clicked do',
        '  puts 2 + 6',
        'end',
        '',
        '# → ネコが「8」としゃべるよ',
    ],
    'ruby-basics-1 · Step 3: 実行',
    path.join(STEPS_DIR, 'ruby-basics-1-3-result.png'),
);

// Step 4 — more math
render(
    [
        'when_flag_clicked do',
        '  puts 4 * 10    # かけ算 → 40',
        '  puts 30 / 4    # わり算 → 7',
        '  puts 5 - 12    # ひき算 → -7',
        'end',
    ],
    'ruby-basics-1 · Step 4: 他の計算',
    path.join(STEPS_DIR, 'ruby-basics-1-4-more-math.png'),
);

// Step 5 — modify
render(
    [
        'when_flag_clicked do',
        '  puts 100 + 50  # ← 好きな数字に変えてみよう！',
        '  puts 7 * 7',
        '  puts 1000 / 8',
        'end',
    ],
    'ruby-basics-1 · Step 5: 自由に編集',
    path.join(STEPS_DIR, 'ruby-basics-1-5-modify.png'),
);

// TryRuby promotional image — used as the externalResources step image
// (lives in thumbnails/, not steps/, to mirror the chat-3-mesh-3 Kairyudo
// external resource pattern).
const tryRubyImage = path.join(THUMBS_DIR, 'ruby-basics-1-tryruby.png');
execFileSync('magick', [
    '-size', `${W}x${H}`,
    'canvas:#cc342d',
    // Top accent
    '-fill', '#ffffff', '-font', FONT_BOLD, '-pointsize', '28',
    '-gravity', 'NorthWest', '-annotate', '+40+40', 'TryRuby',
    // Subtitle
    '-fill', '#ffffff', '-font', FONT_REG, '-pointsize', '16',
    '-gravity', 'NorthWest', '-annotate', '+40+80',
    'https://try.ruby-lang.org/',
    // Body — explain the bridge
    '-fill', '#ffffff', '-font', FONT_REG, '-pointsize', '18',
    '-gravity', 'NorthWest', '-annotate', '+40+150',
    'ここで学んだ puts のコードは',
    '-fill', '#ffffff', '-font', FONT_REG, '-pointsize', '18',
    '-gravity', 'NorthWest', '-annotate', '+40+180',
    '本物の Ruby でも同じように動きます',
    // Sample code-ish line
    '-fill', '#ffe5b4', '-font', '.SF-NS-Mono', '-pointsize', '18',
    '-gravity', 'NorthWest', '-annotate', '+40+250',
    '> puts 2 + 6',
    '-fill', '#ffe5b4', '-font', '.SF-NS-Mono', '-pointsize', '18',
    '-gravity', 'NorthWest', '-annotate', '+40+280',
    '=> 8',
    '-fill', '#ffffff', '-font', FONT_BOLD, '-pointsize', '20',
    '-gravity', 'SouthEast', '-annotate', '+30+30',
    '→ もっと学ぶ',
    tryRubyImage,
], { stdio: 'inherit' });
console.log('wrote', path.relative(REPO_ROOT, tryRubyImage));

// Refresh the thumbnail so it looks consistent with the new style
execFileSync('magick', [
    '-size', '600x375',
    'canvas:#1e1e2e',
    '-fill', '#cba6f7', '-font', FONT_BOLD, '-pointsize', '60',
    '-gravity', 'NorthWest', '-annotate', '+40+90', 'Ruby のきほん',
    '-fill', '#a6e3a1', '-font', '.SF-NS-Mono', '-pointsize', '46',
    '-gravity', 'NorthWest', '-annotate', '+40+200', 'puts 2 + 6',
    '-fill', '#fab387', '-font', '.SF-NS-Mono', '-pointsize', '36',
    '-gravity', 'NorthWest', '-annotate', '+40+270', '=> 8',
    '-quality', '92',
    path.join(THUMBS_DIR, 'ruby-basics-1-numbers.jpg'),
], { stdio: 'inherit' });
console.log('wrote thumbnail');

console.log('done');
