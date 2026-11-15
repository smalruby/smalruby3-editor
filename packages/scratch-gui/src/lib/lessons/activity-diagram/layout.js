// アクティビティ図のモデル（model.js）に置き方（座標）を付ける純粋関数。描くのは
// components/lesson-activity-diagram（SVG）。座標は SVG の viewBox の単位（字の大きさ 12 のとき）で、
// 描く側が収まる大きさに縮める。
//
// 記号は教科書のアクティビティ図にそろえる（docs/lessons/design.md の「アクティビティ図」）。上から下へ流す。
// - 分岐: 中に何も書かないひし形から、条件に合う枝を左・合わない枝を右へ分け、枝に「[条件]」のガードを書く。
//   下の同じ大きさのひし形（合流）でまとめる。
// - くり返し: 上のひし形（合流）に、本体の下から左を回って戻る線を入れる。「ずっと」は合流だけで出口が無い。
//   「〜回」「〜まで」はそのひし形で分岐も兼ね、下へ続ける枝と、右から出て本体の下へ回る枝にガードを書く。
// - 送信: 相手の向きがとがった五角形。受信: 送り手の向きにへこみのある箱で、スクリプトを受信で始める
//   （開始の黒丸を置かない）。送信から、ほかのスプライト・レーンの同じ合図の受信へ矢印を引き、受信は送信と同じ
//   高さまで下げる。
// スクリプトは横に並べ、スプライトが 2 つ以上ならスプライトの名前を上に書く。レーンが 2 つ以上
// （メッシュの練習相手がいるとき）は見出しつきのスイムレーンにする。
import { messageKey, NODE_KINDS } from './model';

