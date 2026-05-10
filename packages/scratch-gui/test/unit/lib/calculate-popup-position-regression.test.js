/**
 * Regression test for issue #671:
 * SP モード (MobileSpritePanel) でスプライト 2 個の状態で 1 個目を削除しようとした際、
 * 削除確認ポップアップの「はい」ボタンが画面左端で見切れて押せない問題への
 * リグレッション検出。
 *
 * delete-confirmation-prompt.jsx の layoutConfig (modalWidth: 290, spaceForArrow: 30)
 * と sprite-list.jsx の deleteConfirmationModalPosition='left' を使い、
 * - SP viewport (844px) + 左端のスプライト → ポップアップが画面内に収まること
 * - desktop viewport (1280px) + 右ペインのスプライト → 従来通り左側 (リグレッションなし)
 * を検証する。
 */
import calculatePopupPosition, { PopupSide, PopupAlign } from '../../../src/lib/calculatePopupPosition.js';

// delete-confirmation-prompt.jsx と同じ値
const deleteConfirmationLayout = {
    popupWidth: 290,
    spaceForArrow: 30,
    counterOffset: 0,
    arrowOffsetFromBottom: 2,
    arrowHeight: 14,
    arrowWidth: 25,
};

const makeRefs = ({ targetRect, popupHeight = 220 }) => ({
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

describe('Regression: issue #671 sprite delete popup off-screen', () => {
    afterEach(() => {
        delete window.visualViewport;
        window.innerWidth = 1024;
        window.innerHeight = 768;
    });

    test('SP viewport (844x390): popup for leftmost sprite stays within viewport', () => {
        // MobileSpritePanel は左サイドレール (56px) の右隣からビューポート右端まで。
        // sprite-list の左端列に並ぶ最初のスプライト (約 80px 幅) は left ~= 70px 付近に置かれる。
        window.innerWidth = 844;
        window.innerHeight = 390;

        const refs = makeRefs({
            targetRect: { top: 100, left: 70, right: 150, bottom: 180, width: 80, height: 80 },
        });

        const { left } = calculatePopupPosition({
            ...refs,
            side: PopupSide.LEFT,
            align: PopupAlign.CENTER,
            ...deleteConfirmationLayout,
        });

        // ポップアップの左端 (left) と右端 (left + popupWidth) が画面内に収まること
        expect(left).toBeGreaterThanOrEqual(0);
        expect(left + deleteConfirmationLayout.popupWidth).toBeLessThanOrEqual(844);
    });

    test('SP viewport (844x390): popup for last remaining sprite stays within viewport', () => {
        // 最後の 1 個 (スプライト 1 個のみ) でも左端列に置かれる
        window.innerWidth = 844;
        window.innerHeight = 390;

        const refs = makeRefs({
            targetRect: { top: 60, left: 70, right: 150, bottom: 140, width: 80, height: 80 },
        });

        const { left } = calculatePopupPosition({
            ...refs,
            side: PopupSide.LEFT,
            align: PopupAlign.CENTER,
            ...deleteConfirmationLayout,
        });

        expect(left).toBeGreaterThanOrEqual(0);
        expect(left + deleteConfirmationLayout.popupWidth).toBeLessThanOrEqual(844);
    });

    test('Desktop viewport (1280x800): popup for sprite in right pane stays on the left side (no regression)', () => {
        // upstream desktop GUI の右ペイン (sprite-selector) は画面右側にある。
        // 削除確認ポップアップは従来通り左側に表示されることを確認。
        window.innerWidth = 1280;
        window.innerHeight = 800;

        const refs = makeRefs({
            targetRect: { top: 600, left: 1050, right: 1130, bottom: 680, width: 80, height: 80 },
        });

        const { left } = calculatePopupPosition({
            ...refs,
            side: PopupSide.LEFT,
            align: PopupAlign.CENTER,
            ...deleteConfirmationLayout,
        });

        // LEFT 配置: 1050 - 290 - 30 = 730 (画面内、左側)
        expect(left).toBe(730);
    });

    test('iPad portrait (768x1024): popup for sprite in right pane stays on the left side (no regression)', () => {
        // iPad portrait は narrow desktop CSS で右ペインが圧縮されるが、
        // sprite-selector は引き続き右側にあるため LEFT 配置が画面内に収まる。
        window.innerWidth = 768;
        window.innerHeight = 1024;

        const refs = makeRefs({
            targetRect: { top: 800, left: 600, right: 680, bottom: 880, width: 80, height: 80 },
        });

        const { left } = calculatePopupPosition({
            ...refs,
            side: PopupSide.LEFT,
            align: PopupAlign.CENTER,
            ...deleteConfirmationLayout,
        });

        // LEFT 配置: 600 - 290 - 30 = 280 (画面内、左側)
        expect(left).toBe(280);
    });
});
