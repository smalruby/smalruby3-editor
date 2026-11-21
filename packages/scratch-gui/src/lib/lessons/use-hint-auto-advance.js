// ヒントのページを、そのページの操作ができたら自分で次へ進める hook（`autoAdvanceHints` のレッスン）と、
// まちがった場所での操作にすぐ一言を出す hook（チャレンジの `wrongPlaceTip`）。判定は hint-advance.js の純粋関数。
// エディタの様子は VM を読むだけで集める（Blockly のメソッドは包まない・呼ばない）:
//   - パレット / スクリプトエリアで押したブロック: vm-execution-hook.js（goal-monitor と同じ。スレッドの始まりで
//     パレットかを分ける describeThread）
//   - 置いたブロック・つながり・値・絵・スプライト・背景: takeHintObservation（300ms ごと）
//   - 指しているものを押した: document の pointerdown（capture。読むだけで止めない）
import { useEffect, useRef, useState } from 'react';
import { describeThread } from './goal-monitor';
import { canAutoAdvance, isStepAdvanced, isWrongPlaceClick, takeHintObservation } from './hint-advance';
import { findHintFocusElement } from './hint-targets';
import { hookOpcodeExecution, isExecutionHooked, resetExecuteCaches } from './vm-execution-hook';

const CHECK_INTERVAL_MS = 300;

// 白いところに数を入れている・▼ のメニューを開いているあいだは進めない（入れ終わる前に吹き出しが次の
// ページへ動くと、何を押せばよいかわからなくなる）
const isEditingField = (doc) => {
    if (!doc) return false;
    if (doc.querySelector('.blocklyHtmlInput')) return true;
    const dropdown = doc.querySelector('.blocklyDropDownDiv');
    if (!dropdown) return false;
    const r = dropdown.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
};

/**
 * @param {object} args - 引数。
 * @param {?object} args.vm - VM。
 * @param {?{lesson: object, challenge: object}} args.current - いまのチャレンジ（getCurrentChallenge）。
 * @param {?object} args.hint - getCurrentHint の値。
 * @param {?string} args.activeTab - いまのタブ（'code' / 'costumes' / 'sounds'）。
 * @param {Function} args.onNext - 次のページへ進める。
 * @param {Function} args.onShow - 小さくした・閉じた吹き出しを出す（まちがった場所の一言を見せる）。
 * @returns {?object} まちがった場所の一言（message descriptor）。出していなければ null。
 */
export const useHintAutoAdvance = ({ vm, current, hint, activeTab, onNext, onShow }) => {
    const [tip, setTip] = useState(null);
    const lesson = current ? current.lesson : null;
    const challenge = current ? current.challenge : null;
    const challengeId = challenge ? challenge.id || '' : null;
    const wrongPlaceTip = challenge ? challenge.wrongPlaceTip : null;
    const hasWrongPlaceTip = Boolean(wrongPlaceTip);
    const autoAdvance = Boolean(lesson && lesson.autoAdvanceHints);
    const session = hint ? hint.session : null;
    const index = hint ? hint.index : null;
    const pageKey = `${session}:${index}`;

    // 押したもの（チャレンジを開き直したら数え直す）
    const paletteClicksRef = useRef([]);
    const focusClicksRef = useRef(0);
    // 最新の値（listener と interval から読む）
    const latest = useRef({});
    latest.current = { hint, activeTab, onNext, onShow, lesson, challenge, wrongPlaceTip, vm };

    useEffect(() => {
        paletteClicksRef.current = [];
        focusClicksRef.current = 0;
    }, [session]);

    // ページが変わったら一言を消す
    useEffect(() => setTip(null), [pageKey]);

    // ブロックの実行（パレットで押した・スクリプトエリアで押した）
    useEffect(() => {
        if (!vm || !vm.runtime || challengeId === null || (!autoAdvance && !hasWrongPlaceTip)) return () => {};
        const runtime = vm.runtime;
        const seen = new WeakSet();
        const hooked = isExecutionHooked(runtime);
        const unhook = hookOpcodeExecution(runtime, (opcode, args, util) => {
            const thread = util && util.thread;
            if (!thread || thread.updateMonitor || seen.has(thread)) return;
            seen.add(thread);
            const { trigger } = describeThread(thread, runtime);
            const run = { opcode: trigger.hat, stackClick: trigger.stackClick, palette: trigger.palette };
            if (run.palette) {
                paletteClicksRef.current = [...paletteClicksRef.current, run.opcode];
                setTip(null);
            }
            const l = latest.current;
            if (isWrongPlaceClick(l.wrongPlaceTip, run)) {
                setTip(l.wrongPlaceTip.message);
                if (l.hint && !l.hint.visible && l.onShow) l.onShow();
            }
        });
        // 見張りを包む前に取られた関数を作り直させる（goal-monitor がもう包んでいれば要らない）
        if (!hooked) resetExecuteCaches(runtime);
        return unhook;
        // チャレンジ（の id）ごとに付け直す（チャレンジの値は latest から読む）
    }, [vm, challengeId, autoAdvance, hasWrongPlaceTip]);

    // 指しているもの（ページの focus）を押した
    useEffect(() => {
        if (!autoAdvance || typeof document === 'undefined') return () => {};
        const onPointerDown = (e) => {
            const h = latest.current.hint;
            const focus = h && h.step ? h.step.focus : null;
            if (!focus) return;
            const el = findHintFocusElement(focus, document);
            if (el && e.target && el.contains(e.target)) focusClicksRef.current += 1;
        };
        document.addEventListener('pointerdown', onPointerDown, true);
        return () => document.removeEventListener('pointerdown', onPointerDown, true);
    }, [autoAdvance]);

    // ページを出したときの様子と、できたら次へ
    useEffect(() => {
        if (!autoAdvance || !vm || !hint || session === null) return () => {};
        const observe = () =>
            takeHintObservation(vm, {
                activeTab: latest.current.activeTab,
                paletteClicks: paletteClicksRef.current,
                focusClicks: focusClicksRef.current,
            });
        const base = observe();
        let advanced = false;
        const timer = window.setInterval(() => {
            const l = latest.current;
            if (advanced || !l.challenge) return;
            if (!canAutoAdvance({ lesson: l.lesson, hint: l.hint, stepCount: l.challenge.steps.length })) return;
            if (isEditingField(document)) return;
            if (isStepAdvanced(l.hint.step.advanceOn, observe(), base)) {
                advanced = true;
                l.onNext();
            }
        }, CHECK_INTERVAL_MS);
        return () => window.clearInterval(timer);
        // ページ（session と index）ごとに様子を取り直す（ほかの値は latest から読む）
    }, [autoAdvance, vm, pageKey]);

    return tip;
};
