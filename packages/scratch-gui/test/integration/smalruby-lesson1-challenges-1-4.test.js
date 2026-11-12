/**
 * Integration tests for lesson 1 "ブロックのなかま" challenges 1-4.
 * チャレンジを開く → ヒントを最後まで進めて「プログラムを入れる」→ 課題の操作（キーを押す・
 * ステージのネコをクリックする）→「できた！」の toast が出る。
 *
 * - キーは Selenium の実際のキー入力で押す（コードエリアをクリックしてフォーカスを移してから）。
 *   エディタにフォーカスがあってもキーがステージ（VM）に届くことの確認を兼ねる。
 * - 音「Owl」・背景「Canyon」「Arctic」は、ネットワーク無しで足せるよう、いまの音・背景を複製して
 *   名前を変えて作る（ライブラリから足すのと同じ VM の状態になる）。
 * - チャレンジ 1 は日本語の locale で開き、日本語の作品（ネコの音「ニャー」）に ja の code が入ることを見る
 *   （英語の作品は smalruby-lessons-en.test.js）。
 *
 * レッスン表はまだ無いので、入口は `window.smalruby.startChallenge(id)`。
 */
import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';

const { findByXpath, getDriver, getLogs, Key, loadUri, waitForLoadingFinished } = new SeleniumHelper();

const uri = path.resolve(__dirname, '../../build/index.html');

const byTestId = (testId) => `//*[@data-testid="${testId}"]`;

let driver;

const startChallenge = (challengeId) =>
    driver.executeScript(`window.smalruby.startChallenge(${JSON.stringify(challengeId)})`);

const clickByTestId = (testId) => driver.executeScript(`document.querySelector('[data-testid="${testId}"]').click()`);

// ヒントの吹き出しはチャレンジを始めると自動で開く。閉じているときだけ課題バーの「ヒント」で開き直す
const openHint = async () => {
    const open = await driver.executeScript(`return document.querySelectorAll('[data-testid="lesson-hint"]').length`);
    if (open === 0) await clickByTestId('lesson-task-bar-hint');
    await findByXpath('//*[@data-testid="lesson-hint"]');
};

// 最後のページの「正解のプログラムを確認する」→ 確認の「はい」（今までの「プログラムを入れる」と同じ動き）
const confirmInsertCode = async () => {
    await clickByTestId('lesson-hint-insert-code');
    await findByXpath('//*[@data-testid="lesson-hint-insert-code-yes"]');
    await clickByTestId('lesson-hint-insert-code-yes');
};

const countByTestId = (testId) =>
    driver.executeScript(`return document.querySelectorAll('[data-testid="${testId}"]').length`);

const textByTestId = (testId) =>
    driver.executeScript(`return document.querySelector('[data-testid="${testId}"]').textContent`);

// 吹き出しの中の Blockly に描かれたブロックの文字（Blockly は空白を   で描く）
const hintBlockText = () =>
    driver.executeScript(
        `const canvas = document.querySelector('[data-testid="lesson-hint-blocks"] .blocklyBlockCanvas');
        return canvas ? canvas.textContent.replace(/\\u00a0/g, ' ') : '';`,
    );

const opcodesOf = (which) =>
    driver.executeScript(`const vm = window.smalruby.vm;
        const target = ${which === 'stage' ? 'vm.runtime.getTargetForStage()' : 'vm.editingTarget'};
        return Object.values(target.blocks._blocks).filter(b => !b.shadow).map(b => b.opcode).sort();`);

const waitForOpcode = (which, opcode) =>
    driver.wait(async () => (await opcodesOf(which)).includes(opcode), 20000, `${opcode} was not inserted`);

// loadUri は窓を 1024 幅にするので、そのあとで授業のパソコン（1300×600）と同じ幅にする
// （ステージ全体が画面に入り、ステージの真ん中をクリックできる）
const loadEditor = async (query) => {
    await loadUri(`${uri}?no_beforeunload=1${query}`);
    await driver.manage().window().setRect({ width: 1300, height: 800 });
    await waitForLoadingFinished();
    await resetProgress();
};

