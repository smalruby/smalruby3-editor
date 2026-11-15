/**
 * 答えのプログラムから描くアクティビティ図（docs/lessons/design.md の「アクティビティ図」）の
 * 純粋関数を守る: ブロック → 図のモデル（`buildActivityModel`）と、モデル → 置き方（`layoutActivityDiagram`）。
 * ブロックは本物の Ruby → ブロック変換で作る（チャレンジの答えと同じ入り方）。
 */
import { en, ja } from '../../../../src/lib/lessons/activity-diagram/activity-diagram.locale';
import {
    activityDiagramLanes,
    challengeActivityDiagram,
    showsActivityDiagram,
} from '../../../../src/lib/lessons/activity-diagram/challenge-diagram';
import { formatFromTable } from '../../../../src/lib/lessons/activity-diagram/labels';
import {
    DIAGRAM_SHAPES,
    diagramScaleFor,
    FONT_SIZE,
    layoutActivityDiagram,
    MIN_DIAGRAM_SCALE,
    RECEIVE_NOTCH,
    SMALL_FONT_SIZE,
} from '../../../../src/lib/lessons/activity-diagram/layout';
import {
    buildActivityModel,
    describeActivityModel,
    NODE_KINDS,
    partnerLane,
} from '../../../../src/lib/lessons/activity-diagram/model';
import { defineChallenge, findChallenge } from '../../../../src/lib/lessons/courses';
import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';

const formatJa = formatFromTable(ja);
const formatEn = formatFromTable(en);

const toBlocks = async (code) => {
    const converter = new RubyToBlocksConverter(null, { version: '2' });
    const ok = await converter.targetCodeToBlocks(null, code);
    expect({ ok, errors: converter.errors }).toEqual({ ok: true, errors: [] });
    return converter.blocks;
};

const modelOf = async (code, { format = formatJa, blockName } = {}) =>
    buildActivityModel(
        { lanes: [{ id: 'own', label: null, targets: [{ name: null, blocks: await toBlocks(code) }] }] },
        {
            format,
            blockName,
        },
    );

const onlyScript = (model) => {
    expect(model.lanes).toHaveLength(1);
    expect(model.lanes[0].targets).toHaveLength(1);
    expect(model.lanes[0].targets[0].scripts).toHaveLength(1);
    return model.lanes[0].targets[0].scripts[0];
};

describe('buildActivityModel', () => {
    test('a hat becomes the start label and the stack becomes actions in order', async () => {
        const script = onlyScript(await modelOf('when_flag_clicked do\n  say("こんにちは！", 2)\n  sleep(1)\nend\n'));
        expect(script.start).toBe('旗が押されたとき');
        expect(script.receive).toBeNull();
        expect(script.body).toEqual([
            { kind: NODE_KINDS.ACTION, label: '「こんにちは！」と2秒言う' },
            { kind: NODE_KINDS.ACTION, label: '1秒待つ' },
        ]);
    });

    test('ask and if / else become an action and a decision with guards on the branches', async () => {
        const { challenge } = findChallenge('blocks-l1-quiz');
        const script = onlyScript(await modelOf(challenge.code.ja));
        expect(script.start).toBe('このスプライトが押されたとき');
        expect(script.body).toEqual([
            { kind: NODE_KINDS.ACTION, label: '「4+3=?」と聞いて待つ' },
            {
                kind: NODE_KINDS.DECISION,
                label: '答え = 7？',
                // 教科書と同じく、条件は枝に「[条件]」と書く
                yesGuard: '[答え = 7]',
                noGuard: '[それ以外]',
                yes: [{ kind: NODE_KINDS.ACTION, label: '「正解です」と2秒言う' }],
                no: [{ kind: NODE_KINDS.ACTION, label: '「ちがいます」と2秒言う' }],
            },
        ]);
    });

    test('forever and repeat become loops; if without else has an empty no branch', async () => {
        const script = onlyScript(
            await modelOf(
                'when_flag_clicked do\n  loop do\n    3.times do\n      if touching?("_mouse_")\n' +
                    '        say("くすぐったい！")\n      end\n    end\n  end\nend\n',
            ),
        );
        expect(script.body).toEqual([
            {
                kind: NODE_KINDS.LOOP,
                label: 'ずっとくり返す',
                forever: true,
                // ずっとは出口が無いので、ガードも無い
                continueGuard: null,
                exitGuard: null,
                body: [
                    {
                        kind: NODE_KINDS.LOOP,
                        label: '3回くり返す',
                        forever: false,
                        continueGuard: '[それ以外]',
                        exitGuard: '[3回くり返した]',
                        body: [
                            {
                                kind: NODE_KINDS.DECISION,
                                label: 'マウスのポインターに触れた？',
                                yesGuard: '[マウスのポインターに触れた]',
                                noGuard: '[それ以外]',
                                yes: [{ kind: NODE_KINDS.ACTION, label: '「くすぐったい！」と言う' }],
                                no: [],
                            },
                        ],
                    },
                ],
            },
        ]);
    });

    test('variables, messages and the mesh sensor value', async () => {
        const model = await modelOf(
            'when_flag_clicked do\n  $回数 = 0\n  $回数 += 1\n  broadcast("あいさつ")\n' +
                '  say(mesh.sensor_value("回数"))\nend\n\nwhen_receive("あいさつ") do\n  say("やあ！" + answer)\nend\n',
        );
        const [first, second] = model.lanes[0].targets[0].scripts;
        expect(first.body.map((n) => n.label)).toEqual([
            '回数を0にする',
            '回数を1ずつ変える',
            '「あいさつ」を送る',
            '「回数」のセンサー値と言う',
        ]);
        expect(second.start).toBe('「あいさつ」を受け取ったとき');
        expect(second.body.map((n) => n.label)).toEqual(['「やあ！」と答えと言う']);
        // 送る・受け取るは、教科書の送信・受信の記号で描くので、合図の名前を持つ
        expect(first.body[2]).toEqual({ kind: NODE_KINDS.SEND, label: '「あいさつ」を送る', message: 'あいさつ' });
        expect(first.receive).toBeNull();
        expect(second.receive).toBe('あいさつ');
    });

    test('broadcast and wait is a send too', async () => {
        const script = onlyScript(await modelOf('when_flag_clicked do\n  broadcast_and_wait("おくる")\nend\n'));
        expect(script.body).toEqual([{ kind: NODE_KINDS.SEND, label: '「おくる」を送って待つ', message: 'おくる' }]);
    });

    test('an unsupported block becomes an action with the block name', async () => {
        const script = onlyScript(
            await modelOf('when_flag_clicked do\n  move(10)\nend\n', {
                blockName: (opcode) => (opcode === 'motion_movesteps' ? '%1 歩動かす' : null),
            }),
        );
        expect(script.body).toEqual([{ kind: NODE_KINDS.ACTION, label: '10 歩動かす' }]);
        // 名前の引き方が無いときは opcode を書く（図が描けないよりよい）
        const plain = onlyScript(await modelOf('when_flag_clicked do\n  move(10)\nend\n'));
        expect(plain.body).toEqual([{ kind: NODE_KINDS.ACTION, label: 'motion_movesteps' }]);
    });

    test('labels follow the locale', async () => {
        const script = onlyScript(
            await modelOf('when_key_pressed("space") do\n  ask("What?")\nend\n', { format: formatEn }),
        );
        expect(script.start).toBe('when space key pressed');
        expect(script.body).toEqual([{ kind: NODE_KINDS.ACTION, label: 'ask "What?" and wait' }]);
    });

    test('a stack without a hat starts without a label', async () => {
        const script = onlyScript(await modelOf('say("やあ")\n'));
        expect(script.start).toBeNull();
        expect(script.body).toHaveLength(1);
    });
});

