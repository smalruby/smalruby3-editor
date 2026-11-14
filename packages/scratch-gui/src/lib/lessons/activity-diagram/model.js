// アクティビティ図のモデル（記号の木）を、VM 形式のブロックから作る純粋関数。
// docs/lessons/design.md の「アクティビティ図」: 記号は 開始・終了・処理・分岐・合流・くり返し。
// モデルは置き方（layout.js）と別にしておき、右クリックで描く（#1647）でも同じモデルを使えるようにする。
//
// モデルの形:
//   {lanes: [{id, label, targets: [{name, scripts: [{start, body}]}]}]}
//   start = 帽子のブロックの文（帽子が無いスクリプトは null）、body = 記号の並び:
//     {kind: 'action', label}
//     {kind: 'decision', label, yes: [...], no: [...]}   （もし〜なら・もし〜なら〜でなければ。合流は描く側が足す）
//     {kind: 'loop', label, forever, body: [...]}       （くり返し・ずっと・〜までくり返す）
//   lane = スイムレーン（label が null なら見出しを描かない）。target = スプライトごとのプログラム。
import { createBlockLabeler } from './labels';

export const NODE_KINDS = Object.freeze({
    ACTION: 'action',
    DECISION: 'decision',
    LOOP: 'loop',
});

// くり返しの opcode → 条件の付け方
const LOOPS = {
    control_repeat: {
        forever: false,
        label: (l, blocks, id) => l.format('repeat', { times: timesOf(l, blocks, id) }),
    },
    control_forever: { forever: true, label: (l) => l.format('forever') },
    control_repeat_until: {
        forever: false,
        label: (l, blocks, id) => l.format('repeatUntil', { condition: l.condition(blocks, id) }),
    },
};

const timesOf = (l, blocks, id) => {
    const input = blocks[id].inputs && blocks[id].inputs.TIMES;
    return l.value(blocks, input ? input.block || input.shadow : null);
};

const substackOf = (block, name) => {
    const input = block.inputs && block.inputs[name];
    return input ? input.block : null;
};

// 1 本の並び（next でつながったブロック）を記号の並びにする
const sequence = (l, blocks, firstId, seen) => {
    const nodes = [];
    let id = firstId;
    while (id && blocks[id] && !seen.has(id)) {
        seen.add(id);
        nodes.push(nodeOf(l, blocks, id, seen));
        id = blocks[id].next;
    }
    return nodes;
};

const nodeOf = (l, blocks, id, seen) => {
    const block = blocks[id];
    if (block.opcode === 'control_if' || block.opcode === 'control_if_else') {
        return {
            kind: NODE_KINDS.DECISION,
            label: l.format('decision', { condition: l.condition(blocks, id) }),
            yes: sequence(l, blocks, substackOf(block, 'SUBSTACK'), seen),
            no: block.opcode === 'control_if_else' ? sequence(l, blocks, substackOf(block, 'SUBSTACK2'), seen) : [],
        };
    }
    const loop = LOOPS[block.opcode];
    if (loop) {
        return {
            kind: NODE_KINDS.LOOP,
            label: loop.label(l, blocks, id),
            forever: loop.forever,
            body: sequence(l, blocks, substackOf(block, 'SUBSTACK'), seen),
        };
    }
    return { kind: NODE_KINDS.ACTION, label: l.statement(blocks, id) };
};

/**
 * 1 つのスプライトのブロックを、スクリプト（帽子のブロックから始まる並び）ごとのモデルにする。
 * 並びは変換の出力の順（Ruby に書いた順）。
 * @param {object} blocks - id → VM 形式のブロック（`converter.blocks`）。
 * @param {object} labeler - `createBlockLabeler` の戻り値。
 * @returns {Array<{start: ?string, body: Array<object>}>} スクリプト。
 */
export const scriptsOf = (blocks, labeler) => {
    const all = blocks || {};
    const seen = new Set();
    return Object.keys(all)
        .filter((id) => all[id].topLevel && !all[id].shadow)
        .map((id) => {
            const start = labeler.hat(all, id);
            if (start === null) return { start: null, body: sequence(labeler, all, id, seen) };
            seen.add(id);
            return { start, body: sequence(labeler, all, all[id].next, seen) };
        });
};

/**
 * レーン（自分・相手）とスプライトごとのブロックから、図のモデルを作る。
 * @param {object} input - もとのデータ。
 * @param {Array<object>} input.lanes - `[{id, label, targets: [{name, blocks}]}]`。blocks の代わりに
 *   `scripts`（作り済みのスクリプト。練習相手のレーン）を持ってもよい。
 * @param {object} options - 文の作り方（`createBlockLabeler` と同じ `format` / `blockName`）。
 * @returns {object} モデル（上の形）。
 */
export const buildActivityModel = ({ lanes }, options) => {
    const labeler = createBlockLabeler(options);
    return {
        lanes: lanes.map(({ id, label = null, targets }) => ({
            id,
            label,
            targets: targets.map((target) => ({
                name: target.name || null,
                scripts: target.scripts || scriptsOf(target.blocks, labeler),
            })),
        })),
    };
};