const openChallenge = async (challengeId) => {
    await startChallenge(challengeId);
    await findByXpath(byTestId('lesson-task-bar'));
    await driver.sleep(1000);
};

// ヒントを開き、最後の手段のページまで進めて「プログラムを入れる」を押す
const insertProgramFromHints = async (expectedHintCount) => {
    await openHint();
    await findByXpath(byTestId('lesson-hint'));
    for (let i = 1; i < expectedHintCount; i++) {
        expect(await countByTestId('lesson-hint-insert-code')).toBe(0);
        await clickByTestId('lesson-hint-next');
    }
    await findByXpath(byTestId('lesson-hint-insert-code'));
    await confirmInsertCode();
};

// コードエリア（Blockly のワークスペース）の空いているところをクリックしてフォーカスを移す
const focusCodeArea = async () => {
    const svg = await driver.findElement({ css: '[class*="blocks_blocks_"] .blocklySvg' });
    await driver.actions().move({ origin: svg, x: 200, y: 120 }).click().perform();
    await driver.sleep(300);
};

const pressKey = async (key) => {
    await driver.actions().keyDown(key).perform();
    await driver.sleep(100);
    await driver.actions().keyUp(key).perform();
};

const clickCatOnStage = async () => {
    // ネコは新しい作品ではステージの真ん中にいる。Selenium の move({origin: element}) は画面に
    // 見えている部分の中心を指すので、ステージの矩形から真ん中の座標を自分で出す
    const center = await driver.executeScript(
        `const r = document.querySelector('[class*="stage_stage-wrapper_"] canvas').getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };`,
    );
    await driver.actions().move({ origin: 'viewport', x: center.x, y: center.y }).click().perform();
};

const waitForCompletedToast = async (challengeId) => {
    await findByXpath(byTestId('lesson-completed-toast'));
    // チャレンジの名前は出さない（課題バーに出ている）ので、data-challenge-id で見る
    expect(
        await driver.executeScript(
            `return document.querySelector('[data-testid="lesson-completed-toast"]').getAttribute('data-challenge-id');`,
        ),
    ).toBe(challengeId);
    // 「できること」は段 1 から外した（#1529）
    expect(await countByTestId('lesson-completed-toast-skills')).toBe(0);
};

const resetProgress = () =>
    driver.executeScript(`window.localStorage.removeItem('smalruby:lessonProgress');
        window.localStorage.removeItem('smalruby:lessonSpotlightSeen');`);

// 複製は元の次（index 1）に入る
const addSoundNamed = (name) =>
    driver.executeScript(
        `const vm = window.smalruby.vm;
        return vm.duplicateSound(0).then(() => vm.renameSound(1, arguments[0]));`,
        name,
    );

// ステージの背景を複製して名前を変える（ライブラリの「背景を選ぶ」で足したのと同じ状態）
const addBackdropsNamed = (names) =>
    driver.executeScript(
        `const vm = window.smalruby.vm;
        const stage = vm.runtime.getTargetForStage();
        const sprite = vm.editingTarget;
        vm.setEditingTarget(stage.id);
        // 複製は元の次（index 1）に入るので、後ろの名前から足すと names の順に並ぶ
        return arguments[0].slice().reverse().reduce((p, name) => p.then(() =>
            vm.duplicateCostume(0).then(() => vm.renameCostume(1, name))
        ), Promise.resolve()).then(() => vm.setEditingTarget(sprite.id));`,
        names,
    );

