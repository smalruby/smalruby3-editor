/**
 * Integration tests for the lessons library (レッスン表) and the "Lessons" menu-bar entry.
 * メニューから開く → チャレンジを押す → レッスンモード（課題バー）→ やめる → レッスン表にもどる、
 * と、記録（localStorage）に合わせた「できた」と進み具合の表示。
 */
import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';

const { findByXpath, getDriver, getLogs, loadUri, waitForLoadingFinished } = new SeleniumHelper();

const uri = path.resolve(__dirname, '../../build/index.html');

const CHALLENGE_ID = 'blocks-l1-click-say';
const PROGRESS_KEY = 'smalruby:lessonProgress';

const byTestId = (testId) => `//*[@data-testid="${testId}"]`;

let driver;

const clickByTestId = (d, testId) => d.executeScript(`document.querySelector('[data-testid="${testId}"]').click()`);

const countByTestId = (d, testId) =>
    d.executeScript(`return document.querySelectorAll('[data-testid="${testId}"]').length`);

const textByTestId = (d, testId) =>
    d.executeScript(`return document.querySelector('[data-testid="${testId}"]').textContent`);

// コースの見出しの「n / m」（コース全体の進み具合）
const courseProgressText = (d) => textByTestId(d, 'lessons-library-course-progress-text');

const visibleChallengeIds = (d) =>
    d.executeScript(
        `return Array.from(document.querySelectorAll('[data-testid^="lessons-library-challenge-blocks"]'))
            .map(el => el.dataset.testid.replace('lessons-library-challenge-', ''));`,
    );

// lessonId は 11 のチャレンジが 1 つのレッスンだったころの値（読むときに今の定義で読みかえる・#1529）
const record = (completedAt) => ({ completedAt, courseId: 'kyou-kara-programmer', lessonId: 'blocks-l1' });

