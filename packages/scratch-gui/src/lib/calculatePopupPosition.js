export const PopupSide = {
    UP: 'up',
    DOWN: 'down',
    LEFT: 'left',
    RIGHT: 'right'
};

export const PopupAlign = {
    UP: 'up',
    DOWN: 'down',
    LEFT: 'left',
    RIGHT: 'right',
    CENTER: 'center'
};

// === Smalruby: Start of viewport-aware popup flip ===
// LEFT/RIGHT 配置で配置側にポップアップ幅 + spaceForArrow が収まらない場合は反対側にフリップする。
// MobileSpritePanel など狭幅レイアウトで、左端列のスプライト削除確認ポップアップが
// 画面外にはみ出して押せない問題への対策 (issue #671)。
const getViewportWidth = () => {
    if (typeof window === 'undefined') return Infinity;
    if (window.visualViewport && typeof window.visualViewport.width === 'number') {
        return window.visualViewport.width;
    }
    return window.innerWidth;
};

const flipSideIfOverflow = (side, targetRect, popupWidth, spaceForArrow) => {
    const required = popupWidth + spaceForArrow;
    if (side === PopupSide.LEFT) {
        if (targetRect.left < required) {
            const viewportWidth = getViewportWidth();
            if (viewportWidth - targetRect.right >= required) {
                return PopupSide.RIGHT;
            }
        }
    } else if (side === PopupSide.RIGHT) {
        const viewportWidth = getViewportWidth();
        if (viewportWidth - targetRect.right < required) {
            if (targetRect.left >= required) {
                return PopupSide.LEFT;
            }
        }
    }
    return side;
};
// === Smalruby: End of viewport-aware popup flip ===

const calculatePopupPosition = ({
    relativeElementRef,
    popupRef,
    side: requestedSide,
    align = PopupAlign.CENTER,
    popupWidth,
    spaceForArrow,
    arrowHeight,
    arrowWidth,
    counterOffset = 5, // Amount of space between the edge of target and
    // the edge of the popup it is aligned with
    arrowOffsetFromBottom = 0 // Amount of space for indentation of arrow inwards the popup
}) => {
    const el = relativeElementRef?.current;
    const modalEl = popupRef?.current;
    if (!el || !modalEl) return {};

    const modalHeight = popupRef.current.getBoundingClientRect().height;
    const targetRect = el.getBoundingClientRect();

    // === Smalruby: Start of viewport-aware popup flip ===
    const side = flipSideIfOverflow(requestedSide, targetRect, popupWidth, spaceForArrow);
    // === Smalruby: End of viewport-aware popup flip ===

    let top = 0;
    let left = 0;
    let arrowTop = 0;
    let arrowLeft = 0;

    switch (side) {
    case PopupSide.UP:
        top = targetRect.top - modalHeight - spaceForArrow;
        break;
    case PopupSide.DOWN:
        top = targetRect.bottom + spaceForArrow;
        break;
    case PopupSide.LEFT:
        left = targetRect.left - popupWidth - spaceForArrow;
        break;
    case PopupSide.RIGHT:
        left = targetRect.right + spaceForArrow;
        break;
    }

    switch (side) {
    case PopupSide.UP:
    case PopupSide.DOWN:
        if (align === PopupAlign.LEFT) {
            left = (targetRect.left + targetRect.width) - popupWidth + counterOffset;
        } else if (align === PopupAlign.RIGHT) {
            left = targetRect.left - counterOffset;
        } else {
            left = targetRect.left + ((targetRect.width - popupWidth) / 2);
        }
        break;

    case PopupSide.LEFT:
    case PopupSide.RIGHT:
        if (align === PopupAlign.UP) {
            top = (targetRect.top + targetRect.height) - modalHeight - counterOffset;
        } else if (align === PopupAlign.DOWN) {
            top = targetRect.top - counterOffset;
        } else {
            top = targetRect.top + ((targetRect.height - modalHeight) / 2);
        }
        break;
    }

    // Arrow positioning
    switch (side) {
    case PopupSide.UP:
        arrowTop = targetRect.top - spaceForArrow - arrowOffsetFromBottom;
        arrowLeft = targetRect.left + ((targetRect.width - arrowWidth) / 2);
        break;
    case PopupSide.DOWN:
        arrowTop = targetRect.top + targetRect.height + spaceForArrow - arrowHeight + arrowOffsetFromBottom;
        arrowLeft = targetRect.left + ((targetRect.width - arrowWidth) / 2);
        break;
    case PopupSide.LEFT:
        arrowTop = targetRect.top + ((targetRect.height - arrowHeight) / 2);
        arrowLeft = targetRect.left - spaceForArrow - arrowOffsetFromBottom;
        break;
    case PopupSide.RIGHT:
        arrowTop = targetRect.top + ((targetRect.height - arrowHeight) / 2);
        arrowLeft = targetRect.left + targetRect.width + spaceForArrow - arrowWidth + arrowOffsetFromBottom;
        break;
    }

    return {top, left, arrowTop, arrowLeft};
};

export default calculatePopupPosition;