export const DIAGRAM_SHAPES = Object.freeze({
    START: 'start',
    END: 'end',
    ACTION: 'action',
    SEND: 'send',
    RECEIVE: 'receive',
    DECISION: 'decision',
    MERGE: 'merge',
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
const ACTION_MAX_TEXT = 192;
// ひし形（分岐・合流。教科書と同じく中に字を書かない）の大きさ
const DIAMOND = 18;
const GUARD_MAX_TEXT = 110;
// 送信の五角形のとがり・受信の箱のへこみの深さ
export const SEND_TIP = 9;
export const RECEIVE_NOTCH = 8;
const COL_GAP = 20;
// くり返しの戻る線・ぬける線を、本体からどれだけ離すか
const LOOP_PAD = 12;
const BACK_GAP = 10;
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

// --- 大きさを測る（cx から左右にどれだけ出るか・高さ・入ってくる矢印の先が上からどれだけ下か）---

const textBox = (label, extra = 0) => {
    const lines = wrapText(label, ACTION_MAX_TEXT);
    return {
        lines,
        w: Math.max(48, linesWidth(lines) + ACTION_PAD_X * 2 + extra),
        h: lines.length * LINE_HEIGHT + ACTION_PAD_Y * 2,
    };
};

// ガード（枝に書く「[条件]」）。無ければ大きさ 0
const guardBox = (label) => {
    if (!label) return { lines: [], w: 0, h: 0 };
    const lines = wrapText(label, GUARD_MAX_TEXT, SMALL_FONT_SIZE);
    return { lines, w: linesWidth(lines, SMALL_FONT_SIZE), h: lines.length * SMALL_LINE_HEIGHT };
};

// ひし形の上に、左右へ出る枝のガードを書く場所を空ける（ひし形の真ん中の高さの上に字を置くため）
const guardReserve = (...boxes) => Math.max(0, Math.max(0, ...boxes.map((b) => b.h)) + 2 - DIAMOND / 2);

const EMPTY = { left: 0, right: 0, h: 0, entry: 0 };

// そこで終わって先へ進まない記号: 「ずっと」、スクリプトを止める処理、両方の枝が終わる分岐
const isEndless = (node) => {
    if (node.kind === NODE_KINDS.LOOP) return node.forever;
    if (node.kind === NODE_KINDS.ACTION) return Boolean(node.stops);
    if (node.kind === NODE_KINDS.DECISION) return endsForever(node.yes) && endsForever(node.no);
    return false;
};

// 終わらない並び（どこかで終わる記号がある）。その先へ線を引かない
const endsForever = (nodes) => nodes.some(isEndless);

// 終わる記号より後ろ（届かない記号）は描かない
const reachable = (nodes) => {
    const i = nodes.findIndex(isEndless);
    return i < 0 ? nodes : nodes.slice(0, i + 1);
};

const measureSeq = (all) => {
    const nodes = reachable(all);
    if (nodes.length === 0) return EMPTY;
    const sizes = nodes.map(measureNode);
    return {
        left: Math.max(...sizes.map((s) => s.left)),
        right: Math.max(...sizes.map((s) => s.right)),
        h: sizes.reduce((sum, s) => sum + s.h, 0) + GAP * (sizes.length - 1),
        entry: sizes[0].entry,
    };
};

const decisionParts = (node) => {
    const yesGuard = guardBox(node.yesGuard);
    const noGuard = guardBox(node.noGuard);
    const yes = measureSeq(node.yes);
    const no = measureSeq(node.no);
    return {
        yesGuard,
        noGuard,
        yes,
        no,
        reserve: guardReserve(yesGuard, noGuard),
        dl: Math.max(yes.right + COL_GAP / 2, DIAMOND / 2 + yesGuard.w + 8),
        dr: Math.max(no.left + COL_GAP / 2, DIAMOND / 2 + noGuard.w + 8),
    };
};

const loopParts = (node) => {
    const inner = measureSeq(node.body);
    const back = endsForever(node.body) ? 0 : BACK_GAP;
    const left = Math.max(DIAMOND / 2, inner.left) + LOOP_PAD;
    if (node.forever) {
        const bodyH = node.body.length === 0 ? 0 : GAP + inner.h;
        return {
            inner,
            reserve: 0,
            below: GAP,
            left,
            right: Math.max(DIAMOND / 2, inner.right),
            h: DIAMOND + bodyH + back,
        };
    }
    const continueGuard = guardBox(node.continueGuard);
    const exitGuard = guardBox(node.exitGuard);
    const reserve = guardReserve(exitGuard);
    const below = Math.max(GAP, continueGuard.h + 6);
    return {
        inner,
        continueGuard,
        exitGuard,
        reserve,
        below,
        left,
        right: Math.max(inner.right + LOOP_PAD, DIAMOND / 2 + exitGuard.w + 10, continueGuard.w + 4 + 10),
        // ひし形 → 続ける枝 → 本体 → 戻る線 → ぬける線（戻る線の下を通って真ん中へ戻る）
        h: reserve + DIAMOND + below + inner.h + BACK_GAP + BACK_GAP,
    };
};

const measureNode = (node) => {
    if (node.kind === NODE_KINDS.ACTION || node.kind === NODE_KINDS.SEND) {
        const box = textBox(node.label, node.kind === NODE_KINDS.SEND ? SEND_TIP : 0);
        return { left: box.w / 2, right: box.w / 2, h: box.h, entry: 0 };
    }
    if (node.kind === NODE_KINDS.DECISION) {
        const { yes, no, reserve, dl, dr } = decisionParts(node);
        // 両方の枝が終わるときは合流を描かない
        const merge = isEndless(node) ? 0 : GAP / 2 + DIAMOND;
        return {
            left: Math.max(DIAMOND / 2, dl + yes.left),
            right: Math.max(DIAMOND / 2, dr + no.right),
            h: reserve + DIAMOND + GAP / 2 + Math.max(yes.h, no.h) + merge,
            entry: reserve,
        };
    }
    const { left, right, h, reserve } = loopParts(node);
    return { left, right, h, entry: reserve };
};

// --- 置く ---

const addEdge = (out, points, arrow = true) => out.edges.push({ points, arrow });

// 上の記号の下（fromY）から、top に置く並びの最初の記号へ矢印を引く
const arrowInto = (out, cx, fromY, nodes, top) =>
    addEdge(out, [
        [cx, fromY],
        [cx, top + measureSeq(nodes).entry],
    ]);

const placeSeq = (all, cx, y, out) => {
    const nodes = reachable(all);
    let top = y;
    nodes.forEach((node, i) => {
        if (i > 0) {
            arrowInto(out, cx, top, [node], top + GAP);
            top += GAP;
        }
        top = placeNode(node, cx, top, out);
    });
    return top;
};

const placeNode = (node, cx, y, out) => {
    if (node.kind === NODE_KINDS.ACTION || node.kind === NODE_KINDS.SEND) {
        const send = node.kind === NODE_KINDS.SEND;
        const box = textBox(node.label, send ? SEND_TIP : 0);
        out.shapes.push({
            type: send ? DIAGRAM_SHAPES.SEND : DIAGRAM_SHAPES.ACTION,
            x: cx - box.w / 2,
            y,
            w: box.w,
            h: box.h,
            label: node.label,
            lines: box.lines,
            // 送信: とがった向き（相手のいる向き。相手がいなければ右）と合図の名前
            ...(send ? { direction: 'right', message: node.message } : {}),
        });
        return y + box.h;
    }
    if (node.kind === NODE_KINDS.DECISION) return placeDecision(node, cx, y, out);
    return node.forever ? placeForever(node, cx, y, out) : placeRepeat(node, cx, y, out);
};

const diamondShape = (type, cx, y, label = null) => ({
    type,
    x: cx - DIAMOND / 2,
    y,
    w: DIAMOND,
    h: DIAMOND,
    ...(label ? { label } : {}),
});

const guardShape = (box, label, x, y, anchor) => ({
    type: DIAGRAM_SHAPES.GUARD,
    x: anchor === 'end' ? x - box.w : x,
    y,
    w: box.w,
    h: box.h,
    label,
    lines: box.lines,
    anchor,
});

const placeDecision = (node, cx, y, out) => {
    const { yesGuard, noGuard, yes, no, reserve, dl, dr } = decisionParts(node);
    const top = y + reserve;
    out.shapes.push(diamondShape(DIAGRAM_SHAPES.DECISION, cx, top, node.label));
    const vy = top + DIAMOND / 2;
    const branchTop = top + DIAMOND + GAP / 2;
    const mergeTop = branchTop + Math.max(yes.h, no.h) + GAP / 2;
    const mergeCY = mergeTop + DIAMOND / 2;
    [
        { nodes: node.yes, guard: yesGuard, label: node.yesGuard, colX: cx - dl, side: -1 },
        { nodes: node.no, guard: noGuard, label: node.noGuard, colX: cx + dr, side: 1 },
    ].forEach(({ nodes, guard, label, colX, side }) => {
        const tipX = cx + (side * DIAMOND) / 2;
        if (label) {
            out.shapes.push(guardShape(guard, label, tipX + side * 3, vy - 2 - guard.h, side < 0 ? 'end' : 'start'));
        }
        if (nodes.length === 0) {
            addEdge(out, [
                [tipX, vy],
                [colX, vy],
                [colX, mergeCY],
                [tipX, mergeCY],
            ]);
            return;
        }
        addEdge(out, [
            [tipX, vy],
            [colX, vy],
            [colX, branchTop + measureSeq(nodes).entry],
        ]);
        const bottom = placeSeq(nodes, colX, branchTop, out);
        // 終わる枝（ずっと・止める）は合流へ戻らない
        if (endsForever(nodes)) return;
        addEdge(out, [
            [colX, bottom],
            [colX, mergeCY],
            [tipX, mergeCY],
        ]);
    });
    if (isEndless(node)) return branchTop + Math.max(yes.h, no.h);
    out.shapes.push(diamondShape(DIAGRAM_SHAPES.MERGE, cx, mergeTop));
    return mergeTop + DIAMOND;
};

// 本体の下から左を回って、ひし形の左のかどへ戻る線
const addBackEdge = (out, cx, bottom, leftX, vy) =>
    addEdge(out, [
        [cx, bottom],
        [cx, bottom + BACK_GAP],
        [leftX, bottom + BACK_GAP],
        [leftX, vy],
        [cx - DIAMOND / 2, vy],
    ]);

// ずっと: 合流のひし形 → 本体 → 戻る線。出口は無い
const placeForever = (node, cx, y, out) => {
    const { left } = loopParts(node);
    out.shapes.push(diamondShape(DIAGRAM_SHAPES.MERGE, cx, y, node.label));
    const vy = y + DIAMOND / 2;
    let bottom = y + DIAMOND;
    if (node.body.length > 0) {
        arrowInto(out, cx, bottom, node.body, bottom + GAP);
        bottom = placeSeq(node.body, cx, bottom + GAP, out);
    }
    if (endsForever(node.body)) return bottom;
    addBackEdge(out, cx, bottom, cx - left, vy);
    return bottom + BACK_GAP;
};

// 〜回くり返す・〜までくり返す: 合流と分岐を兼ねるひし形 → 続ける枝（下）→ 本体 → 戻る線。
// ぬける枝はひし形の右から出て、戻る線の下を通って真ん中へ戻り、次の記号へ続く
const placeRepeat = (node, cx, y, out) => {
    const { continueGuard, exitGuard, reserve, below, left, right } = loopParts(node);
    const top = y + reserve;
    out.shapes.push(diamondShape(DIAGRAM_SHAPES.DECISION, cx, top, node.label));
    const vy = top + DIAMOND / 2;
    const continueTop = top + DIAMOND;
    const bodyTop = continueTop + below;
    if (node.continueGuard) {
        out.shapes.push(guardShape(continueGuard, node.continueGuard, cx + 4, continueTop + 2, 'start'));
    }
    if (node.exitGuard) {
        out.shapes.push(guardShape(exitGuard, node.exitGuard, cx + DIAMOND / 2 + 3, vy - 2 - exitGuard.h, 'start'));
    }
    let bottom = bodyTop;
    if (node.body.length === 0) {
        addEdge(
            out,
            [
                [cx, continueTop],
                [cx, bodyTop],
            ],
            false,
        );
    } else {
        arrowInto(out, cx, continueTop, node.body, bodyTop);
        bottom = placeSeq(node.body, cx, bodyTop, out);
    }
    if (!endsForever(node.body)) addBackEdge(out, cx, bottom, cx - left, vy);
    const exitY = bottom + BACK_GAP + BACK_GAP;
    addEdge(
        out,
        [
            [cx + DIAMOND / 2, vy],
            [cx + right, vy],
            [cx + right, exitY],
            [cx, exitY],
        ],
        false,
    );
    return exitY;
};

// --- スクリプト・スプライト・レーン ---

const startLabel = (script) => (script.start ? wrapText(script.start, ACTION_MAX_TEXT, SMALL_FONT_SIZE) : []);

// 受信で始まるスクリプトは、開始の黒丸の代わりに受信の記号（中に帽子の文）を置く
const startsWithReceive = (script) => Boolean(script.receive && script.start);

const measureScript = (script) => {
    const body = measureSeq(script.body);
    const forever = endsForever(script.body);
    const end = forever ? 0 : END_R * 2 + (body.h === 0 ? 0 : GAP);
    if (startsWithReceive(script)) {
        const box = textBox(script.start, RECEIVE_NOTCH);
        return {
            left: Math.max(body.left, END_R, box.w / 2),
            right: Math.max(body.right, END_R, box.w / 2),
            h: box.h + GAP + body.h + end,
            lines: box.lines,
        };
    }
    const lines = startLabel(script);
    const labelRight = lines.length > 0 ? START_R + 6 + linesWidth(lines, SMALL_FONT_SIZE) : START_R;
    return {
        left: Math.max(body.left, END_R, START_R),
        right: Math.max(body.right, END_R, labelRight),
        h: START_R * 2 + GAP + body.h + end,
        lines,
    };
};

const placeScript = (script, cx, y, out) => {
    const size = measureScript(script);
    let top;
    if (startsWithReceive(script)) {
        const box = textBox(script.start, RECEIVE_NOTCH);
        out.shapes.push({
            type: DIAGRAM_SHAPES.RECEIVE,
            x: cx - box.w / 2,
            y,
            w: box.w,
            h: box.h,
            label: script.start,
            lines: box.lines,
            // へこみの向き（送り手のいる側。送り手がいなければ左）と合図の名前
            notch: 'left',
            message: script.receive,
        });
        top = y + box.h;
    } else {
        out.shapes.push({
            type: DIAGRAM_SHAPES.START,
            x: cx - START_R,
            y,
            w: START_R * 2,
            h: START_R * 2,
            label: script.start,
            lines: size.lines,
        });
        top = y + START_R * 2;
    }
    if (script.body.length > 0) {
        arrowInto(out, cx, top, script.body, top + GAP);
        top = placeSeq(script.body, cx, top + GAP, out);
        if (endsForever(script.body)) return;
    }
    addEdge(out, [
        [cx, top],
        [cx, top + GAP],
    ]);
    top += GAP;
    out.shapes.push({ type: DIAGRAM_SHAPES.END, x: cx - END_R, y: top, w: END_R * 2, h: END_R * 2 });
};

// スクリプトの中で送る合図の名前（入れ子の中も）
const sentMessages = (nodes) =>
    nodes.flatMap((node) => {
        if (node.kind === NODE_KINDS.SEND) return node.message === null ? [] : [node.message];
        if (node.kind === NODE_KINDS.DECISION) return [...sentMessages(node.yes), ...sentMessages(node.no)];
        if (node.kind === NODE_KINDS.LOOP) return sentMessages(node.body);
        return [];
    });

const measureTarget = (target, captioned) => {
    const scripts = target.scripts.map(measureScript);
    const width =
        scripts.reduce((sum, s) => sum + s.left + s.right, 0) + SCRIPT_GAP * Math.max(0, scripts.length - 1);
    const captionW = captioned && target.name ? textWidth(target.name, SMALL_FONT_SIZE) : 0;
    return { scripts, w: Math.max(width, captionW) };
};

const measureLane = (lane) => {
    const captioned = lane.targets.length > 1;
    const targets = lane.targets.map((t) => measureTarget(t, captioned));
    return {
        captioned,
        targets,
        w: targets.reduce((sum, t) => sum + t.w, 0) + SCRIPT_GAP * Math.max(0, targets.length - 1),
    };
};

// 縮めてよい下限。いちばん小さい字（11）が 10px より小さくならないところまで
export const MIN_DIAGRAM_SCALE = 10 / SMALL_FONT_SIZE;

/**
 * 図を、決まった幅・高さの中にどれだけ縮めて描くか。縮めるのは下限（`MIN_DIAGRAM_SCALE`）まで。
 * 下限まで縮めても入らないときは `fits: false`（呼ぶ側が、枠の中をスクロールさせるか、図の代わりに案内を出す）。
 * @param {{width: number, height: number}} layout - 置き方。
 * @param {object} box - 入れる場所。
 * @param {number} box.maxWidth - 幅の上限（px）。
 * @param {number} box.maxHeight - 高さの上限（px）。
 * @returns {{scale: number, fits: boolean}} 倍率（1 を超えない）と、下限までで入るか。
 */
export const diagramScaleFor = (layout, { maxWidth, maxHeight }) => {
    const want = Math.min(1, maxWidth / layout.width, maxHeight / layout.height);
    return { scale: Math.max(want, MIN_DIAGRAM_SCALE), fits: want >= MIN_DIAGRAM_SCALE };
};

// スプライト（レーンをまたいで通し番号）どうしの合図のやりとり。合図の名前は大文字と小文字を区別しない
const messageRoutes = (lanes) => {
    const senders = new Map();
    const receivers = new Map();
    const add = (map, message, gi) => {
        const key = messageKey(message);
        if (!map.has(key)) map.set(key, new Set());
        map.get(key).add(gi);
    };
    let gi = 0;
    lanes.forEach((lane) =>
        lane.targets.forEach((target) => {
            target.scripts.forEach((script) => {
                sentMessages(script.body).forEach((message) => add(senders, message, gi));
                if (startsWithReceive(script)) add(receivers, script.receive, gi);
            });
            gi += 1;
        }),
    );
    return { senders, receivers };
};

// 合図をやりとりする相手が左にいるスクリプトを左へ、右にいるスクリプトを右へ寄せる（矢印がほかのスクリプトを
// 横切りにくいように）。どちらでもないものは間。同じ寄せ方どうしは書いた順のまま
const orderScripts = (lanes) => {
    const { senders, receivers } = messageRoutes(lanes);
    let gi = 0;
    return lanes.map((lane) => ({
        ...lane,
        targets: lane.targets.map((target) => {
            const here = gi;
            gi += 1;
            const side = (script) => {
                const partners = [
                    ...sentMessages(script.body).flatMap((m) => Array.from(receivers.get(messageKey(m)) || [])),
                    ...(startsWithReceive(script) ? Array.from(senders.get(messageKey(script.receive)) || []) : []),
                ].filter((p) => p !== here);
                const left = partners.some((p) => p < here);
                const right = partners.some((p) => p > here);
                if (left && !right) return 0;
                if (right && !left) return 2;
                return 1;
            };
            const keyed = target.scripts.map((script, i) => ({ script, i, key: side(script) }));
            keyed.sort((a, b) => a.key - b.key || a.i - b.i);
            return { ...target, scripts: keyed.map((k) => k.script) };
        }),
    }));
};

const centerY = (shape) => shape.y + shape.h / 2;

const shift = (shape, dy) => ({ ...shape, y: shape.y + dy });

const sameMessage = (a, b) => messageKey(a) === messageKey(b);

// 線が避ける範囲。開始の黒丸は横の文まで含める
const obstacleOf = (shape) => {
    if (shape.type === DIAGRAM_SHAPES.START && shape.lines && shape.lines.length > 0) {
        const h = Math.max(shape.h, shape.lines.length * SMALL_LINE_HEIGHT);
        return {
            shape,
            x: shape.x,
            y: shape.y + shape.h / 2 - h / 2,
            w: shape.w + 6 + linesWidth(shape.lines, SMALL_FONT_SIZE),
            h,
        };
    }
    return { shape, x: shape.x, y: shape.y, w: shape.w, h: shape.h };
};

// 縦か横の線分が、範囲の内側（縁から 1 内側）を通るか
const segmentHits = ([ax, ay], [bx, by], r) => {
    const m = 1;
    const x0 = Math.min(ax, bx);
    const x1 = Math.max(ax, bx);
    const y0 = Math.min(ay, by);
    const y1 = Math.max(ay, by);
    return x1 > r.x + m && x0 < r.x + r.w - m && y1 > r.y + m && y0 < r.y + r.h - m;
};

// 折れ線が、両はしの記号（ignore）のほかのどの記号の内側も通らないか
const pathIsFree = (points, obstacles, ignore) =>
    points.every(
        (p, i) => i === 0 || obstacles.every((r) => ignore.includes(r.shape) || !segmentHits(points[i - 1], p, r)),
    );

// 送信のとがった先・受信のへこみの奥。相手が右なら送信は右の辺、受信は左の辺から取る
const sendPoint = (send, right) => [right ? send.x + send.w : send.x, centerY(send)];
const receivePoint = (receive, right) => [
    right ? receive.x + RECEIVE_NOTCH : receive.x + receive.w - RECEIVE_NOTCH,
    centerY(receive),
];

const obstaclesOf = (placed) =>
    placed.flatMap((p) => p.local.shapes.map((shape) => ({ ...obstacleOf(shift(shape, p.dy)), shape })));

// 受信で始まるスクリプトを、送ったスクリプトの送信と同じ高さまで下げる（どのスクリプトも 1 回だけ動かす）。
// まっすぐ横に引いた矢印がほかの記号を横切らない送り手（近いスプライトから順に）にだけそろえる。
// 送り手が先に決まったものから決め、送り手どうしが互いを待つときは、いまの位置で決める
const alignReceivers = (placed) => {
    const resolved = new Set(placed.filter((p) => !p.receive).map((p) => p.index));
    const sendersOf = (entry) =>
        placed.filter((p) => p.gi !== entry.gi && p.sends.some((s) => sameMessage(s.message, entry.receive.message)));
    const resolve = (entry) => {
        const candidates = sendersOf(entry)
            .flatMap((p) =>
                p.sends.filter((s) => sameMessage(s.message, entry.receive.message)).map((send) => ({ p, send })),
            )
            .sort(
                (a, b) =>
                    Math.abs(a.p.gi - entry.gi) - Math.abs(b.p.gi - entry.gi) ||
                    a.p.dy + a.send.y - (b.p.dy + b.send.y),
            );
        const found = candidates.find(({ p, send }) => {
            const dy = p.dy + centerY(send) - centerY(entry.receive);
            if (dy < 0) return false;
            const before = entry.dy;
            entry.dy = dy;
            const right = entry.gi > p.gi;
            const free = pathIsFree(
                [sendPoint(shift(send, p.dy), right), receivePoint(shift(entry.receive, dy), right)],
                // まだ決めていない受信のスクリプトは、このあと下がるので避けない（最後に引く道すじで確かめる）
                obstaclesOf(placed.filter((q) => q === entry || resolved.has(q.index))),
                [send, entry.receive],
            );
            if (!free) entry.dy = before;
            return free;
        });
        if (!found) entry.dy = 0;
        resolved.add(entry.index);
    };
    while (resolved.size < placed.length) {
        const ready = placed.filter(
            (p) => !resolved.has(p.index) && sendersOf(p).every((s) => resolved.has(s.index)),
        );
        if (ready.length === 0) {
            resolve(placed.find((p) => !resolved.has(p.index)));
        } else {
            ready.forEach(resolve);
        }
    }
};

// 合図の矢印の道すじ。まっすぐ → 受け手の手前のすき間で曲げる → 送り手の先のすき間で曲げる → 図の下を回る、
// の順に、両はしの記号のほかの記号の内側を通らないものを選ぶ。すき間（スクリプトの間）を何本も通るときは
// 少しずつずらす
const routeMessage = ({ from, to, send, receive, obstacles, channels, bus }) => {
    const right = to.gi > from.gi;
    const start = sendPoint(send, right);
    const end = receivePoint(receive, right);
    const [, sy] = start;
    const [, ry] = end;
    const half = SCRIPT_GAP / 2;
    // 同じすき間（2px 以内）は同じ道として数える
    const keyOf = (x) => Array.from(channels.keys()).find((k) => Math.abs(k - x) <= 2) ?? Math.round(x);
    const channel = (x) => {
        const used = channels.get(keyOf(x)) || 0;
        const offsets = [0, 5, -5, 9, -9];
        return x + offsets[used % offsets.length];
    };
    const take = (x) => {
        const key = keyOf(x);
        channels.set(key, (channels.get(key) || 0) + 1);
    };
    const nearReceiver = right ? to.x0 - half : to.x1 + half;
    const nearSender = right ? from.x1 + half : from.x0 - half;
    const c2 = channel(nearReceiver);
    const c1 = channel(nearSender);
    const ignore = [send, receive];
    const candidates = [
        ...(Math.abs(sy - ry) < 0.5 ? [{ points: [start, end] }] : []),
        {
            points: [start, [c2, sy], [c2, ry], end],
            use: [nearReceiver],
        },
        {
            points: [start, [c1, sy], [c1, ry], end],
            use: [nearSender],
        },
    ];
    const chosen = candidates.find((c) => pathIsFree(c.points, obstacles, ignore));
    if (chosen) {
        (chosen.use || []).forEach(take);
        return chosen.points;
    }
    // 図の下を回る（下の段は合図ごとに分ける）
    const h = bus.next;
    bus.next += 8;
    take(nearSender);
    take(nearReceiver);
    return [start, [c1, sy], [c1, h], [c2, h], [c2, ry], end];
};

/**
 * 図のモデルに置き方を付ける。
 * @param {object} model - `buildActivityModel` の戻り値（`{lanes}`）。分岐・くり返しのガードはモデルが持つ。
 * @returns {{width: number, height: number, swimlanes: boolean, shapes: Array<object>, edges: Array<object>}}
 *   置き方。shapes の x / y / w / h は記号の外わく、edges は折れ線（`points`）と矢じりの有無（`arrow`）。
 *   送信から受信への矢印は `message: true`。
 */
export const layoutActivityDiagram = (model) => {
    const lanes = orderScripts(model.lanes);
    const swimlanes = lanes.length > 1;
    const sizes = lanes.map(measureLane);
    const headerH = swimlanes ? LANE_HEADER_H : 0;
    const pad = swimlanes ? LANE_PAD : 0;
    const contentTop = MARGIN + headerH + pad;
    const out = { shapes: [], edges: [] };
    const laneShapes = [];
    const placed = [];
    let laneX = MARGIN;
    let gi = 0;
    lanes.forEach((lane, li) => {
        const size = sizes[li];
        const laneW = size.w + pad * 2;
        if (swimlanes) {
            const shape = {
                type: DIAGRAM_SHAPES.LANE,
                x: laneX,
                y: MARGIN,
                w: laneW,
                h: 0,
                label: lane.label || '',
                headerH,
            };
            laneShapes.push(shape);
            out.shapes.push(shape);
        }
        let targetX = laneX + pad;
        lane.targets.forEach((target, ti) => {
            const tsize = size.targets[ti];
            if (size.captioned && target.name) {
                out.shapes.push({
                    type: DIAGRAM_SHAPES.CAPTION,
                    x: targetX,
                    y: contentTop,
                    w: textWidth(target.name, SMALL_FONT_SIZE),
                    h: CAPTION_H - 6,
                    label: target.name,
                });
            }
            const scriptTop = contentTop + (size.captioned ? CAPTION_H : 0);
            let scriptX = targetX;
            target.scripts.forEach((script, si) => {
                const s = tsize.scripts[si];
                const local = { shapes: [], edges: [] };
                placeScript(script, scriptX + s.left, scriptTop, local);
                placed.push({
                    index: placed.length,
                    gi,
                    x0: scriptX,
                    x1: scriptX + s.left + s.right,
                    local,
                    bottom: scriptTop + s.h,
                    dy: 0,
                    receive: local.shapes.find((sh) => sh.type === DIAGRAM_SHAPES.RECEIVE) || null,
                    sends: local.shapes.filter((sh) => sh.type === DIAGRAM_SHAPES.SEND && sh.message !== null),
                });
                scriptX += s.left + s.right + SCRIPT_GAP;
            });
            targetX += tsize.w + SCRIPT_GAP;
            gi += 1;
        });
        laneX += laneW + (swimlanes ? 0 : SCRIPT_GAP);
    });
    alignReceivers(placed);
    // 置いた位置へ動かす。送信・受信の向きはこのあと矢印を引くときに決めるので、動かした記号を覚えておく
    const moved = new Map();
    placed.forEach((p) => {
        p.local.shapes.forEach((shape) => {
            const copy = shift(shape, p.dy);
            moved.set(shape, copy);
            out.shapes.push(copy);
        });
        p.local.edges.forEach((edge) =>
            out.edges.push({ ...edge, points: edge.points.map(([x, y]) => [x, y + p.dy]) }),
        );
    });
    const scriptsBottom = Math.max(contentTop, ...placed.map((p) => p.bottom + p.dy));
    // 送信 → ほかのスプライト・レーンの同じ合図の受信。送信は相手のいる側がとがり、受信は送り手のいる側がへこむ
    // （両側にいれば両側）
    const obstacles = placed.flatMap((p) => p.local.shapes.map((shape) => obstacleOf(moved.get(shape))));
    const channels = new Map();
    // レーンの境目のすき間では、境目の線に重ならないよう、はじめからずらして通す
    laneShapes.forEach((lane) => {
        channels.set(Math.round(lane.x), 1);
        channels.set(Math.round(lane.x + lane.w), 1);
    });
    const bus = { next: scriptsBottom + 12 };
    const sides = new Map();
    const addSide = (shape, side) => {
        if (!sides.has(shape)) sides.set(shape, new Set());
        sides.get(shape).add(side);
    };
    placed.forEach((from) =>
        from.sends.forEach((sendLocal) => {
            const send = moved.get(sendLocal);
            placed
                .filter((to) => to.receive && to.gi !== from.gi && sameMessage(to.receive.message, send.message))
                .forEach((to) => {
                    const receive = moved.get(to.receive);
                    const right = to.gi > from.gi;
                    addSide(send, right ? 'right' : 'left');
                    addSide(receive, right ? 'left' : 'right');
                    const points = routeMessage({ from, to, send, receive, obstacles, channels, bus });
                    out.edges.push({ points, arrow: true, message: true });
                });
        }),
    );
    sides.forEach((set, shape) => {
        const side = set.size > 1 ? 'both' : Array.from(set)[0];
        if (shape.type === DIAGRAM_SHAPES.SEND) shape.direction = side;
        else shape.notch = side;
    });
    const contentBottom = bus.next > scriptsBottom + 12 ? bus.next - 2 : scriptsBottom;
    const contentH = contentBottom - contentTop;
    laneShapes.forEach((shape) => {
        shape.h = headerH + contentH + pad * 2;
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