describe('Smalruby Lessons Library', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('menu bar → library → challenge → lesson mode → quit → back to the library', async () => {
        await loadUri(`${uri}?no_beforeunload=1`);
        await waitForLoadingFinished();
        await driver.executeScript(`window.localStorage.removeItem(${JSON.stringify(PROGRESS_KEY)})`);

        // 「レッスン」のボタン。はじめての人向けの吹き出しは出さない (#1512)
        await findByXpath(byTestId('menu-bar-lessons'));
        expect(await countByTestId(driver, 'lessons-tooltip')).toBe(0);
        expect(await countByTestId(driver, 'lessons-library')).toBe(0);

        await clickByTestId(driver, 'menu-bar-lessons');
        await findByXpath(byTestId('lessons-library'));
        expect(await courseProgressText(driver)).toBe('0 / 11');
        expect(await countByTestId(driver, 'lessons-library-challenge-done')).toBe(0);
        expect(await countByTestId(driver, 'lessons-library-course-done')).toBe(0);
        // 本文は不透明（青いオーバーレイが透けない）
        const bodyBackground = await driver.executeScript(
            `return getComputedStyle(document.querySelector('[data-testid="lessons-library"]')).backgroundColor`,
        );
        expect(bodyBackground).not.toBe('rgba(0, 0, 0, 0)');

        // 検索: 名前の部分一致。合うチャレンジだけ・合わないレッスンは隠す・無ければその旨
        const search = await driver.findElement({ css: '[data-testid="lessons-library-search"] input' });
        await search.sendKeys('quiz');
        await driver.sleep(300);
        expect(await visibleChallengeIds(driver)).toEqual(['blocks-l1-quiz']);
        expect(await countByTestId(driver, 'lessons-library-lesson-blocks-l1')).toBe(0);
        await search.sendKeys('zzz');
        await driver.sleep(300);
        expect(await textByTestId(driver, 'lessons-library-no-match')).toBe('No challenges match "quizzzz"');
        await driver.executeScript(`document.querySelector('[data-testid="lessons-library-search"] button').click()`);
        await driver.sleep(300);
        expect(await countByTestId(driver, 'lessons-library-no-match')).toBe(0);
        expect((await visibleChallengeIds(driver)).length).toBe(11);

        // チャレンジを押す → レッスン表が閉じてレッスンモードに入る
        await clickByTestId(driver, `lessons-library-challenge-${CHALLENGE_ID}`);
        await findByXpath(byTestId('lesson-task-bar'));
        await driver.sleep(1000);
        expect(await countByTestId(driver, 'lessons-library')).toBe(0);
        expect(await textByTestId(driver, 'lesson-task-bar-position')).toBe('3 of 4');

        // 別のタブが書いた記録のつもりで localStorage に 2 つ入れておく
        const progress = {
            version: 1,
            challenges: {
                'blocks-l1-click-say': record('2026-11-10T00:00:00.000Z'),
                'blocks-l1-repeat': record('2026-11-10T00:00:01.000Z'),
                'blocks-l1-quiz': record('2026-11-10T00:00:02.000Z'),
            },
        };
        await driver.executeScript(
            `window.localStorage.setItem(${JSON.stringify(PROGRESS_KEY)}, ${JSON.stringify(JSON.stringify(progress))})`,
        );

        // やめる → レッスン表にもどり、記録を取り込んで「できた」が出る
        await clickByTestId(driver, 'lesson-task-bar-quit');
        await findByXpath(byTestId('lessons-library'));
        await driver.sleep(500);
        expect(await countByTestId(driver, 'lesson-task-bar')).toBe(0);
        expect(await courseProgressText(driver)).toBe('3 / 11');
        expect(await countByTestId(driver, 'lessons-library-challenge-done')).toBe(3);
        expect(await countByTestId(driver, 'lessons-library-challenge-required')).toBe(0);

        // 既知の無害なログ (Google Drive の初期化失敗など) は getLogs() が除く
        expect(await getLogs()).toEqual([]);
    });

    test('the cards are a color band + the name, and the 11 cards fit in 1300×600 without scrolling', async () => {
        await driver.manage().window().setRect({ width: 1300, height: 600 });
        await loadUri(`${uri}?no_beforeunload=1`);
        await waitForLoadingFinished();
        await driver.executeScript(`window.localStorage.removeItem(${JSON.stringify(PROGRESS_KEY)})`);
        await clickByTestId(driver, 'menu-bar-lessons');
        await findByXpath(byTestId('lessons-library'));
        await driver.sleep(500);

        // 帯の色 = 多く使うブロックのなかまの色（#1543）。絵は無い
        const bands = await driver.executeScript(
            `return Array.from(document.querySelectorAll('[data-testid="lessons-library-card-band"]'))
                .map(el => [el.dataset.category, getComputedStyle(el).backgroundColor, el.getBoundingClientRect().width]);`,
        );
        expect(bands.map(([category]) => category)).toEqual([
            'sound',
            'motion',
            'looks',
            'control',
            'control',
            'sensing',
            'sensing',
            'variables',
            'events',
            'extensions',
            'lists',
        ]);
        expect(bands[0][1]).toBe('rgb(207, 99, 207)');
        expect(bands[1][1]).toBe('rgb(76, 151, 255)');
        bands.forEach(([, , width]) => expect(width).toBe(10));
        expect(await countByTestId(driver, 'lessons-library-card-art')).toBe(0);

        // 11 枚がスクロールせずに見える（いちばん下のカードが画面の中）
        const fit = await driver.executeScript(
            `const cards = Array.from(document.querySelectorAll('[data-testid^="lessons-library-challenge-blocks"]'));
            return {
                innerHeight: window.innerHeight,
                bottom: Math.max(...cards.map(el => el.getBoundingClientRect().bottom)),
            };`,
        );
        expect(fit.bottom).toBeLessThanOrEqual(fit.innerHeight);
    });

    test('?locale=ja-Hira opens the library in hiragana', async () => {
        await loadUri(`${uri}?no_beforeunload=1&locale=ja-Hira`);
        await waitForLoadingFinished();
        await driver.executeScript(`window.localStorage.removeItem(${JSON.stringify(PROGRESS_KEY)})`);

        await findByXpath(byTestId('menu-bar-lessons'));
        await clickByTestId(driver, 'menu-bar-lessons');
        await findByXpath(byTestId('lessons-library'));
        expect(await courseProgressText(driver)).toBe('0 / 11');
        expect(
            await driver.executeScript(
                `return document.querySelector('[data-testid="lessons-library-search"] input').placeholder`,
            ),
        ).toBe('けんさく');
        expect(await textByTestId(driver, 'lessons-library-lesson-blocks-l2')).toContain('えらんで たずねよう');
    });
});
