import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';

import {
    actualSizeView,
    clampPan,
    fitScale,
    fitView,
    normalizeWheelDelta,
    panBy,
    pinchView,
    scaleLimits,
    wheelScale,
    zoomAt,
    zoomByStep,
} from '../../lib/image-viewer-math.js';
import styles from './image-viewer.css';

const messages = defineMessages({
    label: {
        defaultMessage: 'Image viewer',
        description: 'Aria label for the reusable image viewer',
        id: 'gui.imageViewer.label',
    },
    viewport: {
        defaultMessage: '{name}. Use + and - to zoom, arrow keys to move, 0 to fit to screen.',
        description: 'Aria label for the zoomable image area of the image viewer',
        id: 'gui.imageViewer.viewport',
    },
    zoomIn: {
        defaultMessage: 'Zoom in',
        description: 'Button in the image viewer that zooms in',
        id: 'gui.imageViewer.zoomIn',
    },
    zoomOut: {
        defaultMessage: 'Zoom out',
        description: 'Button in the image viewer that zooms out',
        id: 'gui.imageViewer.zoomOut',
    },
    fit: {
        defaultMessage: 'Fit to screen',
        description: 'Button in the image viewer that shows the whole image',
        id: 'gui.imageViewer.fit',
    },
    actualSize: {
        defaultMessage: '100%',
        description: 'Button in the image viewer that shows the image at its actual size',
        id: 'gui.imageViewer.actualSize',
    },
    previous: {
        defaultMessage: 'Previous image',
        description: 'Button in the image viewer that shows the previous image',
        id: 'gui.imageViewer.previous',
    },
    next: {
        defaultMessage: 'Next image',
        description: 'Button in the image viewer that shows the next image',
        id: 'gui.imageViewer.next',
    },
});

/** 矢印キー 1 回でのパン量 (px)。 */
const KEY_PAN_PX = 40;

/** ダブルタップとみなす間隔 (ms) と、1 回目のタップ位置からのずれの許容 (px)。 */
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP_PX = 24;

/** 倍率比較の誤差。 */
const SCALE_EPSILON = 1e-6;

const noop = () => {};

const clampIndex = (index, length) => Math.min(Math.max(0, index), Math.max(0, length - 1));

/**
 * ズーム・パン・ピンチ操作ができる画像ビューア (Issue #1209)。
 *
 * 他者参照 (#1208 / #1210) でクラスメイトのブロック画像を読むための再利用部品。
 * Pointer Events でマウス・タッチ・ペンを共通に扱い、ジェスチャー領域は
 * `touch-action: none` でページのスクロールやブラウザのズームに奪われないようにする。
 * ズーム・パンの計算は `lib/image-viewer-math.js` の純粋関数に委ねる。
 *
 * 複数画像 (ステージ → スプライトごとのプログラム) は前/次ボタンと
 * PageUp / PageDown で切り替える。画像を切り替えると「全体を表示」に戻る。
 * @param {object} props - props
 * @param {Array<{src: string, name: string}>} props.images - 表示する画像 (名前つき)
 * @param {number} [props.initialIndex] - 最初に表示する画像の番号
 * @param {Function} [props.onIndexChange] - 表示中の画像が変わったときに番号を受け取る
 * @param {string} [props.className] - ルート要素に足すクラス
 * @returns {JSX.Element} 画像ビューア
 */
