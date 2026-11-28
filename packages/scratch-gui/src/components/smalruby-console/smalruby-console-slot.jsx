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
 * The place of the console: the height of the right column between the stage header
 * and the strip of the sprites. Empty while the console is hidden.
 * @returns {React.ReactElement} The place.
 */
const SmalrubyConsoleSlot = () => {
    const ref = useCallback((node) => setSlotNode(node), []);
    return <div className={styles.slot} data-testid="smalruby-console-slot" ref={ref} />;
};

export { SmalrubyConsoleSlot, useSmalrubyConsoleSlot };
export default SmalrubyConsoleSlot;
