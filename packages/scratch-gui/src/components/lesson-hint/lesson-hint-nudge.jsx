// 手が止まったときの「ヒントを見てみよう」（#2129 の Q5）。課題バーの「ヒント」ボタン（小さくしたヒントの札が
// あれば札）の近くに文字で出す。光らせるのは課題バーのボタン・札の側（CSS）。音は出さない。
// 置き方は小さくしたヒントの札と同じ純粋関数（lib/lessons/hint-minimized.js）で、札があれば札のすぐ下に出す。
// 押せない文字だけ（pointer-events: none）なので、下の部品の操作をじゃましない。document.body に portal で出す。
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { defineMessages, useIntl } from 'react-intl';
import { minimizedHintPosition } from '../../lib/lessons/hint-minimized';
import { HINT_TARGETS, findHintTargetRect, hintViewport } from '../../lib/lessons/hint-targets';
import styles from './lesson-hint.css';

const messages = defineMessages({
    nudge: {
        id: 'gui.lessonHint.nudge',
        description:
            'Shown near the hint button when the program and the stage have not changed for a while (the student ' +
            'may be stuck)',
        defaultMessage: 'Take a look at the hint',
    },
});

const toRect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.right - r.left > 0 && r.bottom - r.top > 0
        ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
        : null;
};

const STAGE_COLUMN = '[class*="gui_stage-and-target-wrapper_"]';

const LessonHintNudge = ({ visible }) => {
    const intl = useIntl();
    const ref = useRef(null);
    const [position, setPosition] = useState(null);
    const measure = useCallback(() => {
        const el = ref.current;
        if (!el || typeof document === 'undefined') return;
        const size = el.getBoundingClientRect();
        // 小さくしたヒントの札があれば、その下に右をそろえて出す。無ければ課題バーの「ヒント」ボタンの下
        const tag = toRect(document.querySelector('[data-testid="lesson-hint-minimized"]'));
        const next = minimizedHintPosition({
            bar: tag || toRect(document.querySelector('[data-testid="lesson-task-bar"]')),
            hintButton: tag || toRect(document.querySelector('[data-testid="lesson-task-bar-hint"]')),
            stage: toRect(document.querySelector(STAGE_COLUMN)),
            palette: findHintTargetRect(HINT_TARGETS.PALETTE, document),
            chip: { width: size.width, height: size.height },
            viewport: hintViewport(document, window),
        });
        setPosition((prev) => (prev && prev.left === next.left && prev.top === next.top ? prev : next));
    }, []);
    useLayoutEffect(() => {
        if (visible) measure();
    }, [visible, measure]);
    useEffect(() => {
        if (!visible) return () => {};
        window.addEventListener('resize', measure);
        const timer = window.setInterval(measure, 300);
        return () => {
            window.removeEventListener('resize', measure);
            window.clearInterval(timer);
        };
    }, [visible, measure]);

    if (!visible || typeof document === 'undefined') return null;
    return createPortal(
        <div
            ref={ref}
            className={styles.nudge}
            data-testid="lesson-hint-nudge"
            role="status"
            style={position ? { left: position.left, top: position.top } : { visibility: 'hidden' }}
        >
            {intl.formatMessage(messages.nudge)}
        </div>,
        document.body,
    );
};

LessonHintNudge.propTypes = {
    // 手が止まっているか（containers/lesson-mode.jsx の useIdleNudge）
    visible: PropTypes.bool,
};

export default LessonHintNudge;