const ImageViewer = ({ images, initialIndex = 0, onIndexChange, className }) => {
    const intl = useIntl();
    const [index, setIndex] = useState(() => clampIndex(initialIndex, images.length));
    const [imageSize, setImageSize] = useState(null);
    const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
    const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
    // 「全体を表示」中か。リサイズや画像の読み込み時に全体表示を保つかどうかに使う
    const [fitMode, setFitMode] = useState(true);
    const [dragging, setDragging] = useState(false);

    const viewportRef = useRef(null);
    const pointersRef = useRef(new Map());
    const lastTapRef = useRef(null);
    const lastPointerTypeRef = useRef('mouse');
    // ネイティブ wheel リスナー (passive: false) から最新の状態を読むための鏡
    const stateRef = useRef(null);
    stateRef.current = { view, imageSize, viewportSize };

    const currentIndex = clampIndex(index, images.length);
    const current = images[currentIndex];
    // 画像が無い間はビューポートを描かないので、届いた時点で計測とリスナー登録をやり直す
    const hasViewport = Boolean(current);

    // 計算の結果で view と fitMode を同時に更新する
    const applyView = useCallback(next => {
        const { imageSize: image, viewportSize: viewport } = stateRef.current;
        if (!image) return;
        stateRef.current = { ...stateRef.current, view: next };
        setView(next);
        setFitMode(Math.abs(next.scale - fitScale(image, viewport)) < SCALE_EPSILON);
    }, []);

    const updateView = useCallback(
        compute => {
            const { view: prev, imageSize: image, viewportSize: viewport } = stateRef.current;
            if (!image) return;
            applyView(compute(prev, image, viewport));
        },
        [applyView],
    );

    useLayoutEffect(() => {
        const el = viewportRef.current;
        if (!el) return noop;
        const measure = () => setViewportSize({ width: el.clientWidth, height: el.clientHeight });
        measure();
        if (typeof window.ResizeObserver === 'function') {
            const observer = new window.ResizeObserver(measure);
            observer.observe(el);
            return () => observer.disconnect();
        }
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [hasViewport]);

    // 画像の読み込み / ビューポートのリサイズ: 全体表示中なら全体表示を保ち、それ以外は範囲に収め直す
    useEffect(() => {
        if (!imageSize) return;
        setView(prev => (fitMode ? fitView(imageSize, viewportSize) : clampPan(prev, imageSize, viewportSize)));
        // fitMode の変化だけで走っても、全体表示 / 範囲内のビューを作り直すだけなので無害
    }, [fitMode, imageSize, viewportSize]);

    const goTo = useCallback(
        nextIndex => {
            const clamped = clampIndex(nextIndex, images.length);
            if (clamped === currentIndex) return;
            setIndex(clamped);
            setImageSize(null);
            setFitMode(true);
            pointersRef.current.clear();
            if (onIndexChange) onIndexChange(clamped);
        },
        [currentIndex, images.length, onIndexChange],
    );

    const goPrevious = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo]);
    const goNext = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo]);

    const handleImageLoad = useCallback(e => {
        setImageSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight });
    }, []);

    const localPoint = useCallback(e => {
        const rect = viewportRef.current.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }, []);

    const zoomIn = useCallback(() => updateView((v, image, viewport) => zoomByStep(v, 1, image, viewport)), [updateView]);
    const zoomOut = useCallback(
        () => updateView((v, image, viewport) => zoomByStep(v, -1, image, viewport)),
        [updateView],
    );
    const showFit = useCallback(() => updateView((v, image, viewport) => fitView(image, viewport)), [updateView]);
    const showActualSize = useCallback(
        () => updateView((v, image, viewport) => actualSizeView(image, viewport)),
        [updateView],
    );

    // ダブルクリック / ダブルタップ: 全体表示なら指した場所を中心に拡大、拡大中なら全体表示へ
    const toggleZoomAt = useCallback(
        point =>
            updateView((v, image, viewport) => {
                const { min, max } = scaleLimits(image, viewport);
                if (v.scale > min + SCALE_EPSILON) return fitView(image, viewport);
                return zoomAt(v, Math.min(max, Math.max(1, min * 2)), point, image, viewport);
            }),
        [updateView],
    );

    useEffect(() => {
        const el = viewportRef.current;
        if (!el) return noop;
        // React の onWheel は passive で preventDefault できない (Ctrl+ホイールのブラウザズームを止められない)
        const handleWheel = e => {
            e.preventDefault();
            const rect = el.getBoundingClientRect();
            const focal = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            const delta = normalizeWheelDelta(e);
            updateView((v, image, viewport) => zoomAt(v, wheelScale(v.scale, delta), focal, image, viewport));
        };
        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, [hasViewport, updateView]);

    const handlePointerDown = useCallback(
        e => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            lastPointerTypeRef.current = e.pointerType;
            if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
            const point = localPoint(e);
            pointersRef.current.set(e.pointerId, point);
            setDragging(true);

            if (e.pointerType !== 'mouse' && pointersRef.current.size === 1) {
                const last = lastTapRef.current;
                if (
                    last &&
                    e.timeStamp - last.time <= DOUBLE_TAP_MS &&
                    Math.hypot(point.x - last.x, point.y - last.y) <= DOUBLE_TAP_SLOP_PX
                ) {
                    lastTapRef.current = null;
                    toggleZoomAt(point);
                } else {
                    lastTapRef.current = { ...point, time: e.timeStamp };
                }
            }
        },
        [localPoint, toggleZoomAt],
    );

    const handlePointerMove = useCallback(
        e => {
            const pointers = pointersRef.current;
            if (!pointers.has(e.pointerId)) return;
            const prev = Array.from(pointers.values()).slice(0, 2);
            pointers.set(e.pointerId, localPoint(e));
            const curr = Array.from(pointers.values()).slice(0, 2);
            if (curr.length >= 2) {
                updateView((v, image, viewport) => pinchView(v, prev, curr, image, viewport));
            } else {
                const delta = { x: curr[0].x - prev[0].x, y: curr[0].y - prev[0].y };
                updateView((v, image, viewport) => panBy(v, delta, image, viewport));
            }
        },
        [localPoint, updateView],
    );

    const handlePointerEnd = useCallback(e => {
        pointersRef.current.delete(e.pointerId);
        if (pointersRef.current.size === 0) setDragging(false);
    }, []);

    const handleDoubleClick = useCallback(
        e => {
            // タッチのダブルタップは pointerdown 側で処理済み (合成 dblclick で二重に切り替えない)
            if (lastPointerTypeRef.current !== 'mouse') return;
            toggleZoomAt(localPoint(e));
        },
        [localPoint, toggleZoomAt],
    );

    const handleKeyDown = useCallback(
        e => {
            // Ctrl/Cmd + +/-/0 などブラウザのズーム操作は奪わない
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const pan = delta => updateView((v, image, viewport) => panBy(v, delta, image, viewport));
            switch (e.key) {
                case '+':
                case '=':
                    zoomIn();
                    break;
                case '-':
                case '_':
                    zoomOut();
                    break;
                case '0':
                    showFit();
                    break;
                case 'ArrowLeft':
                    pan({ x: KEY_PAN_PX, y: 0 });
                    break;
                case 'ArrowRight':
                    pan({ x: -KEY_PAN_PX, y: 0 });
                    break;
                case 'ArrowUp':
                    pan({ x: 0, y: KEY_PAN_PX });
                    break;
                case 'ArrowDown':
                    pan({ x: 0, y: -KEY_PAN_PX });
                    break;
                case 'PageUp':
                    goPrevious();
                    break;
                case 'PageDown':
                    goNext();
                    break;
                default:
                    return;
            }
            e.preventDefault();
        },
        [goNext, goPrevious, showFit, updateView, zoomIn, zoomOut],
    );

    if (!current) return null;

    const limits = imageSize ? scaleLimits(imageSize, viewportSize) : { min: 1, max: 1 };
    const zoomPercent = Math.round(view.scale * 100);
    const multiple = images.length > 1;

    return (
        <div
            className={classNames(styles.viewer, className)}
            role="group"
            aria-label={intl.formatMessage(messages.label)}
            data-testid="image-viewer"
        >
            <div className={styles.toolbar}>
                <div className={styles.nav}>
                    {multiple && (
                        <button
                            type="button"
                            className={styles.button}
                            aria-label={intl.formatMessage(messages.previous)}
                            title={intl.formatMessage(messages.previous)}
                            disabled={currentIndex === 0}
                            onClick={goPrevious}
                            data-testid="image-viewer-prev"
                        >
                            {'◀'}
                        </button>
                    )}
                    <span
                        className={styles.name}
                        data-testid="image-viewer-name"
                    >
                        {current.name}
                    </span>
                    {multiple && (
                        <span
                            className={styles.counter}
                            data-testid="image-viewer-counter"
                        >
                            {`${currentIndex + 1} / ${images.length}`}
                        </span>
                    )}
                    {multiple && (
                        <button
                            type="button"
                            className={styles.button}
                            aria-label={intl.formatMessage(messages.next)}
                            title={intl.formatMessage(messages.next)}
                            disabled={currentIndex === images.length - 1}
                            onClick={goNext}
                            data-testid="image-viewer-next"
                        >
                            {'▶'}
                        </button>
                    )}
                </div>
                <div className={styles.zoom}>
                    <button
                        type="button"
                        className={styles.button}
                        aria-label={intl.formatMessage(messages.zoomOut)}
                        title={intl.formatMessage(messages.zoomOut)}
                        disabled={!imageSize || view.scale <= limits.min + SCALE_EPSILON}
                        onClick={zoomOut}
                        data-testid="image-viewer-zoom-out"
                    >
                        {'−'}
                    </button>
                    <span
                        className={styles.zoomLevel}
                        aria-live="polite"
                        data-testid="image-viewer-zoom-level"
                    >
                        {`${zoomPercent}%`}
                    </span>
                    <button
                        type="button"
                        className={styles.button}
                        aria-label={intl.formatMessage(messages.zoomIn)}
                        title={intl.formatMessage(messages.zoomIn)}
                        disabled={!imageSize || view.scale >= limits.max - SCALE_EPSILON}
                        onClick={zoomIn}
                        data-testid="image-viewer-zoom-in"
                    >
                        {'+'}
                    </button>
                    <button
                        type="button"
                        className={styles.button}
                        disabled={!imageSize}
                        onClick={fitMode ? showActualSize : showFit}
                        data-testid="image-viewer-toggle-fit"
                    >
                        {intl.formatMessage(fitMode ? messages.actualSize : messages.fit)}
                    </button>
                </div>
            </div>
            <div
                ref={viewportRef}
                className={classNames(styles.viewport, { [styles.dragging]: dragging })}
                role="img"
                aria-label={intl.formatMessage(messages.viewport, { name: current.name })}
                tabIndex={0}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                onDoubleClick={handleDoubleClick}
                onKeyDown={handleKeyDown}
                data-testid="image-viewer-viewport"
            >
                <img
                    // 同じ src が続いても作り直して load を発火させる (imageSize を null に戻しているため)
                    key={`${currentIndex}:${current.src}`}
                    className={classNames(styles.image, { [styles.loading]: !imageSize })}
                    src={current.src}
                    alt={current.name}
                    draggable={false}
                    onLoad={handleImageLoad}
                    style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
                    data-testid="image-viewer-image"
                />
            </div>
        </div>
    );
};

ImageViewer.propTypes = {
    className: PropTypes.string,
    images: PropTypes.arrayOf(
        PropTypes.shape({
            name: PropTypes.string.isRequired,
            src: PropTypes.string.isRequired,
        }),
    ).isRequired,
    initialIndex: PropTypes.number,
    onIndexChange: PropTypes.func,
};

export default ImageViewer;
