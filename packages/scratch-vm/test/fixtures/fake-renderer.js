const FakeRenderer = function () {
    this.unused = '';
    this.x = 0;
    this.y = 0;
    this.order = 0;
    this.spriteCount = 5;
    this._nextSkinId = -1;
};

FakeRenderer.prototype.createSVGSkin = function () {
    return this._nextSkinId++;
};

FakeRenderer.prototype.createBitmapSkin = function () {
    return this._nextSkinId++;
};

FakeRenderer.prototype.getSkinSize = function (d) {
    return [0, 0];
};

FakeRenderer.prototype.getSkinRotationCenter = function (d) {
    return [0, 0];
};

FakeRenderer.prototype.createDrawable = function () {
    return true;
};

FakeRenderer.prototype.getFencedPositionOfDrawable = function (d, p) {
    return [p[0], p[1]];
};

FakeRenderer.prototype.updateDrawableSkinId = function (d, skinId) {
};

FakeRenderer.prototype.updateDrawablePosition = function (d, position) {
    this.x = position[0];
    this.y = position[1];
};

FakeRenderer.prototype.updateDrawableDirectionScale =
    function (d, direction, scale) {};

FakeRenderer.prototype.updateDrawableVisible = function (d, visible) {
};

FakeRenderer.prototype.updateDrawableEffect = function (d, effectName, value) {
};

FakeRenderer.prototype.getCurrentSkinSize = function (d) {
    return [0, 0];
};

FakeRenderer.prototype.pick = function (x, y, a, b, d) {
    return true;
};

FakeRenderer.prototype.drawableTouching = function (d, x, y, w, h) {
    return true;
};

FakeRenderer.prototype.isTouchingColor = function (d, c) {
    return true;
};

FakeRenderer.prototype.getBounds = function (d) {
    return {left: this.x, right: this.x, top: this.y, bottom: this.y};
};

FakeRenderer.prototype.setDrawableOrder = function (d, a, optG, optA, optB) {
    if (d === 999) return 1; // fake for test case
    if (optA) {
        a += this.order;
    }
    if (optB) {
        a = Math.max(a, optB);
    }
    a = Math.max(a, 0);
    this.order = Math.min(a, this.spriteCount);
    return this.order;
};

FakeRenderer.prototype.getDrawableOrder = function (d) {
    return 'stub';
};

FakeRenderer.prototype.pick = function (x, y, a, b, c) {
    return c[0];
};

FakeRenderer.prototype.isTouchingColor = function (a, b) {
    return false;
};

FakeRenderer.prototype.setLayerGroupOrdering = function (a) {};

module.exports = FakeRenderer;
