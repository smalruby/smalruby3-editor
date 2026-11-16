// メッシュの練習相手のコンテナ。いまのチャレンジに `partner` があるあいだ、パネルを出し、
// ブラウザの中での折り返し（lib/lessons/practice-loopback.js）をつなぐ。
//   - チャレンジを開くとパネルを開いた状態で出す（本物のメッシュでつながっていれば閉じて出す。ペアが基本）。
//   - パネルを閉じる・本物のメッシュでつながる（つなごうとする）と、折り返しを外す。外すと本物のメッシュに何も残らない。
//   - パネルは document.body への portal で、コードエリアの右上（ステージの列のすぐ左）に重ねる。
//     ステージの列は動かさないので、課題バーの resize の決まり（docs/lessons/design.md）には当たらない。
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { connect } from 'react-redux';
import LessonPracticePartner from '../components/lesson-practice-partner/lesson-practice-partner.jsx';
import { attachPracticeLoopback } from '../lib/lessons/practice-loopback';
import { arrivalSummary, normalizePartner, pushArrival } from '../lib/lessons/practice-partner';
import { PRACTICE_OWNER_CHANGED } from '../lib/mesh-practice/loopback';
import { practiceAllowed } from '../lib/mesh-practice/partner';
import { getCurrentChallenge } from '../reducers/lesson-mode';

const STAGE_SELECTOR = '[class*="stage_stage-wrapper_"]';
// 新しく届いた行を光らせる時間（ms。pp3）
export const ARRIVAL_FLASH_MS = 1000;
// ステージの列とパネルのあいだ（px）
const GAP = 8;

const meshConnectionState = (vm) => {
    const ext = vm && vm.runtime && vm.runtime.peripheralExtensions && vm.runtime.peripheralExtensions.meshV2;
    return ext ? ext.connectionState : null;
};

/**
 * パネルを置く場所（fixed の top / right）。ステージの列が見つからなければ右上の既定。
 * @returns {{top: number, right: number}} 置く場所。
 */
export const measurePartnerPosition = () => {
    const stage = typeof document === 'undefined' ? null : document.querySelector(STAGE_SELECTOR);
    if (!stage) return { top: 96, right: GAP };
    const rect = stage.getBoundingClientRect();
    return { top: Math.round(rect.top + GAP), right: Math.round(window.innerWidth - rect.left + GAP) };
};

