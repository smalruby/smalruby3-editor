// アクティビティ図のモデル（記号の木）を、VM 形式のブロックから作る純粋関数。
// docs/lessons/design.md の「アクティビティ図」: 記号は教科書のアクティビティ図にそろえる（開始・終了・処理・
// 分岐と合流のひし形・送信・受信）。くり返しは、ひし形の合流と戻る線で描く（置き方は layout.js）。
// モデルは置き方（layout.js）と別にしておき、右クリックで描く（#1647）でも同じモデルを使えるようにする。
//
// モデルの形:
//   {lanes: [{id, label, targets: [{name, scripts: [{start, receive, body}]}]}]}
//   start = 帽子のブロックの文（帽子が無いスクリプトは null）。receive = 「〜を受け取ったとき」なら合図の名前
//   （図では開始の黒丸の代わりに受信の記号で始める）、ほかは null。body = 記号の並び:
//     {kind: 'action', label}
//     {kind: 'send', label, message}                    （〜を送る・〜を送って待つ。message は合図の名前か null）
//     {kind: 'decision', label, yesGuard, noGuard, yes: [...], no: [...]}
//         （もし〜なら・もし〜なら〜でなければ。ガードは枝に書く「[条件]」。合流は描く側が足す）
//     {kind: 'loop', label, forever, continueGuard, exitGuard, body: [...]}
//         （くり返し・ずっと・〜までくり返す。ずっとはガードが null）
//   lane = スイムレーン（label が null なら見出しを描かない）。target = スプライトごとのプログラム。
import { normalizePartner } from '../practice-partner';
import { createBlockLabeler } from './labels';

export const NODE_KINDS = Object.freeze({
    ACTION: 'action',
    SEND: 'send',
    DECISION: 'decision',
    LOOP: 'loop',
});

// 合図を送るブロック（教科書の「送信」の記号で描く）。メッシュの合図もふつうの「〜を送る」で送るので、
// 値つきで送るブロックなどができたら、ここに足す（opcode → 合図の名前の入力）
const SEND_OPCODES = {
    event_broadcast: 'BROADCAST_INPUT',
    event_broadcastandwait: 'BROADCAST_INPUT',
};

// 合図の名前（▼のメニューで選んだもの）。穴に式を入れたときは名前が決まらないので null
const messageOf = (blocks, block, inputName) => {
    const input = block.inputs && block.inputs[inputName];
    // 穴にシャドウ（メニュー）だけがあるときは block と shadow が同じ id
    const menu =
        input && input.shadow && (!input.block || input.block === input.shadow) ? blocks[input.shadow] : null;
    if (!menu || !menu.fields) return null;
    const names = Object.keys(menu.fields);
    return names.length > 0 ? String(menu.fields[names[0]].value) : null;
};

// くり返しの opcode → 条件の付け方
// くり返しは、ひし形の合流から「続ける」枝（continue）と「ぬける」枝（exit）に分ける。ガードはその枝に書く文
const LOOPS = {
    control_repeat: {
        forever: false,
        label: (l, blocks, id) => l.format('repeat', { times: timesOf(l, blocks, id) }),
        guards: (l, blocks, id) => ({
            continueGuard: l.format('otherwise'),
            exitGuard: l.format('guard', { condition: l.format('repeatDone', { times: timesOf(l, blocks, id) }) }),
        }),
    },
    control_forever: {
        forever: true,
        label: (l) => l.format('forever'),
        guards: () => ({ continueGuard: null, exitGuard: null }),
    },
    control_repeat_until: {
        forever: false,
        label: (l, blocks, id) => l.format('repeatUntil', { condition: l.condition(blocks, id) }),
        guards: (l, blocks, id) => guardsOf(l, l.condition(blocks, id), 'exit'),
    },
};

// 条件の文から、条件に合う枝・合わない枝のガードを作る。合わない枝は UML の [else] と同じく「[それ以外]」
// （「〜ではない」と書くと「触れたではない」のような文になるため）
const guardsOf = (l, condition, when) => {
    const yes = l.format('guard', { condition });
    const no = l.format('otherwise');
    return when === 'exit' ? { continueGuard: no, exitGuard: yes } : { yesGuard: yes, noGuard: no };
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
        const condition = l.condition(blocks, id);
        return {
            kind: NODE_KINDS.DECISION,
            label: l.format('decision', { condition }),
            ...guardsOf(l, condition, 'branch'),
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
            ...loop.guards(l, blocks, id),
            body: sequence(l, blocks, substackOf(block, 'SUBSTACK'), seen),
        };
    }
    if (SEND_OPCODES[block.opcode]) {
        return {
            kind: NODE_KINDS.SEND,
            label: l.statement(blocks, id),
            message: messageOf(blocks, block, SEND_OPCODES[block.opcode]),
        };
    }
    return { kind: NODE_KINDS.ACTION, label: l.statement(blocks, id) };
};

