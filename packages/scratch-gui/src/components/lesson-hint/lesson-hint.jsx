// レッスンモードのヒントの吹き出し。指す場所（lib/lessons/hint-targets.js）のそばに出し、
// 中に本物のブロック（LessonHintBlocks）を描く。spotlight のときは周りを暗くして指す場所を照らす。
// 最後のページは「うまく動かないときは」と「プログラムを入れる」（最後の手段）。
// 枠・しっぽ・ヘッダー・ボタンの見た目は共通の吹き出し（components/balloon）を使う。
// document.body に portal で出す（エディタの列のレイアウトに影響しない）。
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { defineMessages, useIntl } from 'react-intl';
import { HINT_SIDES, computeHintPlacement, findHintTargetRect, preferredSides } from '../../lib/lessons/hint-targets';
import BalloonButton from '../balloon/balloon-button.jsx';
import BalloonHeader from '../balloon/balloon-header.jsx';
import Balloon, { BALLOON_VARIANTS } from '../balloon/balloon.jsx';
import LessonHintBlocks from './lesson-hint-blocks.jsx';
import styles from './lesson-hint.css';

const messages = defineMessages({
    ariaLabel: {
        id: 'gui.lessonHint.ariaLabel',
        description: 'Accessible name of the hint balloon in lesson mode',
        defaultMessage: 'Hint',
    },
    position: {
        id: 'gui.lessonHint.position',
        description: 'Which hint this is out of how many',
        defaultMessage: 'Hint {number} of {count}',
    },
    prev: {
        id: 'gui.lessonHint.prev',
        description: 'Button that goes back to the previous hint',
        defaultMessage: 'Back',
    },
    next: {
        id: 'gui.lessonHint.next',
        description: 'Button that goes on to the next hint',
        defaultMessage: 'Next',
    },
    close: {
        id: 'gui.lessonHint.close',
        description: 'Button that closes the hint balloon',
        defaultMessage: 'Close',
    },
    debugTitle: {
        id: 'gui.lessonHint.debugTitle',
        description: 'Heading of the last hint page with tips for when the program does not work',
        defaultMessage: 'If it does not work',
    },
    insertCode: {
        id: 'gui.lessonHint.insertCode',
        description: 'Button on the last hint page that inserts the finished program',
        defaultMessage: 'Insert the program',
    },
    insertCodeError: {
        id: 'gui.lessonHint.insertCodeError',
        description: 'Shown under the insert button when the program cannot be inserted yet',
        defaultMessage: 'The program cannot be inserted yet. Do the earlier hints first.',
    },
    blocksError: {
        id: 'gui.lessonHint.blocksError',
        description: 'Shown when the blocks of a hint could not be drawn',
        defaultMessage: '(These blocks could not be drawn.)',
    },
});

const SPOTLIGHT_PADDING = 4;

const sameRect = (a, b) =>
    a === b || (a && b && a.left === b.left && a.top === b.top && a.right === b.right && a.bottom === b.bottom);

/**
 * 指す場所の矩形と吹き出しの置き方を測る。指す場所はタブの切り替えなどで現れたり消えたり
 * するので、resize のほかに短い間隔でも測り直す（変わったときだけ state を更新する）。
 * @param {?string} target - 指す場所。
 * @param {object} balloonRef - 吹き出しの ref。
 * @param {Array} deps - 測り直すきっかけ（ヒントの番号やブロックの描画）。
 * @returns {{targetRect: ?object, placement: ?object, remeasure: Function}} 測った結果。
 */
const useHintPlacement = (target, balloonRef, deps) => {
    const [state, setState] = useState({ targetRect: null, placement: null });
    const measure = useCallback(() => {
        const el = balloonRef.current;
        if (!el || typeof document === 'undefined') return;
        const targetRect = target ? findHintTargetRect(target, document) : null;
        const size = el.getBoundingClientRect();
        const placement = computeHintPlacement({
            target: targetRect,
            balloon: { width: size.width, height: size.height },
            viewport: { width: window.innerWidth, height: window.innerHeight },
            sides: preferredSides(target),
        });
        setState((prev) =>
            sameRect(prev.targetRect, targetRect) &&
            prev.placement &&
            prev.placement.left === placement.left &&
            prev.placement.top === placement.top &&
            prev.placement.side === placement.side &&
            JSON.stringify(prev.placement.arrow) === JSON.stringify(placement.arrow)
                ? prev
                : { targetRect, placement },
        );
    }, [target, balloonRef]);

    useLayoutEffect(measure, [measure, ...deps]);
    useEffect(() => {
        window.addEventListener('resize', measure);
        const timer = window.setInterval(measure, 300);
        return () => {
            window.removeEventListener('resize', measure);
            window.clearInterval(timer);
        };
    }, [measure]);

    return { ...state, remeasure: measure };
};

