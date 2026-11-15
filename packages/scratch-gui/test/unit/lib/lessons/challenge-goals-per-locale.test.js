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
import { attachPracticeLoopback } from '../../../../src/lib/lessons/practice-loopback';
import { normalizePartner } from '../../../../src/lib/lessons/practice-partner';
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

// その locale の新しい作品に、チャレンジで足すもの（Owl・Canyon / Arctic・spriteCodes のスプライト）を足した状態
const projectFor = (locale, { sprites }) => ({
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
        ...sprites.map((name) => sprite(name, [])),
    ],
    monitors: [],
    extensions: [],
    meta: { semver: '3.0.0' },
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// メッシュの拡張は jest ではサーバーにつなぐ部品（Apollo のクライアント）を作れず meshService が無いので、
// つないでいないときの受信の置き場（remoteData）と読み方（data-sender.js の getRemoteVariable: いちばん新しい
// 値）だけを持つ代わりを入れる。練習相手（practice-loopback.js）はこの置き場に相手の値を入れる
const fakeMeshService = () => ({
    meshId: 'me',
    groupId: null,
    remoteData: {},
    getRemoteVariable(name) {
        let latest = null;
        let latestTimestamp = 0;
        Object.values(this.remoteData).forEach((node) => {
            if (Object.prototype.hasOwnProperty.call(node, name) && node[name].timestamp > latestTimestamp) {
                latestTimestamp = node[name].timestamp;
                latest = node[name].value;
            }
        });
        return latest;
    },
    getGlobalVariables: () => [],
    fireEvent: () => {},
    sendData: async () => {},
});

const loadExtension = async (vm, id) => {
    if (vm.extensionManager.isExtensionLoaded(id)) return;
    await vm.extensionManager.loadExtensionURL(id);
    const ext = id === 'meshV2' ? vm.runtime.peripheralExtensions.meshV2 : null;
    if (ext && !ext.meshService) ext.meshService = fakeMeshService();
};

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
    // コース「チャットをつくろう」のレッスン 1（#1641）。作品ではシマラビに置きかえて始めるが、判定は
    // スプライトを見ないので、ここではネコに入れて動かす
    'chat-l1-sequence': async ({ vm, answer }) => {
        vm.greenFlag();
        await answer('hello');
    },
    'chat-l1-repeat': async ({ vm, answer }) => {
        vm.greenFlag();
        await answer('hello');
        await answer('again');
    },
    'chat-l1-branch': async ({ vm, answer }) => {
        vm.greenFlag();
        await answer('');
        await sleep(2200);
        vm.greenFlag();
        await answer('hello');
    },
    'chat-l1-read-diagram': async ({ vm, answer, locale, isSatisfied }) => {
        const end = locale === 'en' ? 'end' : 'おわり';
        // 1 回目: すぐ「おわり」（くり返しを通らない = まだ「できた」にならない）
        vm.greenFlag();
        await answer(end);
        await sleep(300);
        expect(isSatisfied()).toBe(false);
        // 2 回目: 前の「答え」（おわり）が残っていても、旗を押せば最初に聞く（answer が質問を待つ）
        vm.greenFlag();
        await answer('hello');
        await answer(end);
    },
    // レッスン 2（#1642）。乱数を決めて、課題の両方の場合（大吉と小吉・あいこと勝負あり）を出す
    'chat-l2-omikuji': async ({ click, randoms }) => {
        randoms([1, 2]);
        await click(); // くじ = 1 → 大吉
        await sleep(2200);
        await click(); // くじ = 2 → 小吉
    },
    // タイマーの 10 秒は、リセットのあとで作品のタイマーを 10 秒進めて飛ばす
    'chat-l2-timer': async ({ vm, skipSeconds, isSatisfied }) => {
        vm.greenFlag();
        await sleep(300);
        // まだ 10 秒たっていないので、言っていない
        expect(isSatisfied()).toBe(false);
        skipSeconds(10);
        await sleep(300);
    },
    'chat-l2-janken': async ({ click, answer, randoms }) => {
        randoms([0, 1]);
        await click();
        await answer('0'); // 手 = 0 → あいこ
        await sleep(2200);
        await click();
        await answer('0'); // 手 = 1 → 勝負あり
    },
    // レッスン 3（#1643）。シマラビ（code）はネコに、シマネコは spriteCodes で入れる
    'chat-l3-local-message': async ({ vm, answer }) => {
        vm.greenFlag();
        await answer('hello');
    },
    // 拡張機能「メッシュ」を足してスペースキー（自分の送ったメッセージは自分にも届く）。練習相手の「手をふる」も押す
    'chat-l3-mesh-signal': async ({ press, addExtension, partnerPress, isSatisfied }) => {
        await press(' ');
        await sleep(100);
        // メッシュを足すまでは「できた」にならない
        expect(isSatisfied()).toBe(false);
        await addExtension('meshV2');
        await partnerPress(0);
        await press(' ');
    },
    // 1・2 のキーで自分の気分を変え、練習相手の「うれしい」を押してからシマネコを押す
    'chat-l3-mesh-variable': async ({ press, partnerPress, clickSprite, isSatisfied }) => {
        await press('1');
        await press('2');
        // 相手の気分がまだ届いていないので、シマネコは何も言わない
        await clickSprite('Shimacat');
        await sleep(100);
        expect(isSatisfied()).toBe(false);
        await partnerPress(0);
        await clickSprite('Shimacat');
    },
};