describe('partnerLane', () => {
    test('buttons and automatic replies become scripts of the partner lane', () => {
        const lane = partnerLane(
            {
                name: 'ロボ',
                buttons: [
                    {
                        label: 'あいさつ',
                        set: { variable: 'メッセージ', value: 'こんにちは' },
                        broadcast: 'とどいた',
                    },
                    { label: '3 にする', set: { variable: '点数', value: 3 } },
                ],
                replies: [{ onBroadcast: 'こんにちは', broadcast: 'やあ' }],
            },
            { format: formatJa },
        );
        expect(lane.label).toBe('ロボ');
        const scripts = lane.targets[0].scripts;
        expect(scripts).toEqual([
            {
                // set（共有する変数を変える）→ broadcast（合図を送る）の順
                start: '「あいさつ」ボタンを押したとき',
                receive: null,
                body: [
                    { kind: NODE_KINDS.ACTION, label: 'メッセージを「こんにちは」にする' },
                    { kind: NODE_KINDS.SEND, label: '「とどいた」を送る', message: 'とどいた' },
                ],
            },
            {
                start: '「3 にする」ボタンを押したとき',
                receive: null,
                body: [{ kind: NODE_KINDS.ACTION, label: '点数を3にする' }],
            },
            {
                // 自動の返事は受信で始まる
                start: '「こんにちは」を受け取ったとき',
                receive: 'こんにちは',
                body: [{ kind: NODE_KINDS.SEND, label: '「やあ」を送る', message: 'やあ' }],
            },
        ]);
    });

    test('a reply can change a shared variable too', () => {
        const lane = partnerLane(
            { name: 'ロボ', replies: [{ onBroadcast: 'ping', set: [{ variable: 'へんじ', value: 'pong' }] }] },
            { format: formatJa },
        );
        expect(lane.targets[0].scripts).toEqual([
            {
                start: '「ping」を受け取ったとき',
                receive: 'ping',
                body: [{ kind: NODE_KINDS.ACTION, label: 'へんじを「pong」にする' }],
            },
        ]);
    });

    test('a value from a variable of the student is drawn as "(name の値)" (D4)', () => {
        const partner = {
            name: 'シマネコ',
            buttons: [
                {
                    label: 'あなたに DM',
                    set: [
                        { variable: 'あて先', value: { fromVariable: { ja: '名前', en: 'name' } } },
                        { variable: 'x', value: { fromVariable: '' } },
                    ],
                },
            ],
        };
        const ja = partnerLane(partner, { format: formatJa, locale: 'ja' });
        // 名前の無い fromVariable の行は、動かすとき（normalizePartner）と同じく描かない
        expect(ja.targets[0].scripts[0].body.map((n) => n.label)).toEqual(['あて先を(名前の値)にする']);
        const enLane = partnerLane(partner, { format: formatEn, locale: 'en' });
        expect(enLane.targets[0].scripts[0].body[0].label).toBe('set あて先 to (value of name)');
    });

    test('names, labels, variables and messages may be written per locale, read like the practice panel (Q3)', () => {
        const partner = {
            name: { ja: 'シマネコ', en: 'Shimacat' },
            buttons: [
                {
                    label: { ja: 'こんにちは', en: 'Hello' },
                    set: { variable: { ja: 'シマネコのメッセージ', en: 'shimacat_message' }, value: { ja: 'x' } },
                    broadcast: { ja: 'シマネコのメッセージ', en: 'shimacat_message' },
                },
            ],
            replies: [{ onBroadcast: { ja: 'シマラビのメッセージ', en: 'shimaraby_message' }, broadcast: 'ok' }],
        };
        const enLane = partnerLane(partner, { format: formatEn, locale: 'en' });
        expect(enLane.label).toBe('Shimacat');
        expect(enLane.targets[0].scripts.map((s) => s.start)).toEqual([
            'when the "Hello" button is pressed',
            expect.stringContaining('shimaraby_message'),
        ]);
        // 値の locale ごとの書き方は動かすときも使わない（文字か数だけ）ので、その行は描かない
        expect(enLane.targets[0].scripts[0].body.map((n) => n.label)).toEqual([
            expect.stringContaining('shimacat_message'),
        ]);
        // locale のキーが無いときは、動かすときと同じく en → ja の順
        const jaHira = partnerLane(partner, { format: formatJa, locale: 'ja-Hira' });
        expect(jaHira.label).toBe('Shimacat');
        // 何もしない返事は、動かすときと同じく描かない
        expect(partnerLane({ name: 'ロボ', replies: [{ onBroadcast: 'x' }] }, { format: formatJa })).toBeNull();
    });

    test('no partner (or a partner without anything to draw) gives no lane', () => {
        expect(partnerLane(null, { format: formatJa })).toBeNull();
        expect(partnerLane(undefined, { format: formatJa })).toBeNull();
        expect(partnerLane({ name: 'ロボ' }, { format: formatJa })).toBeNull();
        // 形の合わない項目（ラベルの無いボタン・onBroadcast の無い返事）は描かない
        expect(
            partnerLane({ name: 'ロボ', buttons: [{}], replies: [{ broadcast: 'x' }] }, { format: formatJa }),
        ).toBeNull();
    });
});

const insideBox = (shape, layout) =>
    shape.x >= 0 &&
    shape.y >= 0 &&
    shape.x + shape.w <= layout.width + 0.01 &&
    shape.y + shape.h <= layout.height + 0.01;

