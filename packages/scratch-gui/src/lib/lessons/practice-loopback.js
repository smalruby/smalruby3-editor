// === Smalruby: This file is Smalruby-specific (lesson mesh practice partner: in-browser loopback) ===
// メッシュの練習相手を、ブラウザの中で折り返して動かす（サーバーには何も出さない）。
// scratch-vm のメッシュの拡張は変えず、拡張が持つ受信の置き場（`meshService.remoteData`）と、
// runtime の公開の入口（`startHats`）だけを使う:
//
//   相手 → 生徒: 相手の変数は `remoteData[PRACTICE_PARTNER_NODE_ID]` に入れる（本物のメッシュで
//                ほかのノードから届いた値と同じ置き場。「〜のセンサー値」がそのまま読む）。
//                相手の合図は、本物のメッシュが受け取った合図を流すときと同じく
//                「〜を受け取ったとき」のハットを動かす（作品にその合図が無ければ何もしない）。
//   生徒 → 相手: 生徒の作品が動かした「〜を送る」を vm-execution-hook.js で見て、自動の返事を返す。
//                生徒のグローバル変数の値は、本物のメッシュの #713 と同じく自分のノードの値として
//                `remoteData[meshId]` にも入れる（自分の変数の「〜のセンサー値」が本物と同じに読めるように）。
//
// 本物のメッシュでつながっている・つなごうとしているあいだは何もしない（practiceAllowed）。
// 外す（detach）と、入れた値を remoteData から消し、見張りも外す。外したあとは本物のメッシュに何も残らない。
import { PRACTICE_PARTNER_NODE_ID, practiceAllowed, repliesFor } from './practice-partner';
import { hookOpcodeExecution, resetExecuteCaches } from './vm-execution-hook';

/** 自動の返事を返すまでの間（ms）。本物のメッシュの遅れ（およそ 1 秒）より短く、合図の順が分かる長さ。 */
export const REPLY_DELAY_MS = 500;

const SCALAR_TYPE = '';
const BROADCAST_OPCODES = new Set(['event_broadcast', 'event_broadcastandwait']);
const VARIABLE_OPCODES = new Set(['data_setvariableto', 'data_changevariableby']);

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
 * @param {object} options.partner - `normalizePartner` の結果。
 * @param {number} [options.replyDelayMs] - 自動の返事までの間。
 * @param {function(): number} [options.now] - 時刻（テスト用）。
 * @param {object} [options.timers] - `{setTimeout, clearTimeout}`（テスト用）。
 * @returns {{press: function(number): void, detach: function(): void}} ボタンを押す・外す。
 */
export const attachPracticeLoopback = ({
    vm,
    partner,
    replyDelayMs = REPLY_DELAY_MS,
    now = () => Date.now(),
    timers = {
        setTimeout: globalThis.setTimeout.bind(globalThis),
        clearTimeout: globalThis.clearTimeout.bind(globalThis),
    },
}) => {
    const runtime = vm.runtime;
    const pending = new Set();
    // 自分のノードに入れた値（外すときに、まだ同じものだけを消す）
    const ownSeeds = new Map();
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

    const setPartnerVariables = (set) => {
        const svc = service();
        if (!svc || set.length === 0) return;
        if (!svc.remoteData[PRACTICE_PARTNER_NODE_ID]) svc.remoteData[PRACTICE_PARTNER_NODE_ID] = {};
        const timestamp = now();
        set.forEach(({ name, value }) => {
            svc.remoteData[PRACTICE_PARTNER_NODE_ID][name] = { value, timestamp };
        });
    };

    const receiveBroadcast = (name) => {
        const stage = runtime.getTargetForStage && runtime.getTargetForStage();
        const message = stage && name ? stage.lookupBroadcastMsg(null, name) : null;
        if (!message) return;
        runtime.startHats('event_whenbroadcastreceived', { BROADCAST_OPTION: message.name });
    };

    // ボタン・自動の返事のどちらも、set → broadcast の順
    const act = (action) => {
        if (!allowed()) return;
        setPartnerVariables(action.set);
        if (action.broadcast) receiveBroadcast(action.broadcast);
    };

    const scheduleReplies = (messageName) => {
        repliesFor(partner, messageName).forEach((reply) => {
            const id = timers.setTimeout(() => {
                pending.delete(id);
                act(reply);
            }, replyDelayMs);
            pending.add(id);
        });
    };

    const seedOwnVariable = (args) => {
        const svc = service();
        const stage = runtime.getTargetForStage && runtime.getTargetForStage();
        if (!svc || !stage || !args.VARIABLE) return;
        // メッシュの拡張（syncVariable）と同じく、ステージの変数を id か名前で探す
        let variable = stage.lookupVariableById(args.VARIABLE.id);
        if (!variable) variable = stage.lookupVariableByNameAndType(args.VARIABLE.name, SCALAR_TYPE);
        if (!variable || variable.type !== SCALAR_TYPE) return;
        return variable;
    };

    const listener = (opcode, args, util) => {
        if (!allowed() || !args) return;
        if (BROADCAST_OPCODES.has(opcode)) {
            // 「送って待つ」は待つあいだ何度も呼ばれる。最初の 1 回だけ（メッシュの拡張と同じ見分け方）
            if (opcode === 'event_broadcastandwait' && util && util.stackFrame && util.stackFrame.startedThreads) {
                return;
            }
            const name = messageNameOf(args.BROADCAST_OPTION);
            if (name) scheduleReplies(name);
            return;
        }
        if (VARIABLE_OPCODES.has(opcode)) {
            const variable = seedOwnVariable(args);
            if (!variable) return;
            // 見張りはブロックが動く前に呼ばれるので、動いたあとの値をここで出す
            const value =
                opcode === 'data_setvariableto'
                    ? String(args.VALUE)
                    : String(toNumber(variable.value) + toNumber(args.VALUE));
            const svc = service();
            if (!svc.remoteData[svc.meshId]) svc.remoteData[svc.meshId] = {};
            const entry = { value, timestamp: now() };
            svc.remoteData[svc.meshId][variable.name] = entry;
            ownSeeds.set(variable.name, entry);
        }
    };

    const unhook = hookOpcodeExecution(runtime, listener);
    resetExecuteCaches(runtime);

    return {
        press: (index) => {
            const button = partner.buttons[index];
            if (button) act(button);
        },
        detach: () => {
            if (!attached) return;
            attached = false;
            unhook();
            pending.forEach((id) => timers.clearTimeout(id));
            pending.clear();
            const svc = service();
            if (!svc) return;
            delete svc.remoteData[PRACTICE_PARTNER_NODE_ID];
            const own = svc.remoteData[svc.meshId];
            if (own) {
                ownSeeds.forEach((entry, name) => {
                    if (own[name] === entry) delete own[name];
                });
                if (Object.keys(own).length === 0) delete svc.remoteData[svc.meshId];
            }
            ownSeeds.clear();
        },
    };
};
