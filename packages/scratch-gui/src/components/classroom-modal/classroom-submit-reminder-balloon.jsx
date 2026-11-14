/**
 * 「提出しよう」の吹き出し (#1835)。メニューバーの「提出する」の下（スマホはドロワーの
 * 「提出する」の下）に出す。いつ出すかは containers/classroom-submit-reminder.jsx が決め、
 * ここは見た目・置き場所・消し方だけを持つ。
 *
 * 消し方: × を押す、または吹き出しの外を押す（「提出する」を押したときもふくむ）。
 * どれも「消した」として 10 分後にもう一度出る。音は出さず、揺らさない。
 *
 * メニューバーでは、ほかの操作に重ならない場所を「提出する」の下 56px の中で探す
 * （placeReminderBalloon）。見つからなければ、吹き出しの代わりに「提出する」の右上へ小さな点を出す。
 */
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useSelector } from 'react-redux';
import {
    BALLOON_GAP,
    MAX_BALLOON_SHIFT,
    placeReminderBalloon,
    reminderBalloonColumn,
} from '../../lib/classroom-submit-reminder.js';
import BalloonCloseButton from '../balloon/balloon-close-button.jsx';
import Balloon from '../balloon/balloon.jsx';
import styles from './student-screen-parts.css';

const messages = defineMessages({
    text: {
        defaultMessage: 'Ready to hand in your work? You can send it again later.',
        description:
            'Balloon under the menu bar submit button, shown to a joined student who has not submitted after a while',
        id: 'gui.classroom.submitReminder.text',
    },
    close: {
        defaultMessage: 'Close',
        description: 'Accessible label of the × button that closes the submit reminder balloon',
        id: 'gui.classroom.submitReminder.close',
    },
});

/** メニューバー・ドロワーの「提出する」ボタン（外を押した理由を「提出する」にする）。 */
const SUBMIT_BUTTON_SELECTOR = '[data-testid="classroom-menu-submit"]';
/** 吹き出しを重ねない操作。コードの場所・ステージの絵は操作ではないので重なってよい。 */
const OBSTACLE_SELECTOR = 'button, a[href], input, select, textarea, [role="tab"], [role="button"]';
/** メニューバー（吹き出しはこの下に置く）。 */
const MENU_BAR_SELECTOR = '[class*="menu-bar_menu-bar_"]';
/** 操作を探す点の間隔（px）。縦はいちばん低い操作（リンクの字）、横はいちばん細い操作より細かくする。 */
const SAMPLE_X = 12;
const SAMPLE_Y = 6;
/** タブ・ステージの大きさを切り替えたあと、周りのレイアウトが落ち着くまで待つ（ms）。 */
const SETTLE_MS = 300;

const rectOf = (el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
};

/**
 * 吹き出しを置ける範囲（列 × 上限までの高さ）にある操作だけを集める。画面全部の操作を測らないよう、
 * その範囲を細かい点で調べる（elementsFromPoint）。使えない環境では、列に入る操作だけに絞る。
 * @param {{left: number, right: number, top: number, bottom: number}} area - 調べる範囲
 * @param {HTMLElement} balloon - 吹き出し（数えない）
 * @returns {Array<object>} 操作の箱
 */
const obstaclesIn = (area, balloon) => {
    const found = new Set();
    if (typeof document.elementsFromPoint === 'function') {
        for (let y = area.top; y <= area.bottom; y += SAMPLE_Y) {
            for (let x = area.left; x <= area.right; x += SAMPLE_X) {
                document.elementsFromPoint(x, y).forEach((el) => {
                    const hit = el.closest && el.closest(OBSTACLE_SELECTOR);
                    if (hit && !balloon.contains(hit)) found.add(hit);
                });
            }
        }
    } else {
        document.querySelectorAll(OBSTACLE_SELECTOR).forEach((el) => {
            if (!balloon.contains(el)) found.add(el);
        });
    }
    return [...found]
        .filter((el) => el.getClientRects().length > 0)
        .map(rectOf)
        .filter((r) => r.right > area.left && r.left < area.right && r.bottom > area.top && r.top < area.bottom);
};

/**
 * メニューバーの吹き出しの置き場所を、いまの画面から測って決める。
 * @param {HTMLElement} anchor - 「提出する」を入れた枠
 * @param {HTMLElement} balloon - 吹き出し
 * @returns {?{left: number, top: number, arrowLeft: number}|false} 置く場所。置けなければ null、
 *   測れない（隠れている）ときは false
 */
const measurePlace = (anchor, balloon) => {
    if (!anchor || !balloon || anchor.getClientRects().length === 0) return false;
    const bar = anchor.closest(MENU_BAR_SELECTOR);
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const anchorBox = rectOf(anchor);
    const size = { width: balloon.offsetWidth, height: balloon.offsetHeight };
    const start = rectOf(bar || anchor).bottom;
    const column = reminderBalloonColumn({ anchor: anchorBox, size, viewport });
    const area = {
        left: column.left,
        right: column.right,
        top: start,
        bottom: start + BALLOON_GAP + MAX_BALLOON_SHIFT + size.height,
    };
    return placeReminderBalloon({
        anchor: anchorBox,
        start,
        size,
        obstacles: obstaclesIn(area, balloon),
        viewport,
    });
};

