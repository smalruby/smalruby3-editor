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
import { DIAGRAM_SHAPES, layoutActivityDiagram } from '../../../../src/lib/lessons/activity-diagram/layout';
import { buildActivityModel, NODE_KINDS, partnerLane } from '../../../../src/lib/lessons/activity-diagram/model';
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
                buttons: [{ label: 'あいさつ', send: 'こんにちは' }],
                replies: [{ receive: 'こんにちは', send: 'やあ' }],
            },
            { format: formatJa },
        );
        expect(lane.label).toBe('ロボ');
        const scripts = lane.targets[0].scripts;
        expect(scripts).toEqual([
            {
                start: '「あいさつ」ボタンを押したとき',
                body: [{ kind: NODE_KINDS.ACTION, label: '「こんにちは」を送る' }],
            },
            {
                start: '「こんにちは」を受け取ったとき',
                body: [{ kind: NODE_KINDS.ACTION, label: '「やあ」を送る' }],
            },
        ]);
    });

    test('no partner (or a partner without anything to draw) gives no lane', () => {
        expect(partnerLane(null, { format: formatJa })).toBeNull();
        expect(partnerLane(undefined, { format: formatJa })).toBeNull();
        expect(partnerLane({ name: 'ロボ' }, { format: formatJa })).toBeNull();
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
        expect(action.w).toBeLessThanOrEqual(200);
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
            { name: 'ロボ', replies: [{ receive: 'あいさつ', send: 'やあ' }] },
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
            partner: { name: 'ロボ', replies: [{ receive: 'あいさつ', send: 'やあ' }] },
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
