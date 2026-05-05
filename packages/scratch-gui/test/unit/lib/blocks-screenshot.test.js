import {
    getBlocksBoundingBox,
    mergeWithBubbleBBox,
    calculateCanvasDimensions,
    buildFilename,
    buildExportSVG,
    downloadBlocksAsImage,
    stripExternalCssUrls,
    EXPORT_PADDING,
} from '../../../src/lib/blocks-screenshot';
import downloadBlob from '../../../src/lib/download-blob';

jest.mock('../../../src/lib/download-blob', () => jest.fn());

// Helper: create a mock Blockly workspace
const makeMockWorkspace = ({
    boundingBox = null,
    scale = 1,
    bubbleChildren = 0,
    withForeignObject = false,
    blockCanvasForeignObjectCount = 0,
} = {}) => {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    const group = document.createElementNS(svgNS, 'g');
    svg.appendChild(group);
    const bubbleGroup = document.createElementNS(svgNS, 'g');
    svg.appendChild(bubbleGroup);
    for (let i = 0; i < bubbleChildren; i++) {
        const rect = document.createElementNS(svgNS, 'rect');
        rect.setAttribute('x', '100');
        rect.setAttribute('y', '50');
        rect.setAttribute('width', '30');
        rect.setAttribute('height', '20');
        bubbleGroup.appendChild(rect);
    }
    if (withForeignObject) {
        const fo = document.createElementNS(svgNS, 'foreignObject');
        fo.setAttribute('class', 'scratchCommentForeignObject');
        const body = document.createElementNS('http://www.w3.org/1999/xhtml', 'body');
        fo.appendChild(body);
        bubbleGroup.appendChild(fo);
    }
    // In scratch-blocks v2, block comments live inside the block canvas (not
    // the bubble canvas) and contain `<foreignObject>` for the editing UI.
    for (let i = 0; i < blockCanvasForeignObjectCount; i++) {
        const fo = document.createElementNS(svgNS, 'foreignObject');
        fo.setAttribute('class', 'blocklyCommentForeignObject');
        const body = document.createElementNS('http://www.w3.org/1999/xhtml', 'body');
        fo.appendChild(body);
        group.appendChild(fo);
    }
    return {
        getBlocksBoundingBox: jest.fn(() => boundingBox),
        scale,
        // scratch-blocks v2 exposes the canvases as methods.
        getCanvas: jest.fn(() => group),
        getBubbleCanvas: jest.fn(() => bubbleGroup),
    };
};

// ---- stripExternalCssUrls ----

describe('stripExternalCssUrls', () => {
    test('strips relative cursor / sprite urls', () => {
        const css = '.x { cursor: url("./static/blocks-media/default/handclosed.cur"), default; }';
        expect(stripExternalCssUrls(css)).toBe('.x { cursor: none, default; }');
    });

    test('strips background-image with relative url', () => {
        const css = '.y { background: url(./static/sprites.png) no-repeat; }';
        expect(stripExternalCssUrls(css)).toBe('.y { background: none no-repeat; }');
    });

    test('strips absolute http urls (canvas would taint them too)', () => {
        const css = '.z { cursor: url(https://cdn.example.com/c.cur), default; }';
        expect(stripExternalCssUrls(css)).toBe('.z { cursor: none, default; }');
    });

    test('keeps in-document references like url(#filter)', () => {
        const css = '.a { filter: url(#blocklyDragShadowFilter); }';
        expect(stripExternalCssUrls(css)).toBe('.a { filter: url(#blocklyDragShadowFilter); }');
    });

    test('keeps data: URIs', () => {
        const css = '.b { background: url(data:image/svg+xml;base64,PHN2Z); }';
        expect(stripExternalCssUrls(css)).toBe(css);
    });

    test('handles css with no url() refs unchanged', () => {
        const css = '.blocklyText { fill: #fff; font-size: 12pt; }';
        expect(stripExternalCssUrls(css)).toBe(css);
    });

    test('handles multiple urls in one rule', () => {
        const css = '.c { cursor: url(./a.cur) 0 0, url(#fb) 0 0, default; }';
        expect(stripExternalCssUrls(css)).toBe('.c { cursor: none 0 0, url(#fb) 0 0, default; }');
    });
});

// ---- getBlocksBoundingBox ----

describe('getBlocksBoundingBox', () => {
    test('returns null when bounding box is a zero-area point (no blocks)', () => {
        const workspace = makeMockWorkspace({ boundingBox: { x: 0, y: 0, width: 0, height: 0 } });
        expect(getBlocksBoundingBox(workspace)).toBeNull();
    });

    test('returns null when workspace.getBlocksBoundingBox returns null', () => {
        const workspace = makeMockWorkspace({ boundingBox: null });
        expect(getBlocksBoundingBox(workspace)).toBeNull();
    });

    test('returns bounding box when blocks exist', () => {
        const bbox = { x: 20, y: 10, width: 200, height: 100 };
        const workspace = makeMockWorkspace({ boundingBox: bbox });
        expect(getBlocksBoundingBox(workspace)).toEqual(bbox);
    });

    test('returns bounding box with negative top-left coordinates', () => {
        const bbox = { x: -30, y: -50, width: 100, height: 100 };
        const workspace = makeMockWorkspace({ boundingBox: bbox });
        expect(getBlocksBoundingBox(workspace)).toEqual(bbox);
    });
});