describe('Smalruby Lessons: lesson 1 challenges 1-4', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('challenge 3 (押したら話そう): add a costume, insert the program, click the cat → できた！', async () => {
        await loadEditor('');
        await openChallenge('blocks-l1-click-say');
        expect(await textByTestId('lesson-task-bar-position')).toBe('3 of 4');

        // コスチュームを足す（コスチュームタブで足したのと同じ VM の状態）
        await driver.executeScript(`return window.smalruby.vm.duplicateCostume(0);`);

        await insertProgramFromHints(7);
        await waitForOpcode('sprite', 'looks_nextcostume');
        expect(await opcodesOf('sprite')).toEqual([
            'event_whenthisspriteclicked',
            'looks_nextcostume',
            'looks_sayforsecs',
        ]);
        expect(await countByTestId('lesson-completed-toast')).toBe(0);

        await clickCatOnStage();
        await waitForCompletedToast('blocks-l1-click-say');

        const saved = await driver.executeScript(
            `return JSON.parse(window.localStorage.getItem('smalruby:lessonProgress'));`,
        );
        expect(saved.challenges['blocks-l1-click-say']).toEqual(
            expect.objectContaining({ courseId: 'kyou-kara-programmer', lessonId: 'blocks-l1' }),
        );
        await clickByTestId('lesson-completed-toast-close');
        await clickByTestId('lesson-task-bar-quit');

        // 既知の無害なログ (Google Drive の初期化失敗など) は getLogs() が除く
        expect(await getLogs()).toEqual([]);
    });

    test('challenge 2 (矢印キーで動かそう): insert the program, press up and down with the code area focused → できた！', async () => {
        await loadEditor('');
        await openChallenge('blocks-l1-arrow-move');
        expect(await textByTestId('lesson-task-bar-position')).toBe('2 of 4');

        // ヒント 1 は帽子のブロック「上向き矢印キーが押されたとき」を描き、ヒント 2 は「y座標を 10 ずつ変える」
        await openHint();
        await findByXpath(byTestId('lesson-hint'));
        await driver.wait(async () => (await hintBlockText()).includes('up arrow'), 20000, 'hint 1 blocks');
        await clickByTestId('lesson-hint-next');
        await driver.wait(async () => (await hintBlockText()).includes('change y by'), 20000, 'hint 2 blocks');
        // 1 ページ目にもどしてから閉じる（× はページを保つ）
        await clickByTestId('lesson-hint-prev');
        await clickByTestId('lesson-hint-close');

        await insertProgramFromHints(5);
        await waitForOpcode('sprite', 'motion_changeyby');
        expect(await opcodesOf('sprite')).toEqual([
            'event_whenkeypressed',
            'event_whenkeypressed',
            'motion_changeyby',
            'motion_changeyby',
        ]);
        const yBefore = await driver.executeScript('return window.smalruby.vm.editingTarget.y;');

        // エディタ（コードエリア）にフォーカスがあってもキーはステージに届く
        await focusCodeArea();
        await pressKey(Key.ARROW_UP);
        await driver.wait(
            async () => (await driver.executeScript('return window.smalruby.vm.editingTarget.y;')) > yBefore,
            10000,
            'the cat did not move up',
        );
        expect(await countByTestId('lesson-completed-toast')).toBe(0);
        await pressKey(Key.ARROW_DOWN);
        await waitForCompletedToast('blocks-l1-arrow-move');
        await clickByTestId('lesson-completed-toast-close');
        await clickByTestId('lesson-task-bar-quit');

        // 既知の無害なログ (Google Drive の初期化失敗など) は getLogs() が除く
        expect(await getLogs()).toEqual([]);
    });

    test('challenge 1 (キーで音を鳴らそう): add "Owl", insert the program, press space → できた！', async () => {
        // 日本語の作品（ネコの音は「ニャー」）に ja の code を入れる
        await loadEditor('&locale=ja');
        await openChallenge('blocks-l1-key-sound');
        expect(await textByTestId('lesson-task-bar-position')).toBe('1 / 4');

        // Owl を足す前に「プログラムを入れる」を押すと、入れずに吹き出しの中にわけが出る
        await insertProgramFromHints(6);
        await findByXpath(byTestId('lesson-hint-insert-code-error'));
        expect(await textByTestId('lesson-hint-insert-code-error')).toContain('Owl');
        expect(await opcodesOf('sprite')).toEqual([]);
        await clickByTestId('lesson-hint-close');

        await addSoundNamed('Owl');
        expect(
            await driver.executeScript('return window.smalruby.vm.editingTarget.sprite.sounds.map(s => s.name);'),
        ).toEqual(['ニャー', 'Owl']);

        // ヒントは最後のページのまま開き直す（わけは消えている）
        await openHint();
        await findByXpath(byTestId('lesson-hint-insert-code'));
        expect(await countByTestId('lesson-hint-insert-code-error')).toBe(0);
        await confirmInsertCode();
        await waitForOpcode('sprite', 'sound_play');
        expect(await opcodesOf('sprite')).toEqual(['event_whenkeypressed', 'sound_play', 'sound_playuntildone']);

        await focusCodeArea();
        await pressKey(Key.SPACE);
        await waitForCompletedToast('blocks-l1-key-sound');
        await clickByTestId('lesson-completed-toast-close');
        await clickByTestId('lesson-task-bar-quit');

        // 既知の無害なログ (Google Drive の初期化失敗など) は getLogs() が除く
        expect(await getLogs()).toEqual([]);
    });

    test('challenge 4 (くり返そう): add the backdrops, insert the program into the stage, press 1 → できた！', async () => {
        await loadEditor('');
        await openChallenge('blocks-l1-repeat');
        expect(await textByTestId('lesson-task-bar-position')).toBe('4 of 4');

        await addBackdropsNamed(['Canyon', 'Arctic']);
        expect(
            await driver.executeScript(
                'return window.smalruby.vm.runtime.getTargetForStage().getCostumes().map(c => c.name);',
            ),
        ).toEqual(['backdrop1', 'Canyon', 'Arctic']);
        // スプライトを編集中のまま「プログラムを入れる」→ ステージに入る
        expect(await driver.executeScript('return window.smalruby.vm.editingTarget.isStage;')).toBe(false);

        // ヒント 3 は帽子のブロック「1 キーが押されたとき」、ヒント 5 は「繰り返す」の中に入れる 4 つの並び（#1564）
        await openHint();
        await clickByTestId('lesson-hint-next');
        await clickByTestId('lesson-hint-next');
        expect(await textByTestId('lesson-hint-position')).toBe('Hint 3 of 7');
        await driver.wait(async () => /when\s*1\s*key pressed/.test(await hintBlockText()), 20000, 'hint 3 blocks');
        await clickByTestId('lesson-hint-next');
        await clickByTestId('lesson-hint-next');
        expect(await textByTestId('lesson-hint-position')).toBe('Hint 5 of 7');
        await driver.wait(
            async () => {
                const text = await hintBlockText();
                return ['Canyon', 'Arctic'].every((name) => text.includes(name)) && text.split('wait').length === 3;
            },
            20000,
            'hint 5 blocks',
        );
        for (let i = 0; i < 4; i++) await clickByTestId('lesson-hint-prev');
        expect(await textByTestId('lesson-hint-position')).toBe('Hint 1 of 7');

        await insertProgramFromHints(7);
        await waitForOpcode('stage', 'control_repeat');
        expect(await opcodesOf('stage')).toEqual([
            'control_repeat',
            'control_wait',
            'control_wait',
            'event_whenkeypressed',
            'looks_switchbackdropto',
            'looks_switchbackdropto',
        ]);
        expect(await driver.executeScript('return window.smalruby.vm.editingTarget.isStage;')).toBe(true);
        expect(
            await driver.executeScript(
                'return Object.values(window.smalruby.vm.runtime.targets[1].blocks._blocks).length;',
            ),
        ).toBe(0);

        await focusCodeArea();
        await pressKey('1');
        // 3 回 × (1 秒 + 1 秒) で 6 回かわる（6 秒ほどかかる）
        await waitForCompletedToast('blocks-l1-repeat');
        await clickByTestId('lesson-completed-toast-close');
        await clickByTestId('lesson-task-bar-quit');

        // 既知の無害なログ (Google Drive の初期化失敗など) は getLogs() が除く
        expect(await getLogs()).toEqual([]);
    });
});
