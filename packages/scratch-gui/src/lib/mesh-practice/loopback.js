// === Smalruby: This file is Smalruby-specific (mesh practice partner: in-browser loopback) ===
// メッシュの練習相手を、ブラウザの中で折り返して動かす（サーバーには何も出さない）。
// レッスンの練習相手（#1638）の折り返しを、レッスンの外のひとりで使う練習相手（#1845）でも
// 使えるように一般にしたもの。scratch-vm のメッシュの拡張は変えず、拡張が持つ受信の置き場
// （`meshService.remoteData`）・履歴（`recordMessage`）と、拡張・runtime の公開の入口
// （`startMessageHats` / `startHats`）だけを使う:
//
//   相手 → 生徒: 相手の変数は `remoteData[相手のノード ID]` に入れる（本物のメッシュでほかのノードから
//                届いた値と同じ置き場。「センサーの値」がそのまま読み、ドロップダウンにも出る）。
//                相手のメッセージは、本物のメッシュが受け取ったときと同じく「受け取ったとき」を動かす。
//                値つき（#1843）なら、動き出したスクリプトの「メッセージの値」がその値になる。
//   生徒 → 相手: 生徒の作品が動かした「送る」「送って待つ」「といっしょに送る」を vm-execution-hook.js で見て、
//                自動の返事を返す。生徒のグローバル変数の値は、本物のメッシュの #713 と同じく自分のノードの値として
//                `remoteData[meshId]` にも入れる（自分の変数の「センサーの値」が本物と同じに読めるように）。
//   履歴: 送った・受け取ったものを、本物のメッシュと同じ履歴（状態と履歴のウィンドウ #1844）に残す。
//
// 本物のメッシュでつながっている・つなごうとしているあいだは何もしない（practiceAllowed）。
// 外す（detach）と、入れた値と履歴を消し、見張りも外す。外したあとは本物のメッシュに何も残らない。
import { hookOpcodeExecution, resetExecuteCaches } from '../lessons/vm-execution-hook';
import {
    clampValue,
    MAX_PENDING_REPLIES,
    MESH_PRACTICE_PARTNER_NODE_ID,
    practiceAllowed,
    repliesFor,
    REPLY_DELAY_MS,
    sameMessage,
} from './partner';

const SCALAR_TYPE = '';
const BROADCAST_OPCODES = new Set(['event_broadcast', 'event_broadcastandwait', 'meshV2_broadcastWithValue']);
const VARIABLE_OPCODES = new Set(['data_setvariableto', 'data_changevariableby']);
// 同じものが続けて送られた（「ずっと」の中など）ときに、履歴を埋めないための間（本物のメッシュの 1 秒のまとめ送りと同じ）
const HISTORY_DEDUPE_MS = 1000;

// Scratch の Cast.toNumber と同じ（数にできなければ 0）
const toNumber = (value) => {
    if (typeof value === 'number') return Number.isNaN(value) ? 0 : value;
    const n = Number(value);
    return Number.isNaN(n) ? 0 : n;
};

const messageNameOf = (option) => {
    if (option && typeof option === 'object') return typeof option.name === 'string' ? option.name : null;
    return typeof option === 'string' ? option : null;
};

/**
 * 練習相手の折り返しをつなぐ。
 * @param {object} options - 設定。
 * @param {object} options.vm - VM。
 * @param {object} [options.partner] - 練習相手（`{buttons, replies}`）。変わるものなら getPartner を使う。
 * @param {function(): object} [options.getPartner] - いまの練習相手を返す（設定を変えてもつなぎ直さない）。
 * @param {string} [options.nodeId] - 練習相手のノード ID。
 * @param {boolean} [options.recordHistory] - 履歴に残すか（状態と履歴のウィンドウ）。
 * @param {number} [options.replyDelayMs] - 自動の返事までの間。
 * @param {function(): number} [options.now] - 時刻（テスト用）。
 * @param {object} [options.timers] - `{setTimeout, clearTimeout}`（テスト用）。
 * @returns {object} `{press, act, setVariable, syncVariables, detach, isActive}`。
 */
