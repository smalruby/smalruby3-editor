// Makes the 5 images of the carousel on the teacher sign-in screen (#2364).
//
// Each image is a part cut out of a real teacher screen with the made-up class of
// the docs (docs/classroom/screenshots/). The part is the place each slide talks
// about, so it can be shown large instead of a whole screen made small.
//
// When the screens change, take the docs screenshots again first, then run this:
//   RESHOOT=1 BASE=http://localhost:8601/ node capture-classroom-login-carousel.mjs
//     # runs the scripts that take those docs screenshots (DOCS_SHOTS=1), then cuts
//   node capture-classroom-login-carousel.mjs
//     # only cuts from the docs screenshots that are there now
//
// 0220 (the "Current assignment status" panel) has no script that takes it, so it is
// always cut from the docs screenshot as it is.
//
// The images go to packages/scratch-gui/src/components/classroom-teacher-modal/.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const DOCS_DIR = resolve(REPO_ROOT, 'docs', 'classroom', 'screenshots');
const OUT_DIR = resolve(REPO_ROOT, 'packages', 'scratch-gui', 'src', 'components', 'classroom-teacher-modal');

// The crops are in the 1300x600 docs screenshots.
const SLIDES = [
    {
        // Slide 1: the tabs, [+ Create] and the assignment list (like Google Classroom).
        out: 'carousel-1-classwork.png',
        source: '0211-teacher-assignment-board.png',
        script: 'verify-classroom-board-classwork.mjs',
        clip: { x: 40, y: 62, width: 500, height: 250 },
    },
    {
        // Slide 2: the class code shown on the projector, and the seats.
        out: 'carousel-2-projection.png',
        source: '0260-detail-projection.png',
        script: 'verify-classroom-assignment-detail.mjs',
        clip: { x: 28, y: 56, width: 660, height: 384 },
    },
    {
        // Slide 3: the "Current assignment status" panel on the editor.
        out: 'carousel-3-status-panel.png',
        source: '0220-teacher-status-panel.png',
        script: null,
        clip: { x: 960, y: 138, width: 335, height: 312 },
    },
    {
        // Slide 4: the lesson progress table with the "10 minutes or more" marks.
        out: 'carousel-4-lesson-progress.png',
        source: '0248-detail-lesson-progress.png',
        script: 'verify-classroom-lesson-progress.mjs',
        clip: { x: 44, y: 160, width: 410, height: 300 },
    },
    {
        // Slide 5: the grading tab: "AI drafts", the seat panel and the 4 steps.
        out: 'carousel-5-grading.png',
        source: '0234-teacher-grading-loaded.png',
        script: 'verify-classroom-grading.mjs',
        clip: { x: 700, y: 186, width: 556, height: 392 },
    },
];

if (process.env.RESHOOT === '1') {
    const scripts = [...new Set(SLIDES.map((slide) => slide.script).filter(Boolean))];
    for (const script of scripts) {
        console.log(`reshoot: ${script}`);
        const run = spawnSync(process.execPath, [resolve(HERE, script)], {
            cwd: HERE,
            env: { ...process.env, DOCS_SHOTS: '1', LOCALE: 'ja' },
            stdio: 'inherit',
        });
        if (run.status !== 0) {
            console.error(`reshoot failed: ${script}`);
            process.exit(1);
        }
    }
}

const browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false' });
try {
    const page = await browser.newPage({ viewport: { width: 1300, height: 600 } });
    for (const slide of SLIDES) {
        const png = readFileSync(resolve(DOCS_DIR, slide.source)).toString('base64');
        await page.setContent(
            `<html><body style="margin:0"><img id="shot" style="display:block" src="data:image/png;base64,${png}"></body></html>`,
        );
        await page.waitForFunction(() => document.getElementById('shot').complete);
        await page.screenshot({ path: resolve(OUT_DIR, slide.out), clip: slide.clip });
        console.log(`${slide.out} <- ${slide.source} ${JSON.stringify(slide.clip)}`);
    }
} finally {
    await browser.close();
}
