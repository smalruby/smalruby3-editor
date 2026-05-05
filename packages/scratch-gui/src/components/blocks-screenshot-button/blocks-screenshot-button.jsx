import PropTypes from 'prop-types';
import React, { useLayoutEffect, useRef } from 'react';
import cameraIcon from './icon--camera.svg';
import styles from './blocks-screenshot-button.css';

/** Visual gap between the camera button and the topmost zoom button. */
const ZOOM_GAP_PX = 8;

/**
 * Camera button that exports the workspace blocks as a PNG image. Positioned
 * directly above the scratch-blocks zoom controls. The position is measured
 * at runtime (rather than fixed via CSS) so it survives:
 * - scrollbar width differences across platforms (macOS overlay vs Windows
 *   classic scrollbars),
 * - mobile and window-resize layout changes that move the zoom controls,
 * - scratch-blocks v2's reflow that re-runs the zoom controls auto-layout.
 * @param {object} props - Component props.
 * @param {Function} props.onClick - Click handler for the export action.
 * @returns {React.ReactElement} The screenshot button element.
 */
const BlocksScreenshotButton = ({ onClick }) => {
    const buttonRef = useRef(null);

    useLayoutEffect(() => {
        const button = buttonRef.current;
        if (!button) return;

        let raf = 0;
        const updatePosition = () => {
            const wrapper = button.offsetParent;
            if (!wrapper) return;
            // ScratchZoomControls (scratch-blocks v2) renders a `<g>` with
            // class `blocklyZoom blocklyZoomIn` that ends up at the top of
            // the zoom column when the workspace is in the bottom corner.
            const zoomIn = wrapper.querySelector('.blocklyZoomIn');
            if (!zoomIn) return;
            const zoomRect = zoomIn.getBoundingClientRect();
            const wrapperRect = wrapper.getBoundingClientRect();
            const right = Math.max(0, wrapperRect.right - zoomRect.right);
            const bottom = Math.max(
                0,
                wrapperRect.bottom - (zoomRect.top - ZOOM_GAP_PX),
            );
            button.style.right = `${right}px`;
            button.style.bottom = `${bottom}px`;
        };

        const schedule = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(updatePosition);
        };

        // Initial measurement; retry a few frames in case the zoom controls
        // haven't been mounted yet at this point in the workspace lifecycle.
        let retries = 10;
        const tryUpdate = () => {
            updatePosition();
            const wrapper = button.offsetParent;
            const zoomIn = wrapper && wrapper.querySelector('.blocklyZoomIn');
            if (!zoomIn && retries > 0) {
                retries -= 1;
                requestAnimationFrame(tryUpdate);
            }
        };
        tryUpdate();

        const wrapper = button.offsetParent;
        const observer = new ResizeObserver(schedule);
        if (wrapper) observer.observe(wrapper);
        window.addEventListener('resize', schedule);

        return () => {
            cancelAnimationFrame(raf);
            observer.disconnect();
            window.removeEventListener('resize', schedule);
        };
    }, []);

    return (
        <button
            ref={buttonRef}
            className={styles.screenshotButton}
            title="命令ブロックを画像として保存"
            onClick={onClick}
        >
            <img
                alt="命令ブロックを画像として保存"
                className={styles.screenshotIcon}
                draggable={false}
                src={cameraIcon}
            />
        </button>
    );
};

BlocksScreenshotButton.propTypes = {
    onClick: PropTypes.func.isRequired,
};

export default BlocksScreenshotButton;
