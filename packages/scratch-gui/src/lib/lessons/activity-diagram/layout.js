// アクティビティ図のモデル（model.js）に置き方（座標）を付ける純粋関数。描くのは
// components/lesson-activity-diagram（SVG）。座標は SVG の viewBox の単位（字の大きさ 12 のとき）で、
// 描く側が収まる大きさに縮める。
//
// 上から下へ流す。くり返しはワークシートの形と同じ点線の枠（左上に「ずっとくり返す」など）、
// 分岐はひし形から「はい」を左・「いいえ」を右へ分け、下の小さなひし形（合流）でまとめる。
// スクリプトは横に並べ、スプライトが 2 つ以上ならスプライトの名前を上に書く。レーンが 2 つ以上
// （メッシュの練習相手がいるとき）は見出しつきのスイムレーンにする。
import { NODE_KINDS } from './model';

export const DIAGRAM_SHAPES = Object.freeze({
    START: 'start',
    END: 'end',
    ACTION: 'action',
    DECISION: 'decision',
    MERGE: 'merge',
    LOOP: 'loop',
    GUARD: 'guard',
    LANE: 'lane',
    CAPTION: 'caption',
});

export const FONT_SIZE = 12;
export const SMALL_FONT_SIZE = 11;
const LINE_HEIGHT = 15;
const SMALL_LINE_HEIGHT = 14;
const GAP = 18;
const START_R = 7;
const END_R = 8;
const ACTION_PAD_X = 10;
const ACTION_PAD_Y = 5;
const ACTION_MAX_TEXT = 170;
const DECISION_MAX_TEXT = 120;
const MERGE_SIZE = 14;
const COL_GAP = 20;
const LOOP_LABEL_H = 20;
const LOOP_PAD = 10;
const SCRIPT_GAP = 28;
const CAPTION_H = 20;
const LANE_HEADER_H = 26;
const LANE_PAD = 14;
const MARGIN = 8;

// 字の幅のめやす（全角 = 字の大きさ、半角 = 0.6 倍）。描く前に測れない（純粋関数にする）ので見積もる
const charWidth = (ch, size) => (/[⺀-￿]/.test(ch) ? size : size * 0.6);

/**
 * 文の幅の見積もり。
 * @param {string} text - 文。
 * @param {number} [size] - 字の大きさ。
 * @returns {number} 幅。
 */
export const textWidth = (text, size = FONT_SIZE) =>
    Array.from(text).reduce((sum, ch) => sum + charWidth(ch, size), 0);

/**
 * 文を幅に収まるように行に分ける（日本語はどこでも、英語はできるだけ空白で切る）。
 * @param {string} text - 文。
 * @param {number} maxWidth - 1 行の幅の上限。
 * @param {number} [size] - 字の大きさ。
 * @returns {string[]} 行。
 */
export const wrapText = (text, maxWidth, size = FONT_SIZE) => {
    const lines = [];
    let line = '';
    let width = 0;
    Array.from(text).forEach((ch) => {
        const w = charWidth(ch, size);
        if (line !== '' && width + w > maxWidth) {
            const space = line.lastIndexOf(' ');
            if (space > 0 && ch !== ' ') {
                lines.push(line.slice(0, space));
                line = line.slice(space + 1);
            } else {
                lines.push(line);
                line = '';
            }
            width = textWidth(line, size);
        }
        line += ch;
        width += w;
    });
    if (line !== '' || lines.length === 0) lines.push(line);
    return lines;
};

const linesWidth = (lines, size = FONT_SIZE) => Math.max(0, ...lines.map((l) => textWidth(l, size)));

// --- 大きさを測る（cx から左右にどれだけ出るか・高さ）---

const actionBox = (label) => {
    const lines = wrapText(label, ACTION_MAX_TEXT);
    return {
        lines,
        w: Math.max(48, linesWidth(lines) + ACTION_PAD_X * 2),
        h: lines.length * LINE_HEIGHT + ACTION_PAD_Y * 2,
    };
};

const decisionBox = (label) => {
    const lines = wrapText(label, DECISION_MAX_TEXT);
    const th = lines.length * LINE_HEIGHT;
    return { lines, w: linesWidth(lines) + th * 2 + 16, h: th * 2 + 12 };
};

