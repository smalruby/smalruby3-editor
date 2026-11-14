// レッスンモードのヒントの吹き出し。指す場所（lib/lessons/hint-targets.js）のそばに出し、
// 中に本物のブロック（LessonHintBlocks）を描く。spotlight のときは周りを暗くして指す場所を照らす。
// 最後のページは「うまく動かないときは」と「正解のプログラムを確認する」（最後の手段）。押すと吹き出しの中で
// 「置き換えますか？」を確かめ、はいで正解のプログラムを入れる（onInsertCode）。最後のページの「進める」は「おわり」
// （押すと閉じる）。
// ヘッダー（色の帯）をドラッグすると吹き出しを動かせる（マウス・タッチ。Pointer Events）。動かした位置は
// ページを進めても保ち（じゃまだから動かした場所に、また戻ってこないように）、吹き出しを閉じると元の置き方に戻る。
// 動かしたあとは指す場所から離れるので、しっぽは消す（スポットライトは指す場所を照らし続ける）。
// 枠・しっぽ・ヘッダー・ボタンの見た目は共通の吹き出し（components/balloon）を使う。
// document.body に portal で出す（エディタの列のレイアウトに影響しない）。
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { defineMessages, useIntl } from 'react-intl';
import {
    HINT_SIDES,
    clampHintPosition,
    computeHintPlacement,
    findHintTargetRect,
    hintViewport,
    preferredSides,
} from '../../lib/lessons/hint-targets';
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
    checkAnswer: {
        id: 'gui.lessonHint.checkAnswer',
        description: 'Button on the last hint page that asks whether to replace the program with the correct one',
        defaultMessage: 'See the correct program',
    },
    checkAnswerConfirm: {
        id: 'gui.lessonHint.checkAnswerConfirm',
        description: 'Confirmation shown before replacing the program with the correct one',
        defaultMessage: 'Replace your program with the correct program? The program you made will be deleted.',
    },
    checkAnswerYes: {
        id: 'gui.lessonHint.checkAnswerYes',
        description: 'Button that replaces the program with the correct one',
        defaultMessage: 'Yes',
    },
    checkAnswerNo: {
        id: 'gui.lessonHint.checkAnswerNo',
        description: 'Button that cancels replacing the program',
        defaultMessage: 'No',
    },
    finish: {
        id: 'gui.lessonHint.finish',
        description: 'Button on the last hint page that closes the hint balloon',
        defaultMessage: 'Finish',
    },
    dragLabel: {
        id: 'gui.lessonHint.dragLabel',
        description: 'Tooltip of the header of the hint balloon, which can be dragged to move the balloon',
        defaultMessage: 'Drag to move',
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
            viewport: viewportSize(),
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

const viewportSize = () => hintViewport(document, window);

// ドラッグとみなすまでに動かす距離（px）。ヘッダーを押しただけの手ぶれで吹き出しを動かさない
const DRAG_THRESHOLD = 4;

/**
 * ヘッダーをドラッグして吹き出しを動かす（Pointer Events なのでマウスとタッチの両方）。
 * 動かした位置は画面の内側に収め、吹き出しの大きさ（ページで変わる）や画面の大きさが変わったときも収め直す。
 * @param {object} balloonRef - 吹き出しの ref。
 * @param {Array} deps - 収め直すきっかけ（ページの番号など）。
 * @returns {{position: ?{left: number, top: number}, onPointerDown: Function}} 動かした位置（動かしていなければ null）と取っ手の handler。
 */
const useHintDrag = (balloonRef, deps) => {
    const [position, setPosition] = useState(null);
    const cleanupRef = useRef(null);

    const settle = useCallback(
        (next) => {
            const el = balloonRef.current;
            if (!el || !next) return next;
            const size = el.getBoundingClientRect();
            return clampHintPosition(next, { width: size.width, height: size.height }, viewportSize());
        },
        [balloonRef],
    );

    const onPointerDown = useCallback(
        (e) => {
            // 閉じるボタンなど、ヘッダーの中のボタンはふつうに押せるようにする
            if (e.button > 0 || (e.target && e.target.closest && e.target.closest('button'))) return;
            const el = balloonRef.current;
            if (!el) return;
            e.preventDefault();
            const start = el.getBoundingClientRect();
            const offset = { x: e.clientX - start.left, y: e.clientY - start.top };
            const origin = { x: e.clientX, y: e.clientY };
            const pointerId = e.pointerId;
            let moving = false;
            let onMove = null;
            const stop = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', stop);
                window.removeEventListener('pointercancel', stop);
                cleanupRef.current = null;
            };
            onMove = (ev) => {
                if (
                    typeof pointerId !== 'undefined' &&
                    typeof ev.pointerId !== 'undefined' &&
                    ev.pointerId !== pointerId
                ) {
                    return;
                }
                // ボタンを離したのに pointerup が来なかったとき（窓の外で離した等）は、ここで終える
                // （押していないのに吹き出しがポインタについてくる、を残さない）
                if (ev.pointerType === 'mouse' && ev.buttons === 0) {
                    stop();
                    return;
                }
                // 押しただけ（手ぶれの数 px）では動かさない（動かすとしっぽが消えてしまう）
                if (!moving && Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y) < DRAG_THRESHOLD) return;
                moving = true;
                setPosition(settle({ left: ev.clientX - offset.x, top: ev.clientY - offset.y }));
            };
            if (cleanupRef.current) cleanupRef.current();
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', stop);
            window.addEventListener('pointercancel', stop);
            cleanupRef.current = stop;
        },
        [balloonRef, settle],
    );

    // ドラッグの途中で閉じたとき（unmount）に window の listener を残さない
    useEffect(
        () => () => {
            if (cleanupRef.current) cleanupRef.current();
        },
        [],
    );

    // ページが変わって大きさが変わったとき・画面の大きさが変わったときも画面の内側に収め直す
    const reclamp = useCallback(() => {
        setPosition((prev) => {
            if (!prev) return prev;
            const next = settle(prev);
            return next.left === prev.left && next.top === prev.top ? prev : next;
        });
    }, [settle]);
    useLayoutEffect(reclamp, [reclamp, ...deps]);
    useEffect(() => {
        window.addEventListener('resize', reclamp);
        const timer = window.setInterval(reclamp, 300);
        return () => {
            window.removeEventListener('resize', reclamp);
            window.clearInterval(timer);
        };
    }, [reclamp]);

    return { position, onPointerDown };
};

