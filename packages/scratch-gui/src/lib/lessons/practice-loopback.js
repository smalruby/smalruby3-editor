// === Smalruby: This file is Smalruby-specific (lesson mesh practice partner: in-browser loopback) ===
// レッスンの練習相手（チャレンジの `partner`）を、メッシュの練習相手の共通の折り返し
// （lib/mesh-practice/loopback.js）につなぐ。折り返しそのもの（相手の変数・合図・自動の返事・
// 自分のノードの値・本物のメッシュでつなぎ始めたら消す・外したら何も残さない）は共通の部品が行い、
// ここはレッスンだけのことを足す:
//
//   - `owner: 'lesson'` でつなぐ。ひとりで使う練習相手（#1845）は、そのあいだ自動で休む。
//     ほかの練習相手がもうつないでいれば、つながない（null を返す）。
//   - 相手に届いたもの（最後の合図・相手が使う名前の共有する変数の値）を、フレームに 1 回までに
//     まとめて `onReceived` でパネルに知らせる（D3。パネルは 2 行まで出す）。
//   - 送った・受け取ったものは、本物のメッシュと同じ「状態と履歴」のウィンドウの履歴にも残す
//     （相手は「相手（練習相手）」と出る）。外すと、残したものも消す。
import { attachPracticeLoopback as attachSharedLoopback } from '../mesh-practice/loopback';
import { REPLY_DELAY_MS } from '../mesh-practice/partner';
import { findName, PRACTICE_PARTNER_NODE_ID, partnerNames, receivedSummary } from './practice-partner';

/** レッスンの練習相手としてつなぐときの名前（共通の部品の owner）。 */
export const LESSON_OWNER = 'lesson';

/**
 * 練習相手の折り返しをつなぐ。
 * @param {object} options - 設定。
 * @param {object} options.vm - VM。
 * @param {object} options.partner - `normalizePartner` の結果。
 * @param {number} [options.replyDelayMs] - 自動の返事までの間。
 * @param {function(): number} [options.now] - 時刻（テスト用）。
 * @param {object} [options.timers] - `{setTimeout, clearTimeout}`（テスト用）。
 * @param {?function(?string, {announce: boolean}): void} [options.onReceived] - 相手に届いたもの
 *   （`receivedSummary`。パネルに 2 行まで出す）が変わったときに、フレームに 1 回まで呼ぶ。`announce` は
 *   合図が届いて変わったとき true（読み上げは合図のときだけにする）。
 * @returns {?{press: function(number): void, detach: function(): void}} ボタンを押す・外す。
 *   ほかの練習相手がつないでいれば null。
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
    onReceived = null,
}) => {
    const runtime = vm.runtime;
    // 相手に届いたもの（D3）: 最後に届いたもの（合図か、相手が使う名前の変数）と、共有する変数の名前 → 最後の値。
    // 知らせるのはフレームの最初（BEFORE_STEP）にまとめて 1 回まで（ずっと変数を変えるスクリプトでも、
    // パネルを毎回描き直さない）
    const names = partnerNames(partner);
    const received = { last: null, values: {} };
    let receivedLine = null;
    let receivedDirty = false;
    let messageArrived = false;

    const onStudentAction = ({ kind, name, value }) => {
        if (kind === 'message') {
            received.last = { kind: 'message', name };
            messageArrived = true;
        } else {
            // 値はいつも覚える（合図と同じ名前の変数の値として出すため）。行の主役にするのは相手が使う名前だけ
            received.values[name] = value;
            if (findName(names, name) !== null) received.last = { kind: 'variable', name };
        }
        receivedDirty = true;
    };

    const loop = attachSharedLoopback({
        vm,
        partner,
        nodeId: PRACTICE_PARTNER_NODE_ID,
        owner: LESSON_OWNER,
        recordHistory: true,
        replyDelayMs,
        now,
        timers,
        onStudentAction,
    });
    if (!loop) return null;

    const flushReceived = () => {
        if (!receivedDirty) return;
        receivedDirty = false;
        const announce = messageArrived;
        messageArrived = false;
        const line = receivedSummary(received);
        if (line === receivedLine) return;
        receivedLine = line;
        if (onReceived) onReceived(line, { announce });
    };
    runtime.on('BEFORE_STEP', flushReceived);

    let attached = true;
    return {
        press: loop.press,
        detach: () => {
            if (!attached) return;
            attached = false;
            runtime.removeListener('BEFORE_STEP', flushReceived);
            loop.detach();
        },
    };
};