const EMPTY = { left: 0, right: 0, h: 0 };

const measureSeq = (nodes) => {
    if (nodes.length === 0) return EMPTY;
    const sizes = nodes.map(measureNode);
    return {
        left: Math.max(...sizes.map((s) => s.left)),
        right: Math.max(...sizes.map((s) => s.right)),
        h: sizes.reduce((sum, s) => sum + s.h, 0) + GAP * (sizes.length - 1),
    };
};

const decisionColumns = (node) => {
    const box = decisionBox(node.label);
    const yes = measureSeq(node.yes);
    const no = measureSeq(node.no);
    const guardYes = textWidth(node.yesLabel || '', SMALL_FONT_SIZE);
    const guardNo = textWidth(node.noLabel || '', SMALL_FONT_SIZE);
    const dl = Math.max(yes.right + COL_GAP / 2, box.w / 2 + guardYes + 6);
    const dr = Math.max(no.left + COL_GAP / 2, box.w / 2 + guardNo + 6);
    return { box, yes, no, dl, dr };
};

const loopSize = (node) => {
    const inner = measureSeq(node.body);
    const labelW = textWidth(node.label, SMALL_FONT_SIZE);
    const half = Math.max(inner.left + LOOP_PAD, inner.right + LOOP_PAD, labelW + 14, 40);
    const innerH = inner.h === 0 ? 0 : inner.h + LOOP_PAD;
    return { inner, half, h: LOOP_LABEL_H + 6 + innerH };
};

const measureNode = (node) => {
    if (node.kind === NODE_KINDS.ACTION) {
        const box = actionBox(node.label);
        return { left: box.w / 2, right: box.w / 2, h: box.h };
    }
    if (node.kind === NODE_KINDS.DECISION) {
        const { box, yes, no, dl, dr } = decisionColumns(node);
        const branchH = Math.max(yes.h, no.h);
        return {
            left: Math.max(box.w / 2, dl + yes.left),
            right: Math.max(box.w / 2, dr + no.right),
            h: box.h + GAP / 2 + branchH + GAP / 2 + MERGE_SIZE,
        };
    }
    const { half, h } = loopSize(node);
    return { left: half, right: half, h };
};

// --- 置く ---

const addEdge = (out, points, arrow = true) => out.edges.push({ points, arrow });

const placeSeq = (nodes, cx, y, out) => {
    let top = y;
    nodes.forEach((node, i) => {
        if (i > 0) {
            addEdge(out, [
                [cx, top],
                [cx, top + GAP],
            ]);
            top += GAP;
        }
        top = placeNode(node, cx, top, out);
    });
    return top;
};

const placeNode = (node, cx, y, out) => {
    if (node.kind === NODE_KINDS.ACTION) {
        const box = actionBox(node.label);
        out.shapes.push({
            type: DIAGRAM_SHAPES.ACTION,
            x: cx - box.w / 2,
            y,
            w: box.w,
            h: box.h,
            label: node.label,
            lines: box.lines,
        });
        return y + box.h;
    }
    if (node.kind === NODE_KINDS.DECISION) return placeDecision(node, cx, y, out);
    return placeLoop(node, cx, y, out);
};