// 線分が、両はしの記号のほかの記号の内側を通るか（M3）。縦・横の線分だけ（置き方はそれしか作らない）。
// 開始の黒丸は横の文まで含める。字（ガード・見出し）も記号として見る
const crossings = (layout) => {
    const rects = layout.shapes
        .filter((s) => s.type !== DIAGRAM_SHAPES.LANE && s.type !== DIAGRAM_SHAPES.CAPTION)
        .map((s) => {
            if (s.type === DIAGRAM_SHAPES.START && s.lines && s.lines.length > 0) {
                const label = Math.max(...s.lines.map((l) => Array.from(l).length)) * SMALL_FONT_SIZE;
                return { s, x: s.x, y: s.y, w: s.w + 6 + label * 0.6, h: s.h };
            }
            return { s, x: s.x, y: s.y, w: s.w, h: s.h };
        });
    const near = ([px, py], r) =>
        px >= r.x - 0.5 && px <= r.x + r.w + 0.5 && py >= r.y - 0.5 && py <= r.y + r.h + 0.5;
    const hits = [];
    layout.edges.forEach((edge, ei) => {
        const ends = [edge.points[0], edge.points[edge.points.length - 1]];
        rects
            .filter((r) => !ends.some((p) => near(p, r)))
            .forEach((r) => {
                edge.points.slice(1).forEach((b, i) => {
                    const a = edge.points[i];
                    const inside =
                        Math.max(a[0], b[0]) > r.x + 1 &&
                        Math.min(a[0], b[0]) < r.x + r.w - 1 &&
                        Math.max(a[1], b[1]) > r.y + 1 &&
                        Math.min(a[1], b[1]) < r.y + r.h - 1;
                    if (inside) hits.push(`edge ${ei}${edge.message ? ' (message)' : ''} × ${r.s.type} ${r.s.label}`);
                });
            });
    });
    return [...new Set(hits)];
};

const spritesModel = async (codes) =>
    buildActivityModel(
        {
            lanes: [
                {
                    id: 'own',
                    label: null,
                    targets: await Promise.all(
                        codes.map(async (code, i) => ({ name: `S${i}`, blocks: await toBlocks(code) })),
                    ),
                },
            ],
        },
        { format: formatJa },
    );

describe('message arrows do not pass through any symbol (M3)', () => {
    test.each([
        [
            'one send to two receivers on the right',
            [
                'when_flag_clicked do\n  broadcast("go")\nend\n',
                'when_receive("go") do\n  say("b")\nend\n',
                'when_receive("go") do\n  say("c")\nend\n',
            ],
            2,
        ],
        [
            'an unrelated sprite between the send and the receive',
            [
                'when_flag_clicked do\n  broadcast("go")\nend\n',
                'when_flag_clicked do\n  say("mid")\n  say("mid2")\nend\n',
                'when_receive("go") do\n  say("c")\nend\n',
            ],
            1,
        ],
        [
            'two senders on the same side',
            [
                'when_flag_clicked do\n  broadcast("x")\nend\n\nwhen_clicked do\n  broadcast("y")\nend\n',
                'when_receive("x") do\n  say("1")\nend\n\nwhen_receive("y") do\n  say("2")\nend\n',
            ],
            2,
        ],
        [
            'a sender in the middle (receivers on both sides)',
            [
                'when_receive("go") do\n  say("a")\nend\n',
                'when_flag_clicked do\n  broadcast("go")\nend\n',
                'when_receive("go") do\n  say("c")\nend\n',
            ],
            2,
        ],
        [
            'a receiver with senders on both sides',
            [
                'when_flag_clicked do\n  broadcast("go")\nend\n',
                'when_receive("go") do\n  say("b")\nend\n',
                'when_clicked do\n  say("z")\n  say("z")\n  broadcast("go")\nend\n',
            ],
            2,
        ],
    ])('%s', async (name, codes, arrows) => {
        const layout = layoutActivityDiagram(await spritesModel(codes));
        const messages = layout.edges.filter((e) => e.message);
        expect(messages).toHaveLength(arrows);
        expect(crossings(layout)).toEqual([]);
        // 矢印は送信の、相手のいる側の辺から出る
        const sends = layout.shapes.filter((s) => s.type === DIAGRAM_SHAPES.SEND);
        messages.forEach((edge) => {
            const [[x0, y0], [x1]] = edge.points;
            const send = sends.find((s) => Math.abs(s.y + s.h / 2 - y0) < 0.01 && (s.x === x0 || s.x + s.w === x0));
            expect(send).toBeDefined();
            expect(x0 === send.x ? x1 < x0 : x1 > x0).toBe(true);
        });
        layout.shapes.forEach((s) => expect(insideBox(s, layout)).toBe(true));
    });

    test('a send with receivers on both sides points both ways', async () => {
        const layout = layoutActivityDiagram(
            await spritesModel([
                'when_receive("go") do\n  say("a")\nend\n',
                'when_flag_clicked do\n  broadcast("go")\nend\n',
                'when_receive("go") do\n  say("c")\nend\n',
            ]),
        );
        expect(layout.shapes.find((s) => s.type === DIAGRAM_SHAPES.SEND).direction).toBe('both');
        expect(layout.shapes.filter((s) => s.type === DIAGRAM_SHAPES.RECEIVE).map((s) => s.notch)).toEqual([
            'right',
            'left',
        ]);
    });

    test('the chat answer with a partner has no crossings either', async () => {
        const own = (
            await modelOf(
                'when_flag_clicked do\n  ask("メッセージを入力")\n  loop do\n    $メッセージ = answer\n' +
                    '    broadcast("メッセージ")\n    ask($メッセージ)\n  end\nend\n\n' +
                    'when_receive("へんじ") do\n  say(mesh.sensor_value("へんじ"))\nend\n',
            )
        ).lanes[0];
        const partner = partnerLane(
            {
                name: 'ロボ',
                buttons: [{ label: 'あいさつ', broadcast: 'へんじ' }],
                replies: [
                    { onBroadcast: 'メッセージ', set: { variable: 'へんじ', value: 'x' }, broadcast: 'へんじ' },
                ],
            },
            { format: formatJa },
        );
        const layout = layoutActivityDiagram({ lanes: [{ ...own, label: 'あなた' }, partner] });
        expect(layout.edges.filter((e) => e.message)).toHaveLength(3);
        expect(crossings(layout)).toEqual([]);
        // レーンの境目の線に重ねて通さない
        const borders = layout.shapes
            .filter((sh) => sh.type === DIAGRAM_SHAPES.LANE)
            .flatMap((lane) => [lane.x, lane.x + lane.w]);
        layout.edges
            .filter((e) => e.message)
            .forEach((e) =>
                e.points.slice(1).forEach(([x, y], i) => {
                    const [px, py] = e.points[i];
                    if (px === x && py !== y) borders.forEach((b) => expect(Math.abs(x - b)).toBeGreaterThan(2));
                }),
            );
    });
});