// 「〜を受け取ったとき」の合図の名前（ほかの帽子は null）
const receiveOf = (block) =>
    block.opcode === 'event_whenbroadcastreceived' && block.fields && block.fields.BROADCAST_OPTION
        ? String(block.fields.BROADCAST_OPTION.value)
        : null;

/**
 * 1 つのスプライトのブロックを、スクリプト（帽子のブロックから始まる並び）ごとのモデルにする。
 * 並びは変換の出力の順（Ruby に書いた順）。
 * @param {object} blocks - id → VM 形式のブロック（`converter.blocks`）。
 * @param {object} labeler - `createBlockLabeler` の戻り値。
 * @returns {Array<{start: ?string, receive: ?string, body: Array<object>}>} スクリプト。
 */
export const scriptsOf = (blocks, labeler) => {
    const all = blocks || {};
    const seen = new Set();
    return Object.keys(all)
        .filter((id) => all[id].topLevel && !all[id].shadow)
        .map((id) => {
            const start = labeler.hat(all, id);
            if (start === null) return { start: null, receive: null, body: sequence(labeler, all, id, seen) };
            seen.add(id);
            return { start, receive: receiveOf(all[id]), body: sequence(labeler, all, all[id].next, seen) };
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

/**
 * 練習相手の定義（チャレンジの `partner`。#1638・docs/lessons/design.md の「メッシュの練習相手」）から相手の
 * レーンを作る。定義はデータだけ:
 * `{name, buttons: [{label, set, broadcast}], replies: [{onBroadcast, set, broadcast}]}`。
 * `set` は共有する変数を変える `{variable, value}`（複数なら配列。`value` が `{fromVariable}` なら「(名前)の値」と
 * 書く）、`broadcast` は送る合図の名前。
 * 定義は動かすとき（練習のパネル）と同じ `normalizePartner` で読む。locale ごとの書き方（`{ja, 'ja-Hira', en}`）も
 * 同じ選び方で選び、動かすときに使わない行（ラベルの無いボタン、名前の無い変数・`fromVariable`、何もしない返事）は
 * 図にも描かない。
 * ボタンは「〜」ボタンを押したとき、自動の返事は `onBroadcast` の合図を受け取ったとき（受信の記号）を開始にし、
 * `set`（〜を〜にする）→ `broadcast`（〜を送る。送信の記号）の順にする。描くものが無い・定義が無いときは null
 * （自分のレーンだけを描く）。
 * @param {?object} partner - 練習相手の定義。
 * @param {object} options - 文の作り方。
 * @param {function(string, object=): string} options.format - 文言を引く関数。
 * @param {?string} [options.locale] - いまの locale（locale ごとに書いた名前を選ぶ）。
 * @returns {?object} レーン（`{id: 'partner', label, targets}`）。
 */
export const partnerLane = (partner, { format, locale = null }) => {
    const normalized = normalizePartner(partner, locale);
    if (!normalized) return null;
    const l = createBlockLabeler({ format });
    const quote = (text) => l.format('literal', { text });
    // 値は、数ならそのまま、文字なら「」で囲む（ブロックの値の書き方と同じ）。生徒の変数の値は「(名前)の値」
    const valueText = (one) => {
        if (typeof one.fromVariable === 'string') return l.format('variableValue', { name: one.fromVariable });
        const text = one.value;
        if (text === '') return l.format('empty');
        return /^-?\d+(\.\d+)?$/.test(text) ? text : quote(text);
    };
    const actionsOf = (rule) => [
        ...rule.set.map((one) => ({
            kind: NODE_KINDS.ACTION,
            label: l.format('setVariable', { variable: one.name, value: valueText(one) }),
        })),
        ...(rule.broadcast === null
            ? []
            : [
                  {
                      kind: NODE_KINDS.SEND,
                      label: l.format('broadcast', { name: quote(rule.broadcast) }),
                      message: rule.broadcast,
                  },
              ]),
    ];
    const scripts = [
        ...normalized.buttons.map((button) => ({
            start: l.format('hat.partnerButton', { label: button.label }),
            receive: null,
            body: actionsOf(button),
        })),
        ...normalized.replies.map((reply) => ({
            start: l.format('hat.receive', { name: quote(reply.onBroadcast) }),
            receive: reply.onBroadcast,
            body: actionsOf(reply),
        })),
    ];
    return {
        id: 'partner',
        label: normalized.name,
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