export const attachPracticeLoopback = ({
    vm,
    partner = null,
    getPartner = () => partner,
    nodeId = MESH_PRACTICE_PARTNER_NODE_ID,
    recordHistory = true,
    replyDelayMs = REPLY_DELAY_MS,
    now = () => Date.now(),
    timers = {
        setTimeout: globalThis.setTimeout.bind(globalThis),
        clearTimeout: globalThis.clearTimeout.bind(globalThis),
    },
}) => {
    const runtime = vm.runtime;
    // 待っている返事: メッセージの名前（大文字）→ タイマー。本物のメッシュの fireEvent が、まだ送っていない
    // 同じメッセージをまとめるのに合わせ、同じメッセージの返事は待っているあいだ 1 つだけにする
    const pending = new Map();
    // 自分のノードに入れた値: `ノード ID + 名前` → {nodeId, name, entry}。meshId は、つながっていないあいだにも
    // 出席番号で変わる（setClassroomSeat）ので、書いたときのノード ID を覚えて、そこから消す
    const ownSeeds = new Map();
    // 履歴に入れたもの（消すときに、本物のメッシュの履歴を消さないように、入れたものだけを見分ける）
    const historyEntries = new Set();
    let attached = true;

    const extension = () => (runtime.peripheralExtensions && runtime.peripheralExtensions.meshV2) || null;
    const service = () => {
        const ext = extension();
        return ext && ext.meshService ? ext.meshService : null;
    };
    const allowed = () => {
        const ext = extension();
        return attached && practiceAllowed(ext ? ext.connectionState : null);
    };

    const record = (direction, name, value, from) => {
        const svc = service();
        if (!recordHistory || !svc || typeof svc.recordMessage !== 'function' || !Array.isArray(svc.messageHistory)) {
            return;
        }
        const at = now();
        const last = svc.messageHistory[0];
        if (
            last &&
            historyEntries.has(last) &&
            last.direction === direction &&
            sameMessage(last.name, name) &&
            last.value === value &&
            last.nodeId === from &&
            at - last.at < HISTORY_DEDUPE_MS
        ) {
            return;
        }
        svc.recordMessage({ direction, name, value, nodeId: from, at });
        if (svc.messageHistory[0]) historyEntries.add(svc.messageHistory[0]);
    };

    const partnerNode = (create) => {
        const svc = service();
        if (!svc) return null;
        if (!svc.remoteData[nodeId] && create) svc.remoteData[nodeId] = {};
        return svc.remoteData[nodeId] || null;
    };

    const setPartnerVariables = (set) => {
        if (!Array.isArray(set) || set.length === 0) return;
        const node = partnerNode(true);
        if (!node) return;
        const timestamp = now();
        set.forEach(({ name, value }) => {
            node[name] = { value: clampValue(value), timestamp };
        });
    };

    const receiveBroadcast = (name, value) => {
        const stage = runtime.getTargetForStage && runtime.getTargetForStage();
        const message = stage && name ? stage.lookupBroadcastMsg(null, name) : null;
        record('received', message ? message.name : name, value, nodeId);
        if (!message) return;
        const ext = extension();
        if (ext && typeof ext.startMessageHats === 'function') {
            // 値つきメッセージ（#1843）: 動き出したスクリプトに値を持たせる（値なしは ''）
            ext.startMessageHats(message.name, value, {
                startHats: (opcode, fields) => runtime.startHats(opcode, fields),
            });
            return;
        }
        runtime.startHats('event_whenbroadcastreceived', { BROADCAST_OPTION: message.name });
    };

    // 入れた値と履歴を消す（あとから本物のメッシュが同じ名前に入れた値は消さない）
    const purge = () => {
        const svc = service();
        if (!svc) return;
        delete svc.remoteData[nodeId];
        ownSeeds.forEach(({ nodeId: id, name, entry }) => {
            const node = svc.remoteData[id];
            if (!node) return;
            if (node[name] === entry) delete node[name];
            if (Object.keys(node).length === 0) delete svc.remoteData[id];
        });
        ownSeeds.clear();
        if (historyEntries.size > 0 && Array.isArray(svc.messageHistory)) {
            svc.messageHistory = svc.messageHistory.filter((entry) => !historyEntries.has(entry));
        }
        historyEntries.clear();
    };

    // ボタン・自動の返事のどちらも、set → broadcast の順
    const act = (action) => {
        if (!action) return;
        if (!allowed()) {
            // つなぎ始めたあとに押された・返事のタイマーが来たときは何もせず、入れた値も残さない
            if (attached) purge();
            return;
        }
        setPartnerVariables(action.set);
        if (action.broadcast) receiveBroadcast(action.broadcast, clampValue(action.value));
    };

    const scheduleReplies = (messageName) => {
        const replies = repliesFor(getPartner(), messageName);
        const key = messageName.toUpperCase();
        if (replies.length === 0 || pending.has(key) || pending.size >= MAX_PENDING_REPLIES) return;
        const id = timers.setTimeout(() => {
            pending.delete(key);
            replies.forEach(act);
        }, replyDelayMs);
        pending.set(key, id);
    };

    const ownVariable = (args) => {
        const stage = runtime.getTargetForStage && runtime.getTargetForStage();
        if (!stage || !args.VARIABLE) return null;
        // メッシュの拡張（syncVariable）と同じく、ステージの変数を id か名前で探す
        let variable = stage.lookupVariableById ? stage.lookupVariableById(args.VARIABLE.id) : null;
        if (!variable && stage.lookupVariableByNameAndType) {
            variable = stage.lookupVariableByNameAndType(args.VARIABLE.name, SCALAR_TYPE);
        }
        return variable && variable.type === SCALAR_TYPE ? variable : null;
    };

    const listener = (opcode, args, util) => {
        if (!allowed() || !args) return;
        if (BROADCAST_OPCODES.has(opcode)) {
            // 「送って待つ」は待つあいだ何度も呼ばれる。最初の 1 回だけ（メッシュの拡張と同じ見分け方）
            if (opcode === 'event_broadcastandwait' && util && util.stackFrame && util.stackFrame.startedThreads) {
                return;
            }
            const name = messageNameOf(args.BROADCAST_OPTION);
            if (!name) return;
            const svc = service();
            const value = opcode === 'meshV2_broadcastWithValue' ? clampValue(args.VALUE) : '';
            record('sent', name, value, svc ? svc.meshId : '');
            scheduleReplies(name);
            return;
        }
        if (VARIABLE_OPCODES.has(opcode)) {
            const variable = ownVariable(args);
            const svc = service();
            if (!variable || !svc) return;
            // 見張りはブロックが動く前に呼ばれるので、動いたあとの値をここで出す
            const value =
                opcode === 'data_setvariableto'
                    ? String(args.VALUE)
                    : String(toNumber(variable.value) + toNumber(args.VALUE));
            const id = svc.meshId;
            if (!svc.remoteData[id]) svc.remoteData[id] = {};
            const entry = { value, timestamp: now() };
            svc.remoteData[id][variable.name] = entry;
            ownSeeds.set(`${id}\u0000${variable.name}`, { nodeId: id, name: variable.name, entry });
        }
    };

    const hasLeftovers = () => {
        const svc = service();
        return Boolean(svc && (svc.remoteData[nodeId] || ownSeeds.size > 0 || historyEntries.size > 0));
    };

    // メッシュの拡張は「つないでいる途中」になったことを知らせない。毎フレームの最初（スクリプトが動く前）に
    // 見て、本物のメッシュでつなぎ始めたら、その場で入れた値を消す（「センサーの値」が練習の値を読まないように）
    const onBeforeStep = () => {
        if (attached && !allowed() && hasLeftovers()) purge();
    };

    const unhook = hookOpcodeExecution(runtime, listener);
    resetExecuteCaches(runtime);
    runtime.on('BEFORE_STEP', onBeforeStep);

    return {
        /** @param {number} index - `partner.buttons` の番号。 */
        press: (index) => {
            const current = getPartner();
            const button = current && Array.isArray(current.buttons) ? current.buttons[index] : null;
            if (button) act(button);
        },
        act,
        /**
         * 相手の変数に値を入れる（同じ値でも入れなおした時刻にする。本物のメッシュの #721 と同じ）。
         * @param {string} name - 変数の名前。
         * @param {string} value - 値。
         */
        setVariable: (name, value) => act({ set: [{ name, value }], broadcast: null }),
        /**
         * 相手の変数を、設定にそろえる（値の変わったものだけ時刻を新しくする。無くなったものは消す）。
         * @param {Array<{name: string, value: ?string}>} variables - 値（null = まだ入れていない）。
         */
        syncVariables: (variables) => {
            if (!allowed()) return;
            const wanted = new Map(
                variables.filter((v) => v.value !== null).map((v) => [v.name, clampValue(v.value)]),
            );
            const node = partnerNode(wanted.size > 0);
            if (!node) return;
            const timestamp = now();
            Object.keys(node).forEach((name) => {
                if (!wanted.has(name)) delete node[name];
            });
            wanted.forEach((value, name) => {
                if (!node[name] || node[name].value !== value) node[name] = { value, timestamp };
            });
            const svc = service();
            if (svc && Object.keys(node).length === 0) delete svc.remoteData[nodeId];
        },
        isActive: allowed,
        detach: () => {
            if (!attached) return;
            attached = false;
            unhook();
            runtime.removeListener('BEFORE_STEP', onBeforeStep);
            pending.forEach((id) => timers.clearTimeout(id));
            pending.clear();
            purge();
        },
    };
};
