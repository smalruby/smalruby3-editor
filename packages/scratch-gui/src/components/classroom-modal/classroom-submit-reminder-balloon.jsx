/**
 * 「提出しよう」の吹き出し (#1835)。メニューバーの「提出する」の下（スマホはドロワーの
 * 「提出する」の下）に出す。いつ出すかは containers/classroom-submit-reminder.jsx が決め、
 * ここは見た目と消し方だけを持つ。
 *
 * 消し方: × を押す、または吹き出しの外を押す（「提出する」を押したときもふくむ）。
 * どれも「消した」として 10 分後にもう一度出る。音は出さず、揺らさない。
 */
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { placeReminderBalloon } from '../../lib/classroom-submit-reminder.js';
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
/** 置き直す間隔。タブの切り替え・ステージの大きさの切り替えで周りの操作が動くため。 */
const REPLACE_MS = 1000;

const rectOf = (el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
};

/**
 * メニューバーの吹き出しの置き場所を、いまの画面から測って決める。
 * @param {HTMLElement} anchor - 「提出する」を入れた枠
 * @param {HTMLElement} balloon - 吹き出し
 * @returns {?{left: number, top: number, arrowLeft: number}} 置く場所
 */
const measurePlace = (anchor, balloon) => {
    if (!anchor || !balloon || anchor.getClientRects().length === 0) return null;
    const bar = anchor.closest(MENU_BAR_SELECTOR);
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const obstacles = [...document.querySelectorAll(OBSTACLE_SELECTOR)]
        .filter((el) => !balloon.contains(el) && el.getClientRects().length > 0)
        .map(rectOf)
        .filter((r) => r.right > r.left && r.bottom > r.top && r.bottom > 0 && r.top < viewport.height);
    return placeReminderBalloon({
        anchor: rectOf(anchor),
        start: rectOf(bar || anchor).bottom,
        size: { width: balloon.offsetWidth, height: balloon.offsetHeight },
        obstacles,
        viewport,
    });
};

/**
 * @param {object} props - component props
 * @param {string} [props.placement] - 'menu-bar'（ボタンの下に浮かべる）か 'drawer'（ボタンの下に並べる）
 * @param {object} [props.anchorRef] - メニューバーの「提出する」を入れた枠（置き場所を測る）
 * @param {Function} props.onDismiss - 消したとき。理由（'close' / 'outside' / 'submit'）を渡す
 * @returns {React.ReactElement} the balloon
 */
const ClassroomSubmitReminderBalloon = ({ placement = 'menu-bar', anchorRef = null, onDismiss }) => {
    const intl = useIntl();
    const ref = useRef(null);
    const onDismissRef = useRef(onDismiss);
    onDismissRef.current = onDismiss;
    const floating = placement !== 'drawer';
    const [place, setPlace] = useState(null);

    // メニューバーでは、ほかの操作に重ならない場所を測って置く（画面の大きさ・言語で変わる）。
    useLayoutEffect(() => {
        if (!floating) return;
        const update = () => {
            const next = measurePlace(anchorRef && anchorRef.current, ref.current);
            setPlace((prev) =>
                next && prev && prev.left === next.left && prev.top === next.top && prev.arrowLeft === next.arrowLeft
                    ? prev
                    : next,
            );
        };
        update();
        const timer = setInterval(update, REPLACE_MS);
        window.addEventListener('resize', update);
        return () => {
            clearInterval(timer);
            window.removeEventListener('resize', update);
        };
    }, [floating, anchorRef]);

    // 外を押したら消す。見えていない吹き出し（スマホでは隠れているメニューバー側）は何もしない。
    useEffect(() => {
        const handlePointerDown = (e) => {
            const el = ref.current;
            if (!el || el.getClientRects().length === 0) return;
            // 画面の外（閉じたドロワーの中など）にあるときも、見えていないので何もしない。
            const r = el.getBoundingClientRect();
            if (r.right <= 0 || r.left >= window.innerWidth || r.bottom <= 0 || r.top >= window.innerHeight) return;
            if (el.contains(e.target)) return;
            const onSubmit = e.target && e.target.closest && e.target.closest(SUBMIT_BUTTON_SELECTOR);
            onDismissRef.current(onSubmit ? 'submit' : 'outside');
        };
        document.addEventListener('pointerdown', handlePointerDown, true);
        return () => document.removeEventListener('pointerdown', handlePointerDown, true);
    }, []);

    const handleClose = useCallback((e) => {
        e.stopPropagation();
        onDismissRef.current('close');
    }, []);
    // 吹き出しの中を押しても、メニューバーのクラスのボタン（クラスの画面を開く）に伝えない。
    const stop = useCallback((e) => e.stopPropagation(), []);

    return (
        <div
            ref={ref}
            className={classNames(
                styles.submitReminder,
                placement === 'drawer' ? styles.submitReminderDrawer : styles.submitReminderMenuBar,
            )}
            data-placement={placement}
            data-testid="classroom-submit-reminder"
            style={floating && place ? { left: `${place.left}px`, top: `${place.top}px` } : null}
            onClick={stop}
        >
            <Balloon
                arrowSide="bottom"
                arrowStyle={floating && place ? { left: `${place.arrowLeft}px` } : null}
                className={styles.submitReminderBalloon}
                role="status"
            >
                <span className={styles.submitReminderText}>{intl.formatMessage(messages.text)}</span>
                <BalloonCloseButton
                    label={intl.formatMessage(messages.close)}
                    testId="classroom-submit-reminder-close"
                    title={intl.formatMessage(messages.close)}
                    onClick={handleClose}
                />
            </Balloon>
        </div>
    );
};

ClassroomSubmitReminderBalloon.propTypes = {
    anchorRef: PropTypes.shape({ current: PropTypes.object }),
    onDismiss: PropTypes.func.isRequired,
    placement: PropTypes.oneOf(['menu-bar', 'drawer']),
};

export default ClassroomSubmitReminderBalloon;