const LessonPracticePartnerContainer = ({ challengeId = null, locale, partnerDef = null, vm }) => {
    const partner = useMemo(() => normalizePartner(partnerDef, locale), [partnerDef, locale]);
    const [open, setOpen] = useState(true);
    const [meshFree, setMeshFree] = useState(() => practiceAllowed(meshConnectionState(vm)));
    const [position, setPosition] = useState(null);
    // 相手に届いたもの（D3。「〜に届いた」に新しいものから 3 行。practice-loopback.js の onReceived）と、
    // いま光らせている行の id（pp3）、読み上げる文（合図が届いたときだけ更新する）。チャレンジが変わったら消す
    const [arrivals, setArrivals] = useState([]);
    const [flashId, setFlashId] = useState(null);
    const [announcement, setAnnouncement] = useState('');
    const nextArrivalIdRef = useRef(0);
    const handleReceived = useCallback((arrival, { announce }) => {
        nextArrivalIdRef.current += 1;
        const id = nextArrivalIdRef.current;
        setArrivals((list) => pushArrival(list, { ...arrival, id }));
        setFlashId(id);
        // 同じ合図が続けて届いたときも読み上げ直すよう、同じ文なら見えない文字を付け外しして中身を変える
        if (announce) {
            const text = arrivalSummary(arrival);
            setAnnouncement((prev) => (prev === text ? `${text}\u200b` : text));
        }
    }, []);
    useEffect(() => {
        if (flashId === null) return () => {};
        const timer = setTimeout(() => setFlashId(null), ARRIVAL_FLASH_MS);
        return () => clearTimeout(timer);
    }, [flashId]);
    const loopRef = useRef(null);

    // チャレンジが変わったら開いた状態にもどす（本物のメッシュでつながっていれば閉じて出す）
    useEffect(() => {
        setOpen(practiceAllowed(meshConnectionState(vm)));
        setArrivals([]);
        setFlashId(null);
        setAnnouncement('');
    }, [challengeId, vm]);

    // 本物のメッシュのつながり。つながったらパネルを閉じる
    useEffect(() => {
        if (!vm || !vm.runtime) return () => {};
        const update = () => {
            const free = practiceAllowed(meshConnectionState(vm));
            setMeshFree(free);
            if (!free) setOpen(false);
        };
        update();
        vm.runtime.on('PERIPHERAL_CONNECTED', update);
        vm.runtime.on('PERIPHERAL_DISCONNECTED', update);
        return () => {
            vm.runtime.removeListener('PERIPHERAL_CONNECTED', update);
            vm.runtime.removeListener('PERIPHERAL_DISCONNECTED', update);
        };
    }, [vm]);

    const active = Boolean(partner && open && meshFree && vm);

    // 折り返しをつなぐ・外す。同じ練習相手を使うチャレンジ（4-1〜4-3）に移ったときも、チャレンジごとにつなぎ
    // 直す（前のチャレンジで届いたもの・覚えた値を持ち越さない）
    // ほかの練習相手（ひとりで使う練習相手）がまだつないでいると、共通の部品はつながず null を返す。
    // その相手が外れたら（PRACTICE_OWNER_CHANGED）つなぎ直す
    useEffect(() => {
        if (!active) return () => {};
        let loop = null;
        let attaching = false;
        const tryAttach = () => {
            // つなぐときにも PRACTICE_OWNER_CHANGED が出るので、その中では何もしない
            if (loop || attaching) return;
            attaching = true;
            loop = attachPracticeLoopback({ vm, partner, onReceived: handleReceived });
            attaching = false;
            loopRef.current = loop;
        };
        tryAttach();
        vm.runtime.on(PRACTICE_OWNER_CHANGED, tryAttach);
        return () => {
            vm.runtime.removeListener(PRACTICE_OWNER_CHANGED, tryAttach);
            if (loop) loop.detach();
            if (loopRef.current === loop) loopRef.current = null;
        };
    }, [active, challengeId, handleReceived, partner, vm]);

    // 置く場所（ステージの大きさを変えると列の左端が動くので、resize と列の大きさの変化で測り直す）
    useEffect(() => {
        if (!partner || typeof window === 'undefined') return () => {};
        const update = () => setPosition(measurePartnerPosition());
        update();
        window.addEventListener('resize', update);
        const stage = document.querySelector(STAGE_SELECTOR);
        const observer = stage && typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
        if (observer) observer.observe(stage);
        return () => {
            window.removeEventListener('resize', update);
            if (observer) observer.disconnect();
        };
    }, [partner]);

    const handlePress = useCallback((index) => {
        if (loopRef.current) loopRef.current.press(index);
    }, []);
    const handleClose = useCallback(() => setOpen(false), []);
    const handleOpen = useCallback(() => setOpen(true), []);

    if (!partner || !meshFree || typeof document === 'undefined') return null;
    return ReactDOM.createPortal(
        <LessonPracticePartner
            buttons={partner.buttons}
            name={partner.name}
            onClose={handleClose}
            onOpen={handleOpen}
            onPress={handlePress}
            open={open}
            position={position}
            announcement={announcement}
            arrivals={arrivals}
            flashId={flashId}
        />,
        document.body,
    );
};

LessonPracticePartnerContainer.propTypes = {
    challengeId: PropTypes.string,
    locale: PropTypes.string.isRequired,
    // チャレンジの `partner`（データだけの定義。lib/lessons/practice-partner.js）
    partnerDef: PropTypes.object,
    vm: PropTypes.object,
};

const mapStateToProps = (state) => {
    const current = getCurrentChallenge(state);
    return {
        challengeId: current ? current.challenge.id : null,
        locale: state.locales.locale,
        partnerDef: current ? current.challenge.partner || null : null,
        vm: state.scratchGui.vm,
    };
};

export { LessonPracticePartnerContainer };
export default connect(mapStateToProps)(LessonPracticePartnerContainer);