describe('layoutActivityDiagram', () => {
    test('places start, actions and end top to bottom, connected by arrows', async () => {
        const layout = layoutActivityDiagram(await modelOf('when_flag_clicked do\n  say("a")\n  say("b")\nend\n'));
        const kinds = layout.shapes.map((s) => s.type);
        expect(kinds).toEqual([
            DIAGRAM_SHAPES.START,
            DIAGRAM_SHAPES.ACTION,
            DIAGRAM_SHAPES.ACTION,
            DIAGRAM_SHAPES.END,
        ]);
        const [start, a, b, end] = layout.shapes;
        expect(start.y).toBeLessThan(a.y);
        expect(a.y + a.h).toBeLessThan(b.y);
        expect(b.y + b.h).toBeLessThan(end.y);
        // 開始 → a → b → 終了 の 3 本の矢印
        expect(layout.edges).toHaveLength(3);
        layout.shapes.forEach((s) => expect(insideBox(s, layout)).toBe(true));
        expect(start.label).toBe('旗が押されたとき');
    });

    test('a decision is an empty diamond: the yes branch goes left, the no branch right, guards on the branches', async () => {
        const { challenge } = findChallenge('blocks-l1-quiz');
        const layout = layoutActivityDiagram(await modelOf(challenge.code.ja));
        const decision = layout.shapes.find((s) => s.type === DIAGRAM_SHAPES.DECISION);
        const merge = layout.shapes.find((s) => s.type === DIAGRAM_SHAPES.MERGE);
        const yes = layout.shapes.find((s) => s.label === '「正解です」と2秒言う');
        const no = layout.shapes.find((s) => s.label === '「ちがいます」と2秒言う');
        const cx = decision.x + decision.w / 2;
        expect(yes.x + yes.w).toBeLessThanOrEqual(no.x);
        expect(yes.x + yes.w / 2).toBeLessThan(cx);
        expect(no.x + no.w / 2).toBeGreaterThan(cx);
        expect(merge.y).toBeGreaterThan(Math.max(yes.y + yes.h, no.y + no.h));
        expect(merge.x + merge.w / 2).toBeCloseTo(cx);
        // 分岐と合流は同じ大きさのひし形で、中に字を書かない（教科書の形）
        expect([merge.w, merge.h]).toEqual([decision.w, decision.h]);
        expect(decision.lines).toBeUndefined();
        const guards = layout.shapes.filter((s) => s.type === DIAGRAM_SHAPES.GUARD);
        expect(guards.map((s) => s.label)).toEqual(['[答え = 7]', '[それ以外]']);
        // ガードはひし形の左右（条件に合う枝が左）
        expect(guards[0].x + guards[0].w).toBeLessThanOrEqual(decision.x);
        expect(guards[1].x).toBeGreaterThanOrEqual(decision.x + decision.w);
        layout.shapes.forEach((s) => expect(insideBox(s, layout)).toBe(true));
    });

    test('forever is a merge diamond with a line that goes back from the bottom of its body (no exit)', async () => {
        const layout = layoutActivityDiagram(
            await modelOf('when_flag_clicked do\n  loop do\n    say("a")\n  end\nend\n'),
        );
        const merge = layout.shapes.find((s) => s.type === DIAGRAM_SHAPES.MERGE);
        const action = layout.shapes.find((s) => s.type === DIAGRAM_SHAPES.ACTION);
        expect(merge.label).toBe('ずっとくり返す');
        expect(merge.y + merge.h).toBeLessThan(action.y);
        // 戻る線: 本体の下から出て、ひし形の左のかどへ矢印で入る
        const back = layout.edges[layout.edges.length - 1];
        const [first] = back.points;
        const last = back.points[back.points.length - 1];
        expect(first[1]).toBeCloseTo(action.y + action.h);
        expect(last).toEqual([merge.x, merge.y + merge.h / 2]);
        expect(back.arrow).toBe(true);
        expect(Math.min(...back.points.map(([x]) => x))).toBeLessThan(action.x);
        // 出口のガードも枠も無い
        expect(layout.shapes.filter((s) => s.type === DIAGRAM_SHAPES.GUARD)).toHaveLength(0);
    });

    test('repeat is a diamond that merges and branches: continue below, exit to the right and back to the middle', async () => {
        const layout = layoutActivityDiagram(
            await modelOf('when_flag_clicked do\n  3.times do\n    say("a")\n  end\n  say("b")\nend\n'),
        );
        const diamond = layout.shapes.find((s) => s.type === DIAGRAM_SHAPES.DECISION);
        const [a, b] = layout.shapes.filter((s) => s.type === DIAGRAM_SHAPES.ACTION);
        const cx = diamond.x + diamond.w / 2;
        const vy = diamond.y + diamond.h / 2;
        expect(diamond.label).toBe('3回くり返す');
        const guards = layout.shapes.filter((s) => s.type === DIAGRAM_SHAPES.GUARD);
        expect(guards.map((s) => s.label)).toEqual(['[それ以外]', '[3回くり返した]']);
        // 戻る線は左のかどへ、ぬける線は右のかどから出て、本体より下を通って真ん中へ戻る
        const back = layout.edges.find((e) => e.points[e.points.length - 1][0] === diamond.x);
        expect(back.points[back.points.length - 1]).toEqual([diamond.x, vy]);
        const exit = layout.edges.find((e) => e.points[0][0] === diamond.x + diamond.w && e.points[0][1] === vy);
        const exitEnd = exit.points[exit.points.length - 1];
        expect(exitEnd[0]).toBeCloseTo(cx);
        expect(exitEnd[1]).toBeGreaterThan(a.y + a.h);
        expect(exitEnd[1]).toBeLessThan(b.y);
        expect(Math.max(...exit.points.map(([x]) => x))).toBeGreaterThan(a.x + a.w);
        // 線や字がほかの記号と重ならない（ガードはひし形・箱の外）
        guards.forEach((g) => {
            expect(g.y + g.h <= a.y || g.x >= a.x + a.w || g.x + g.w <= a.x).toBe(true);
        });
        layout.shapes.forEach((s) => expect(insideBox(s, layout)).toBe(true));
    });

    test('send is a pentagon and a script started by receiving starts with the receive symbol', async () => {
        const layout = layoutActivityDiagram(
            await modelOf(
                'when_flag_clicked do\n  broadcast("あいさつ")\nend\n\nwhen_receive("あいさつ") do\n  say("やあ")\nend\n',
            ),
        );
        expect(layout.shapes.map((s) => s.type)).toEqual([
            DIAGRAM_SHAPES.START,
            DIAGRAM_SHAPES.SEND,
            DIAGRAM_SHAPES.END,
            DIAGRAM_SHAPES.RECEIVE,
            DIAGRAM_SHAPES.ACTION,
            DIAGRAM_SHAPES.END,
        ]);
        const receive = layout.shapes.find((s) => s.type === DIAGRAM_SHAPES.RECEIVE);
        expect(receive.label).toBe('「あいさつ」を受け取ったとき');
        expect(receive.lines.join('')).toBe('「あいさつ」を受け取ったとき');
        // 同じスプライトの中の合図には矢印を引かない（スクリプトが横に並ぶので、ほかの記号を横切るため）
        expect(layout.edges.some((e) => e.message)).toBe(false);
    });

    test('long labels wrap so the boxes stay narrow', async () => {
        const long = 'とても長いセリフをネコに言わせて、みんなに読んでもらうためのテストの文です';
        const layout = layoutActivityDiagram(await modelOf(`when_flag_clicked do\n  say("${long}")\nend\n`));
        const action = layout.shapes.find((s) => s.type === DIAGRAM_SHAPES.ACTION);
        expect(action.lines.length).toBeGreaterThan(1);
        expect(action.lines.join('')).toBe(`「${long}」と言う`);
        expect(action.w).toBeLessThanOrEqual(212);
    });

    test('scripts sit side by side; lanes get a header and a separator only when there are 2 or more', async () => {
        const own = (await modelOf('when_flag_clicked do\n  say("a")\nend\n\nwhen_clicked do\n  say("b")\nend\n'))
            .lanes[0];
        const single = layoutActivityDiagram({ lanes: [own] });
        const starts = single.shapes.filter((s) => s.type === DIAGRAM_SHAPES.START);
        expect(starts).toHaveLength(2);
        expect(starts[0].y).toBe(starts[1].y);
        expect(starts[0].x).toBeLessThan(starts[1].x);
        expect(single.shapes.filter((s) => s.type === DIAGRAM_SHAPES.LANE)).toHaveLength(0);

        const partner = partnerLane(
            { name: 'ロボ', replies: [{ onBroadcast: 'あいさつ', broadcast: 'やあ' }] },
            { format: formatJa },
        );
        const swim = layoutActivityDiagram({ lanes: [{ ...own, label: 'あなた' }, partner] });
        const lanes = swim.shapes.filter((s) => s.type === DIAGRAM_SHAPES.LANE);
        expect(lanes.map((l) => l.label)).toEqual(['あなた', 'ロボ']);
        expect(lanes[0].x + lanes[0].w).toBeLessThanOrEqual(lanes[1].x);
        swim.shapes.forEach((s) => expect(insideBox(s, swim)).toBe(true));
    });

    test('a send in one lane points to the receive of the same message in the other lane, at the same height', async () => {
        const own = (
            await modelOf(
                'when_flag_clicked do\n  ask("メッセージは？")\n  $メッセージ = answer\n  broadcast("メッセージ")\nend\n\n' +
                    'when_receive("へんじ") do\n  say("とどいた")\nend\n',
            )
        ).lanes[0];
        const partner = partnerLane(
            {
                name: 'ロボ',
                replies: [{ onBroadcast: 'メッセージ', set: { variable: 'x', value: 1 }, broadcast: 'へんじ' }],
            },
            { format: formatJa },
        );
        const layout = layoutActivityDiagram({ lanes: [{ ...own, label: 'あなた' }, partner] });
        const [laneOwn, lanePartner] = layout.shapes.filter((s) => s.type === DIAGRAM_SHAPES.LANE);
        const within = (lane, s) => s.x >= lane.x && s.x + s.w <= lane.x + lane.w;
        const sends = layout.shapes.filter((s) => s.type === DIAGRAM_SHAPES.SEND);
        const receives = layout.shapes.filter((s) => s.type === DIAGRAM_SHAPES.RECEIVE);
        const ownSend = sends.find((s) => s.message === 'メッセージ');
        const partnerSend = sends.find((s) => s.message === 'へんじ');
        const partnerReceive = receives.find((s) => s.message === 'メッセージ');
        const ownReceive = receives.find((s) => s.message === 'へんじ');
        expect(within(laneOwn, ownSend) && within(laneOwn, ownReceive)).toBe(true);
        expect(within(lanePartner, partnerSend) && within(lanePartner, partnerReceive)).toBe(true);
        // 送信は相手の向きがとがり、受信は送り手の向きがへこむ
        expect([ownSend.direction, partnerReceive.notch]).toEqual(['right', 'left']);
        expect([partnerSend.direction, ownReceive.notch]).toEqual(['left', 'right']);
        // 受信は送信と同じ高さまで下がり、矢印はまっすぐ横に引く
        const cy = (s) => s.y + s.h / 2;
        expect(cy(partnerReceive)).toBeCloseTo(cy(ownSend));
        expect(cy(ownReceive)).toBeCloseTo(cy(partnerSend));
        const messages = layout.edges.filter((e) => e.message);
        expect(messages).toHaveLength(2);
        expect(messages[0].points).toEqual([
            [ownSend.x + ownSend.w, cy(ownSend)],
            [partnerReceive.x + RECEIVE_NOTCH, cy(partnerReceive)],
        ]);
        expect(messages[1].points).toEqual([
            [partnerSend.x, cy(partnerSend)],
            [ownReceive.x + ownReceive.w - RECEIVE_NOTCH, cy(ownReceive)],
        ]);
        expect(messages.every((e) => e.arrow)).toBe(true);
        // 下げたぶん、レーンも高くなって、どの記号もレーンの中
        layout.shapes
            .filter((s) => s.type !== DIAGRAM_SHAPES.LANE)
            .forEach((s) => expect(s.y + s.h).toBeLessThanOrEqual(laneOwn.y + laneOwn.h));
        layout.shapes.forEach((s) => expect(insideBox(s, layout)).toBe(true));
    });

    test('scripts that talk to the other lane sit on the side of that lane', async () => {
        const own = (
            await modelOf('when_receive("へんじ") do\n  say("a")\nend\n\nwhen_clicked do\n  say("b")\nend\n')
        ).lanes[0];
        const partner = partnerLane(
            { name: 'ロボ', buttons: [{ label: 'おす', broadcast: 'へんじ' }] },
            { format: formatJa },
        );
        const layout = layoutActivityDiagram({ lanes: [{ ...own, label: 'あなた' }, partner] });
        const receive = layout.shapes.find((s) => s.type === DIAGRAM_SHAPES.RECEIVE);
        const other = layout.shapes.find((s) => s.label === '「b」と言う');
        expect(other.x + other.w).toBeLessThan(receive.x);
    });

    test('sprites in one lane are connected too, and a receive lower than its send turns in the gap', async () => {
        const blocksA = await toBlocks(
            'when_clicked do\n  say("a")\n  say("b")\n  say("c")\n  broadcast("あいさつ")\nend\n',
        );
        const blocksB = await toBlocks('when_receive("あいさつ") do\n  say("やあ！", 2)\nend\n');
        const blocksC = await toBlocks('when_flag_clicked do\n  broadcast("あいさつ")\nend\n');
        const model = buildActivityModel(
            {
                lanes: [
                    {
                        id: 'own',
                        label: null,
                        targets: [
                            { name: 'ネコ', blocks: blocksA },
                            { name: 'Penguin', blocks: blocksB },
                            { name: 'Owl', blocks: blocksC },
                        ],
                    },
                ],
            },
            { format: formatJa },
        );
        const layout = layoutActivityDiagram(model);
        const receive = layout.shapes.find((s) => s.type === DIAGRAM_SHAPES.RECEIVE);
        const [catSend, owlSend] = layout.shapes.filter((s) => s.type === DIAGRAM_SHAPES.SEND);
        const cy = (s) => s.y + s.h / 2;
        const messages = layout.edges.filter((e) => e.message);
        expect(messages).toHaveLength(2);
        // いちばん上の送信（ここではフクロウ）の高さにそろえ、もう一方は相手の手前で曲げる
        expect(cy(receive)).toBeCloseTo(Math.min(cy(catSend), cy(owlSend)));
        const bent = messages.find((e) => e.points.length === 4);
        expect(bent).toBeDefined();
        expect(owlSend.direction).toBe('left');
        // 送り手が左（ネコ）と右（フクロウ）の両側にいるので、受信は両側がへこむ
        expect(receive.notch).toBe('both');
        // 矢印は、相手のいる側の辺から出て、相手のいる側の辺へ入る
        const owlEdge = messages.find((e) => e.points[0][0] === owlSend.x);
        expect(owlEdge.points[owlEdge.points.length - 1][0]).toBe(receive.x + receive.w - RECEIVE_NOTCH);
        expect(crossings(layout)).toEqual([]);
    });

    test('target captions are drawn when the lane has programs of 2 or more sprites', async () => {
        const blocksA = await toBlocks('when_clicked do\n  broadcast("あいさつ")\nend\n');
        const blocksB = await toBlocks('when_receive("あいさつ") do\n  say("やあ！", 2)\nend\n');
        const model = buildActivityModel(
            {
                lanes: [
                    {
                        id: 'own',
                        label: null,
                        targets: [
                            { name: 'ネコ', blocks: blocksA },
                            { name: 'Penguin', blocks: blocksB },
                        ],
                    },
                ],
            },
            { format: formatJa },
        );
        const layout = layoutActivityDiagram(model);
        expect(layout.shapes.filter((s) => s.type === DIAGRAM_SHAPES.CAPTION).map((s) => s.label)).toEqual([
            'ネコ',
            'Penguin',
        ]);
    });
});