// ---- mergeWithBubbleBBox ----

describe('mergeWithBubbleBBox', () => {
    test('returns original bbox when bubble canvas has no children', () => {
        const workspace = makeMockWorkspace({ boundingBox: { x: 10, y: 20, width: 200, height: 100 } });
        const bbox = { x: 10, y: 20, width: 200, height: 100 };
        expect(mergeWithBubbleBBox(workspace, bbox)).toEqual(bbox);
    });

    test('returns original bbox when workspace has no bubble canvas', () => {
        const workspace = makeMockWorkspace({ boundingBox: { x: 10, y: 20, width: 200, height: 100 } });
        workspace.getBubbleCanvas = jest.fn(() => null);
        const bbox = { x: 10, y: 20, width: 200, height: 100 };
        expect(mergeWithBubbleBBox(workspace, bbox)).toEqual(bbox);
    });

    test('expands bbox to include bubble canvas bounds', () => {
        const workspace = makeMockWorkspace({
            boundingBox: { x: 10, y: 20, width: 200, height: 100 },
            bubbleChildren: 2,
        });
        // Mock getBBox to return a region outside the block bbox
        workspace.getBubbleCanvas().getBBox = jest.fn(() => ({
            x: 250,
            y: 10,
            width: 80,
            height: 40,
        }));
        const bbox = { x: 10, y: 20, width: 200, height: 100 };
        const merged = mergeWithBubbleBBox(workspace, bbox);
        // minX=10, minY=10, maxX=330, maxY=120
        expect(merged).toEqual({ x: 10, y: 10, width: 320, height: 110 });
    });
});

// ---- calculateCanvasDimensions ----

describe('calculateCanvasDimensions', () => {
    test('includes padding on all sides at scale=1', () => {
        const bbox = { x: 0, y: 0, width: 200, height: 100 };
        const { width, height } = calculateCanvasDimensions(bbox, 1);
        expect(width).toBe(200 + EXPORT_PADDING * 2);
        expect(height).toBe(100 + EXPORT_PADDING * 2);
    });

    test('applies scale to block dimensions', () => {
        const bbox = { x: 0, y: 0, width: 200, height: 100 };
        const scale = 1.5;
        const { width, height } = calculateCanvasDimensions(bbox, scale);
        expect(width).toBe(Math.ceil(200 * scale + EXPORT_PADDING * 2));
        expect(height).toBe(Math.ceil(100 * scale + EXPORT_PADDING * 2));
    });

    test('handles bounding box with non-zero origin', () => {
        const bbox = { x: 30, y: 50, width: 200, height: 100 };
        const { width, height } = calculateCanvasDimensions(bbox, 1);
        expect(width).toBe(200 + EXPORT_PADDING * 2);
        expect(height).toBe(100 + EXPORT_PADDING * 2);
    });

    test('single block is small with minimal extra padding', () => {
        // A single block might be ~150x50 workspace units
        const bbox = { x: 100, y: 100, width: 150, height: 50 };
        const { width, height } = calculateCanvasDimensions(bbox, 1);
        expect(width).toBe(150 + EXPORT_PADDING * 2); // 150 + 32 = 182
        expect(height).toBe(50 + EXPORT_PADDING * 2); // 50 + 32 = 82
        // Verify padding is small (less than 50px total)
        expect(EXPORT_PADDING * 2).toBeLessThan(50);
    });
});

// ---- buildFilename ----

describe('buildFilename', () => {
    test('builds filename from project and sprite names', () => {
        expect(buildFilename('myProject', 'Sprite1')).toBe('myProject_Sprite1.png');
    });

    test('handles Japanese project and sprite names', () => {
        expect(buildFilename('スモウルビーのプロジェクト', 'スプライト1')).toBe(
            'スモウルビーのプロジェクト_スプライト1.png',
        );
    });

    test('handles stage (ステージ)', () => {
        expect(buildFilename('project', 'Stage')).toBe('project_Stage.png');
    });
});

// ---- buildExportSVG ----

