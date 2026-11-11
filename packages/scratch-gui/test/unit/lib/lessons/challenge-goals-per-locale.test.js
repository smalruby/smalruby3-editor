/**
 * 「プログラムを入れる」の code（locale ごと。Issue #1488）を、その locale の新しい作品に入れて
 * 本物の VM で動かし、チャレンジの操作をしたら goal（「できた」）を満たすかを確かめる。
 *
 * courses.test.js は code が変換できることと、goal がセリフの文字を許すことを別々に見ている。
 * ここでは両方をつなげて、ja / ja-Hira / en の code のセリフ・変数名・リスト名・メッセージ名が、
 * goal の条件に本当に合うかを見る（例: en の code が "Correct" と言っても 7 の goal が満たされるか）。
 * 見張りは本物の goal-monitor（attachGoalMonitor）を使う。
 */
import VM from '@smalruby/scratch-vm';
import { findChallenge, localizeCode } from '../../../../src/lib/lessons/courses';
import { attachGoalMonitor } from '../../../../src/lib/lessons/goal-monitor';
import { targetCodeToBlocks } from '../../../../src/lib/ruby-to-blocks-converter';

// jsdom の performance に mark / measure が無い（scratch-vm が読み込み時に呼ぶ）
if (typeof performance.mark !== 'function') performance.mark = () => {};
if (typeof performance.measure !== 'function') performance.measure = () => {};

// 新しい作品のネコの音の名前（scratch-l10n の gui.defaultProject.meow。ja-Hira は訳が無く Meow）
const CAT_SOUND = { ja: 'ニャー', 'ja-Hira': 'Meow', en: 'Meow' };
const LOCALES = Object.keys(CAT_SOUND);

const costume = (name) => ({
    name,
    assetId: 'cd21514d0531fdffb22204e0ec5ed84a',
    md5ext: 'cd21514d0531fdffb22204e0ec5ed84a.svg',
    dataFormat: 'svg',
    rotationCenterX: 0,
    rotationCenterY: 0,
});
const sound = (name) => ({
    name,
    assetId: '83c36d806dc92327b9e7049a565c6bff',
    md5ext: '83c36d806dc92327b9e7049a565c6bff.wav',
    dataFormat: 'wav',
    rate: 48000,
    sampleCount: 1,
});
const sprite = (name, sounds) => ({
    isStage: false,
    name,
    variables: {},
    lists: {},
    broadcasts: {},
    blocks: {},
    comments: {},
    costumes: [costume('costume1')],
    sounds: sounds.map(sound),
    visible: true,
    x: 0,
    y: 0,
    size: 100,
    direction: 90,
    draggable: false,
    rotationStyle: 'all around',
    currentCostume: 0,
    volume: 100,
    layerOrder: 1,
});

// その locale の新しい作品に、チャレンジで足すもの（Owl・Canyon / Arctic・ペンギン）を足した状態
const projectFor = (locale, { penguin }) => ({
    targets: [
        {
            isStage: true,
            name: 'Stage',
            variables: {},
            lists: {},
            broadcasts: {},
            blocks: {},
            comments: {},
            costumes: [costume('backdrop1'), costume('Canyon'), costume('Arctic')],
            sounds: [sound('pop')],
            currentCostume: 0,
            volume: 100,
            layerOrder: 0,
        },
        sprite('Sprite1', [CAT_SOUND[locale], 'Owl']),
        ...(penguin ? [sprite('Penguin', [])] : []),
    ],
    monitors: [],
    extensions: [],
    meta: { semver: '3.0.0' },
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const until = async (predicate, timeout) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
        if (predicate()) return true;
        await sleep(20);
    }
    return predicate();
};

const insert = async (vm, target, code) => {
    const converter = await targetCodeToBlocks(vm, target, code, null, { version: '2' });
    expect(converter.errors).toEqual([]);
    await converter.apply();
};