describe('challenge definition', () => {
    test('the diagram is off unless the challenge asks for it', () => {
        expect(defineChallenge({ id: 'x' }).activityDiagram).toBe(false);
        expect(showsActivityDiagram(defineChallenge({ id: 'x' }))).toBe(false);
        expect(showsActivityDiagram(defineChallenge({ id: 'x', activityDiagram: true, code: 'say("a")\n' }))).toBe(
            true,
        );
        // 答えが無ければ描けない
        expect(showsActivityDiagram(defineChallenge({ id: 'x', activityDiagram: true }))).toBe(false);
        expect(showsActivityDiagram(null)).toBe(false);
    });

    test('lanes come from code and spriteCodes, plus the partner when there is one', () => {
        const { challenge } = findChallenge('blocks-l1-broadcast');
        const sources = activityDiagramLanes({ ...challenge, activityDiagram: true }, 'ja');
        expect(sources).toEqual([
            {
                id: 'own',
                sources: [
                    { name: null, code: challenge.code.ja, target: 'code' },
                    { name: 'Penguin', code: challenge.spriteCodes[0].code.ja, target: 'Penguin' },
                ],
            },
        ]);
    });

    test('builds the diagram of a challenge from its answer', async () => {
        const { challenge } = findChallenge('blocks-l1-if');
        const diagram = await challengeActivityDiagram(
            { ...challenge, activityDiagram: true },
            {
                locale: 'ja',
                format: formatJa,
                toBlocks: (source) => toBlocks(source.code),
            },
        );
        expect(diagram.model.lanes).toHaveLength(1);
        expect(diagram.layout.shapes.some((s) => s.type === DIAGRAM_SHAPES.MERGE)).toBe(true);
        expect(diagram.layout.shapes.some((s) => s.type === DIAGRAM_SHAPES.DECISION)).toBe(true);
        expect(diagram.layout.width).toBeGreaterThan(0);
    });

    test('names the sprites when the answer has programs of 2 or more sprites', async () => {
        const { challenge } = findChallenge('blocks-l1-broadcast');
        const diagram = await challengeActivityDiagram(
            { ...challenge, activityDiagram: true },
            { locale: 'ja', format: formatJa, toBlocks: (source) => toBlocks(source.code) },
        );
        expect(diagram.model.lanes[0].targets.map((t) => t.name)).toEqual(['ネコ', 'Penguin']);
        expect(diagram.layout.shapes.filter((s) => s.type === DIAGRAM_SHAPES.CAPTION).map((s) => s.label)).toEqual([
            'ネコ',
            'Penguin',
        ]);
    });

    test('names the code sprite after setup.sprites, in the words of the locale for the characters', async () => {
        const { challenge } = findChallenge('blocks-l1-broadcast');
        const started = {
            ...challenge,
            activityDiagram: true,
            setup: { sprites: ['Shimaraby', 'Shimacat'] },
            spriteCodes: [{ sprite: 'Shimacat', code: challenge.spriteCodes[0].code }],
        };
        const ja = await challengeActivityDiagram(started, {
            locale: 'ja',
            format: formatJa,
            toBlocks: (source) => toBlocks(source.code),
        });
        expect(ja.model.lanes[0].targets.map((t) => t.name)).toEqual(['シマラビ', 'シマネコ']);
        const enDiagram = await challengeActivityDiagram(started, {
            locale: 'en',
            format: formatEn,
            toBlocks: (source) => toBlocks(source.code),
        });
        expect(enDiagram.model.lanes[0].targets.map((t) => t.name)).toEqual(['Shimaraby', 'Shimacat']);
        // 訳の無いスプライトは名前のまま
        const owl = await challengeActivityDiagram(
            { ...challenge, activityDiagram: true, setup: { sprites: ['Owl'] } },
            { locale: 'ja', format: formatJa, toBlocks: (source) => toBlocks(source.code) },
        );
        expect(owl.model.lanes[0].targets.map((t) => t.name)).toEqual(['Owl', 'Penguin']);
    });

    test('a partner adds its own lane and names the student lane', async () => {
        const challenge = defineChallenge({
            id: 'x',
            activityDiagram: true,
            code: 'when_flag_clicked do\n  broadcast("あいさつ")\nend\n',
            partner: { name: 'ロボ', replies: [{ onBroadcast: 'あいさつ', broadcast: 'やあ' }] },
        });
        const diagram = await challengeActivityDiagram(challenge, {
            locale: 'ja',
            format: formatJa,
            toBlocks: (source) => toBlocks(source.code),
        });
        expect(diagram.model.lanes.map((l) => l.label)).toEqual(['あなた', 'ロボ']);
    });

    test('returns null when the diagram is not shown or the answer does not convert', async () => {
        const { challenge } = findChallenge('blocks-l1-if');
        expect(await challengeActivityDiagram(challenge, { locale: 'ja', format: formatJa, toBlocks })).toBeNull();
        const broken = await challengeActivityDiagram(
            { ...challenge, activityDiagram: true },
            { locale: 'ja', format: formatJa, toBlocks: () => Promise.resolve(null) },
        );
        expect(broken).toBeNull();
    });
});

