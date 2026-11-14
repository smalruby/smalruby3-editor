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
 * 練習相手の定義（チャレンジの `partner`。#1638）から相手のレーンを作る。定義はデータだけ:
 * `{name, buttons: [{label, send}], replies: [{receive, send}]}`。ボタンを押したとき・合図を受け取ったときに
 * 合図を送る、の 2 種類だけを描く。描くものが無い・定義が無いときは null（自分のレーンだけを描く）。
 * @param {?object} partner - 練習相手の定義。
 * @param {object} options - 文の作り方。
 * @param {function(string, object=): string} options.format - 文言を引く関数。
 * @returns {?object} レーン（`{id: 'partner', label, targets}`）。
 */
export const partnerLane = (partner, { format }) => {
    if (!partner || typeof partner !== 'object') return null;
    const l = createBlockLabeler({ format });
    const quote = (text) => l.format('literal', { text });
    const sendActions = (send) =>
        textOf(send) === null
            ? []
            : [{ kind: NODE_KINDS.ACTION, label: l.format('broadcast', { name: quote(send) }) }];
    const buttons = (Array.isArray(partner.buttons) ? partner.buttons : [])
        .filter((button) => button && textOf(button.label) !== null)
        .map((button) => ({
            start: l.format('hat.partnerButton', { label: textOf(button.label) }),
            body: sendActions(button.send),
        }));
    const replies = (Array.isArray(partner.replies) ? partner.replies : [])
        .filter((reply) => reply && textOf(reply.receive) !== null)
        .map((reply) => ({
            start: l.format('hat.receive', { name: quote(textOf(reply.receive)) }),
            body: sendActions(reply.send),
        }));
    const scripts = [...buttons, ...replies];
    if (scripts.length === 0) return null;
    return {
        id: 'partner',
        label: textOf(partner.name) || '',
        targets: [{ name: null, scripts }],
    };
};
