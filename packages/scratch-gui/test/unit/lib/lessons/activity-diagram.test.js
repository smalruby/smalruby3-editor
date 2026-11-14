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
        expect(script.body).toEqual([
            { kind: NODE_KINDS.ACTION, label: '「こんにちは！」と2秒言う' },
            { kind: NODE_KINDS.ACTION, label: '1秒待つ' },
        ]);
    });

    test('ask and if / else become an action and a decision with yes / no branches', async () => {
        const { challenge } = findChallenge('blocks-l1-quiz');
        const script = onlyScript(await modelOf(challenge.code.ja));
        expect(script.start).toBe('このスプライトが押されたとき');
        expect(script.body).toEqual([
            { kind: NODE_KINDS.ACTION, label: '「4+3=?」と聞いて待つ' },
            {
                kind: NODE_KINDS.DECISION,
                label: '答え = 7？',
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
                body: [
                    {
                        kind: NODE_KINDS.LOOP,
                        label: '3回くり返す',
                        forever: false,
                        body: [
                            {
                                kind: NODE_KINDS.DECISION,
                                label: 'マウスのポインターに触れた？',
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
                body: [
                    { kind: NODE_KINDS.ACTION, label: 'メッセージを「こんにちは」にする' },
                    { kind: NODE_KINDS.ACTION, label: '「とどいた」を送る' },
                ],
            },
            {
                start: '「3 にする」ボタンを押したとき',
                body: [{ kind: NODE_KINDS.ACTION, label: '点数を3にする' }],
            },
            {
                start: '「こんにちは」を受け取ったとき',
                body: [{ kind: NODE_KINDS.ACTION, label: '「やあ」を送る' }],
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
                body: [{ kind: NODE_KINDS.ACTION, label: 'へんじを「pong」にする' }],
            },
        ]);
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

    test('a decision puts the yes branch on the left, the no branch on the right and merges below', async () => {
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
        const guards = layout.shapes.filter((s) => s.type === DIAGRAM_SHAPES.GUARD).map((s) => s.label);
        expect(guards).toEqual(['はい', 'いいえ']);
        layout.shapes.forEach((s) => expect(insideBox(s, layout)).toBe(true));
    });

    test('a loop is a frame that holds its body', async () => {
        const layout = layoutActivityDiagram(
            await modelOf('when_flag_clicked do\n  loop do\n    say("a")\n  end\nend\n'),
        );
        const frame = layout.shapes.find((s) => s.type === DIAGRAM_SHAPES.LOOP);
        const action = layout.shapes.find((s) => s.type === DIAGRAM_SHAPES.ACTION);
        expect(frame.label).toBe('ずっとくり返す');
        expect(action.x).toBeGreaterThan(frame.x);
        expect(action.y).toBeGreaterThan(frame.y);
        expect(action.x + action.w).toBeLessThan(frame.x + frame.w);
        expect(action.y + action.h).toBeLessThan(frame.y + frame.h);
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
        expect(diagram.layout.shapes.some((s) => s.type === DIAGRAM_SHAPES.LOOP)).toBe(true);
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
        const frames = layout.shapes.filter((s) => s.type === DIAGRAM_SHAPES.LOOP);
        const [outerFrame, innerFrame] = frames;
        const said = (label) => layout.shapes.find((s) => s.label === label);
        // はいの枝（くり返しの枠）が、いいえの枝（入れ子の分岐とその箱）より左にあって重ならない
        const noShapes = [said('「に」と言う'), said('「ほか」と言う')];
        noShapes.forEach((shape) => expect(innerFrame.x + innerFrame.w).toBeLessThanOrEqual(shape.x));
        // どれも外の枠の中
        layout.shapes
            .filter((s) => s !== outerFrame && s.type !== DIAGRAM_SHAPES.START && s.type !== DIAGRAM_SHAPES.GUARD)
            .forEach((s) => {
                expect(s.x).toBeGreaterThanOrEqual(outerFrame.x);
                expect(s.x + s.w).toBeLessThanOrEqual(outerFrame.x + outerFrame.w);
            });
    });

    test('a script that ends with forever has no end symbol', async () => {
        const layout = layoutActivityDiagram(
            await modelOf('when_flag_clicked do\n  loop do\n    say("a")\n  end\nend\n'),
        );
        expect(layout.shapes.filter((s) => s.type === DIAGRAM_SHAPES.END)).toHaveLength(0);
        const frame = layout.shapes.find((s) => s.type === DIAGRAM_SHAPES.LOOP);
        // 枠の下から先へ出る矢印も無い
        expect(layout.edges.every((e) => e.points.every(([, y]) => y <= frame.y + frame.h))).toBe(true);
        // ずっとのあとに続きがあるとき（ずっとが最後でない）は終了を描く
        const repeat = layoutActivityDiagram(
            await modelOf('when_flag_clicked do\n  3.times do\n    say("a")\n  end\nend\n'),
        );
        expect(repeat.shapes.filter((s) => s.type === DIAGRAM_SHAPES.END)).toHaveLength(1);
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
        const text = describeActivityModel(await modelOf(challenge.code.ja), { yes: 'はい', no: 'いいえ' });
        expect(text).toBe(
            'このスプライトが押されたとき → 「4+3=?」と聞いて待つ → 答え = 7？' +
                '（はい: 「正解です」と2秒言う / いいえ: 「ちがいます」と2秒言う）',
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