describe('more shapes', () => {
    test('repeat until is a loop with its condition', async () => {
        const script = onlyScript(
            await modelOf('when_flag_clicked do\n  until answer == "おわり"\n    ask("なに？")\n  end\nend\n'),
        );
        expect(script.body).toEqual([
            {
                kind: NODE_KINDS.LOOP,
                label: '答え = 「おわり」までくり返す',
                forever: false,
                // 条件に合うまで続け、合ったらぬける
                continueGuard: '[それ以外]',
                exitGuard: '[答え = 「おわり」]',
                body: [{ kind: NODE_KINDS.ACTION, label: '「なに？」と聞いて待つ' }],
            },
        ]);
    });

    test('nested if / else in a loop and a loop in a branch do not overlap', async () => {
        const model = await modelOf(
            'when_flag_clicked do\n  loop do\n    if answer == 1\n      3.times do\n        say("とても長いセリフを言います")\n' +
                '      end\n    else\n      if answer == 2\n        say("に")\n      else\n        say("ほか")\n      end\n' +
                '    end\n  end\nend\n',
        );
        const [outer] = onlyScript(model).body;
        expect(outer.kind).toBe(NODE_KINDS.LOOP);
        const [decision] = outer.body;
        expect(decision.kind).toBe(NODE_KINDS.DECISION);
        expect(decision.yes[0].kind).toBe(NODE_KINDS.LOOP);
        expect(decision.no[0].kind).toBe(NODE_KINDS.DECISION);
        const layout = layoutActivityDiagram(model);
        const said = (label) => layout.shapes.find((s) => s.label === label);
        const innerLoop = said('3回くり返す');
        // はいの枝のくり返しの線（ぬける線の右はし）が、いいえの枝（入れ子の分岐とその箱）より左にあって重ならない
        const innerExit = layout.edges.find(
            (e) => e.points[0][0] === innerLoop.x + innerLoop.w && e.points[0][1] === innerLoop.y + innerLoop.h / 2,
        );
        const innerRight = Math.max(...innerExit.points.map(([x]) => x));
        const noShapes = [said('「に」と言う'), said('「ほか」と言う')];
        noShapes.forEach((shape) => expect(innerRight).toBeLessThan(shape.x));
        // 記号どうしが重ならない（ガードを含む）
        const boxes = layout.shapes.filter((s) => s.type !== DIAGRAM_SHAPES.START);
        boxes.forEach((p, i) =>
            boxes.slice(i + 1).forEach((q) => {
                const apart = p.x + p.w <= q.x || q.x + q.w <= p.x || p.y + p.h <= q.y || q.y + q.h <= p.y;
                expect({ p: p.label, q: q.label, apart }).toEqual({ p: p.label, q: q.label, apart: true });
            }),
        );
        // 外のずっとの戻る線が、いちばん左にある
        const outerMerge = said('ずっとくり返す');
        const outerBack = layout.edges.find(
            (e) =>
                e.points[e.points.length - 1][0] === outerMerge.x &&
                e.points[e.points.length - 1][1] === outerMerge.y + 9,
        );
        const leftMost = Math.min(...layout.edges.flatMap((e) => e.points.map(([x]) => x)));
        expect(Math.min(...outerBack.points.map(([x]) => x))).toBe(leftMost);
    });

    test('a script that ends with forever has no end symbol', async () => {
        const layout = layoutActivityDiagram(
            await modelOf('when_flag_clicked do\n  loop do\n    say("a")\n  end\nend\n'),
        );
        expect(layout.shapes.filter((s) => s.type === DIAGRAM_SHAPES.END)).toHaveLength(0);
        const action = layout.shapes.find((s) => s.type === DIAGRAM_SHAPES.ACTION);
        // 戻る線より下へ出る矢印も無い
        expect(layout.edges.every((e) => e.points.every(([, y]) => y <= action.y + action.h + 10))).toBe(true);
        // ずっとのあとに続きがあるとき（ずっとが最後でない）は終了を描く
        const repeat = layoutActivityDiagram(
            await modelOf('when_flag_clicked do\n  3.times do\n    say("a")\n  end\nend\n'),
        );
        expect(repeat.shapes.filter((s) => s.type === DIAGRAM_SHAPES.END)).toHaveLength(1);
    });

    test('stop all / this script ends the script: no end symbol, and nothing drawn after it', async () => {
        const script = onlyScript(await modelOf('when_flag_clicked do\n  say("a")\n  stop("all")\nend\n'));
        expect(script.body[1]).toEqual({ kind: NODE_KINDS.ACTION, label: expect.any(String), stops: true });
        const layout = layoutActivityDiagram(
            await modelOf('when_flag_clicked do\n  say("a")\n  stop("this script")\nend\n'),
        );
        expect(layout.shapes.filter((s) => s.type === DIAGRAM_SHAPES.END)).toHaveLength(0);
        // ほかのスクリプトを止めるだけなら、そのスクリプトは続く
        const others = layoutActivityDiagram(
            await modelOf('when_flag_clicked do\n  stop("other scripts in sprite")\nend\n'),
        );
        expect(others.shapes.filter((s) => s.type === DIAGRAM_SHAPES.END)).toHaveLength(1);
    });

    test('a branch that stops does not go to the merge; when both branches end, nothing follows', async () => {
        const one = layoutActivityDiagram(
            await modelOf(
                'when_flag_clicked do\n  if touching?("_edge_")\n    stop("all")\n  end\n  say("x")\nend\n',
            ),
        );
        const merge = one.shapes.find((s) => s.type === DIAGRAM_SHAPES.MERGE);
        // 合流へ入るのは、いいえの枝（右）だけ
        const intoMerge = one.edges.filter((e) => {
            const [x, y] = e.points[e.points.length - 1];
            return Math.abs(y - (merge.y + merge.h / 2)) < 0.01 && (x === merge.x || x === merge.x + merge.w);
        });
        expect(intoMerge).toHaveLength(1);
        expect(one.shapes.filter((s) => s.type === DIAGRAM_SHAPES.END)).toHaveLength(1);
        const both = layoutActivityDiagram(
            await modelOf(
                'when_flag_clicked do\n  if touching?("_edge_")\n    stop("all")\n  else\n    loop do\n      say("a")\n' +
                    '    end\n  end\n  say("never")\nend\n',
            ),
        );
        expect(both.shapes.filter((s) => s.type === DIAGRAM_SHAPES.MERGE)).toHaveLength(1); // ずっとの合流だけ
        expect(both.shapes.filter((s) => s.type === DIAGRAM_SHAPES.END)).toHaveLength(0);
        expect(both.shapes.some((s) => s.label === '「never」と言う')).toBe(false);
        both.shapes.forEach((s) => expect(insideBox(s, both)).toBe(true));
    });

    test('mesh broadcast with value is a send too', () => {
        // topic にはまだブロックが無いので、VM 形式のブロックを直接書く
        const blocks = {
            hat: { opcode: 'event_whenflagclicked', topLevel: true, next: 's', inputs: {}, fields: {} },
            s: {
                opcode: 'meshV2_broadcastWithValue',
                next: null,
                inputs: { BROADCAST_INPUT: { block: 'm', shadow: 'm' }, VALUE: { block: 'v', shadow: 'v' } },
                fields: {},
            },
            m: { opcode: 'event_broadcast_menu', shadow: true, fields: { BROADCAST_OPTION: { value: 'あいさつ' } } },
            v: { opcode: 'text', shadow: true, fields: { TEXT: { value: 'やあ' } } },
        };
        const model = buildActivityModel(
            { lanes: [{ id: 'own', label: null, targets: [{ name: null, blocks }] }] },
            { format: formatJa, blockName: () => '%1 を %2 で送る' },
        );
        expect(onlyScript(model).body).toEqual([
            { kind: NODE_KINDS.SEND, label: '「あいさつ」 を 「やあ」 で送る', message: 'あいさつ' },
        ]);
    });

    test('message names match regardless of upper and lower case', async () => {
        const layout = layoutActivityDiagram(
            await spritesModel([
                'when_flag_clicked do\n  broadcast("Go")\nend\n',
                'when_receive("go") do\n  say("b")\nend\n',
            ]),
        );
        expect(layout.edges.filter((e) => e.message)).toHaveLength(1);
    });

    test('an answer without scripts gives no diagram', async () => {
        const diagram = await challengeActivityDiagram(
            defineChallenge({ id: 'x', activityDiagram: true, code: '# メモだけ\n' }),
            { locale: 'ja', format: formatJa, toBlocks: (source) => toBlocks(source.code) },
        );
        expect(diagram).toBeNull();
    });
});