describe('buildExportSVG', () => {
    test('includes bubble canvas clone in exported SVG', async () => {
        const workspace = makeMockWorkspace({
            boundingBox: { x: 0, y: 0, width: 200, height: 100 },
            bubbleChildren: 3,
        });
        const bbox = { x: 0, y: 0, width: 200, height: 100 };
        const svgStr = await buildExportSVG(workspace, bbox, 1, 232, 132);
        // Count <g elements — block canvas + bubble canvas (each is a <g>)
        const gMatches = svgStr.match(/<g[\s>/]/g) || [];
        expect(gMatches.length).toBeGreaterThanOrEqual(2);
        // Bubble canvas children (rect elements) should be present
        const rectMatches = svgStr.match(/<rect[\s>/]/g) || [];
        // 1 background rect + 3 bubble rects = at least 4
        expect(rectMatches.length).toBeGreaterThanOrEqual(4);
    });

    test('strips foreignObject elements from bubble canvas clone to avoid tainted canvas', async () => {
        const workspace = makeMockWorkspace({
            boundingBox: { x: 0, y: 0, width: 200, height: 100 },
            bubbleChildren: 1,
            withForeignObject: true,
        });
        const bbox = { x: 0, y: 0, width: 200, height: 100 };
        const svgStr = await buildExportSVG(workspace, bbox, 1, 232, 132);
        expect(svgStr).not.toMatch(/foreignObject/);
    });

    test('strips foreignObject elements from block canvas clone (v2 comments)', async () => {
        const workspace = makeMockWorkspace({
            boundingBox: { x: 0, y: 0, width: 200, height: 100 },
            blockCanvasForeignObjectCount: 4,
        });
        const bbox = { x: 0, y: 0, width: 200, height: 100 };
        const svgStr = await buildExportSVG(workspace, bbox, 1, 232, 132);
        expect(svgStr).not.toMatch(/foreignObject/);
    });

    test('does not include bubble canvas when it has no children', async () => {
        const workspace = makeMockWorkspace({
            boundingBox: { x: 0, y: 0, width: 200, height: 100 },
            bubbleChildren: 0,
        });
        const bbox = { x: 0, y: 0, width: 200, height: 100 };
        const svgStr = await buildExportSVG(workspace, bbox, 1, 232, 132);
        // Count <g elements — only block canvas (1 group)
        const gMatches = svgStr.match(/<g[\s>/]/g) || [];
        expect(gMatches.length).toBe(1);
        // Only background rect, no bubble rects
        const rectMatches = svgStr.match(/<rect[\s>/]/g) || [];
        expect(rectMatches.length).toBe(1);
    });
});

// ---- downloadBlocksAsImage ----

describe('downloadBlocksAsImage', () => {
    beforeEach(() => {
        downloadBlob.mockClear();
        // Mock URL APIs (not available in jsdom by default)
        global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
        global.URL.revokeObjectURL = jest.fn();
        // Mock canvas APIs
        HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
            fillStyle: '',
            fillRect: jest.fn(),
            drawImage: jest.fn(),
        }));
        HTMLCanvasElement.prototype.toBlob = jest.fn(function (callback) {
            callback(new Blob(['fake-png'], { type: 'image/png' }));
        });
        // Mock Image: triggers onload immediately
        global.Image = class {
            set src(_url) {
                // eslint-disable-line accessor-pairs
                setTimeout(() => this.onload && this.onload(), 0);
            }
        };
    });

    test('does nothing when workspace has no blocks', async () => {
        const workspace = makeMockWorkspace({ boundingBox: { x: 0, y: 0, width: 0, height: 0 } });
        await downloadBlocksAsImage(workspace, 'project', 'sprite');
        expect(downloadBlob).not.toHaveBeenCalled();
    });

    test('downloads PNG with correct filename', async () => {
        const workspace = makeMockWorkspace({
            boundingBox: { x: 0, y: 0, width: 200, height: 100 },
            scale: 1,
        });
        await downloadBlocksAsImage(workspace, 'myProject', 'Sprite1');
        expect(downloadBlob).toHaveBeenCalledWith('myProject_Sprite1.png', expect.any(Blob));
    });

    test('canvas dimensions include padding', async () => {
        const bbox = { x: 0, y: 0, width: 200, height: 100 };
        const workspace = makeMockWorkspace({ boundingBox: bbox, scale: 1 });

        let capturedCanvas;
        const realCreateElement = document.createElement.bind(document);
        jest.spyOn(document, 'createElement').mockImplementation((tag) => {
            const el = realCreateElement(tag);
            if (tag === 'canvas') capturedCanvas = el;
            return el;
        });

        await downloadBlocksAsImage(workspace, 'p', 's');

        expect(capturedCanvas.width).toBe(200 + EXPORT_PADDING * 2);
        expect(capturedCanvas.height).toBe(100 + EXPORT_PADDING * 2);

        document.createElement.mockRestore();
    });

    test('canvas dimensions respect scale', async () => {
        const bbox = { x: 0, y: 0, width: 200, height: 100 };
        const scale = 2;
        const workspace = makeMockWorkspace({ boundingBox: bbox, scale });

        let capturedCanvas;
        const realCreateElement = document.createElement.bind(document);
        jest.spyOn(document, 'createElement').mockImplementation((tag) => {
            const el = realCreateElement(tag);
            if (tag === 'canvas') capturedCanvas = el;
            return el;
        });

        await downloadBlocksAsImage(workspace, 'p', 's');

        expect(capturedCanvas.width).toBe(200 * scale + EXPORT_PADDING * 2);
        expect(capturedCanvas.height).toBe(100 * scale + EXPORT_PADDING * 2);

        document.createElement.mockRestore();
    });
});
