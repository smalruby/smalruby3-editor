/* eslint-env jest */
import {
    MAX_SCALE,
    clampPan,
    clampScale,
    fitScale,
    fitView,
    actualSizeView,
    panBy,
    pinchView,
    scaleLimits,
    zoomAt,
    zoomByStep,
    normalizeWheelDelta,
} from '../../../src/lib/image-viewer-math.js';

const IMAGE = { width: 2000, height: 1000 };
const VIEWPORT = { width: 500, height: 500 };

describe('image-viewer-math', () => {
    describe('fitScale', () => {
        test('shrinks a large image so the whole image fits the viewport', () => {
            expect(fitScale(IMAGE, VIEWPORT)).toBe(0.25);
        });

        test('does not upscale an image smaller than the viewport', () => {
            expect(fitScale({ width: 100, height: 50 }, VIEWPORT)).toBe(1);
        });

        test('returns 1 when sizes are unknown (zero) to avoid division by zero', () => {
            expect(fitScale({ width: 0, height: 0 }, VIEWPORT)).toBe(1);
            expect(fitScale(IMAGE, { width: 0, height: 0 })).toBe(1);
        });
    });

    describe('scaleLimits / clampScale', () => {
        test('lower limit is the fit scale and upper limit is 400%', () => {
            expect(scaleLimits(IMAGE, VIEWPORT)).toEqual({ min: 0.25, max: MAX_SCALE });
            expect(MAX_SCALE).toBe(4);
        });

        test('clamps a scale into the limits', () => {
            const limits = scaleLimits(IMAGE, VIEWPORT);
            expect(clampScale(0.1, limits)).toBe(0.25);
            expect(clampScale(10, limits)).toBe(4);
            expect(clampScale(2, limits)).toBe(2);
        });
    });

    describe('clampPan', () => {
        test('centers the image on an axis where it is smaller than the viewport', () => {
            // 0.25 倍: 500x250 → 縦は 250px 余るので中央 (125)
            expect(clampPan({ scale: 0.25, x: -300, y: 0 }, IMAGE, VIEWPORT)).toEqual({
                scale: 0.25,
                x: 0,
                y: 125,
            });
        });

        test('keeps the image covering the viewport when it is larger', () => {
            // 1 倍: 2000x1000。x は [-1500, 0]、y は [-500, 0]
            expect(clampPan({ scale: 1, x: 100, y: 100 }, IMAGE, VIEWPORT)).toEqual({ scale: 1, x: 0, y: 0 });
            expect(clampPan({ scale: 1, x: -9999, y: -9999 }, IMAGE, VIEWPORT)).toEqual({
                scale: 1,
                x: -1500,
                y: -500,
            });
            expect(clampPan({ scale: 1, x: -700, y: -200 }, IMAGE, VIEWPORT)).toEqual({ scale: 1, x: -700, y: -200 });
        });
    });

    describe('fitView / actualSizeView', () => {
        test('fitView shows the whole image centered', () => {
            expect(fitView(IMAGE, VIEWPORT)).toEqual({ scale: 0.25, x: 0, y: 125 });
        });

        test('actualSizeView shows 100% centered on the image center', () => {
            // 画像中心 (1000, 500) がビューポート中心 (250, 250) に来る
            expect(actualSizeView(IMAGE, VIEWPORT)).toEqual({ scale: 1, x: -750, y: -250 });
        });
    });

    describe('zoomAt', () => {
        test('keeps the image point under the focal point fixed', () => {
            const view = { scale: 1, x: -700, y: -200 };
            const focal = { x: 100, y: 300 };
            // ズーム前に focal の下にある画像座標
            const before = { x: (focal.x - view.x) / view.scale, y: (focal.y - view.y) / view.scale };
            const next = zoomAt(view, 2, focal, IMAGE, VIEWPORT);
            expect(next.scale).toBe(2);
            expect((focal.x - next.x) / next.scale).toBeCloseTo(before.x);
            expect((focal.y - next.y) / next.scale).toBeCloseTo(before.y);
        });

        test('clamps the scale to the upper limit', () => {
            const next = zoomAt({ scale: 3, x: -700, y: -200 }, 100, { x: 250, y: 250 }, IMAGE, VIEWPORT);
            expect(next.scale).toBe(MAX_SCALE);
        });

        test('clamps the scale to the fit scale and re-centers', () => {
            const next = zoomAt({ scale: 1, x: -700, y: -200 }, 0.01, { x: 0, y: 0 }, IMAGE, VIEWPORT);
            expect(next).toEqual({ scale: 0.25, x: 0, y: 125 });
        });

        test('keeps the pan inside the range after zooming', () => {
            // 左上角で縮小しても画像がビューポートの外へ逃げない
            const next = zoomAt({ scale: 2, x: 0, y: 0 }, 1, { x: 500, y: 500 }, IMAGE, VIEWPORT);
            expect(next.x).toBeLessThanOrEqual(0);
            expect(next.x).toBeGreaterThanOrEqual(VIEWPORT.width - IMAGE.width);
            expect(next.y).toBeLessThanOrEqual(0);
            expect(next.y).toBeGreaterThanOrEqual(VIEWPORT.height - IMAGE.height);
        });
    });

    describe('zoomByStep', () => {
        test('zooms in and out around the viewport center by a fixed factor', () => {
            const view = actualSizeView(IMAGE, VIEWPORT);
            const zoomedIn = zoomByStep(view, 1, IMAGE, VIEWPORT);
            expect(zoomedIn.scale).toBeCloseTo(1.25);
            const zoomedOut = zoomByStep(view, -1, IMAGE, VIEWPORT);
            expect(zoomedOut.scale).toBeCloseTo(0.8);
            // 中心にあった画像点 (1000, 500) は中心に留まる
            expect((250 - zoomedIn.x) / zoomedIn.scale).toBeCloseTo(1000);
            expect((250 - zoomedIn.y) / zoomedIn.scale).toBeCloseTo(500);
        });
    });

    describe('panBy', () => {
        test('moves the view and clamps it to the pan range', () => {
            const view = { scale: 1, x: -700, y: -200 };
            expect(panBy(view, { x: 50, y: -50 }, IMAGE, VIEWPORT)).toEqual({ scale: 1, x: -650, y: -250 });
            expect(panBy(view, { x: 5000, y: 5000 }, IMAGE, VIEWPORT)).toEqual({ scale: 1, x: 0, y: 0 });
        });

        test('cannot move an image that is fully visible', () => {
            const view = fitView(IMAGE, VIEWPORT);
            expect(panBy(view, { x: 100, y: 100 }, IMAGE, VIEWPORT)).toEqual(view);
        });
    });

    describe('pinchView', () => {
        test('scales by the finger distance ratio around the midpoint and follows the midpoint', () => {
            const view = { scale: 1, x: -700, y: -200 };
            const prev = [
                { x: 200, y: 250 },
                { x: 300, y: 250 },
            ];
            const curr = [
                { x: 160, y: 260 },
                { x: 360, y: 260 },
            ];
            const next = pinchView(view, prev, curr, IMAGE, VIEWPORT);
            expect(next.scale).toBeCloseTo(2);
            // 前回の中点の下にあった画像点が、今回の中点の下に来る
            const imgX = (250 - view.x) / view.scale;
            const imgY = (250 - view.y) / view.scale;
            expect((260 - next.x) / next.scale).toBeCloseTo(imgX);
            expect((260 - next.y) / next.scale).toBeCloseTo(imgY);
        });

        test('ignores a degenerate pinch (zero distance)', () => {
            const view = { scale: 1, x: -700, y: -200 };
            const p = [
                { x: 10, y: 10 },
                { x: 10, y: 10 },
            ];
            expect(pinchView(view, p, p, IMAGE, VIEWPORT)).toEqual(view);
        });
    });

    describe('normalizeWheelDelta', () => {
        test('converts line and page deltas to pixels', () => {
            expect(normalizeWheelDelta({ deltaY: 3, deltaMode: 0 })).toBe(3);
            expect(normalizeWheelDelta({ deltaY: 3, deltaMode: 1 })).toBe(48);
            expect(normalizeWheelDelta({ deltaY: 1, deltaMode: 2 })).toBe(800);
        });
    });
});