describe('describeActivityModel', () => {
    test('writes the flow as text (for screen readers)', async () => {
        const { challenge } = findChallenge('blocks-l1-quiz');
        const text = describeActivityModel(await modelOf(challenge.code.ja), formatJa);
        // 分岐の枝は図と同じガードで書く
        expect(text).toBe(
            'このスプライトが押されたとき → 「4+3=?」と聞いて待つ → 答え = 7？' +
                '（[答え = 7]: 「正解です」と2秒言う / [それ以外]: 「ちがいます」と2秒言う）',
        );
    });

    test('the diagram of a challenge carries the text', async () => {
        const challenge = defineChallenge({
            id: 'x',
            activityDiagram: true,
            code: 'when_flag_clicked do\n  loop do\n    say("a")\n  end\nend\n',
            partner: { name: 'ロボ', replies: [{ onBroadcast: 'あ', broadcast: 'い' }] },
        });
        const diagram = await challengeActivityDiagram(challenge, {
            locale: 'ja',
            format: formatJa,
            toBlocks: (source) => toBlocks(source.code),
        });
        expect(diagram.layout.description.split('\n')).toEqual([
            'あなた: 旗が押されたとき → ずっとくり返す（「a」と言う）',
            'ロボ: 「あ」を受け取ったとき → 「い」を送る',
        ]);
    });

    test('a send and a receive name the sprites or lanes on the other end (as the arrows do)', async () => {
        const challenge = defineChallenge({
            id: 'x',
            activityDiagram: true,
            code: 'when_flag_clicked do\n  broadcast("Hello")\nend\n\nwhen_receive("やあ") do\n  say("a")\nend\n',
            // 合図の名前は大文字と小文字を区別しない（Scratch と同じ）
            partner: { name: 'ロボ', replies: [{ onBroadcast: 'hello', broadcast: 'やあ' }] },
        });
        const diagram = await challengeActivityDiagram(challenge, {
            locale: 'ja',
            format: formatJa,
            toBlocks: (source) => toBlocks(source.code),
        });
        expect(diagram.layout.description.split('\n')).toEqual([
            'あなた: 旗が押されたとき → 「Hello」を送る（受け取る: ロボ）',
            'あなた: 「やあ」を受け取ったとき（送る: ロボ） → 「a」と言う',
            'ロボ: 「hello」を受け取ったとき（送る: あなた） → 「やあ」を送る（受け取る: あなた）',
        ]);
        expect(diagram.layout.edges.filter((e) => e.message)).toHaveLength(2);
    });
});

