import { useEffect, useRef } from 'react';
import { PRINT_EVENT } from '../smalruby-console/smalruby-console.jsx';

/**
 * スマホ（MobileGui）では、編集中はステージの欄を幅 0 にして隠している（mobile-gui.css の 3 節）。
 * 日本語タブのコンソールはステージを覆って出るので、そのままでは画面の外にあり、
 * 表示した行も答えの入力欄も見えない（#2551）。
 * そこで、日本語タブのプログラムが行を表示したり答えを待ったりしたら、再生の画面
 * （全画面のステージ）に移して、コンソールと入力欄を見せる。
 */
const CONSOLE_PLAY_VIEW_EVENTS = { print: 'print', question: 'question' };

/**
 * 再生の画面に移すかどうか。
 * - 表示した行: 1 回の実行で 1 度だけ移す。子どもが編集の画面に戻したあとは、
 *   続きの行のたびに引き戻さない。
 * - 答えの待ち: いつも移す。答えはコンソールでしか入れられないため。
 * @param {object} state - いまの状態。
 * @param {string} state.event - `CONSOLE_PLAY_VIEW_EVENTS` のどれか。
 * @param {boolean} state.active - 日本語タブでコンソールを見せているか。
 * @param {boolean} state.isFullScreen - 再生の画面か。
 * @param {boolean} state.openedThisRun - この実行で、もう再生の画面に移したか。
 * @returns {boolean} 移すとき true。
 */
const shouldOpenConsolePlayView = ({ event, active, isFullScreen, openedThisRun }) => {
    if (!active || isFullScreen) return false;
    if (event === CONSOLE_PLAY_VIEW_EVENTS.question) return true;
    return !openedThisRun;
};

/**
 * 日本語タブのプログラムの表示・答えの待ちで、再生の画面に移す。
 * @param {object} options - オプション。
 * @param {?object} options.vm - VM。
 * @param {boolean} options.active - 日本語タブでコンソールを見せているか。
 * @param {boolean} options.isFullScreen - 再生の画面か。
 * @param {Function} options.onOpen - 再生の画面に移す。
 */
const useConsolePlayView = ({ vm, active, isFullScreen, onOpen }) => {
    // リスナーを付け直さずに最新の値を読むため ref に置く
    const stateRef = useRef({ active, isFullScreen, onOpen });
    stateRef.current = { active, isFullScreen, onOpen };
    const openedThisRunRef = useRef(false);

    useEffect(() => {
        const runtime = vm && vm.runtime;
        if (!runtime || typeof runtime.on !== 'function') return () => {};
        const handle = (event) => {
            // PROJECT_RUN_START は最初の tick のあとに出るので、最初の tick の表示はそれより先に来る。
            // 動いているスレッドの数がまだ 0 なら、新しい実行の最初の tick とみなす。
            if (!runtime._nonMonitorThreadCount) openedThisRunRef.current = false;
            const state = stateRef.current;
            if (!shouldOpenConsolePlayView({ ...state, event, openedThisRun: openedThisRunRef.current })) return;
            openedThisRunRef.current = true;
            state.onOpen();
        };
        const handlePrint = () => handle(CONSOLE_PLAY_VIEW_EVENTS.print);
        // stopAll などで質問を取り下げるときは null が来る
        const handleQuestion = (question) => {
            if (question !== null && typeof question !== 'undefined') handle(CONSOLE_PLAY_VIEW_EVENTS.question);
        };
        const handleRunStop = () => {
            openedThisRunRef.current = false;
        };
        runtime.on(PRINT_EVENT, handlePrint);
        runtime.on('QUESTION', handleQuestion);
        runtime.on('PROJECT_RUN_STOP', handleRunStop);
        return () => {
            runtime.removeListener(PRINT_EVENT, handlePrint);
            runtime.removeListener('QUESTION', handleQuestion);
            runtime.removeListener('PROJECT_RUN_STOP', handleRunStop);
        };
    }, [vm]);
};

export { CONSOLE_PLAY_VIEW_EVENTS, shouldOpenConsolePlayView, useConsolePlayView };
