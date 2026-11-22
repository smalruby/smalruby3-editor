// Studuino の練習用の基板のパネルのコンテナ（#2192・E7 = A / E8 = A）。
//   - Studuino の拡張機能を読みこむと VM が状態を 1 回送る（STUDUINO_PRACTICE_BOARD_STATE）。その状態があるあいだだけパネルを出す。
//   - 状態が変わるたびにイベントで受け取って描き直す。センサーの値は拡張機能の setPracticeSensorValue で変える（ほかの値は書かない）。
//   - たたんだ状態は端末に覚える（localStorage・try/catch）。
//   - 置き場所: コードエリアの右上（ステージの列のすぐ左）に重ねる。レッスンの練習相手のパネル（同じ場所に出る）が
//     出ているときは、その左に並べて重ならないようにする。ステージの列の下（スプライトの情報）はヒントが指すので使わない。
//   - コードのタブと Ruby のタブだけで出す（コスチューム・音のタブではエディタの道具に重なるため出さない）。
//     小さい画面（MobileGui）には置かない（gui.jsx の desktop の木にだけ置く）。
//   - Studuino モードでは、Studuino モードの練習用の基板（入出力の設定で割り当てた部品だけ・#2355）を出す。
//     ［旗のスクリプトを試す］で旗のスクリプトをブラウザで動かす（緑の旗は書きこみのまま）。
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useIntl } from 'react-intl';
import { connect } from 'react-redux';
import StuduinoModePracticeBoard from '../components/studuino-practice-board/studuino-mode-practice-board.jsx';
import StuduinoPracticeBoard from '../components/studuino-practice-board/studuino-practice-board.jsx';
import log from '../lib/log';
import RubyToBlocksConverterHOC from '../lib/ruby-to-blocks-converter-hoc.jsx';
import { BLOCKS_TAB_INDEX, RUBY_TAB_INDEX } from '../reducers/editor-tab';
import { getCurrentChallenge } from '../reducers/lesson-mode';
import { isStuduinoMode } from '../reducers/studuino-mode';

export const STATE_EVENT = 'STUDUINO_PRACTICE_BOARD_STATE';
export const STUDUINO_MODE_STATE_EVENT = 'STUDUINO_MODE_PRACTICE_STATE';
export const EXTENSION_ID = 'smalrubotS1';
export const OPEN_STORAGE_KEY = 'smalruby:studuinoPracticeBoardOpen';
// タッチセンサーの値（Studuino のタッチセンサーは押すと 0、はなすと 1）
export const TOUCH_PRESSED_VALUE = 0;
export const TOUCH_RELEASED_VALUE = 1;

const STAGE_SELECTOR = '[class*="stage_stage-wrapper_"]';
// レッスンの練習相手のパネル（ひらいた・たたんだ）
const PARTNER_SELECTOR = '[data-testid="lesson-practice-partner"], [data-testid="lesson-practice-partner-open"]';
// ステージの列・練習相手のパネルとのあいだ（px）
const GAP = 8;

/**
 * たたんだかどうかを読む（既定はひらく）。
 * @returns {boolean} ひらいているなら true。
 */
export const loadOpen = () => {
    try {
        return typeof window === 'undefined' || !window.localStorage
            ? true
            : window.localStorage.getItem(OPEN_STORAGE_KEY) !== 'false';
    } catch (e) {
        return true;
    }
};

const saveOpen = (open) => {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(OPEN_STORAGE_KEY, String(open));
        }
    } catch (e) {
        // 覚えられなくても動く（プライベートウィンドウなど）
    }
};

/**
 * パネルを置く場所（fixed の top / right）。ステージの列のすぐ左、練習相手のパネルがあればその左。
 * @returns {{top: number, right: number}} 置く場所。
 */
export const measureBoardPosition = () => {
    if (typeof document === 'undefined') return { top: 96, right: GAP };
    const stage = document.querySelector(STAGE_SELECTOR);
    const partner = document.querySelector(PARTNER_SELECTOR);
    const top = stage ? Math.round(stage.getBoundingClientRect().top + GAP) : 96;
    let left = stage ? stage.getBoundingClientRect().left : window.innerWidth;
    if (partner) left = Math.min(left, partner.getBoundingClientRect().left);
    return { top, right: Math.round(window.innerWidth - left + GAP) };
};

const getExtension = (vm) =>
    (vm && vm.runtime && vm.runtime.peripheralExtensions && vm.runtime.peripheralExtensions[EXTENSION_ID]) || null;

const initialState = (vm) => {
    if (!vm || !vm.runtime) return null;
    const ext = getExtension(vm);
    if (ext && typeof ext.getPracticeBoardState === 'function') return ext.getPracticeBoardState();
    return vm.runtime.studuinoPracticeBoardState || null;
};

const initialStuduinoModeState = (vm) => {
    if (!vm || !vm.runtime) return null;
    const ext = getExtension(vm);
    if (ext && typeof ext.getStuduinoPracticeState === 'function') return ext.getStuduinoPracticeState();
    return vm.runtime.studuinoModePracticeState || null;
};

