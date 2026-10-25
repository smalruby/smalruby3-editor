/**
 * 画像ビューア (`components/image-viewer/`) のズーム・パン計算。
 *
 * React から切り離した純粋関数にして、ズーム中心の維持・倍率の上下限・パン範囲を
 * unit テストで担保する。
 *
 * 座標系: ビュー `{scale, x, y}` は「画像の左上をビューポート座標 (x, y) に置き、
 * scale 倍で描く」ことを表す。ビューポート上の点 p の下にある画像座標は
 * `(p - {x, y}) / scale`。
 */

/** ズーム倍率の上限 (400%)。下限は「全体を表示」の倍率。 */
const MAX_SCALE = 4;

/** ボタン / キーボードによる 1 段階のズーム倍率。 */
const ZOOM_STEP = 1.25;

/** ホイール 1px あたりのズーム量 (指数で効かせ、行き来しても元の倍率に戻るようにする)。 */
const WHEEL_ZOOM_SPEED = 0.002;

/** WheelEvent.deltaMode の LINE / PAGE をピクセルへ換算する係数。 */
const WHEEL_LINE_PX = 16;
const WHEEL_PAGE_PX = 800;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const hasSize = (size) => Boolean(size) && size.width > 0 && size.height > 0;

/**
 * 画像全体がビューポートに収まる倍率。小さな画像は拡大しない (最大 1)。
 * @param {{width: number, height: number}} image - 画像の実寸
 * @param {{width: number, height: number}} viewport - ビューポートの大きさ
 * @returns {number} 倍率 (寸法が不明なら 1)
 */
const fitScale = (image, viewport) => {
    if (!hasSize(image) || !hasSize(viewport)) return 1;
    return Math.min(viewport.width / image.width, viewport.height / image.height, 1);
};

/**
 * ズーム倍率の上下限。下限 = 全体表示、上限 = 400%。
 * @param {{width: number, height: number}} image - 画像の実寸
 * @param {{width: number, height: number}} viewport - ビューポートの大きさ
 * @returns {{min: number, max: number}} 上下限
 */
const scaleLimits = (image, viewport) => {
    const min = fitScale(image, viewport);
    return { min, max: Math.max(MAX_SCALE, min) };
};

/**
 * 倍率を上下限に収める。
 * @param {number} scale - 倍率
 * @param {{min: number, max: number}} limits - 上下限
 * @returns {number} 収めた倍率
 */
const clampScale = (scale, limits) => clamp(scale, limits.min, limits.max);

const clampAxis = (offset, imageLength, viewportLength) => {
    // ビューポートより小さい軸は中央寄せ、大きい軸は画像がビューポートを覆い続ける範囲
    if (imageLength <= viewportLength) return (viewportLength - imageLength) / 2;
    return clamp(offset, viewportLength - imageLength, 0);
};

/**
 * パン位置を「画像がビューポートの外へ逃げない」範囲に収める。
 * @param {{scale: number, x: number, y: number}} view - ビュー
 * @param {{width: number, height: number}} image - 画像の実寸
 * @param {{width: number, height: number}} viewport - ビューポートの大きさ
 * @returns {{scale: number, x: number, y: number}} 収めたビュー
 */
const clampPan = (view, image, viewport) => ({
    scale: view.scale,
    x: clampAxis(view.x, image.width * view.scale, viewport.width),
    y: clampAxis(view.y, image.height * view.scale, viewport.height),
});

/**
 * 画像中心をビューポート中心に置いたビュー。
 * @param {number} scale - 倍率
 * @param {{width: number, height: number}} image - 画像の実寸
 * @param {{width: number, height: number}} viewport - ビューポートの大きさ
 * @returns {{scale: number, x: number, y: number}} ビュー
 */
const centeredView = (scale, image, viewport) =>
    clampPan(
        {
            scale,
            x: (viewport.width - image.width * scale) / 2,
            y: (viewport.height - image.height * scale) / 2,
        },
        image,
        viewport,
    );

/**
 * 「全体を表示」のビュー。
 * @param {{width: number, height: number}} image - 画像の実寸
 * @param {{width: number, height: number}} viewport - ビューポートの大きさ
 * @returns {{scale: number, x: number, y: number}} ビュー
 */
const fitView = (image, viewport) => centeredView(fitScale(image, viewport), image, viewport);

/**
 * 「100%」のビュー (画像中心を表示)。
 * @param {{width: number, height: number}} image - 画像の実寸
 * @param {{width: number, height: number}} viewport - ビューポートの大きさ
 * @returns {{scale: number, x: number, y: number}} ビュー
 */
const actualSizeView = (image, viewport) =>
    centeredView(clampScale(1, scaleLimits(image, viewport)), image, viewport);