// ステージのプログラムのチャレンジ 4 は 1 秒の待ちが 6 回ある
const WAIT_FOR_GOAL_MS = 9000;

// チャレンジの code（または codeOverride）をその locale の新しい作品に入れ、goal の見張りを付けて動かす準備をする。
// codeOverride は code の Ruby か、ほかのスプライトにも入れるときは `{code, sprites: {名前: Ruby}}`。
// 戻り値の ctx でチャレンジの操作をし、isSatisfied() で「できた」かを見る
const prepareRun = async (id, locale, override = null) => {
    const codeOverride = override !== null && typeof override === 'object' ? override.code : override;
    const spriteOverrides = override !== null && typeof override === 'object' ? override.sprites || {} : {};
    const { challenge } = findChallenge(id);
    const vm = new VM();
    await vm.loadProject(projectFor(locale, { sprites: challenge.spriteCodes.map((s) => s.sprite) }));
    // 始めるときに読み込む拡張機能（3-3 のメッシュ）。プログラムを入れる前に読み込む
    for (const id of (challenge.setup && challenge.setup.extensions) || []) {
        await loadExtension(vm, id);
    }
    const stage = vm.runtime.getTargetForStage();
    const cat = vm.runtime.targets.find((t) => t.isOriginal && t.getName() === 'Sprite1');
    vm.setEditingTarget(cat.id);

    if (codeOverride === null) {
        for (const { sprite: name, code } of challenge.spriteCodes) {
            const target = vm.runtime.targets.find((t) => t.isOriginal && t.getName() === name);
            await insert(vm, target, localizeCode(code, locale));
        }
    }
    for (const [name, code] of Object.entries(spriteOverrides)) {
        const target = vm.runtime.targets.find((t) => t.isOriginal && t.getName() === name);
        await insert(vm, target, code);
    }
    await insert(
        vm,
        challenge.codeTarget === 'stage' ? stage : cat,
        codeOverride === null ? localizeCode(challenge.code, locale) : codeOverride,
    );

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
    // 練習相手（ひとりのとき）。ボタンは ctx.partnerPress で押す
    const partner = normalizePartner(challenge.partner, locale);
    const loop = partner ? attachPracticeLoopback({ vm, partner }) : null;
    let satisfied = false;
    attachGoalMonitor(vm, challenge.goal, () => {
        satisfied = true;
    });
    vm.start();

    const ctx = {
        vm,
        locale,
        cat,
        stage,
        isSatisfied: () => satisfied,
        // 拡張機能を足す（課題で生徒が足す）
        addExtension: (id) => loadExtension(vm, id),
        // 練習相手のパネルのボタンを押す（何番目か）
        partnerPress: async (index) => {
            loop.press(index);
            await sleep(50);
        },
        // シマネコ（spriteCodes のスプライト）を押す
        clickSprite: async (name) => {
            const target = vm.runtime.targets.find((t) => t.isOriginal && t.getName() === name);
            vm.runtime.startHats('event_whenthisspriteclicked', null, target);
            await sleep(50);
        },
        // 作品のタイマー（「タイマー」ブロックの値）を進める
        skipSeconds: (seconds) => {
            vm.runtime.ioDevices.clock._projectTimer.startTime -= seconds * 1000;
        },
        // 「乱数」ブロックが返す数を、決めた数のくり返しにする（Math.random はほかでも呼ばれるので、ブロックの
        // 関数を差しかえる。見張りは差しかえた関数も包むので、引数 FROM / TO は記録される）
        randoms: (values) => {
            let i = 0;
            vm.runtime._primitives.operator_random = () => {
                const value = values[i % values.length];
                i += 1;
                return value;
            };
            vm.runtime.targets.forEach((target) => target.blocks.resetCache());
        },
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
    return { vm, ctx, isSatisfied: () => satisfied };
};

const quitVm = (vm) => {
    if (vm) {
        vm.stopAll();
        vm.runtime.quit();
    }
};

describe('the code of every locale satisfies the goal when run in a new project of that locale', () => {
    let vm;

    afterEach(() => {
        quitVm(vm);
        vm = null;
    });

    const cases = [];
    Object.keys(OPERATIONS).forEach((id) => LOCALES.forEach((locale) => cases.push([id, locale])));

    test.each(cases)(
        '%s (%s)',
        async (id, locale) => {
            const run = await prepareRun(id, locale);
            vm = run.vm;
            await OPERATIONS[id](run.ctx);
            expect(await until(run.isSatisfied, WAIT_FOR_GOAL_MS)).toBe(true);
        },
        20000,
    );
});

// 「チャットをつくろう」レッスン 1（#1641）の goal が、課題をやっていないプログラム（ずる）では満たされないこと
const CHEATS = [
    // 1-1: 変数を使わずに答えを言う
    [
        'chat-l1-sequence',
        'when_flag_clicked do\n  ask("メッセージを入力")\n  say(answer, 2)\nend\n',
        async ({ vm, answer }) => {
            vm.greenFlag();
            await answer('hello');
            await sleep(300);
        },
    ],
    // 1-2: ずっと〔(答え) と聞いて待つ〕だけ（変数は作ってあるが入れない）
    [
        'chat-l1-repeat',
        'when_flag_clicked do\n  ask("メッセージを入力")\n  loop do\n    ask(answer)\n  end\nend\n\n' +
            'when_key_pressed("x") do\n  $シマラビのメッセージ = 0\nend\n',
        async ({ vm, answer }) => {
            vm.greenFlag();
            await answer('hello');
            await answer('again');
            await answer('more');
        },
    ],
    // 1-3: 分岐なしで「何か書いてね」と答えの両方を言う
    [
        'chat-l1-branch',
        'when_flag_clicked do\n  ask("メッセージを入力")\n  say("何か書いてね", 2)\n' +
            '  $シマラビのメッセージ = answer\n  say($シマラビのメッセージ, 2)\nend\n',
        async ({ vm, answer }) => {
            vm.greenFlag();
            await answer('');
            await sleep(4200);
            vm.greenFlag();
            await answer('hello');
            await sleep(4200);
        },
    ],
    // 1-4: 「またね」を言うブロックが無く、入力した「またね」を言っただけ
    [
        'chat-l1-read-diagram',
        'when_flag_clicked do\n  ask("メッセージを入力")\n  until answer == "おわり"\n    say(answer, 1)\n' +
            '    ask("メッセージを入力")\n  end\nend\n',
        async ({ vm, answer }) => {
            vm.greenFlag();
            await answer('またね');
            await answer('おわり');
            await sleep(300);
        },
    ],
];

describe('the chat lesson 1 goals are not met by programs that skip the task (#1641)', () => {
    let vm;

    afterEach(() => {
        quitVm(vm);
        vm = null;
    });

    test.each(CHEATS)(
        '%s',
        async (id, code, operation) => {
            const run = await prepareRun(id, 'ja', code);
            vm = run.vm;
            await operation(run.ctx);
            expect(await until(run.isSatisfied, 1500)).toBe(false);
        },
        20000,
    );
});

// 「チャットをつくろう」レッスン 2（#1642）の goal が、課題をやっていないプログラム（ずる）では満たされないこと。
// 乱数を決めて、ずるのプログラムでも「大吉と小吉」「あいこと勝負あり」の両方を言う場面を作る。
// くじを見ずに別の乱数で分ける・答えを決まった数と比べるプログラムは、本当の乱数なら出方しだいで通ることがある
// （判定は動いた結果を見る）。ここでは、乱数を決めた場合に通らないことだけを確かめる
const CHEATS_L2 = [
    // 2-1: 分岐を使わずに、押すたびに大吉と小吉の両方を言う（くじが 1 のときに大吉、2 のときに小吉は言っている）
    [
        'chat-l2-omikuji (both lines without the branch)',
        'chat-l2-omikuji',
        'when_clicked do\n  $くじ = rand(1..3)\n  say("大吉")\n  say("小吉")\nend\n',
        async ({ click, randoms }) => {
            randoms([1, 2]);
            await click();
            await sleep(300);
            await click();
            await sleep(300);
        },
    ],
    // 2-1: くじを見ずに、別の乱数で分ける（乱数を決めた場合。くじに入れた数と、言ったことが合わない）
    [
        'chat-l2-omikuji (branch on another random number, with fixed random numbers)',
        'chat-l2-omikuji',
        'when_clicked do\n  $くじ = rand(1..3)\n  if rand(1..3) == 1\n    say("大吉")\n  else\n' +
            '    say("小吉")\n  end\nend\n',
        async ({ click, randoms }) => {
            // 押すたびに (くじ, 条件の乱数) = (1, 2) (3, 1) (2, 3) (1, 2)
            randoms([1, 2, 3]);
            for (let i = 0; i < 4; i += 1) {
                await click();
                await sleep(300);
            }
        },
    ],
    // 2-2: 10 秒より前に終わる条件で待つ
    [
        'chat-l2-timer (waits until the timer is greater than 1)',
        'chat-l2-timer',
        'when_flag_clicked do\n  timer.reset\n  wait until timer.value > 1\n  say("10秒たったよ")\nend\n',
        async ({ vm, skipSeconds }) => {
            vm.greenFlag();
            await sleep(300);
            skipSeconds(2);
            await sleep(300);
        },
    ],
    // 2-2: 右に数でない文字（「10秒」）を入れる。Scratch は文字として比べるので 2 秒ほどで成り立つ
    [
        'chat-l2-timer (compares the timer with the text "10秒")',
        'chat-l2-timer',
        'when_flag_clicked do\n  timer.reset\n  wait until timer.value > "10秒"\n  say("10秒たったよ")\nend\n',
        async ({ vm, skipSeconds }) => {
            const said = [];
            vm.runtime.on('SAY', (target, type, text) => said.push(text));
            vm.greenFlag();
            await sleep(300);
            skipSeconds(3);
            await sleep(300);
            // 3 秒で言ってはいる（判定の右が数でないので通らない）
            expect(said).toContain('10秒たったよ');
        },
    ],
    // 2-3: 分岐を使わずに、あいこと勝負ありの両方を言う
    [
        'chat-l2-janken (both lines without the branch)',
        'chat-l2-janken',
        'when_clicked do\n  ask("0:グー 1:チョキ 2:パー")\n  $手 = rand(0..2)\n  say("あいこ")\n' +
            '  say("勝負あり")\nend\n',
        async ({ click, answer, randoms }) => {
            randoms([0, 1]);
            await click();
            await answer('0');
            await sleep(300);
            await click();
            await answer('0');
            await sleep(300);
        },
    ],
    // 2-3: 答えをコンピューターの手ではなく、決まった数（0）と比べる（乱数を決めた場合）
    [
        'chat-l2-janken (compares the answer with 0, not with 手, with fixed random numbers)',
        'chat-l2-janken',
        'when_clicked do\n  ask("0:グー 1:チョキ 2:パー")\n  $手 = rand(0..2)\n  if answer == 0\n' +
            '    say("あいこ")\n  else\n    say("勝負あり")\n  end\nend\n',
        async ({ click, answer, randoms }) => {
            // 手はいつも 1
            randoms([1]);
            await click();
            await answer('0'); // 手とちがうのに「あいこ」
            await sleep(300);
            await click();
            await answer('1'); // 手と同じなのに「勝負あり」
            await sleep(300);
        },
    ],
];

describe('the chat lesson 2 goals are not met by programs that skip the task (#1642)', () => {
    let vm;

    afterEach(() => {
        quitVm(vm);
        vm = null;
    });

    test.each(CHEATS_L2)(
        '%s',
        async (_name, id, code, operation) => {
            const run = await prepareRun(id, 'ja', code);
            vm = run.vm;
            await operation(run.ctx);
            expect(await until(run.isSatisfied, 1500)).toBe(false);
        },
        20000,
    );
});

// 「チャットをつくろう」レッスン 3（#1643）の goal が、課題をやっていないプログラム（ずる）では満たされないこと
const L3_ASK = 'when_flag_clicked do\n  ask("メッセージを入力")\n';
const CHEATS_L3 = [
    // 3-1: シマラビが自分で変数を言い、受け取ったシマネコは別のことを言う
    [
        'chat-l3-local-message (Shimaraby says it and Shimacat says something else)',
        'chat-l3-local-message',
        {
            code: `${L3_ASK}  $シマラビのメッセージ = answer\n  say($シマラビのメッセージ)\n  broadcast("シマラビのメッセージ")\nend\n`,
            sprites: { Shimacat: 'when_receive("シマラビのメッセージ") do\n  say("やあ")\nend\n' },
        },
        async ({ vm, answer }) => {
            vm.greenFlag();
            await answer('hello');
            await sleep(300);
        },
    ],
    // 3-1: 変数に入れずに送り、受け取ったシマネコが (答え) を言う（変数は作ってあるが入れない）
    [
        'chat-l3-local-message (Shimacat says the answer, not the variable)',
        'chat-l3-local-message',
        {
            code: `${L3_ASK}  broadcast("シマラビのメッセージ")\nend\n\nwhen_key_pressed("x") do\n  $シマラビのメッセージ = 0\nend\n`,
            sprites: { Shimacat: 'when_receive("シマラビのメッセージ") do\n  say(answer)\nend\n' },
        },
        async ({ vm, answer }) => {
            vm.greenFlag();
            await answer('hello');
            await sleep(300);
        },
    ],
    // 3-1: シマラビが送って、シマラビ自身が受け取って言う（シマネコは何もしない）
    [
        'chat-l3-local-message (Shimaraby receives its own message)',
        'chat-l3-local-message',
        `${L3_ASK}  $シマラビのメッセージ = answer\n  broadcast("シマラビのメッセージ")\nend\n\n` +
            'when_receive("シマラビのメッセージ") do\n  say($シマラビのメッセージ)\nend\n',
        async ({ vm, answer }) => {
            vm.greenFlag();
            await answer('hello');
            await sleep(300);
        },
    ],
    // 3-2: 答えのとおりでも、拡張機能「メッシュ」を足していない
    [
        'chat-l3-mesh-signal (without the mesh extension)',
        'chat-l3-mesh-signal',
        {
            code: 'when_key_pressed("space") do\n  broadcast("手をふる")\nend\n',
            sprites: { Shimacat: 'when_receive("手をふる") do\n  say("やあ！")\nend\n' },
        },
        async ({ press }) => {
            await press(' ');
            await sleep(300);
        },
    ],
    // 3-2: スペースキーではメッセージを送らずに言うだけ（練習相手の「手をふる」で受け取ってはいる）
    [
        'chat-l3-mesh-signal (the space key says without broadcasting)',
        'chat-l3-mesh-signal',
        {
            code: 'when_key_pressed("space") do\n  say("やあ！")\nend\n',
            sprites: { Shimacat: 'when_receive("手をふる") do\n  say("やあ！")\nend\n' },
        },
        async ({ press, addExtension, partnerPress }) => {
            await addExtension('meshV2');
            await partnerPress(0);
            await press(' ');
            await sleep(300);
        },
    ],
    // 3-2: 「手をふる」ではないメッセージを送り、受け取る
    [
        'chat-l3-mesh-signal (another message)',
        'chat-l3-mesh-signal',
        {
            code: 'when_key_pressed("space") do\n  broadcast("あいさつ")\nend\n',
            sprites: { Shimacat: 'when_receive("あいさつ") do\n  say("やあ！")\nend\n' },
        },
        async ({ press, addExtension }) => {
            await addExtension('meshV2');
            await press(' ');
            await sleep(300);
        },
    ],
    // 3-3: 気分を「このスプライトのみ」の変数に入れる（メッシュで共有されない）
    [
        'chat-l3-mesh-variable (the mood is a variable for this sprite only)',
        'chat-l3-mesh-variable',
        {
            code: 'when_key_pressed("1") do\n  @シマラビの気分 = "うれしい"\nend\n\nwhen_key_pressed("2") do\n  @シマラビの気分 = "ねむい"\nend\n',
            sprites: { Shimacat: 'when_clicked do\n  say(mesh.sensor_value("シマネコの気分"))\nend\n' },
        },
        async ({ press, partnerPress, clickSprite }) => {
            await press('1');
            await press('2');
            await partnerPress(0);
            await clickSprite('Shimacat');
            await sleep(300);
        },
    ],
    // 3-3: センサーの値を読まずに「うれしい」と言う
    [
        'chat-l3-mesh-variable (says "うれしい" without the sensor value)',
        'chat-l3-mesh-variable',
        {
            code: 'when_key_pressed("1") do\n  $シマラビの気分 = "うれしい"\nend\n\nwhen_key_pressed("2") do\n  $シマラビの気分 = "ねむい"\nend\n',
            sprites: { Shimacat: 'when_clicked do\n  say("うれしい")\nend\n' },
        },
        async ({ press, partnerPress, clickSprite }) => {
            await press('1');
            await press('2');
            await partnerPress(0);
            await clickSprite('Shimacat');
            await sleep(300);
        },
    ],
    // 3-3: 2 のキーのスクリプトが無い（作っただけの変数・1 のキーだけ）
    [
        'chat-l3-mesh-variable (only the 1 key changes the mood)',
        'chat-l3-mesh-variable',
        {
            code: 'when_key_pressed("1") do\n  $シマラビの気分 = "うれしい"\nend\n',
            sprites: { Shimacat: 'when_clicked do\n  say(mesh.sensor_value("シマネコの気分"))\nend\n' },
        },
        async ({ press, partnerPress, clickSprite }) => {
            await press('1');
            await press('2');
            await partnerPress(0);
            await clickSprite('Shimacat');
            await sleep(300);
        },
    ],
    // 3-3: 相手の気分が届く前に押す（センサーの値が空なので何も言わない）
    [
        'chat-l3-mesh-variable (clicks Shimacat before the mood of the partner arrives)',
        'chat-l3-mesh-variable',
        null,
        async ({ press, clickSprite }) => {
            await press('1');
            await press('2');
            await clickSprite('Shimacat');
            await sleep(300);
        },
    ],
];

describe('the chat lesson 3 goals are not met by programs that skip the task (#1643)', () => {
    let vm;

    afterEach(() => {
        quitVm(vm);
        vm = null;
    });

    test.each(CHEATS_L3)(
        '%s',
        async (_name, id, code, operation) => {
            const run = await prepareRun(id, 'ja', code);
            vm = run.vm;
            await operation(run.ctx);
            expect(await until(run.isSatisfied, 1500)).toBe(false);
        },
        20000,
    );
});

// ペアでシマネコの役の人は、シマラビとシマネコを入れかえて作る（判定は両方の名前を通す・#1643）。
// 相手（シマラビの役）の気分は、本物のメッシュでほかのノードから届いた値として remoteData に入れる
describe('the chat lesson 3-3 goal also passes for the one who plays Shimacat in a pair (#1643)', () => {
    let vm;

    afterEach(() => {
        quitVm(vm);
        vm = null;
    });

    test('swapped names, with the mood of the pair from another node', async () => {
        const run = await prepareRun('chat-l3-mesh-variable', 'ja', {
            code:
                'when_key_pressed("1") do\n  $シマネコの気分 = "うれしい"\nend\n\n' +
                'when_key_pressed("2") do\n  $シマネコの気分 = "ねむい"\nend\n',
            sprites: { Shimacat: 'when_clicked do\n  say(mesh.sensor_value("シマラビの気分"), 2)\nend\n' },
        });
        vm = run.vm;
        await run.ctx.press('1');
        await run.ctx.press('2');
        vm.runtime.peripheralExtensions.meshV2.meshService.remoteData.pair = {
            シマラビの気分: { value: 'ねむい', timestamp: Date.now() },
        };
        await run.ctx.clickSprite('Shimacat');
        expect(await until(run.isSatisfied, 1500)).toBe(true);
    }, 20000);
});
