import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useState } from 'react';
import styles from './smalruby-console.css';

// Where the console goes in the right column of the Japanese tab
// (docs/design-system/code-tab.md「日本語タブの右の列」). The console stays a child of the
// stage, which gives it the question of the program and takes the answer, and is drawn
// into this place with a portal. There is one right column, so one place at a time.
let slotNode = null;
const listeners = new Set();

const setSlotNode = (node) => {
    if (slotNode === node) return;
    slotNode = node;
    listeners.forEach((listener) => listener(node));
};

/**
 * The place of the console in the right column of the Japanese tab, kept up to date.
 * @returns {?HTMLElement} The place, or null outside the Japanese tab.
 */
const useSmalrubyConsoleSlot = () => {
    const [node, setNode] = useState(slotNode);
    useEffect(() => {
        listeners.add(setNode);
        setNode(slotNode);
        return () => {
            listeners.delete(setNode);
        };
    }, []);
    return node;
};

/**
 * The borders of the stage on its left and right (2 × `$stage-standard-border-width` of
 * `css/units.css`): the stage is wider than its width by them, so the place of the console
 * takes them too, and the column keeps its width when the console is shown or hidden (B22 of #1731).
 */
const STAGE_BORDERS = '0.125rem';

/**
 * The place of the console: the height of the right column between the stage header
 * and the strip of the sprites. Empty while the console is hidden.
 * @param {object} props - The props.
 * @param {boolean} props.shrinkWhenEmpty - Whether to take no height while empty (the sprites
 * and backdrops are open and take the height the console leaves).
 * @param {number} props.width - The width of the stage, which the column keeps (with the borders of the stage).
 * @returns {React.ReactElement} The place.
 */
const SmalrubyConsoleSlot = ({ shrinkWhenEmpty = false, width }) => {
    const ref = useCallback((node) => setSlotNode(node), []);
    return (
        <div
            className={classNames(styles.slot, { [styles.shrinkWhenEmpty]: shrinkWhenEmpty })}
            data-testid="smalruby-console-slot"
            ref={ref}
            style={{ width: `calc(${width}px + ${STAGE_BORDERS})` }}
        />
    );
};

SmalrubyConsoleSlot.propTypes = {
    shrinkWhenEmpty: PropTypes.bool,
    width: PropTypes.number.isRequired,
};

export { SmalrubyConsoleSlot, useSmalrubyConsoleSlot };
export default SmalrubyConsoleSlot;