const placeDecision = (node, cx, y, out) => {
    const { box, yes, no, dl, dr } = decisionColumns(node);
    out.shapes.push({
        type: DIAGRAM_SHAPES.DECISION,
        x: cx - box.w / 2,
        y,
        w: box.w,
        h: box.h,
        label: node.label,
        lines: box.lines,
    });
    const vy = y + box.h / 2;
    const branchTop = y + box.h + GAP / 2;
    const mergeTop = branchTop + Math.max(yes.h, no.h) + GAP / 2;
    const mergeCY = mergeTop + MERGE_SIZE / 2;
    const guardH = SMALL_LINE_HEIGHT;
    const branches = [
        {
            nodes: node.yes,
            colX: cx - dl,
            vx: cx - box.w / 2,
            mx: cx - MERGE_SIZE / 2,
            label: node.yesLabel,
            left: true,
        },
        {
            nodes: node.no,
            colX: cx + dr,
            vx: cx + box.w / 2,
            mx: cx + MERGE_SIZE / 2,
            label: node.noLabel,
            left: false,
        },
    ];
    branches.forEach((branch) => {
        const gw = textWidth(branch.label || '', SMALL_FONT_SIZE);
        out.shapes.push({
            type: DIAGRAM_SHAPES.GUARD,
            x: branch.left ? branch.vx - 3 - gw : branch.vx + 3,
            y: vy - 3 - guardH,
            w: gw,
            h: guardH,
            label: branch.label || '',
            anchor: branch.left ? 'end' : 'start',
        });
        if (branch.nodes.length === 0) {
            addEdge(out, [
                [branch.vx, vy],
                [branch.colX, vy],
                [branch.colX, mergeCY],
                [branch.mx, mergeCY],
            ]);
            return;
        }
        addEdge(out, [
            [branch.vx, vy],
            [branch.colX, vy],
            [branch.colX, branchTop],
        ]);
        const bottom = placeSeq(branch.nodes, branch.colX, branchTop, out);
        addEdge(out, [
            [branch.colX, bottom],
            [branch.colX, mergeCY],
            [branch.mx, mergeCY],
        ]);
    });
    out.shapes.push({
        type: DIAGRAM_SHAPES.MERGE,
        x: cx - MERGE_SIZE / 2,
        y: mergeTop,
        w: MERGE_SIZE,
        h: MERGE_SIZE,
    });
    return mergeTop + MERGE_SIZE;
};

const placeLoop = (node, cx, y, out) => {
    const { inner, half, h } = loopSize(node);
    out.shapes.push({
        type: DIAGRAM_SHAPES.LOOP,
        x: cx - half,
        y,
        w: half * 2,
        h,
        label: node.label,
        forever: node.forever,
    });
    const innerTop = y + LOOP_LABEL_H + 6;
    if (inner.h === 0) {
        addEdge(
            out,
            [
                [cx, y],
                [cx, y + h],
            ],
            false,
        );
        return y + h;
    }
    addEdge(out, [
        [cx, y],
        [cx, innerTop],
    ]);
    const bottom = placeSeq(node.body, cx, innerTop, out);
    addEdge(
        out,
        [
            [cx, bottom],
            [cx, y + h],
        ],
        false,
    );
    return y + h;
};

// --- スクリプト・スプライト・レーン ---

const startLabel = (script) => (script.start ? wrapText(script.start, ACTION_MAX_TEXT, SMALL_FONT_SIZE) : []);

const measureScript = (script) => {
    const body = measureSeq(script.body);
    const lines = startLabel(script);
    const labelRight = lines.length > 0 ? START_R + 6 + linesWidth(lines, SMALL_FONT_SIZE) : START_R;
    const bodyH = body.h === 0 ? 0 : body.h + GAP;
    return {
        left: Math.max(body.left, END_R, START_R),
        right: Math.max(body.right, END_R, labelRight),
        h: START_R * 2 + GAP + bodyH + END_R * 2,
        lines,
    };
};

const placeScript = (script, cx, y, out) => {
    const size = measureScript(script);
    out.shapes.push({
        type: DIAGRAM_SHAPES.START,
        x: cx - START_R,
        y,
        w: START_R * 2,
        h: START_R * 2,
        label: script.start,
        lines: size.lines,
    });
    let top = y + START_R * 2;
    addEdge(out, [
        [cx, top],
        [cx, top + GAP],
    ]);
    top += GAP;
    if (script.body.length > 0) {
        top = placeSeq(script.body, cx, top, out);
        addEdge(out, [
            [cx, top],
            [cx, top + GAP],
        ]);
        top += GAP;
    }
    out.shapes.push({ type: DIAGRAM_SHAPES.END, x: cx - END_R, y: top, w: END_R * 2, h: END_R * 2 });
};

// はい・いいえの文言をモデルの分岐に付ける（測る・置くの両方で同じものを使う）
const withGuards = (nodes, guards) =>
    nodes.map((node) => {
        if (node.kind === NODE_KINDS.DECISION) {
            return {
                ...node,
                yesLabel: guards.yes,
                noLabel: guards.no,
                yes: withGuards(node.yes, guards),
                no: withGuards(node.no, guards),
            };
        }
        if (node.kind === NODE_KINDS.LOOP) return { ...node, body: withGuards(node.body, guards) };
        return node;
    });

