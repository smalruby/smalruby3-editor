/**
 * BoardMenu — a small dropdown (toggle + list) used by the assignment board
 * and the assignment detail's「…」menu (#1303: own file so the detail view
 * does not import from the board).
 */
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import styles from './classroom-modal.css';

/**
 * A small dropdown: a toggle button and a list shown under it. Closes on an
 * outside click, on Escape, and after an item runs (items call `close`).
 * @param {object} props - component props
 * @param {Function} props.children - (close) => menu items
 * @param {string} props.buttonClassName - class of the toggle button
 * @param {React.ReactNode} props.label - contents of the toggle button
 * @param {string} props.ariaLabel - accessible name of the toggle (icon-only buttons)
 * @param {boolean} props.alignRight - open the list toward the left edge of the button
 * @param {boolean} props.disabled - disable the toggle
 * @param {string} props.testId - data-testid of the toggle; the list gets `${testId}-list`
 * @returns {React.ReactElement} the menu
 */
const BoardMenu = ({ alignRight, ariaLabel, buttonClassName, children, disabled, label, testId }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const close = useCallback(() => setOpen(false), []);
    const handleToggle = useCallback(() => setOpen((v) => !v), []);
    useEffect(() => {
        if (!open) return () => {};
        const handleDown = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        const handleKey = (e) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', handleDown);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleDown);
            document.removeEventListener('keydown', handleKey);
        };
    }, [open]);
    return (
        <div className={styles.boardMenu} ref={ref}>
            <button
                aria-expanded={open}
                aria-haspopup="menu"
                aria-label={ariaLabel}
                className={buttonClassName}
                data-testid={testId}
                disabled={disabled}
                type="button"
                onClick={handleToggle}
            >
                {label}
            </button>
            {open ? (
                <div
                    className={alignRight ? styles.boardMenuListRight : styles.boardMenuList}
                    data-testid={`${testId}-list`}
                    role="menu"
                >
                    {children(close)}
                </div>
            ) : null}
        </div>
    );
};

BoardMenu.propTypes = {
    alignRight: PropTypes.bool,
    ariaLabel: PropTypes.string,
    buttonClassName: PropTypes.string,
    children: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
    label: PropTypes.node.isRequired,
    testId: PropTypes.string.isRequired,
};

/**
 * One item of a BoardMenu: runs the action and closes the menu.
 * @param {object} props - component props
 * @param {React.ReactNode} props.children - item label
 * @param {Function} props.close - closes the menu
 * @param {boolean} props.disabled - disable the item
 * @param {Function} props.onSelect - action of the item
 * @param {string} props.testId - data-testid
 * @returns {React.ReactElement} the item
 */
const BoardMenuItem = ({ children, close, disabled, onSelect, testId }) => {
    const handleClick = useCallback(() => {
        close();
        onSelect();
    }, [close, onSelect]);
    return (
        <button
            className={styles.boardMenuItem}
            data-testid={testId}
            disabled={disabled}
            role="menuitem"
            type="button"
            onClick={handleClick}
        >
            {children}
        </button>
    );
};

BoardMenuItem.propTypes = {
    children: PropTypes.node.isRequired,
    close: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
    onSelect: PropTypes.func.isRequired,
    testId: PropTypes.string.isRequired,
};

export { BoardMenuItem };
export default BoardMenu;
