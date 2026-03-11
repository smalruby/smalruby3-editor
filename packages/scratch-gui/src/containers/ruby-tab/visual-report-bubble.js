// === Smalruby: This file is Smalruby-specific (visual report bubble for line execution) ===

import styles from './ruby-tab.css';

/**
 * Find the execute/stop button in the toolbar to anchor the bubble.
 * @returns {Element|null} The button element.
 */
const findAnchorButton = () => (
    document.querySelector('button[aria-label*="カーソル行を実行"]') ||
    document.querySelector('button[aria-label*="Execute current line"]') ||
    document.querySelector('button[aria-label*="実行を停止"]') ||
    document.querySelector('button[aria-label*="Stop execution"]')
);

/**
 * Show a visual report bubble next to the execute button.
 * Creates the bubble DOM element if it doesn't exist yet.
 * @param {HTMLElement|null} bubbleRef - Existing bubble element, or null to create new.
 * @param {*} value - The value to display in the bubble.
 * @returns {HTMLElement|null} The bubble element (possibly newly created), or null if no anchor.
 */
const showBubble = (bubbleRef, value) => {
    const button = findAnchorButton();
    if (!button) {
        return bubbleRef;
    }

    const rect = button.getBoundingClientRect();
    let bubble = bubbleRef;

    if (!bubble) {
        bubble = document.createElement('div');
        bubble.className = styles.valueReportBubble;
        document.body.appendChild(bubble);
    }

    bubble.textContent = String(value);
    bubble.style.left = `${rect.right + 10}px`;
    bubble.style.top = `${rect.top}px`;

    requestAnimationFrame(() => {
        bubble.classList.add(styles.visible);
    });

    return bubble;
};

/**
 * Dismiss (hide) the visual report bubble.
 * @param {HTMLElement|null} bubbleRef - The bubble element.
 */
const dismissBubble = bubbleRef => {
    if (bubbleRef) {
        bubbleRef.classList.remove(styles.visible);
    }
};

/**
 * Remove the bubble element from the DOM.
 * @param {HTMLElement|null} bubbleRef - The bubble element.
 */
const removeBubble = bubbleRef => {
    if (bubbleRef) {
        document.body.removeChild(bubbleRef);
    }
};

export {
    showBubble,
    dismissBubble,
    removeBubble
};
