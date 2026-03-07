/**
 * Renders furigana annotations in Monaco Editor using ViewZones.
 *
 * Each line with annotations gets a ViewZone inserted above it.
 * The zone's DOM element contains absolutely-positioned spans for each token's furigana label,
 * aligned to the token's column position using the editor's monospace font metrics.
 */
class FuriganaRenderer {
    constructor () {
        this._viewZoneIds = [];
        this._enabled = false;
    }

    get enabled () {
        return this._enabled;
    }

    /**
     * Render furigana ViewZones for all annotated lines.
     * @param {object} editor - Monaco editor instance
     * @param {object} monaco - Monaco namespace
     * @param {Map} annotations - Map<lineNumber, Array<{startColumn, label}>> from FuriganaAnnotator
     */
    render (editor, monaco, annotations) {
        this.clear(editor);
        this._enabled = true;

        if (!annotations || annotations.size === 0) return;

        const fontInfo = editor.getOption(monaco.editor.EditorOption.fontInfo);
        const charWidth = fontInfo.typicalHalfwidthCharacterWidth;
        const lineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight);

        // Height for each furigana zone: half a line height, minimum 12px
        const zoneHeight = Math.max(12, Math.floor(lineHeight * 0.55));
        const fontSize = Math.max(9, Math.floor(zoneHeight * 0.75));

        editor.changeViewZones(accessor => {
            for (const [lineNumber, anns] of annotations) {
                const domNode = this._createZoneDom(
                    anns, charWidth, zoneHeight, fontSize
                );

                const zoneId = accessor.addZone({
                    afterLineNumber: lineNumber - 1, // insert above this line
                    heightInPx: zoneHeight,
                    domNode
                });
                this._viewZoneIds.push(zoneId);
            }
        });
    }

    /**
     * Remove all furigana ViewZones from the editor.
     * @param {object} editor - Monaco editor instance
     */
    clear (editor) {
        this._enabled = false;
        if (this._viewZoneIds.length === 0) return;
        editor.changeViewZones(accessor => {
            this._viewZoneIds.forEach(id => accessor.removeZone(id));
        });
        this._viewZoneIds = [];
    }

    /**
     * Re-render with updated annotations (clear then render).
     * @param {object} editor - Monaco editor instance
     * @param {object} monaco - Monaco namespace
     * @param {Map} annotations - Map from FuriganaAnnotator
     */
    update (editor, monaco, annotations) {
        this.render(editor, monaco, annotations);
    }

    _createZoneDom (anns, charWidth, zoneHeight, fontSize) {
        const div = document.createElement('div');
        div.style.position = 'relative';
        div.style.height = `${zoneHeight}px`;
        div.style.overflow = 'hidden';
        div.style.pointerEvents = 'none';

        const GAP = 4; // minimum gap between adjacent labels (px)
        let prevRight = 0; // right edge (px) of previous label

        for (const ann of anns) {
            const span = document.createElement('span');
            span.textContent = ann.label;
            span.style.position = 'absolute';
            // .view-zones container is already offset by contentLeft,
            // so span.left = column * charWidth (no contentLeft needed).
            // Push right if needed to avoid overlapping the previous label.
            const naturalLeft = ann.startColumn * charWidth;
            const left = Math.max(naturalLeft, prevRight);
            span.style.left = `${left}px`;
            span.style.bottom = '1px';
            span.style.fontSize = `${fontSize}px`;
            span.style.lineHeight = '1';
            span.style.color = '#888888';
            span.style.fontFamily = 'sans-serif';
            span.style.whiteSpace = 'nowrap';
            span.style.userSelect = 'none';
            div.appendChild(span);

            prevRight = left + this._measureTextWidth(ann.label, fontSize) + GAP;
        }

        return div;
    }

    /**
     * Measure text width using an offscreen canvas (no DOM insertion needed).
     * The canvas context is cached for performance.
     */
    _measureTextWidth (text, fontSize) {
        if (!this._measureCanvas) {
            this._measureCanvas = document.createElement('canvas');
        }
        const ctx = this._measureCanvas.getContext('2d');
        ctx.font = `${fontSize}px sans-serif`;
        return ctx.measureText(text).width;
    }
}

export default FuriganaRenderer;