// チャレンジの操作（子どもが課題の文言どおりにすること）。ctx = {vm, cat, stage, answer, touch}
const OPERATIONS = {
    'blocks-l1-key-sound': async ({ press }) => press(' '),
    'blocks-l1-arrow-move': async ({ press }) => {
        await press('ArrowUp');
        await press('ArrowDown');
    },
    'blocks-l1-click-say': async ({ vm, cat, click }) => {
        // 課題: コスチュームを 1 つ足す
        cat.addCostume({ ...costume('costume2'), asset: null, skinId: null });
        vm.runtime.emitProjectChanged();
        await click();
    },
    'blocks-l1-repeat': async ({ press }) => press('1'),
    'blocks-l1-if': async ({ vm, touch }) => {
        vm.greenFlag();
        await sleep(150);
        touch(true);
        await sleep(150);
        touch(false);
    },
    'blocks-l1-ask-answer': async ({ click, answer }) => {
        await click();
        await answer('たろう');
    },
    'blocks-l1-quiz': async ({ click, answer }) => {
        await click();
        await answer('7');
        await sleep(2200);
        await click();
        await answer('5');
    },
    'blocks-l1-count': async ({ vm, click }) => {
        vm.greenFlag();
        await sleep(100);
        for (let i = 0; i < 3; i += 1) {
            await click();
            await sleep(100);
        }
    },
    'blocks-l1-broadcast': async ({ click }) => click(),
    'blocks-l1-speak': async ({ click }) => click(),
    'blocks-l1-message-list': async ({ vm, click, answer }) => {
        vm.greenFlag();
        await sleep(100);
        for (const text of ['a', 'b', 'c']) {
            await click();
            await answer(text);
        }
    },
};

// ステージのプログラムのチャレンジ 4 は 1 秒の待ちが 6 回ある
const WAIT_FOR_GOAL_MS = 9000;

describe('the code of every locale satisfies the goal when run in a new project of that locale', () => {
    let vm;

    afterEach(() => {
        if (vm) {
            vm.stopAll();
            vm.runtime.quit();
            vm = null;
        }
    });

    const cases = [];
    Object.keys(OPERATIONS).forEach((id) => LOCALES.forEach((locale) => cases.push([id, locale])));

    test.each(cases)(
        '%s (%s)',
        async (id, locale) => {
            const { challenge } = findChallenge(id);
            vm = new VM();
            await vm.loadProject(projectFor(locale, { penguin: challenge.spriteCodes.length > 0 }));
            const stage = vm.runtime.getTargetForStage();
            const cat = vm.runtime.targets.find((t) => t.isOriginal && t.getName() === 'Sprite1');
            vm.setEditingTarget(cat.id);

            for (const { sprite: name, code } of challenge.spriteCodes) {
                const target = vm.runtime.targets.find((t) => t.isOriginal && t.getName() === name);
                await insert(vm, target, localizeCode(code, locale));
            }
            await insert(vm, challenge.codeTarget === 'stage' ? stage : cat, localizeCode(challenge.code, locale));

            // 音声合成（チャレンジ 10）はネットワークにつながないので、しゃべるブロックは何もしない
            if (vm.runtime._primitives.text2speech_speakAndWait) {
                vm.runtime._primitives.text2speech_speakAndWait = () => {};
            }
            // マウスのふれ方はレンダラーが無いので、テストで決める
            let touching = false;
            cat.isTouchingObject = (object) => object === '_mouse_' && touching;

            let questions = 0;
            vm.runtime.on('QUESTION', (q) => {
                if (q !== null) questions += 1;
            });
            let satisfied = false;
            attachGoalMonitor(vm, challenge.goal, () => {
                satisfied = true;
            });
            vm.start();

            const ctx = {
                vm,
                cat,
                stage,
                touch: (value) => {
                    touching = value;
                },
                press: async (key) => {
                    vm.postIOData('keyboard', { key, isDown: true });
                    await sleep(50);
                    vm.postIOData('keyboard', { key, isDown: false });
                    await sleep(50);
                },
                click: async () => {
                    vm.runtime.startHats('event_whenthisspriteclicked', null, cat);
                    await sleep(50);
                },
                answer: async (text) => {
                    const asked = questions;
                    expect(await until(() => questions > asked - 1 && questions > 0, 2000)).toBe(true);
                    vm.runtime.emit('ANSWER', text);
                    questions = 0;
                    await sleep(50);
                },
            };
            await OPERATIONS[id](ctx);
            expect(await until(() => satisfied, WAIT_FOR_GOAL_MS)).toBe(true);
        },
        20000,
    );
});
