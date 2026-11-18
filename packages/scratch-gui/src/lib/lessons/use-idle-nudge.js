// 手が止まったときに「ヒント」を光らせるかを決める hook（判定は idle-nudge.js の純粋関数）。
// 変化は VM のイベントで知る（毎フレームの処理はしない。イベントでは時刻を覚えるだけ）:
//   - プログラム: PROJECT_CHANGED（ブロックの追加・移動・値の変更）・workspaceUpdate（スプライトの切りかえなど）
//   - ステージ: targetsUpdate（スプライトの位置・見た目・数。1 フレームに 1 回まで）・PROJECT_RUN_START（実行）・
//     SAY（言う・考える）
// 光らせる時刻にタイマーを 1 つだけ置き、来たら判定し直す（変化があればその時刻から数え直す）。
// 光っているあいだに何か操作したら（押す・キー・プログラムやステージの変化）止め、そこからまた数える。
import { useEffect, useRef, useState } from 'react';
import { nextNudgeCheckIn, shouldNudgeHint } from './idle-nudge';

const VM_EVENTS = ['PROJECT_CHANGED', 'targetsUpdate', 'workspaceUpdate'];
const RUNTIME_EVENTS = ['PROJECT_RUN_START', 'SAY'];
const OPERATIONS = ['pointerdown', 'keydown', 'wheel'];

/**
 * @param {object} args - 引数。
 * @param {?object} args.vm - VM。
 * @param {boolean} args.enabled - レッスンモードでチャレンジを開いているか。
 * @param {boolean} args.hintAvailable - ヒントのあるチャレンジか。
 * @param {boolean} args.hintVisible - ヒントの吹き出しを大きく出しているか。
 * @param {boolean} [args.blocked] - 「できた！」などが出ているか（そのあいだは光らせない）。
 * @param {string} [args.resetKey] - 変わったら数え直すもの（チャレンジ・ヒントのページ・小さくしたか）。
 * @param {number} [args.idleMs] - 光らせるまでの時間（ms。テスト用）。
 * @returns {boolean} 光らせるか。
 */
export const useIdleNudge = ({ vm, enabled, hintAvailable, hintVisible, blocked = false, resetKey = '', idleMs }) => {
    const [nudge, setNudge] = useState(false);
    const lastChangeRef = useRef(Date.now());
    const lastDismissRef = useRef(null);

    useEffect(() => {
        lastChangeRef.current = Date.now();
        lastDismissRef.current = null;
        // 前の条件で光っていたものは消して数え直す
        setNudge(false);
        if (!enabled) return () => {};
        let timer = null;
        let nudging = false;
        const args = () => ({
            now: Date.now(),
            lastChangeAt: lastChangeRef.current,
            lastDismissAt: lastDismissRef.current,
            hintAvailable,
            hintVisible,
            blocked,
            ...(typeof idleMs === 'number' ? { idleMs } : {}),
        });
        const evaluate = () => {
            if (timer !== null) clearTimeout(timer);
            timer = null;
            const current = args();
            const should = shouldNudgeHint(current);
            if (should !== nudging) {
                nudging = should;
                setNudge(should);
            }
            // ヒントが無い・読んでいる・ほかの表示のあいだは、変わるまで待たない（deps が変わればやり直す）
            if (!should && hintAvailable && !hintVisible && !blocked) {
                timer = setTimeout(evaluate, nextNudgeCheckIn(current));
            }
        };
        const onChange = () => {
            lastChangeRef.current = Date.now();
            if (nudging) evaluate();
        };
        const onOperate = () => {
            if (!nudging) return;
            lastDismissRef.current = Date.now();
            evaluate();
        };
        const runtime = vm && vm.runtime;
        if (vm && typeof vm.on === 'function') VM_EVENTS.forEach((name) => vm.on(name, onChange));
        if (runtime && typeof runtime.on === 'function') RUNTIME_EVENTS.forEach((name) => runtime.on(name, onChange));
        OPERATIONS.forEach((name) => document.addEventListener(name, onOperate, true));
        evaluate();
        return () => {
            if (timer !== null) clearTimeout(timer);
            if (vm && typeof vm.removeListener === 'function') {
                VM_EVENTS.forEach((name) => vm.removeListener(name, onChange));
            }
            if (runtime && typeof runtime.removeListener === 'function') {
                RUNTIME_EVENTS.forEach((name) => runtime.removeListener(name, onChange));
            }
            OPERATIONS.forEach((name) => document.removeEventListener(name, onOperate, true));
        };
    }, [vm, enabled, hintAvailable, hintVisible, blocked, resetKey, idleMs]);

    return nudge;
};