const LessonHint = ({
    blocksError = false,
    blocksXml,
    colorMode,
    count,
    debug = [],
    hasCode = false,
    index,
    insertErrors = [],
    lastResort = false,
    mediaPath = './static/blocks-media/default/',
    onClose,
    onInsertCode,
    onNext,
    onPrev,
    scratchBlocks,
    spotlight = false,
    target,
    title,
}) => {
    const intl = useIntl();
    const balloonRef = useRef(null);
    const [renderedTick, setRenderedTick] = useState(0);
    const handleRendered = useCallback(() => setRenderedTick((t) => t + 1), []);
    const { targetRect, placement } = useHintPlacement(target, balloonRef, [index, blocksXml, renderedTick]);

    if (typeof document === 'undefined') return null;

    const side = placement ? placement.side : HINT_SIDES.CENTER;
    const arrow = placement ? placement.arrow : null;
    const arrowStyle = arrow
        ? side === HINT_SIDES.RIGHT || side === HINT_SIDES.LEFT
            ? { top: arrow.y }
            : { left: arrow.x }
        : null;

    return createPortal(
        <>
            {spotlight && targetRect ? (
                <div
                    className={styles.spotlight}
                    data-testid="lesson-hint-spotlight"
                    style={{
                        left: targetRect.left - SPOTLIGHT_PADDING,
                        top: targetRect.top - SPOTLIGHT_PADDING,
                        width: targetRect.right - targetRect.left + SPOTLIGHT_PADDING * 2,
                        height: targetRect.bottom - targetRect.top + SPOTLIGHT_PADDING * 2,
                    }}
                />
            ) : null}
            <Balloon
                ref={balloonRef}
                variant={BALLOON_VARIANTS.PANEL}
                arrowSide={arrow ? side : null}
                arrowStyle={arrowStyle}
                className={styles.balloon}
                data-testid="lesson-hint"
                data-side={side}
                data-target={target || ''}
                role="dialog"
                aria-label={intl.formatMessage(messages.ariaLabel)}
                style={placement ? { left: placement.left, top: placement.top } : { visibility: 'hidden' }}
            >
                <BalloonHeader
                    closeLabel={intl.formatMessage(messages.close)}
                    closeTestId="lesson-hint-close"
                    onClose={onClose}
                >
                    <span data-testid="lesson-hint-position">
                        {intl.formatMessage(messages.position, { number: index + 1, count })}
                    </span>
                </BalloonHeader>
                <div className={styles.body}>
                    {lastResort ? (
                        <>
                            <div className={styles.debugTitle} data-testid="lesson-hint-debug-title">
                                {intl.formatMessage(messages.debugTitle)}
                            </div>
                            {debug.length > 0 ? (
                                <ul className={styles.debugList} data-testid="lesson-hint-debug">
                                    {debug.map((tip) => (
                                        <li key={tip.id}>{intl.formatMessage(tip)}</li>
                                    ))}
                                </ul>
                            ) : null}
                            {hasCode ? (
                                <button
                                    type="button"
                                    className={styles.insertButton}
                                    data-testid="lesson-hint-insert-code"
                                    onClick={onInsertCode}
                                >
                                    {intl.formatMessage(messages.insertCode)}
                                </button>
                            ) : null}
                            {hasCode && insertErrors.length > 0 ? (
                                <div
                                    className={styles.insertError}
                                    data-testid="lesson-hint-insert-code-error"
                                    role="alert"
                                >
                                    <div className={styles.insertErrorTitle}>
                                        {intl.formatMessage(messages.insertCodeError)}
                                    </div>
                                    {insertErrors.map((text, i) => (
                                        <div key={i}>{text}</div>
                                    ))}
                                </div>
                            ) : null}
                        </>
                    ) : (
                        <>
                            {title ? (
                                <p className={styles.title} data-testid="lesson-hint-title">
                                    {intl.formatMessage(title)}
                                </p>
                            ) : null}
                            {blocksXml ? (
                                <LessonHintBlocks
                                    scratchBlocks={scratchBlocks}
                                    xml={blocksXml}
                                    mediaPath={mediaPath}
                                    colorMode={colorMode}
                                    onRendered={handleRendered}
                                />
                            ) : null}
                            {blocksError ? (
                                <p className={styles.blocksError} data-testid="lesson-hint-blocks-error">
                                    {intl.formatMessage(messages.blocksError)}
                                </p>
                            ) : null}
                        </>
                    )}
                </div>
                <div className={styles.footer}>
                    <BalloonButton data-testid="lesson-hint-prev" disabled={index <= 0} onClick={onPrev}>
                        {intl.formatMessage(messages.prev)}
                    </BalloonButton>
                    <BalloonButton
                        primary
                        data-testid="lesson-hint-next"
                        disabled={index >= count - 1}
                        onClick={onNext}
                    >
                        {intl.formatMessage(messages.next)}
                    </BalloonButton>
                </div>
            </Balloon>
        </>,
        document.body,
    );
};

LessonHint.propTypes = {
    blocksError: PropTypes.bool,
    blocksXml: PropTypes.string,
    colorMode: PropTypes.string,
    count: PropTypes.number.isRequired,
    // うまく動かないときは（message descriptor の配列）
    debug: PropTypes.arrayOf(PropTypes.object),
    hasCode: PropTypes.bool,
    index: PropTypes.number.isRequired,
    // 「プログラムを入れる」を試して失敗したときのわけ（変換のエラーの文言）
    insertErrors: PropTypes.arrayOf(PropTypes.string),
    lastResort: PropTypes.bool,
    mediaPath: PropTypes.string,
    onClose: PropTypes.func.isRequired,
    onInsertCode: PropTypes.func,
    onNext: PropTypes.func.isRequired,
    onPrev: PropTypes.func.isRequired,
    scratchBlocks: PropTypes.object,
    spotlight: PropTypes.bool,
    target: PropTypes.string,
    // 吹き出しの文言（message descriptor）
    title: PropTypes.object,
};

export default LessonHint;