const textOf = (value) => (typeof value === 'string' || typeof value === 'number' ? String(value) : null);

/**
 * 練習相手の定義（チャレンジの `partner`。#1638・docs/lessons/design.md の「メッシュの練習相手」）から相手の
 * レーンを作る。定義はデータだけ:
 * `{name, buttons: [{label, set, broadcast}], replies: [{onBroadcast, set, broadcast}]}`。
 * `set` は共有する変数を変える `{variable, value}`（複数なら配列）、`broadcast` は送る合図の名前。
 * ボタンは「〜」ボタンを押したとき、自動の返事は `onBroadcast` の合図を受け取ったときを開始にし、
 * `set`（〜を〜にする）→ `broadcast`（〜を送る）の順の処理にする。描くものが無い・定義が無いときは null
 * （自分のレーンだけを描く）。
 * @param {?object} partner - 練習相手の定義。
 * @param {object} options - 文の作り方。
 * @param {function(string, object=): string} options.format - 文言を引く関数。
 * @returns {?object} レーン（`{id: 'partner', label, targets}`）。
 */
export const partnerLane = (partner, { format }) => {
    if (!partner || typeof partner !== 'object') return null;
    const l = createBlockLabeler({ format });
    const quote = (text) => l.format('literal', { text });
    // 値は、数ならそのまま、文字なら「」で囲む（ブロックの値の書き方と同じ）
    const valueText = (value) => {
        const text = textOf(value);
        if (text === null || text === '') return l.format('empty');
        return /^-?\d+(\.\d+)?$/.test(text) ? text : quote(text);
    };
    const setActions = (set) =>
        (Array.isArray(set) ? set : [set])
            .filter((one) => one && typeof one === 'object' && textOf(one.variable) !== null)
            .map((one) => ({
                kind: NODE_KINDS.ACTION,
                label: l.format('setVariable', { variable: textOf(one.variable), value: valueText(one.value) }),
            }));
    const actionsOf = (rule) => [
        ...setActions(rule.set),
        ...(textOf(rule.broadcast) === null
            ? []
            : [{ kind: NODE_KINDS.ACTION, label: l.format('broadcast', { name: quote(textOf(rule.broadcast)) }) }]),
    ];
    const buttons = (Array.isArray(partner.buttons) ? partner.buttons : [])
        .filter((button) => button && textOf(button.label) !== null)
        .map((button) => ({
            start: l.format('hat.partnerButton', { label: textOf(button.label) }),
            body: actionsOf(button),
        }));
    const replies = (Array.isArray(partner.replies) ? partner.replies : [])
        .filter((reply) => reply && textOf(reply.onBroadcast) !== null)
        .map((reply) => ({
            start: l.format('hat.receive', { name: quote(textOf(reply.onBroadcast)) }),
            body: actionsOf(reply),
        }));
    const scripts = [...buttons, ...replies];
    if (scripts.length === 0) return null;
    return {
        id: 'partner',
        label: textOf(partner.name) || '',
        targets: [{ name: null, scripts }],
    };
};

const describeNodes = (nodes, guards) =>
    nodes
        .map((node) => {
            if (node.kind === NODE_KINDS.DECISION) {
                const branch = (label, body) => `${label}: ${body.length > 0 ? describeNodes(body, guards) : '-'}`;
                return `${node.label}（${branch(guards.yes, node.yes)} / ${branch(guards.no, node.no)}）`;
            }
            if (node.kind === NODE_KINDS.LOOP) {
                return node.body.length > 0 ? `${node.label}（${describeNodes(node.body, guards)}）` : node.label;
            }
            return node.label;
        })
        .join(' → ');

/**
 * 図の流れを文にする（スクリーンリーダー向けの代わりの文。SVG の `<desc>`）。スクリプトごとに 1 行で、
 * 「開始の文 → 処理 → …」。分岐は「条件（はい: … / いいえ: …）」、くり返しは「くり返しの文（…）」。
 * レーンの名前と（スプライトが 2 つ以上なら）スプライトの名前を行の頭に書く。
 * @param {object} model - `buildActivityModel` の戻り値。
 * @param {object} guards - 分岐の文言 `{yes, no}`。
 * @returns {string} 代わりの文（行は改行で区切る）。
 */
export const describeActivityModel = (model, guards) =>
    model.lanes
        .flatMap((lane) =>
            lane.targets.flatMap((target) =>
                target.scripts.map((script) => {
                    // スプライトの名前は、図と同じくスプライトが 2 つ以上のときだけ書く
                    const head = [lane.label, lane.targets.length > 1 ? target.name : null]
                        .filter(Boolean)
                        .join(' / ');
                    const steps = [script.start, describeNodes(script.body, guards)].filter(Boolean).join(' → ');
                    return head ? `${head}: ${steps}` : steps;
                }),
            ),
        )
        .join('\n');

/**
 * モデルのスクリプトの数（0 なら図を描かない）。
 * @param {object} model - `buildActivityModel` の戻り値。
 * @returns {number} スクリプトの数。
 */
export const countScripts = (model) =>
    model.lanes.reduce((sum, lane) => sum + lane.targets.reduce((n, t) => n + t.scripts.length, 0), 0);