describe('diagramScaleFor (the smallest scale keeps the text readable)', () => {
    // 1300×600 の課題の全文のパネルで図に使える大きさ（lesson-task-bar.jsx と同じ式）
    const FULL_TEXT = { maxWidth: 1300 - 36, maxHeight: 600 * 0.6 - 136 };

    test('the smallest scale keeps every text 10px or larger', () => {
        expect(SMALL_FONT_SIZE * MIN_DIAGRAM_SCALE).toBeGreaterThanOrEqual(10);
        expect(FONT_SIZE * MIN_DIAGRAM_SCALE).toBeGreaterThanOrEqual(10);
    });

    test('a small diagram is drawn as it is', () => {
        expect(diagramScaleFor({ width: 200, height: 100 }, FULL_TEXT)).toEqual({ scale: 1, fits: true });
    });

    test('a diagram a little too tall shrinks, down to the smallest scale', () => {
        const { scale, fits } = diagramScaleFor({ width: 200, height: 240 }, FULL_TEXT);
        expect(fits).toBe(true);
        expect(scale).toBeCloseTo(224 / 240);
    });

    test('a diagram too tall even at the smallest scale does not fit and stays at the smallest scale', () => {
        expect(diagramScaleFor({ width: 200, height: 600 }, FULL_TEXT)).toEqual({
            scale: MIN_DIAGRAM_SCALE,
            fits: false,
        });
    });

    test('a chat answer of about 8 blocks does not fit the full text at 1300×600 (it shows on the hint instead)', async () => {
        const layout = layoutActivityDiagram(
            await modelOf(
                'when_receive("とどいた") do\n  ask("メッセージは？")\n  $メッセージ = answer\n  broadcast("おくる")\n' +
                    '  say($メッセージ, 2)\n  $回数 += 1\n  sleep(1)\n  say("おくったよ")\nend\n',
            ),
        );
        expect(diagramScaleFor(layout, FULL_TEXT).fits).toBe(false);
        // 1 本の短い答え（4 ブロック）は入る
        const { challenge } = findChallenge('blocks-l1-quiz');
        expect(diagramScaleFor(layoutActivityDiagram(await modelOf(challenge.code.ja)), FULL_TEXT).fits).toBe(true);
    });
});