const measureTarget = (target, captioned) => {
    const scripts = target.scripts.map(measureScript);
    const width =
        scripts.reduce((sum, s) => sum + s.left + s.right, 0) + SCRIPT_GAP * Math.max(0, scripts.length - 1);
    const captionW = captioned && target.name ? textWidth(target.name, SMALL_FONT_SIZE) : 0;
    return {
        scripts,
        w: Math.max(width, captionW),
        h: (captioned ? CAPTION_H : 0) + Math.max(0, ...scripts.map((s) => s.h)),
    };
};

const measureLane = (lane) => {
    const captioned = lane.targets.length > 1;
    const targets = lane.targets.map((t) => measureTarget(t, captioned));
    return {
        captioned,
        targets,
        w: targets.reduce((sum, t) => sum + t.w, 0) + SCRIPT_GAP * Math.max(0, targets.length - 1),
        h: Math.max(0, ...targets.map((t) => t.h)),
    };
};

/**
 * 図のモデルに置き方を付ける。
 * @param {object} model - `buildActivityModel` の戻り値（`{lanes}`）。
 * @param {object} [guards] - 分岐の矢印に書く文言 `{yes, no}`（既定は「はい」「いいえ」）。
 * @returns {{width: number, height: number, swimlanes: boolean, shapes: Array<object>, edges: Array<object>}}
 *   置き方。shapes の x / y / w / h は記号の外わく、edges は折れ線（`points`）と矢じりの有無（`arrow`）。
 */
export const layoutActivityDiagram = (model, guards = { yes: 'はい', no: 'いいえ' }) => {
    const lanes = model.lanes.map((lane) => ({
        ...lane,
        targets: lane.targets.map((target) => ({
            ...target,
            scripts: target.scripts.map((s) => ({ ...s, body: withGuards(s.body, guards) })),
        })),
    }));
    const swimlanes = lanes.length > 1;
    const sizes = lanes.map(measureLane);
    const headerH = swimlanes ? LANE_HEADER_H : 0;
    const pad = swimlanes ? LANE_PAD : 0;
    const contentH = Math.max(0, ...sizes.map((s) => s.h));
    const out = { shapes: [], edges: [] };
    let laneX = MARGIN;
    lanes.forEach((lane, li) => {
        const size = sizes[li];
        const laneW = size.w + pad * 2;
        if (swimlanes) {
            out.shapes.push({
                type: DIAGRAM_SHAPES.LANE,
                x: laneX,
                y: MARGIN,
                w: laneW,
                h: headerH + contentH + pad * 2,
                label: lane.label || '',
                headerH,
            });
        }
        let targetX = laneX + pad;
        const top = MARGIN + headerH + pad;
        lane.targets.forEach((target, ti) => {
            const tsize = size.targets[ti];
            if (size.captioned && target.name) {
                out.shapes.push({
                    type: DIAGRAM_SHAPES.CAPTION,
                    x: targetX,
                    y: top,
                    w: textWidth(target.name, SMALL_FONT_SIZE),
                    h: CAPTION_H - 6,
                    label: target.name,
                });
            }
            const scriptTop = top + (size.captioned ? CAPTION_H : 0);
            let scriptX = targetX;
            target.scripts.forEach((script, si) => {
                const s = tsize.scripts[si];
                placeScript(script, scriptX + s.left, scriptTop, out);
                scriptX += s.left + s.right + SCRIPT_GAP;
            });
            targetX += tsize.w + SCRIPT_GAP;
        });
        laneX += laneW + (swimlanes ? 0 : SCRIPT_GAP);
    });
    const width =
        MARGIN * 2 +
        sizes.reduce((sum, s) => sum + s.w + pad * 2, 0) +
        (swimlanes ? 0 : SCRIPT_GAP * Math.max(0, lanes.length - 1));
    return {
        width: Math.ceil(width),
        height: Math.ceil(MARGIN * 2 + headerH + pad * 2 + contentH),
        swimlanes,
        shapes: out.shapes,
        edges: out.edges,
    };
};