const StuduinoPracticeBoardContainer = ({
    editorVisible = true,
    partnerKey = null,
    studuinoMode = false,
    targetCodeToBlocks = null,
    vm,
}) => {
    const intl = useIntl();
    const [boardState, setBoardState] = useState(() => initialState(vm));
    const [studuinoState, setStuduinoState] = useState(() => initialStuduinoModeState(vm));
    const [open, setOpen] = useState(loadOpen);
    const [position, setPosition] = useState(null);
    // タッチセンサーを「はなした」値にそろえたか（拡張機能を読みこんだ直後は 0 = 押した、になっているため）
    const touchReadyRef = useRef(false);

    useEffect(() => {
        if (!vm || !vm.runtime) return () => {};
        const handleState = (state) => setBoardState(state);
        setBoardState(initialState(vm));
        vm.runtime.on(STATE_EVENT, handleState);
        return () => vm.runtime.removeListener(STATE_EVENT, handleState);
    }, [vm]);

    useEffect(() => {
        if (!vm || !vm.runtime) return () => {};
        const handleState = (state) => setStuduinoState(state);
        setStuduinoState(initialStuduinoModeState(vm));
        vm.runtime.on(STUDUINO_MODE_STATE_EVENT, handleState);
        return () => vm.runtime.removeListener(STUDUINO_MODE_STATE_EVENT, handleState);
    }, [vm]);

    const setStuduinoInput = useCallback(
        (port, value) => {
            const ext = getExtension(vm);
            if (ext && typeof ext.setStuduinoPracticeInput === 'function') ext.setStuduinoPracticeInput(port, value);
        },
        [vm],
    );

    // ［旗のスクリプトを試す］: 緑の旗と同じく Ruby の変更をブロックにしてから、旗のスクリプトを VM で動かす
    const handleTry = useCallback(async () => {
        if (!vm) return;
        try {
            if (targetCodeToBlocks) {
                const converter = await targetCodeToBlocks(intl);
                if (!converter.result) return;
                await converter.apply();
            }
            if (typeof vm.start === 'function') vm.start();
            vm.greenFlag();
        } catch (e) {
            log.error('Failed to try the flag script on the practice board:', e);
        }
    }, [intl, targetCodeToBlocks, vm]);

    const setSensor = useCallback(
        (port, value) => {
            const ext = getExtension(vm);
            if (ext && typeof ext.setPracticeSensorValue === 'function') ext.setPracticeSensorValue(port, value);
        },
        [vm],
    );

    // 練習用の基板のタッチセンサーは、はじめ「はなした」値にする（押すと 0 の Studuino と同じ向きで練習できるように）。
    // パネルを出したときに 1 回だけ（生徒がボタンで変えたあとは触らない）
    useEffect(() => {
        if (touchReadyRef.current || !boardState || boardState.mode !== 'practice') return;
        touchReadyRef.current = true;
        if (boardState.sensors && boardState.sensors.A2 === 0) setSensor('A2', TOUCH_RELEASED_VALUE);
    }, [boardState, setSensor]);

    const studuinoVisible = Boolean(studuinoMode && studuinoState);
    const visible = Boolean((studuinoVisible || boardState) && editorVisible);

    // 置く場所（ステージの大きさ・窓の大きさ・練習相手のパネルが出る/たたむで測り直す）
    useEffect(() => {
        if (!visible || typeof window === 'undefined') return () => {};
        const update = () => setPosition(measureBoardPosition());
        update();
        // 練習相手のパネルは同じときに portal で描かれるので、描かれたあとにも測る
        const timer = setTimeout(update, 0);
        window.addEventListener('resize', update);
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
        if (observer) {
            const stage = document.querySelector(STAGE_SELECTOR);
            const partner = document.querySelector(PARTNER_SELECTOR);
            if (stage) observer.observe(stage);
            if (partner) observer.observe(partner);
        }
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', update);
            if (observer) observer.disconnect();
        };
    }, [visible, partnerKey, open]);

    const handleTouch = useCallback(
        (pressed) => setSensor('A2', pressed ? TOUCH_PRESSED_VALUE : TOUCH_RELEASED_VALUE),
        [setSensor],
    );
    const handleClose = useCallback(() => {
        setOpen(false);
        saveOpen(false);
    }, []);
    const handleOpen = useCallback(() => {
        setOpen(true);
        saveOpen(true);
    }, []);

    if (!visible || typeof document === 'undefined') return null;
    if (studuinoVisible) {
        return ReactDOM.createPortal(
            <StuduinoModePracticeBoard
                boardState={studuinoState}
                onClose={handleClose}
                onInputChange={setStuduinoInput}
                onOpen={handleOpen}
                onTry={handleTry}
                open={open}
                position={position}
            />,
            document.body,
        );
    }
    return ReactDOM.createPortal(
        <StuduinoPracticeBoard
            boardState={boardState}
            onClose={handleClose}
            onOpen={handleOpen}
            onSensorChange={setSensor}
            onTouch={handleTouch}
            open={open}
            position={position}
            touchPressedValue={TOUCH_PRESSED_VALUE}
        />,
        document.body,
    );
};

StuduinoPracticeBoardContainer.propTypes = {
    // コード・Ruby のタブで、ステージを全画面にしていないとき true
    editorVisible: PropTypes.bool,
    // 練習相手のパネルが変わったら置く場所を測り直すためのキー（いまのチャレンジの id。相手がいなければ null）
    partnerKey: PropTypes.string,
    // Studuino モードか（Studuino モードの練習用の基板を出す）
    studuinoMode: PropTypes.bool,
    // Ruby の変更をブロックにする（RubyToBlocksConverterHOC が渡す）
    targetCodeToBlocks: PropTypes.func,
    vm: PropTypes.object,
};

const mapStateToProps = (state) => {
    const tab = state.scratchGui.editorTab.activeTabIndex;
    const mode = state.scratchGui.mode;
    const current = getCurrentChallenge(state);
    return {
        editorVisible:
            (tab === BLOCKS_TAB_INDEX || tab === RUBY_TAB_INDEX) && !mode.isFullScreen && !mode.isPlayerOnly,
        partnerKey: current && current.challenge.partner ? current.challenge.id : null,
        studuinoMode: isStuduinoMode(state),
        vm: state.scratchGui.vm,
    };
};

export { StuduinoPracticeBoardContainer };
export default RubyToBlocksConverterHOC(connect(mapStateToProps)(StuduinoPracticeBoardContainer));
