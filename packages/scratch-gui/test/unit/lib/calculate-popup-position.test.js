import calculatePopupPosition, { PopupSide, PopupAlign } from '../../../src/lib/calculatePopupPosition.js';

const makeRefs = ({ targetRect, popupHeight = 200 }) => ({
    relativeElementRef: {
        current: {
            getBoundingClientRect: () => ({
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: 0,
                height: 0,
                ...targetRect,
            }),
        },
    },
    popupRef: {
        current: {
            getBoundingClientRect: () => ({
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: 0,
                height: popupHeight,
            }),
        },
    },
});

const defaultLayout = {
    popupWidth: 290,
    spaceForArrow: 30,
    arrowHeight: 14,
    arrowWidth: 25,
    arrowOffsetFromBottom: 2,
    counterOffset: 0,
};

const setViewport = (width, height = 800) => {
    window.innerWidth = width;
    window.innerHeight = height;
    delete window.visualViewport;
};

describe('calculatePopupPosition viewport-aware flip', () => {
    afterEach(() => {
        setViewport(1024, 768);
    });

    test('LEFT keeps LEFT placement when there is enough space on the left', () => {
        setViewport(1024);
        const refs = makeRefs({
            targetRect: {
                top: 100,
                left: 600,
                right: 660,
                bottom: 160,
                width: 60,
                height: 60,
            },
        });
        const { left } = calculatePopupPosition({
            ...refs,
            side: PopupSide.LEFT,
            align: PopupAlign.CENTER,
            ...defaultLayout,
        });
        // LEFT placement: targetRect.left - popupWidth - spaceForArrow = 600 - 290 - 30 = 280
        expect(left).toBe(280);
    });

    test('LEFT flips to RIGHT when there is not enough space on the left (mobile sprite panel case)', () => {
        // Simulate MobileSpritePanel: viewport width 844, sprite at left ~70px
        setViewport(844);
        const refs = makeRefs({
            targetRect: {
                top: 100,
                left: 70,
                right: 130,
                bottom: 160,
                width: 60,
                height: 60,
            },
        });
        const { left } = calculatePopupPosition({
            ...refs,
            side: PopupSide.LEFT,
            align: PopupAlign.CENTER,
            ...defaultLayout,
        });
        // Flipped to RIGHT: targetRect.right + spaceForArrow = 130 + 30 = 160
        expect(left).toBe(160);
    });

    test('RIGHT flips to LEFT when there is not enough space on the right', () => {
        setViewport(844);
        const refs = makeRefs({
            targetRect: {
                top: 100,
                left: 700,
                right: 760,
                bottom: 160,
                width: 60,
                height: 60,
            },
        });
        const { left } = calculatePopupPosition({
            ...refs,
            side: PopupSide.RIGHT,
            align: PopupAlign.CENTER,
            ...defaultLayout,
        });
        // Flipped to LEFT: 700 - 290 - 30 = 380
        expect(left).toBe(380);
    });

    test('LEFT stays LEFT when neither side has enough space (prefer original)', () => {
        setViewport(400);
        const refs = makeRefs({
            targetRect: {
                top: 100,
                left: 50,
                right: 110,
                bottom: 160,
                width: 60,
                height: 60,
            },
        });
        const { left } = calculatePopupPosition({
            ...refs,
            side: PopupSide.LEFT,
            align: PopupAlign.CENTER,
            ...defaultLayout,
        });
        // Stays LEFT: 50 - 290 - 30 = -270
        expect(left).toBe(-270);
    });

    test('arrow position is recalculated for the flipped side', () => {
        setViewport(844);
        const refs = makeRefs({
            targetRect: {
                top: 100,
                left: 70,
                right: 130,
                bottom: 160,
                width: 60,
                height: 60,
            },
        });
        const { arrowLeft } = calculatePopupPosition({
            ...refs,
            side: PopupSide.LEFT,
            align: PopupAlign.CENTER,
            ...defaultLayout,
        });
        // Flipped to RIGHT: arrowLeft = targetRect.right + spaceForArrow - arrowWidth + arrowOffsetFromBottom
        // = 130 + 30 - 25 + 2 = 137
        expect(arrowLeft).toBe(137);
    });

    test('UP/DOWN placements are unaffected by horizontal viewport', () => {
        setViewport(844);
        const refs = makeRefs({
            targetRect: {
                top: 100,
                left: 70,
                right: 130,
                bottom: 160,
                width: 60,
                height: 60,
            },
            popupHeight: 200,
        });
        const { top } = calculatePopupPosition({
            ...refs,
            side: PopupSide.DOWN,
            align: PopupAlign.CENTER,
            ...defaultLayout,
        });
        // DOWN: targetRect.bottom + spaceForArrow = 160 + 30 = 190
        expect(top).toBe(190);
    });

    test('uses visualViewport.width when available', () => {
        window.innerWidth = 9999;
        window.visualViewport = { width: 844, height: 800 };
        const refs = makeRefs({
            targetRect: {
                top: 100,
                left: 70,
                right: 130,
                bottom: 160,
                width: 60,
                height: 60,
            },
        });
        const { left } = calculatePopupPosition({
            ...refs,
            side: PopupSide.LEFT,
            align: PopupAlign.CENTER,
            ...defaultLayout,
        });
        // Flips to RIGHT because visualViewport indicates narrow width
        expect(left).toBe(160);
    });

    test('returns empty object when refs are missing', () => {
        const result = calculatePopupPosition({
            relativeElementRef: { current: null },
            popupRef: { current: null },
            side: PopupSide.LEFT,
            ...defaultLayout,
        });
        expect(result).toEqual({});
    });
});