const LessonHint = ({
    activityDiagram = null,
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
    onFinish,
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
    // アクティビティ図は 1 ページ目だけ（毎ページ描くと情報が多すぎる・docs/lessons/design.md の「アクティビティ図」）
    const diagram = index === 0 && !lastResort ? activityDiagram : null;
    // 置き方の測り直しは、図が出た・消えたときだけ（図の要素は描くたびに作り直されるので、要素では見ない）
    const hasDiagram = Boolean(diagram);
    const { targetRect, placement } = useHintPlacement(target, balloonRef, [
        index,
        blocksXml,
        renderedTick,
        hasDiagram,
    ]);
    const { position: dragged, onPointerDown } = useHintDrag(balloonRef, [
        index,
        blocksXml,
        renderedTick,
        lastResort,
        hasDiagram,
    ]);
    // 「正解のプログラムを確認する」を押して、置き換えてよいかを確かめているところか（ページが変わったらやめる）
    const [confirming, setConfirming] = useState(false);
    useEffect(() => setConfirming(false), [index, lastResort]);
    const handleAskInsert = useCallback(() => setConfirming(true), []);
    const handleCancelInsert = useCallback(() => setConfirming(false), []);
    const handleConfirmInsert = useCallback(() => {
        setConfirming(false);
        if (onInsertCode) onInsertCode();
    }, [onInsertCode]);

    if (typeof document === 'undefined') return null;

    const side = placement ? placement.side : HINT_SIDES.CENTER;
    // 動かしたあとは指す場所から離れるので、しっぽは出さない
    const arrow = placement && !dragged ? placement.arrow : null;
    const isLastPage = index >= count - 1;
    let balloonStyle = { visibility: 'hidden' };
    if (dragged) balloonStyle = { left: dragged.left, top: dragged.top };
    else if (placement) balloonStyle = { left: placement.left, top: placement.top };
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
                // 図のあるページは、図が字の読める大きさのまま収まるよう吹き出しを少し広げる
                className={hasDiagram ? styles.balloonWide : styles.balloon}
                data-testid="lesson-hint"
                data-side={side}
                data-target={target || ''}
                data-dragged={dragged ? 'true' : 'false'}
                role="dialog"
                aria-label={intl.formatMessage(messages.ariaLabel)}
                style={balloonStyle}
            >
                <BalloonHeader
                    className={styles.dragHandle}
                    data-testid="lesson-hint-drag-handle"
                    title={intl.formatMessage(messages.dragLabel)}
                    onPointerDown={onPointerDown}
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
                            {hasCode && !confirming ? (
                                <button
                                    type="button"
                                    className={styles.insertButton}
                                    data-testid="lesson-hint-insert-code"
                                    onClick={handleAskInsert}
                                >
                                    {intl.formatMessage(messages.checkAnswer)}
                                </button>
                            ) : null}
                            {hasCode && confirming ? (
                                <div
                                    className={styles.confirm}
                                    data-testid="lesson-hint-insert-code-confirm"
                                    role="alertdialog"
                                    aria-label={intl.formatMessage(messages.checkAnswer)}
                                >
                                    <p className={styles.confirmText}>
                                        {intl.formatMessage(messages.checkAnswerConfirm)}
                                    </p>
                                    <div className={styles.confirmButtons}>
                                        <BalloonButton
                                            data-testid="lesson-hint-insert-code-no"
                                            onClick={handleCancelInsert}
                                        >
                                            {intl.formatMessage(messages.checkAnswerNo)}
                                        </BalloonButton>
                                        <BalloonButton
                                            primary
                                            data-testid="lesson-hint-insert-code-yes"
                                            onClick={handleConfirmInsert}
                                        >
                                            {intl.formatMessage(messages.checkAnswerYes)}
                                        </BalloonButton>
                                    </div>
                                </div>
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
                            {diagram ? (
                                <div className={styles.activityDiagram} data-testid="lesson-hint-activity-diagram">
                                    {diagram}
                                </div>
                            ) : null}
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
                    {isLastPage ? (
                        // 最後のページのあとは無いので、「進める」の代わりに「おわり」で閉じる。
                        // ×（onClose）とちがい、次に開くときは 1 ページ目から（onFinish・#1528）
                        <BalloonButton primary data-testid="lesson-hint-finish" onClick={onFinish || onClose}>
                            {intl.formatMessage(messages.finish)}
                        </BalloonButton>
                    ) : (
                        <BalloonButton primary data-testid="lesson-hint-next" onClick={onNext}>
                            {intl.formatMessage(messages.next)}
                        </BalloonButton>
                    )}
                </div>
            </Balloon>
        </>,
        document.body,
    );
};

LessonHint.propTypes = {
    // 答えのプログラムから描いたアクティビティ図（components/lesson-activity-diagram）。1 ページ目の文の上に出す
    activityDiagram: PropTypes.node,
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
    // 「おわり」で閉じる（無ければ onClose）
    onFinish: PropTypes.func,
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