const samePlace = (a, b) =>
    a === b || (!!a && !!b && a.left === b.left && a.top === b.top && a.arrowLeft === b.arrowLeft);

/**
 * @param {object} props - component props
 * @param {string} [props.placement] - 'menu-bar'（ボタンの下に浮かべる）か 'drawer'（ボタンの下に並べる）
 * @param {Function} props.onDismiss - 消したとき。理由（'close' / 'outside' / 'submit'）を渡す
 * @returns {React.ReactElement} the balloon
 */
const ClassroomSubmitReminderBalloon = ({ placement = 'menu-bar', onDismiss }) => {
    const intl = useIntl();
    const ref = useRef(null);
    const dotRef = useRef(null);
    const onDismissRef = useRef(onDismiss);
    onDismissRef.current = onDismiss;
    const floating = placement !== 'drawer';
    // false = まだ測っていない、null = 置ける場所が無い（点を出す）
    const [place, setPlace] = useState(false);
    const compact = floating && place === null;
    const activeTab = useSelector((state) => state.scratchGui.editorTab && state.scratchGui.editorTab.activeTabIndex);
    const stageSize = useSelector((state) => state.scratchGui.stageSize && state.scratchGui.stageSize.stageSize);

    // 測るのは、出したとき・画面の大きさを変えたとき・タブやステージの大きさを切り替えたときだけ
    // （周りの操作が動くのはこのときだけなので、毎秒は測らない）。
    const update = useCallback(() => {
        // 親（「提出する」を入れた枠）を基準に測る。親の ref は子の layout effect より後に付くので使わない。
        const balloon = ref.current;
        const next = measurePlace(balloon && balloon.parentElement, balloon);
        if (next === false) return;
        setPlace((prev) => (samePlace(prev, next) ? prev : next));
    }, []);

    useLayoutEffect(() => {
        if (!floating) return;
        update();
        const settle = setTimeout(update, SETTLE_MS);
        return () => clearTimeout(settle);
    }, [floating, update, activeTab, stageSize]);

    useEffect(() => {
        if (!floating) return;
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, [floating, update]);

    // 外を押したら消す。見えていない吹き出し（スマホでは隠れているメニューバー側）は何もしない。
    useEffect(() => {
        const handlePointerDown = (e) => {
            const el = (compact ? dotRef : ref).current;
            if (!el || el.getClientRects().length === 0) return;
            // 画面の外（閉じたドロワーの中・測る前）にあるときも、見えていないので何もしない。
            const r = el.getBoundingClientRect();
            if (r.right <= 0 || r.left >= window.innerWidth || r.bottom <= 0 || r.top >= window.innerHeight) return;
            if (ref.current && ref.current.contains(e.target)) return;
            const onSubmit = e.target && e.target.closest && e.target.closest(SUBMIT_BUTTON_SELECTOR);
            onDismissRef.current(onSubmit ? 'submit' : 'outside');
        };
        document.addEventListener('pointerdown', handlePointerDown, true);
        return () => document.removeEventListener('pointerdown', handlePointerDown, true);
    }, [compact]);

    const handleClose = useCallback((e) => {
        e.stopPropagation();
        onDismissRef.current('close');
    }, []);
    // 吹き出しの中を押しても、メニューバーのクラスのボタン（クラスの画面を開く）に伝えない。
    const stop = useCallback((e) => e.stopPropagation(), []);
    const text = intl.formatMessage(messages.text);

    return (
        <React.Fragment>
            <div
                ref={ref}
                aria-hidden={compact ? 'true' : null}
                className={classNames(
                    styles.submitReminder,
                    floating ? styles.submitReminderMenuBar : styles.submitReminderDrawer,
                    { [styles.submitReminderHidden]: compact },
                )}
                data-placement={placement}
                data-testid={compact ? null : 'classroom-submit-reminder'}
                style={floating && place ? { left: `${place.left}px`, top: `${place.top}px` } : null}
                onClick={stop}
            >
                <Balloon
                    arrowSide="bottom"
                    arrowStyle={floating && place ? { left: `${place.arrowLeft}px` } : null}
                    className={styles.submitReminderBalloon}
                    role={compact ? null : 'status'}
                >
                    <span className={styles.submitReminderText}>{text}</span>
                    <BalloonCloseButton
                        label={intl.formatMessage(messages.close)}
                        testId="classroom-submit-reminder-close"
                        title={intl.formatMessage(messages.close)}
                        onClick={handleClose}
                    />
                </Balloon>
            </div>
            {compact ? (
                <span
                    ref={dotRef}
                    className={styles.submitReminderDot}
                    data-testid="classroom-submit-reminder-dot"
                    role="status"
                    title={text}
                >
                    <span className={styles.visuallyHidden}>{text}</span>
                </span>
            ) : null}
        </React.Fragment>
    );
};

ClassroomSubmitReminderBalloon.propTypes = {
    onDismiss: PropTypes.func.isRequired,
    placement: PropTypes.oneOf(['menu-bar', 'drawer']),
};

export default ClassroomSubmitReminderBalloon;