/**
 * focal (ビューポート座標) の下にある画像の点を動かさずに倍率を変える。
 * @param {{scale: number, x: number, y: number}} view - ビュー
 * @param {number} scale - 新しい倍率 (上下限に収められる)
 * @param {{x: number, y: number}} focal - ズームの中心 (カーソル / ピンチの中点)
 * @param {{width: number, height: number}} image - 画像の実寸
 * @param {{width: number, height: number}} viewport - ビューポートの大きさ
 * @returns {{scale: number, x: number, y: number}} 新しいビュー
 */
const zoomAt = (view, scale, focal, image, viewport) => {
    const next = clampScale(scale, scaleLimits(image, viewport));
    const ratio = next / view.scale;
    return clampPan(
        {
            scale: next,
            x: focal.x - (focal.x - view.x) * ratio,
            y: focal.y - (focal.y - view.y) * ratio,
        },
        image,
        viewport,
    );
};

/**
 * ビューポート中心を基準に 1 段階ズームする (ボタン / キーボード用)。
 * @param {{scale: number, x: number, y: number}} view - ビュー
 * @param {number} direction - 1 = 拡大、-1 = 縮小
 * @param {{width: number, height: number}} image - 画像の実寸
 * @param {{width: number, height: number}} viewport - ビューポートの大きさ
 * @returns {{scale: number, x: number, y: number}} 新しいビュー
 */
const zoomByStep = (view, direction, image, viewport) =>
    zoomAt(
        view,
        view.scale * Math.pow(ZOOM_STEP, direction),
        { x: viewport.width / 2, y: viewport.height / 2 },
        image,
        viewport,
    );

/**
 * ホイールの deltaY をピクセル単位にそろえる。
 * @param {{deltaY: number, deltaMode: number}} event - WheelEvent 相当
 * @returns {number} ピクセル換算の deltaY
 */
const normalizeWheelDelta = (event) => {
    if (event.deltaMode === 1) return event.deltaY * WHEEL_LINE_PX;
    if (event.deltaMode === 2) return event.deltaY * WHEEL_PAGE_PX;
    return event.deltaY;
};

/**
 * ホイール 1 回分のズーム後の倍率。
 * @param {number} scale - 現在の倍率
 * @param {number} deltaPx - ピクセル換算の deltaY (正 = 縮小)
 * @returns {number} 新しい倍率 (上下限は zoomAt が収める)
 */
const wheelScale = (scale, deltaPx) => scale * Math.exp(-deltaPx * WHEEL_ZOOM_SPEED);

/**
 * 表示位置を動かす (ドラッグ / 1 本指スワイプ / 矢印キー)。
 * @param {{scale: number, x: number, y: number}} view - ビュー
 * @param {{x: number, y: number}} delta - 移動量 (ビューポート座標)
 * @param {{width: number, height: number}} image - 画像の実寸
 * @param {{width: number, height: number}} viewport - ビューポートの大きさ
 * @returns {{scale: number, x: number, y: number}} 新しいビュー
 */
const panBy = (view, delta, image, viewport) =>
    clampPan({ scale: view.scale, x: view.x + delta.x, y: view.y + delta.y }, image, viewport);

const midpoint = ([a, b]) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

const distance = ([a, b]) => Math.hypot(b.x - a.x, b.y - a.y);

/**
 * 2 本指ピンチの 1 ステップ。指の間隔の比で拡大縮小し、前回の中点の下にあった
 * 画像の点を今回の中点へ動かす (ズームしながらのパンも兼ねる)。
 * @param {{scale: number, x: number, y: number}} view - ビュー
 * @param {Array<{x: number, y: number}>} prev - 前回の 2 点
 * @param {Array<{x: number, y: number}>} curr - 今回の 2 点
 * @param {{width: number, height: number}} image - 画像の実寸
 * @param {{width: number, height: number}} viewport - ビューポートの大きさ
 * @returns {{scale: number, x: number, y: number}} 新しいビュー
 */
const pinchView = (view, prev, curr, image, viewport) => {
    const prevDistance = distance(prev);
    const currDistance = distance(curr);
    if (prevDistance === 0 || currDistance === 0) return view;
    const prevMid = midpoint(prev);
    const currMid = midpoint(curr);
    const zoomed = zoomAt(view, view.scale * (currDistance / prevDistance), prevMid, image, viewport);
    return panBy(zoomed, { x: currMid.x - prevMid.x, y: currMid.y - prevMid.y }, image, viewport);
};

export {
    MAX_SCALE,
    ZOOM_STEP,
    actualSizeView,
    clampPan,
    clampScale,
    fitScale,
    fitView,
    normalizeWheelDelta,
    panBy,
    pinchView,
    scaleLimits,
    wheelScale,
    zoomAt,
    zoomByStep,
};
