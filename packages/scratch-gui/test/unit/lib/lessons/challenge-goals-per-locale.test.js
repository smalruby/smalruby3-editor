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
import { ROLES, challengeForRole, swapRoleText } from '../../../../src/lib/lessons/role-swap';
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
// ライブラリのスプライト（spriteCodes で足すもの）のコスチューム・音（sprites.json と同じ名前。レッスン 5 の
// 「Meow の音を鳴らす」「コスチュームを shimacat-b にする」のため）
const LIBRARY_SPRITES = {
    Shimacat: { costumes: ['shimacat-a', 'shimacat-b'], sounds: ['Meow'] },
    // シマネコの役（名前を入れかえた形・#2061）では、spriteCodes の相手がシマラビになる
    Shimaraby: { costumes: ['shimaraby-a', 'shimaraby-b'], sounds: ['Chirp'] },
};
const sprite = (name, sounds, costumes = ['costume1']) => ({
    isStage: false,
    name,
    variables: {},
    lists: {},
    broadcasts: {},
    blocks: {},
    comments: {},
    costumes: costumes.map(costume),
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
        ...sprites.map((name) =>
            LIBRARY_SPRITES[name]
                ? sprite(name, LIBRARY_SPRITES[name].sounds, LIBRARY_SPRITES[name].costumes)
                : sprite(name, []),
        ),
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
    // 拡張機能「メッシュ」を足してスペースキー（自分の送ったメッセージは自分にも届く）。練習相手の「てをふる」も押す
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
    // レッスン 4（#1644）。シマラビ（code）はネコに、シマネコは spriteCodes で入れる。メッシュは setup で読み込む
    'chat-l4-send-once': async ({ vm, answer }) => {
        vm.greenFlag();
        await answer('hello');
    },
    'chat-l4-send-repeat': async ({ vm, answer, isSatisfied }) => {
        vm.greenFlag();
        await answer('hello');
        await sleep(100);
        // 1 回送っただけでは、まだ「できた」にならない
        expect(isSatisfied()).toBe(false);
        await answer('again');
    },
    // 練習相手のボタンを押しただけ（自分から送っていない）では「できた」にならない。送ると相手が「とどいたよ」を返す
    'chat-l4-both-ways': async ({ vm, answer, partnerPress, isSatisfied }) => {
        await partnerPress(0);
        await sleep(100);
        expect(isSatisfied()).toBe(false);
        vm.greenFlag();
        await answer('hello');
    },
    'chat-l4-group': async ({ vm, answer }) => {
        vm.greenFlag();
        await answer('たろう');
        await answer('やあ');
    },
    // 自分の名前を「たろう」にし、ミミあてに送る → 練習相手の「ミミに DM」→ 言わない。「あなたに DM」で言う
    'chat-l4-dm': async ({ vm, answer, partnerPress, isSatisfied }) => {
        vm.greenFlag();
        await answer('たろう');
        await answer('やあ');
        await answer('ミミ');
        await partnerPress(1);
        await sleep(200);
        expect(isSatisfied()).toBe(false);
        await partnerPress(0);
    },
    // レッスン 5（#1645）。4-3 の答えに足した形。練習相手のボタンは課題ごと
    // 5-1: 練習相手の「発言する」→ 音。シマネコを押す → 「既読にする」→ シマラビが「既読」
    'chat-l5-read-receipt': async ({ partnerPress, clickSprite, isSatisfied }) => {
        await partnerPress(0);
        await sleep(100);
        await clickSprite('Shimacat');
        await sleep(100);
        // 相手から既読がまだ届いていない
        expect(isSatisfied()).toBe(false);
        await partnerPress(1);
    },
    // 5-2: NG ワードを入力すると注意される（送らない）。そのあとふつうの言葉を送る
    'chat-l5-ng-word': async ({ vm, locale, answer, isSatisfied }) => {
        vm.greenFlag();
        await answer(L5_NG_WORD[locale]);
        await sleep(2200);
        expect(isSatisfied()).toBe(false);
        await answer('hello');
    },
    // 5-3: 昼（12 時）は自動返信しない。夜（23 時）に練習相手の「こんにちは」で自動返信する
    'chat-l5-auto-reply': async ({ hour, partnerPress, isSatisfied }) => {
        hour(12);
        await partnerPress(0);
        await sleep(200);
        expect(isSatisfied()).toBe(false);
        hour(23);
        await partnerPress(0);
    },
    // 5-4: ちがう合言葉で注意される。旗を押し直して合言葉を入れ、メッセージを送る
    'chat-l5-password': async ({ vm, locale, answer, isSatisfied }) => {
        vm.greenFlag();
        await answer('sakura');
        await sleep(2200);
        expect(isSatisfied()).toBe(false);
        vm.greenFlag();
        await answer(L5_PASSWORD[locale]);
        await answer('hello');
    },
    // 5-5: シマラビを押すとスタンプを送り、練習相手がスタンプを返す（シマネコのコスチュームが 2 秒かわる）
    'chat-l5-stamp': async ({ click }) => {
        await click();
    },
};

// レッスン 5 の 5-2 の NG ワード・5-4 の合言葉（locale ごと）
const L5_NG_WORD = { ja: 'ばか', 'ja-Hira': 'ばか', en: 'stupid' };
const L5_PASSWORD = { ja: 'もみじ', 'ja-Hira': 'もみじ', en: 'maple' };

// ステージのプログラムのチャレンジ 4 は 1 秒の待ちが 6 回ある
const WAIT_FOR_GOAL_MS = 9000;

// チャレンジの code（または codeOverride）をその locale の新しい作品に入れ、goal の見張りを付けて動かす準備をする。
// codeOverride は code の Ruby か、ほかのスプライトにも入れるときは `{code, sprites: {名前: Ruby}}`。
// 戻り値の ctx でチャレンジの操作をし、isSatisfied() で「できた」かを見る
const prepareRun = async (id, locale, override = null, { role = ROLES.SHIMARABY } = {}) => {
    const codeOverride = override !== null && typeof override === 'object' ? override.code : override;
    const spriteOverrides = override !== null && typeof override === 'object' ? override.sprites || {} : {};
    // シマネコの役は、名前を入れかえた形のチャレンジ（答え・練習相手も入れかわる）
    const challenge = challengeForRole(findChallenge(id).challenge, role);
    // 操作で押すスプライトの名前も、役に合わせて入れかえる
    const roleName = (name) => (role === ROLES.SHIMACAT ? swapRoleText(name) : name);
    const vm = new VM();
    await vm.loadProject(projectFor(locale, { sprites: challenge.spriteCodes.map((s) => s.sprite) }));
    // 始めるときに読み込む拡張機能（3-3 のメッシュ）。プログラムを入れる前に読み込む
    for (const id of (challenge.setup && challenge.setup.extensions) || []) {
        await loadExtension(vm, id);
    }
    const stage = vm.runtime.getTargetForStage();
    const cat = vm.runtime.targets.find((t) => t.isOriginal && t.getName() === 'Sprite1');
    vm.setEditingTarget(cat.id);

    // 始めるときにステージに入れるプログラム（5-2 のリスト「NGワード」の用意）。答えのプログラムはそのリストを使う
    if (challenge.setup && challenge.setup.stageCode) {
        await insert(vm, stage, localizeCode(challenge.setup.stageCode, locale));
    }
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
            const target = vm.runtime.targets.find((t) => t.isOriginal && t.getName() === roleName(name));
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
        // 「現在の (時)」が返す時を決める（5-3 の夜の自動返信。ほかの「現在の」はそのまま）
        hour: (value) => {
            const original = vm.runtime._primitives.sensing_current;
            vm.runtime._primitives.sensing_current = (args, util) =>
                String(args.CURRENTMENU).toLowerCase() === 'hour' ? value : original(args, util);
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

// ペアでシマネコの役を選んだときの答え（名前を入れかえた形・#2061）でも、判定は変えずに「できた」になる
// （判定は両方の役の名前を通す・先生の判断 p4）
describe('the answer of the Shimacat role (names swapped) also satisfies the goal (#2061)', () => {
    let vm;

    afterEach(() => {
        quitVm(vm);
        vm = null;
    });

    const cases = [];
    Object.keys(OPERATIONS)
        .filter((id) => findChallenge(id).challenge.roles)
        .forEach((id) => LOCALES.forEach((locale) => cases.push([id, locale])));

    test('every challenge with roles is checked', () => {
        expect(cases.length).toBe(9 * LOCALES.length);
    });

    test.each(cases)(
        '%s (%s, Shimacat role)',
        async (id, locale) => {
            const run = await prepareRun(id, locale, null, { role: ROLES.SHIMACAT });
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
    // 3-1: 変数に入れたうえで、受け取ったシマネコは (答え) を言う（変数を読んでいない）
    [
        'chat-l3-local-message (puts the answer into the variable, but Shimacat says the answer)',
        'chat-l3-local-message',
        {
            code: `${L3_ASK}  $シマラビのメッセージ = answer\n  broadcast("シマラビのメッセージ")\nend\n`,
            sprites: { Shimacat: 'when_receive("シマラビのメッセージ") do\n  say(answer, 3)\nend\n' },
        },
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
            code: 'when_key_pressed("space") do\n  broadcast("てをふる")\nend\n',
            sprites: { Shimacat: 'when_receive("てをふる") do\n  say("やあ！")\nend\n' },
        },
        async ({ press }) => {
            await press(' ');
            await sleep(300);
        },
    ],
    // 3-2: スペースキーではメッセージを送らずに言うだけ（練習相手の「てをふる」で受け取ってはいる）
    [
        'chat-l3-mesh-signal (the space key says without broadcasting)',
        'chat-l3-mesh-signal',
        {
            code: 'when_key_pressed("space") do\n  say("やあ！")\nend\n',
            sprites: { Shimacat: 'when_receive("てをふる") do\n  say("やあ！")\nend\n' },
        },
        async ({ press, addExtension, partnerPress }) => {
            await addExtension('meshV2');
            await partnerPress(0);
            await press(' ');
            await sleep(300);
        },
    ],
    // 3-2: 「てをふる」ではないメッセージを送り、受け取る
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
            code: 'when_key_pressed("1") do\n  @シマラビのきぶん = "うれしい"\nend\n\nwhen_key_pressed("2") do\n  @シマラビのきぶん = "ねむい"\nend\n',
            sprites: { Shimacat: 'when_clicked do\n  say(mesh.sensor_value("シマネコのきぶん"))\nend\n' },
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
            code: 'when_key_pressed("1") do\n  $シマラビのきぶん = "うれしい"\nend\n\nwhen_key_pressed("2") do\n  $シマラビのきぶん = "ねむい"\nend\n',
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
            code: 'when_key_pressed("1") do\n  $シマラビのきぶん = "うれしい"\nend\n',
            sprites: { Shimacat: 'when_clicked do\n  say(mesh.sensor_value("シマネコのきぶん"))\nend\n' },
        },
        async ({ press, partnerPress, clickSprite }) => {
            await press('1');
            await press('2');
            await partnerPress(0);
            await clickSprite('Shimacat');
            await sleep(300);
        },
    ],
    // 3-3: 自分の気分のセンサーの値を言う（練習相手の「うれしい」も押してある。自分の気分は「ねむい」）
    [
        'chat-l3-mesh-variable (says the sensor value of its own mood)',
        'chat-l3-mesh-variable',
        {
            code: 'when_key_pressed("1") do\n  $シマラビのきぶん = "うれしい"\nend\n\nwhen_key_pressed("2") do\n  $シマラビのきぶん = "ねむい"\nend\n',
            sprites: { Shimacat: 'when_clicked do\n  say(mesh.sensor_value("シマラビのきぶん"))\nend\n' },
        },
        async ({ press, partnerPress, clickSprite }) => {
            await press('1');
            await press('2');
            await partnerPress(0);
            await clickSprite('Shimacat');
            await sleep(300);
        },
    ],
    // 3-3: 押したスクリプトでセンサーの値を読んだあと、自分の気分の変数を言う（相手の気分はまだ届いていない）
    [
        'chat-l3-mesh-variable (reads the sensor value, then says its own mood variable)',
        'chat-l3-mesh-variable',
        {
            code: 'when_key_pressed("1") do\n  $シマラビのきぶん = "うれしい"\nend\n\nwhen_key_pressed("2") do\n  $シマラビのきぶん = "ねむい"\nend\n',
            sprites: {
                Shimacat:
                    'when_clicked do\n  say(mesh.sensor_value("シマネコのきぶん"))\n  say($シマラビのきぶん)\nend\n',
            },
        },
        async ({ press, clickSprite }) => {
            await press('1');
            await press('2');
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
describe('the chat lesson 3 goals also pass for the other ways to do the task (#1643)', () => {
    let vm;

    afterEach(() => {
        quitVm(vm);
        vm = null;
    });

    test('3-2 also passes when the space key sends "てをふる" with a value', async () => {
        const run = await prepareRun('chat-l3-mesh-signal', 'ja', {
            code: 'when_key_pressed("space") do\n  mesh.broadcast("てをふる", "やっほー")\nend\n',
            sprites: { Shimacat: 'when_receive("てをふる") do\n  say("やあ！", 2)\nend\n' },
        });
        vm = run.vm;
        await run.ctx.addExtension('meshV2');
        await run.ctx.press(' ');
        expect(await until(run.isSatisfied, 1500)).toBe(true);
    }, 20000);

    test('swapped names, with the mood of the pair from another node', async () => {
        const run = await prepareRun('chat-l3-mesh-variable', 'ja', {
            code:
                'when_key_pressed("1") do\n  $シマネコのきぶん = "うれしい"\nend\n\n' +
                'when_key_pressed("2") do\n  $シマネコのきぶん = "ねむい"\nend\n',
            sprites: { Shimacat: 'when_clicked do\n  say(mesh.sensor_value("シマラビのきぶん"), 2)\nend\n' },
        });
        vm = run.vm;
        await run.ctx.press('1');
        await run.ctx.press('2');
        vm.runtime.peripheralExtensions.meshV2.meshService.remoteData.pair = {
            シマラビのきぶん: { value: 'ねむい', timestamp: Date.now() },
        };
        await run.ctx.clickSprite('Shimacat');
        expect(await until(run.isSatisfied, 1500)).toBe(true);
    }, 20000);
});

// 「チャットをつくろう」レッスン 4（#1644）の goal が、課題をやっていないプログラム（ずる）では満たされないこと
// 4-2 の答え（4-3 の送る側）
const L4_SEND_REPEAT =
    'when_flag_clicked do\n  ask("メッセージを入力")\n  loop do\n    $シマラビのメッセージ = answer\n' +
    '    broadcast("シマラビのメッセージ")\n    ask($シマラビのメッセージ)\n  end\nend\n';
const L4_RECEIVE_GROUP = 'when_receive("メッセージ") do\n  say(mesh.sensor_value("メッセージ"))\nend\n';
const L4_DM_RECEIVE =
    'when_receive("メッセージ") do\n  if mesh.sensor_value("あてさき") == $なまえ\n' +
    '    say(mesh.sensor_value("メッセージ"))\n  end\nend\n';
const l4Group = (message) =>
    'when_flag_clicked do\n  ask("名前は？")\n  $なまえ = answer\n  ask("メッセージを入力")\n  loop do\n' +
    `    $メッセージ = ${message}\n    broadcast("メッセージ")\n    ask($メッセージ)\n  end\nend\n`;
const l4Dm = (setTo) =>
    'when_flag_clicked do\n  ask("名前は？")\n  $なまえ = answer\n  ask("メッセージを入力")\n  loop do\n' +
    `    $メッセージ = $なまえ + "：" + answer\n    ask("だれに送る？")\n    ${setTo}\n` +
    '    broadcast("メッセージ")\n    ask($メッセージ)\n  end\nend\n';
const sendOnce = async ({ vm, answer }) => {
    vm.greenFlag();
    await answer('hello');
    await sleep(300);
};
const sendGroup = async ({ vm, answer }) => {
    vm.greenFlag();
    await answer('たろう');
    await answer('やあ');
    await sleep(300);
};
// 名前「たろう」で自分あてに送り、練習相手の「ミミに DM」「あなたに DM」を押す
const sendDm = async ({ vm, answer, partnerPress }) => {
    vm.greenFlag();
    await answer('たろう');
    await answer('やあ');
    await answer('たろう');
    await partnerPress(1);
    await partnerPress(0);
    await sleep(300);
};
const CHEATS_L4 = [
    // 4-1: 変数に入れずに送る（変数は作ってあるが入れない）
    [
        'chat-l4-send-once (broadcasts without setting the variable)',
        'chat-l4-send-once',
        'when_flag_clicked do\n  ask("メッセージを入力")\n  broadcast("シマラビのメッセージ")\nend\n\n' +
            'when_key_pressed("x") do\n  $シマラビのメッセージ = 0\nend\n',
        sendOnce,
    ],
    // 4-1: 入力した答えではなく、決まった文字を入れて送る
    [
        'chat-l4-send-once (sets a fixed text, not the answer)',
        'chat-l4-send-once',
        'when_flag_clicked do\n  ask("メッセージを入力")\n  $シマラビのメッセージ = "こんにちは"\n' +
            '  broadcast("シマラビのメッセージ")\nend\n',
        sendOnce,
    ],
    // 4-1: 「このスプライトのみ」の変数に入れる（メッシュで共有されない）
    [
        'chat-l4-send-once (the variable is for this sprite only)',
        'chat-l4-send-once',
        'when_flag_clicked do\n  ask("メッセージを入力")\n  @シマラビのメッセージ = answer\n' +
            '  broadcast("シマラビのメッセージ")\nend\n',
        sendOnce,
    ],
    // 4-1: 変数に入れる前に送る（前の値が届く）
    [
        'chat-l4-send-once (broadcasts before setting the variable)',
        'chat-l4-send-once',
        'when_flag_clicked do\n  ask("メッセージを入力")\n  broadcast("シマラビのメッセージ")\n' +
            '  $シマラビのメッセージ = answer\nend\n',
        sendOnce,
    ],
    // 4-2: 「ずっと」を使わずに 2 回並べる
    [
        'chat-l4-send-repeat (two sends in a row without forever)',
        'chat-l4-send-repeat',
        'when_flag_clicked do\n  ask("メッセージを入力")\n  $シマラビのメッセージ = answer\n' +
            '  broadcast("シマラビのメッセージ")\n  ask($シマラビのメッセージ)\n  $シマラビのメッセージ = answer\n' +
            '  broadcast("シマラビのメッセージ")\n  ask($シマラビのメッセージ)\nend\n',
        async ({ vm, answer }) => {
            vm.greenFlag();
            await answer('hello');
            await answer('again');
            await sleep(300);
        },
    ],
    // 4-2: 「ずっと」の中で聞かずに送り続ける
    [
        'chat-l4-send-repeat (keeps sending without asking in forever)',
        'chat-l4-send-repeat',
        'when_flag_clicked do\n  ask("メッセージを入力")\n  loop do\n    $シマラビのメッセージ = answer\n' +
            '    broadcast("シマラビのメッセージ")\n  end\nend\n',
        sendOnce,
    ],
    // 4-3: 受け取ったシマネコが、自分のメッセージのセンサーの値を言う（練習相手は「とどいたよ」を返している）
    [
        'chat-l4-both-ways (Shimacat says the sensor value of its own message)',
        'chat-l4-both-ways',
        {
            code: L4_SEND_REPEAT,
            sprites: {
                Shimacat:
                    'when_receive("シマネコのメッセージ") do\n  say(mesh.sensor_value("シマラビのメッセージ"))\nend\n',
            },
        },
        async (ctx) => {
            await sendOnce(ctx);
            await sleep(700);
        },
    ],
    // 4-3: 受け取ったシマネコが、自分の変数を言う（3-1 の形のまま）
    [
        'chat-l4-both-ways (Shimacat says its own variable as in 3-1)',
        'chat-l4-both-ways',
        {
            code: L4_SEND_REPEAT,
            sprites: { Shimacat: 'when_receive("シマネコのメッセージ") do\n  say($シマラビのメッセージ)\nend\n' },
        },
        async (ctx) => {
            await sendOnce(ctx);
            await ctx.partnerPress(0);
            await sleep(700);
        },
    ],
    // 4-3: センサーの値を読まずに、練習相手の返事と同じ「とどいたよ」を言う
    [
        'chat-l4-both-ways (says "とどいたよ" without the sensor value)',
        'chat-l4-both-ways',
        {
            code: L4_SEND_REPEAT,
            sprites: { Shimacat: 'when_receive("シマネコのメッセージ") do\n  say("とどいたよ")\nend\n' },
        },
        async (ctx) => {
            await sendOnce(ctx);
            await sleep(700);
        },
    ],
    // 4-4: 名前を聞かずに、決まった名前をつなぐ（変数「なまえ」は作ってあるが入れない）
    [
        'chat-l4-group (joins a fixed name without asking the name)',
        'chat-l4-group',
        {
            code:
                'when_flag_clicked do\n  ask("メッセージを入力")\n  loop do\n' +
                '    $メッセージ = "シマラビ" + "：" + answer\n    broadcast("メッセージ")\n    ask($メッセージ)\n' +
                '  end\nend\n\nwhen_key_pressed("x") do\n  $なまえ = 0\nend\n',
            sprites: { Shimacat: L4_RECEIVE_GROUP },
        },
        async ({ vm, answer }) => {
            vm.greenFlag();
            await answer('やあ');
            await sleep(300);
        },
    ],
    // 4-4: 名前を聞いて変数に入れたが、つなぐのは決まった名前
    [
        'chat-l4-group (asks the name but joins a fixed name)',
        'chat-l4-group',
        { code: l4Group('"シマラビ" + "：" + answer'), sprites: { Shimacat: L4_RECEIVE_GROUP } },
        sendGroup,
    ],
    // 4-4: 「：」を入れずにつなぐ
    [
        'chat-l4-group (joins without "：")',
        'chat-l4-group',
        { code: l4Group('$なまえ + " " + answer'), sprites: { Shimacat: L4_RECEIVE_GROUP } },
        sendGroup,
    ],
    // 4-4: 名前に入力した答えではなく、決まった名前を入れる
    [
        'chat-l4-group (sets a fixed name)',
        'chat-l4-group',
        {
            code: l4Group('$なまえ + "：" + answer').replace('$なまえ = answer', '$なまえ = "シマラビ"'),
            sprites: { Shimacat: L4_RECEIVE_GROUP },
        },
        sendGroup,
    ],
    // 4-5: シマネコが、あてさきを見ずに全部言う（4-4 のまま）
    [
        'chat-l4-dm (Shimacat says every message without "if")',
        'chat-l4-dm',
        { code: l4Dm('$あてさき = answer'), sprites: { Shimacat: L4_RECEIVE_GROUP } },
        sendDm,
    ],
    // 4-5: シマネコが、自分の変数「あてさき」（自分が送った先）と名前を比べる
    [
        'chat-l4-dm (compares its own variable "あてさき", not the sensor value)',
        'chat-l4-dm',
        {
            code: l4Dm('$あてさき = answer'),
            sprites: {
                Shimacat:
                    'when_receive("メッセージ") do\n  if $あてさき == $なまえ\n' +
                    '    say(mesh.sensor_value("メッセージ"))\n  end\nend\n',
            },
        },
        sendDm,
    ],
    // 4-5: 「あてさき」を「このスプライトのみ」の変数にする（ほかの人に届かない）
    [
        'chat-l4-dm (the variable "あてさき" is for this sprite only)',
        'chat-l4-dm',
        { code: l4Dm('@あてさき = answer'), sprites: { Shimacat: L4_DM_RECEIVE } },
        sendDm,
    ],
    // 4-5: シマラビが「だれに送る？」を聞かない（シマネコは答えのとおり）
    [
        'chat-l4-dm (Shimaraby does not ask "だれに送る？")',
        'chat-l4-dm',
        { code: l4Group('$なまえ + "：" + answer'), sprites: { Shimacat: L4_DM_RECEIVE } },
        async ({ vm, answer, partnerPress }) => {
            vm.greenFlag();
            await answer('たろう');
            await answer('やあ');
            await partnerPress(0);
            await sleep(300);
        },
    ],
    // 4-5: 答えのとおりでも、ほかの人あて（ミミに DM）しか届いていない
    [
        'chat-l4-dm (only a DM for someone else arrives)',
        'chat-l4-dm',
        null,
        async ({ vm, answer, partnerPress }) => {
            vm.greenFlag();
            await answer('たろう');
            await answer('やあ');
            await answer('ミミ');
            await partnerPress(1);
            await sleep(300);
        },
    ],
];

describe('the chat lesson 4 goals are not met by programs that skip the task (#1644)', () => {
    let vm;

    afterEach(() => {
        quitVm(vm);
        vm = null;
    });

    test.each(CHEATS_L4)(
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

// ペアでシマネコの役の人は、シマラビとシマネコの名前と受け持ちを入れかえて作る（判定は両方の名前を通す・#1644）。
// 相手（シマラビの役）のメッセージは、本物のメッシュでほかのノードから届いた値として remoteData に入れて合図を流す
describe('the chat lesson 4 goals also pass for the one who plays Shimacat in a pair (#1644)', () => {
    let vm;

    afterEach(() => {
        quitVm(vm);
        vm = null;
    });

    const fromPair = async (run, name, value) => {
        run.vm.runtime.peripheralExtensions.meshV2.meshService.remoteData.pair = {
            [name]: { value, timestamp: Date.now() },
        };
        run.vm.runtime.startHats('event_whenbroadcastreceived', { BROADCAST_OPTION: name });
        await sleep(100);
    };

    test('4-1 with the names swapped', async () => {
        const run = await prepareRun(
            'chat-l4-send-once',
            'ja',
            'when_flag_clicked do\n  ask("メッセージを入力")\n  $シマネコのメッセージ = answer\n' +
                '  broadcast("シマネコのメッセージ")\nend\n',
        );
        vm = run.vm;
        vm.greenFlag();
        await run.ctx.answer('hello');
        expect(await until(run.isSatisfied, 1500)).toBe(true);
    }, 20000);

    test('4-3 with the names swapped, with the message of the pair from another node', async () => {
        const run = await prepareRun('chat-l4-both-ways', 'ja', {
            code:
                'when_flag_clicked do\n  ask("メッセージを入力")\n  loop do\n    $シマネコのメッセージ = answer\n' +
                '    broadcast("シマネコのメッセージ")\n    ask($シマネコのメッセージ)\n  end\nend\n',
            sprites: {
                Shimacat:
                    'when_receive("シマラビのメッセージ") do\n  say(mesh.sensor_value("シマラビのメッセージ"))\nend\n',
            },
        });
        vm = run.vm;
        vm.greenFlag();
        await run.ctx.answer('hello');
        await fromPair(run, 'シマラビのメッセージ', 'やっほー');
        expect(await until(run.isSatisfied, 1500)).toBe(true);
    }, 20000);
});

// 「チャットをつくろう」レッスン 5（#1645）の goal が、課題をやっていないプログラム（ずる）では満たされないこと。
// どのテーマも 4-3 の答え（L4_SEND_REPEAT・L4_RECEIVE_SAY）に足した形
const L4_RECEIVE_SAY =
    'when_receive("シマネコのメッセージ") do\n  say(mesh.sensor_value("シマネコのメッセージ"))\nend\n';
const L5_RECEIVE_PLAY =
    'when_receive("シマネコのメッセージ") do\n  say(mesh.sensor_value("シマネコのメッセージ"))\n' +
    '  play("Meow")\nend\n';
const l5Ng = (body) =>
    'when_flag_clicked do\n  ask("メッセージを入力")\n  loop do\n' +
    body +
    '    ask($シマラビのメッセージ)\n  end\nend\n';
const l5Password = (inside, otherwise = '    say("合言葉がちがいます", 2)\n') =>
    `when_flag_clicked do\n  ask("合言葉は？")\n  if answer == "もみじ"\n${inside}  else\n${otherwise}  end\nend\n`;
const L5_CHAT_LOOP =
    '    loop do\n      $シマラビのメッセージ = answer\n      broadcast("シマラビのメッセージ")\n' +
    '      ask($シマラビのメッセージ)\n    end\n';
const readReceipt = async ({ partnerPress, clickSprite }) => {
    await partnerPress(0);
    await clickSprite('Shimacat');
    await partnerPress(1);
    await sleep(300);
};
const ngWord = async ({ vm, answer }) => {
    vm.greenFlag();
    await answer('こんにちは');
    await answer('ばか');
    await sleep(2200);
    await answer('またね');
    await sleep(300);
};
const password = async ({ vm, answer }) => {
    vm.greenFlag();
    await answer('さくら');
    await sleep(2200);
    vm.greenFlag();
    await answer('もみじ');
    await answer('こんにちは');
    await sleep(300);
};
const autoReplyAtNight = async ({ vm, hour, answer, partnerPress }) => {
    hour(23);
    vm.greenFlag();
    await answer('こんにちは');
    await partnerPress(0);
    await sleep(300);
};
const stamp = async ({ click, partnerPress }) => {
    await click();
    await partnerPress(0);
    await sleep(2800);
};
const CHEATS_L5 = [
    // 5-1: シマネコを押して送るのを、シマラビが受け取る名前（シマネコがよんだ）と同じにする（自分の画面だけで既読）
    [
        'chat-l5-read-receipt (Shimacat sends the name Shimaraby receives, so it reads its own receipt)',
        'chat-l5-read-receipt',
        {
            code: `${L4_SEND_REPEAT}\nwhen_receive("シマネコがよんだ") do\n  say("既読", 2)\nend\n`,
            sprites: {
                Shimacat: `${L5_RECEIVE_PLAY}\nwhen_clicked do\n  broadcast("シマネコがよんだ")\nend\n`,
            },
        },
        async ({ partnerPress, clickSprite }) => {
            await partnerPress(0);
            await clickSprite('Shimacat');
            await sleep(300);
        },
    ],
    // 5-1: 音を、受け取ったときではなく押したときに鳴らす
    [
        'chat-l5-read-receipt (plays the sound when clicked, not when the message arrives)',
        'chat-l5-read-receipt',
        {
            code: `${L4_SEND_REPEAT}\nwhen_receive("シマネコがよんだ") do\n  say("既読", 2)\nend\n`,
            sprites: {
                Shimacat: `${L4_RECEIVE_SAY}\nwhen_clicked do\n  play("Meow")\n  broadcast("シマラビがよんだ")\nend\n`,
            },
        },
        readReceipt,
    ],
    // 5-1: シマラビが、相手のメッセージが届いたときに「既読」と言う（既読の合図を受け取らない）
    [
        'chat-l5-read-receipt (Shimaraby says "既読" when a message arrives, without the receipt)',
        'chat-l5-read-receipt',
        {
            code: `${L4_SEND_REPEAT}\nwhen_receive("シマネコのメッセージ") do\n  say("既読", 2)\nend\n`,
            sprites: { Shimacat: `${L5_RECEIVE_PLAY}\nwhen_clicked do\n  broadcast("シマラビがよんだ")\nend\n` },
        },
        readReceipt,
    ],
    // 5-2: 「もし〜なら」だけで注意し、そのあとに送る（「でなければ」が無いので NG ワードも送られる）
    [
        'chat-l5-ng-word (warns with "if" only and then sends the NG word too)',
        'chat-l5-ng-word',
        {
            code: l5Ng(
                '    if $NGワード.include?(answer)\n      say("その言葉は送れません", 2)\n    end\n' +
                    '    $シマラビのメッセージ = answer\n    broadcast("シマラビのメッセージ")\n',
            ),
            sprites: { Shimacat: L4_RECEIVE_SAY },
        },
        ngWord,
    ],
    // 5-2: 「でなければ」はあるが、その外で送る（NG ワードを入れたあとに送る）
    [
        'chat-l5-ng-word (has "else" but sends outside it, after the NG word)',
        'chat-l5-ng-word',
        {
            code: l5Ng(
                '    if $NGワード.include?(answer)\n      say("その言葉は送れません", 2)\n    else\n' +
                    '      sleep(0.1)\n    end\n    $シマラビのメッセージ = answer\n    broadcast("シマラビのメッセージ")\n',
            ),
            sprites: { Shimacat: L4_RECEIVE_SAY },
        },
        async ({ vm, answer }) => {
            vm.greenFlag();
            await answer('ばか');
            await sleep(2200);
            await answer('またね');
            await sleep(300);
        },
    ],
    // 5-2: リストを使わず、決まった言葉と比べる
    [
        'chat-l5-ng-word (compares with a fixed word instead of the list)',
        'chat-l5-ng-word',
        {
            code: l5Ng(
                '    if answer == "ばか"\n      say("その言葉は送れません", 2)\n    else\n' +
                    '      $シマラビのメッセージ = answer\n      broadcast("シマラビのメッセージ")\n    end\n',
            ),
            sprites: { Shimacat: L4_RECEIVE_SAY },
        },
        ngWord,
    ],
    // 5-2: NG ワードを入れたが、ふつうの言葉は送っていない
    [
        'chat-l5-ng-word (only the NG word is typed)',
        'chat-l5-ng-word',
        null,
        async ({ vm, answer }) => {
            vm.greenFlag();
            await answer('ばか');
            await sleep(2500);
        },
    ],
    // 5-3: 自分のメッセージを受け取って返事する（相手のメッセージではない）
    [
        'chat-l5-auto-reply (replies to its own message)',
        'chat-l5-auto-reply',
        {
            code:
                `${L4_SEND_REPEAT}\nwhen_receive("シマラビのメッセージ") do\n  if Time.now.hour > 21\n` +
                '    $シマラビのメッセージ = "もう寝ています"\n    broadcast("シマラビのメッセージ")\n  end\nend\n',
            sprites: { Shimacat: L4_RECEIVE_SAY },
        },
        autoReplyAtNight,
    ],
    // 5-3: 「もし」の中に何も入れない（時を調べるだけで返事しない）
    [
        'chat-l5-auto-reply (checks the hour but replies nothing)',
        'chat-l5-auto-reply',
        {
            code: `${L4_SEND_REPEAT}\nwhen_receive("シマネコのメッセージ") do\n  if Time.now.hour > 21\n  end\nend\n`,
            sprites: { Shimacat: L4_RECEIVE_SAY },
        },
        autoReplyAtNight,
    ],
    // 5-3: 時を調べずに、いつも返事する
    [
        'chat-l5-auto-reply (always replies without checking the hour)',
        'chat-l5-auto-reply',
        {
            code:
                `${L4_SEND_REPEAT}\nwhen_receive("シマネコのメッセージ") do\n` +
                '  $シマラビのメッセージ = "もう寝ています"\n  broadcast("シマラビのメッセージ")\nend\n',
            sprites: { Shimacat: L4_RECEIVE_SAY },
        },
        autoReplyAtNight,
    ],
    // 5-3: 答えのとおりでも、昼（21 のまま）は返事が出ないので、まだ「できた」にならない
    [
        'chat-l5-auto-reply (the answer in the daytime, with 21 as it is)',
        'chat-l5-auto-reply',
        null,
        async ({ hour, partnerPress }) => {
            hour(13);
            await partnerPress(0);
            await partnerPress(1);
            await sleep(300);
        },
    ],
    // 5-4: 合言葉を確かめずに、注意してからチャットを始める
    [
        'chat-l5-password (says the warning and starts the chat without checking)',
        'chat-l5-password',
        {
            code:
                'when_flag_clicked do\n  ask("合言葉は？")\n  say("合言葉がちがいます", 2)\n  ask("メッセージを入力")\n' +
                L5_CHAT_LOOP.replace(/^ {2}/gm, '') +
                'end\n',
            sprites: { Shimacat: L4_RECEIVE_SAY },
        },
        password,
    ],
    // 5-4: 合言葉のあとすぐ「ずっと」に入り、合言葉をそのまま送る
    [
        'chat-l5-password (sends the password itself)',
        'chat-l5-password',
        { code: l5Password(L5_CHAT_LOOP), sprites: { Shimacat: L4_RECEIVE_SAY } },
        password,
    ],
    // 5-4: ちがう合言葉で注意されただけで、チャットを始めていない
    [
        'chat-l5-password (only a wrong password is typed)',
        'chat-l5-password',
        null,
        async ({ vm, answer }) => {
            vm.greenFlag();
            await answer('さくら');
            await sleep(2500);
        },
    ],
    // 5-5: シマラビを押して送るのを、シマネコが受け取る名前（シマネコのスタンプ）と同じにする（自分の画面だけ）
    [
        'chat-l5-stamp (Shimaraby sends the name Shimacat receives, so it gets its own stamp)',
        'chat-l5-stamp',
        {
            code: `${L4_SEND_REPEAT}\nwhen_clicked do\n  broadcast("シマネコのスタンプ")\nend\n`,
            sprites: {
                Shimacat:
                    `${L4_RECEIVE_SAY}\nwhen_receive("シマネコのスタンプ") do\n  switch_costume("shimacat-b")\n` +
                    '  sleep(2)\n  switch_costume("shimacat-a")\nend\n',
            },
        },
        async ({ click }) => {
            await click();
            await sleep(2800);
        },
    ],
    // 5-5: コスチュームをかえたまま、もどさない
    [
        'chat-l5-stamp (switches the costume and does not switch it back)',
        'chat-l5-stamp',
        {
            code: `${L4_SEND_REPEAT}\nwhen_clicked do\n  broadcast("シマラビのスタンプ")\nend\n`,
            sprites: {
                Shimacat: `${L4_RECEIVE_SAY}\nwhen_receive("シマネコのスタンプ") do\n  switch_costume("shimacat-b")\n  sleep(2)\nend\n`,
            },
        },
        stamp,
    ],
    // 5-5: 待たずに、2 回かえる（見えないうちにもどる）
    [
        'chat-l5-stamp (switches twice without waiting)',
        'chat-l5-stamp',
        {
            code: `${L4_SEND_REPEAT}\nwhen_clicked do\n  broadcast("シマラビのスタンプ")\nend\n`,
            sprites: {
                Shimacat:
                    `${L4_RECEIVE_SAY}\nwhen_receive("シマネコのスタンプ") do\n  switch_costume("shimacat-b")\n` +
                    '  switch_costume("shimacat-a")\nend\n',
            },
        },
        stamp,
    ],
];

describe('the chat lesson 5 goals are not met by programs that skip the task (#1645)', () => {
    let vm;

    afterEach(() => {
        quitVm(vm);
        vm = null;
    });

    test.each(CHEATS_L5)(
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

// ペアでシマネコの役の人は、名前と受け持ちを入れかえて作る（#1645）。相手（シマラビの役）の合図・値は、本物の
// メッシュでほかのノードから届いたものとして remoteData に入れて合図を流す
describe('the chat lesson 5 goals also pass for the one who plays Shimacat in a pair (#1645)', () => {
    let vm;

    afterEach(() => {
        quitVm(vm);
        vm = null;
    });

    const fromPair = async (run, name, value = null) => {
        if (value !== null) {
            run.vm.runtime.peripheralExtensions.meshV2.meshService.remoteData.pair = {
                [name]: { value, timestamp: Date.now() },
            };
        }
        run.vm.runtime.startHats('event_whenbroadcastreceived', { BROADCAST_OPTION: name });
        await sleep(100);
    };
    const SEND_AS_SHIMACAT =
        'when_flag_clicked do\n  ask("メッセージを入力")\n  loop do\n    $シマネコのメッセージ = answer\n' +
        '    broadcast("シマネコのメッセージ")\n    ask($シマネコのメッセージ)\n  end\nend\n';
    const RECEIVE_FROM_SHIMARABY =
        'when_receive("シマラビのメッセージ") do\n  say(mesh.sensor_value("シマラビのメッセージ"))\n';

    test('5-1 with the names swapped', async () => {
        const run = await prepareRun('chat-l5-read-receipt', 'ja', {
            code: `${SEND_AS_SHIMACAT}\nwhen_receive("シマラビがよんだ") do\n  say("既読", 2)\nend\n`,
            sprites: {
                Shimacat: `${RECEIVE_FROM_SHIMARABY}  play("Meow")\nend\n\nwhen_clicked do\n  broadcast("シマネコがよんだ")\nend\n`,
            },
        });
        vm = run.vm;
        await fromPair(run, 'シマラビのメッセージ', 'やっほー');
        await run.ctx.clickSprite('Shimacat');
        await fromPair(run, 'シマラビがよんだ');
        expect(await until(run.isSatisfied, 1500)).toBe(true);
    }, 20000);

    test('5-2 with the names swapped', async () => {
        const run = await prepareRun('chat-l5-ng-word', 'ja', {
            code: SEND_AS_SHIMACAT.replace(
                '    $シマネコのメッセージ = answer\n    broadcast("シマネコのメッセージ")\n',
                '    if $NGワード.include?(answer)\n      say("その言葉は送れません", 2)\n    else\n' +
                    '      $シマネコのメッセージ = answer\n      broadcast("シマネコのメッセージ")\n    end\n',
            ),
            sprites: { Shimacat: `${RECEIVE_FROM_SHIMARABY}end\n` },
        });
        vm = run.vm;
        vm.greenFlag();
        await run.ctx.answer('きらい');
        await sleep(2200);
        await run.ctx.answer('こんにちは');
        expect(await until(run.isSatisfied, 1500)).toBe(true);
    }, 20000);

    test('5-3 with the names swapped', async () => {
        const run = await prepareRun('chat-l5-auto-reply', 'ja', {
            code:
                `${SEND_AS_SHIMACAT}\nwhen_receive("シマラビのメッセージ") do\n  if Time.now.hour > 21\n` +
                '    $シマネコのメッセージ = "もう寝ています。朝に返事します"\n    broadcast("シマネコのメッセージ")\n' +
                '  end\nend\n',
            sprites: { Shimacat: `${RECEIVE_FROM_SHIMARABY}end\n` },
        });
        vm = run.vm;
        run.ctx.hour(22);
        await fromPair(run, 'シマラビのメッセージ', 'おやすみ');
        expect(await until(run.isSatisfied, 1500)).toBe(true);
    }, 20000);

    test('5-4 with the names swapped', async () => {
        const run = await prepareRun('chat-l5-password', 'ja', {
            code: l5Password(
                '    ask("メッセージを入力")\n' +
                    L5_CHAT_LOOP.replace(/シマラビのメッセージ/g, 'シマネコのメッセージ'),
            ),
            sprites: { Shimacat: `${RECEIVE_FROM_SHIMARABY}end\n` },
        });
        vm = run.vm;
        await password(run.ctx);
        expect(await until(run.isSatisfied, 1500)).toBe(true);
    }, 20000);

    test('5-5 with the names swapped', async () => {
        const run = await prepareRun('chat-l5-stamp', 'ja', {
            code: `${SEND_AS_SHIMACAT}\nwhen_clicked do\n  broadcast("シマネコのスタンプ")\nend\n`,
            sprites: {
                Shimacat:
                    `${RECEIVE_FROM_SHIMARABY}end\n\nwhen_receive("シマラビのスタンプ") do\n` +
                    '  switch_costume("shimacat-b")\n  sleep(2)\n  switch_costume("shimacat-a")\nend\n',
            },
        });
        vm = run.vm;
        await run.ctx.click();
        await fromPair(run, 'シマラビのスタンプ');
        expect(await until(run.isSatisfied, 4000)).toBe(true);
    }, 20000);
});

// `uses` の `not` は、いちばん新しい旗の実行だけを見る。ヒントどおり直して旗を押し直せば、開き直さなくても
// 「できた」になる（#1645）
describe('the chat lesson 5 goals pass after fixing the program and clicking the flag again (#1645)', () => {
    let vm;

    afterEach(() => {
        quitVm(vm);
        vm = null;
    });

    test('5-2: after sending the NG word, the fixed program passes', async () => {
        const run = await prepareRun('chat-l5-ng-word', 'ja', CHEATS_L5[4][2]);
        vm = run.vm;
        await CHEATS_L5[4][3](run.ctx);
        expect(await until(run.isSatisfied, 500)).toBe(false);
        await insert(vm, run.ctx.cat, localizeCode(findChallenge('chat-l5-ng-word').challenge.code, 'ja'));
        vm.greenFlag();
        // 前のプログラムの「聞いて待つ」が数えられないよう、新しいプログラムが聞くのを待つ
        await sleep(300);
        await run.ctx.answer('ばか');
        await sleep(2200);
        await run.ctx.answer('こんにちは');
        expect(await until(run.isSatisfied, 1500)).toBe(true);
    }, 20000);

    test('5-4: after sending the password itself, the fixed program passes', async () => {
        const run = await prepareRun('chat-l5-password', 'ja', CHEATS_L5[12][2]);
        vm = run.vm;
        await password(run.ctx);
        expect(await until(run.isSatisfied, 500)).toBe(false);
        await insert(vm, run.ctx.cat, localizeCode(findChallenge('chat-l5-password').challenge.code, 'ja'));
        vm.greenFlag();
        await sleep(300);
        await run.ctx.answer('もみじ');
        await run.ctx.answer('こんにちは');
        expect(await until(run.isSatisfied, 1500)).toBe(true);
    }, 20000);
});

// レッスン 5 の練習相手のボタン・自動の返事が、どの役・どの locale でも本当に効くこと（ひとりで最後までできること）。
// 「プログラムを入れる」の答えを入れて課題の操作をし「できた」になったあと、パネルのボタンを 1 つずつ全部押して、
// 生徒のプログラムがそれに応える（相手のメッセージを言う・「既読」と言う・コスチュームがかわる）ことを見る。
// 4-5 の「あなたに DM」が生徒の名前ではなく「あなた」を送っていた不具合のような、押しても何も起きないボタンを見つける
describe('every practice partner button of lesson 5 works for both roles', () => {
    let vm;

    afterEach(() => {
        quitVm(vm);
        vm = null;
    });

    const L5_IDS = Object.keys(OPERATIONS).filter((id) => id.startsWith('chat-l5-'));
    const cases = [];
    L5_IDS.forEach((id) =>
        [ROLES.SHIMARABY, ROLES.SHIMACAT].forEach((role) =>
            LOCALES.forEach((locale) => cases.push([id, role, locale])),
        ),
    );

    test('every lesson 5 challenge is checked', () => {
        expect(L5_IDS).toHaveLength(5);
    });

    test.each(cases)(
        '%s (%s role, %s)',
        async (id, role, locale) => {
            const run = await prepareRun(id, locale, null, { role });
            vm = run.vm;
            const said = [];
            const allSaid = [];
            vm.runtime.on('SAY', (target, type, text) => {
                said.push(String(text));
                allSaid.push(String(text));
            });
            const costumes = () =>
                vm.runtime.targets.map((t) => (t.isStage ? null : t.getCostumes()[t.currentCostume].name));
            const partner = normalizePartner(challengeForRole(findChallenge(id).challenge, role).partner, locale);

            await OPERATIONS[id](run.ctx);
            expect(await until(run.isSatisfied, WAIT_FOR_GOAL_MS)).toBe(true);

            for (const [index, button] of partner.buttons.entries()) {
                // 前のボタンの「2 秒言う」・コスチュームがもどるのを待つ
                await sleep(2300);
                said.length = 0;
                const before = costumes();
                await run.ctx.partnerPress(index);
                const values = button.set.map((one) => one.value).filter((value) => typeof value === 'string');
                const answered = await until(
                    () =>
                        values.length > 0
                            ? values.every((value) => said.includes(value))
                            : said.length > 0 || costumes().some((name, i) => name !== before[i]),
                    1500,
                );
                expect({ button: button.label, answered, said }).toEqual({
                    button: button.label,
                    answered: true,
                    said,
                });
            }

            // 自分のメッセージを送ると返す自動の返事（「とどいたよ」）は、相手のメッセージとしてシマネコが言う。
            // 5-2・5-4 は課題の操作でもう送っている。5-1・5-5 は旗を押して送る
            const gotIt = partner.replies.find((reply) => reply.set.length > 0);
            if (gotIt) {
                const value = gotIt.set[0].value;
                if (!allSaid.includes(value)) {
                    await sleep(2300);
                    vm.greenFlag();
                    await run.ctx.answer('hello');
                }
                expect({ reply: value, said: await until(() => allSaid.includes(value), 2000) }).toEqual({
                    reply: value,
                    said: true,
                });
            }
        },
        40000,
    );
});
