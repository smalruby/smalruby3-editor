import {
    getBlocksBoundingBox,
    calculateCanvasDimensions,
    buildFilename,
    downloadBlocksAsImage,
    EXPORT_PADDING
} from '../../../src/lib/blocks-screenshot';

jest.mock('../../../src/lib/download-blob', () => jest.fn());
import downloadBlob from '../../../src/lib/download-blob';

// Helper: create a mock Blockly workspace
const makeMockWorkspace = ({boundingBox = null, scale = 1} = {}) => {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    const group = document.createElementNS(svgNS, 'g');
    svg.appendChild(group);
    // ownerSVGElement is read-only on real SVG elements, but we can assign it on a plain obj
    const blockCanvas = group;
    return {
        getBlocksBoundingBox: jest.fn(() => boundingBox),
        scale,
        svgBlockCanvas_: blockCanvas
    };
};

// ---- getBlocksBoundingBox ----

describe('getBlocksBoundingBox', () => {
    test('returns null when bounding box is a zero-area point (no blocks)', () => {
        const workspace = makeMockWorkspace({boundingBox: {top: 0, bottom: 0, left: 0, right: 0}});
        expect(getBlocksBoundingBox(workspace)).toBeNull();
    });

    test('returns null when workspace.getBlocksBoundingBox returns null', () => {
        const workspace = makeMockWorkspace({boundingBox: null});
        expect(getBlocksBoundingBox(workspace)).toBeNull();
    });

    test('returns bounding box when blocks exist', () => {
        const bbox = {top: 10, bottom: 110, left: 20, right: 220};
        const workspace = makeMockWorkspace({boundingBox: bbox});
        expect(getBlocksBoundingBox(workspace)).toEqual(bbox);
    });

    test('returns bounding box with negative top-left coordinates', () => {
        const bbox = {top: -50, bottom: 50, left: -30, right: 70};
        const workspace = makeMockWorkspace({boundingBox: bbox});
        expect(getBlocksBoundingBox(workspace)).toEqual(bbox);
    });
});

// ---- calculateCanvasDimensions ----

describe('calculateCanvasDimensions', () => {
    test('includes padding on all sides at scale=1', () => {
        const bbox = {top: 0, bottom: 100, left: 0, right: 200};
        const {width, height} = calculateCanvasDimensions(bbox, 1);
        expect(width).toBe(200 + EXPORT_PADDING * 2);
        expect(height).toBe(100 + EXPORT_PADDING * 2);
    });

    test('applies scale to block dimensions', () => {
        const bbox = {top: 0, bottom: 100, left: 0, right: 200};
        const scale = 1.5;
        const {width, height} = calculateCanvasDimensions(bbox, scale);
        expect(width).toBe(Math.ceil(200 * scale + EXPORT_PADDING * 2));
        expect(height).toBe(Math.ceil(100 * scale + EXPORT_PADDING * 2));
    });

    test('handles bounding box with non-zero origin', () => {
        const bbox = {top: 50, bottom: 150, left: 30, right: 230};
        const {width, height} = calculateCanvasDimensions(bbox, 1);
        expect(width).toBe(200 + EXPORT_PADDING * 2); // right - left = 200
        expect(height).toBe(100 + EXPORT_PADDING * 2); // bottom - top = 100
    });

    test('single block is small with minimal extra padding', () => {
        // A single block might be ~150x50 workspace units
        const bbox = {top: 100, bottom: 150, left: 100, right: 250};
        const {width, height} = calculateCanvasDimensions(bbox, 1);
        expect(width).toBe(150 + EXPORT_PADDING * 2); // 150 + 32 = 182
        expect(height).toBe(50 + EXPORT_PADDING * 2);  // 50 + 32 = 82
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
            'スモウルビーのプロジェクト_スプライト1.png'
        );
    });

    test('handles stage (ステージ)', () => {
        expect(buildFilename('project', 'Stage')).toBe('project_Stage.png');
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
            drawImage: jest.fn()
        }));
        HTMLCanvasElement.prototype.toBlob = jest.fn(function (callback) {
            callback(new Blob(['fake-png'], {type: 'image/png'}));
        });
        // Mock Image: triggers onload immediately
        global.Image = class {
            set src (_url) { // eslint-disable-line accessor-pairs
                setTimeout(() => this.onload && this.onload(), 0);
            }
        };
    });

    test('does nothing when workspace has no blocks', async () => {
        const workspace = makeMockWorkspace({boundingBox: {top: 0, bottom: 0, left: 0, right: 0}});
        await downloadBlocksAsImage(workspace, 'project', 'sprite');
        expect(downloadBlob).not.toHaveBeenCalled();
    });

    test('downloads PNG with correct filename', async () => {
        const workspace = makeMockWorkspace({
            boundingBox: {top: 0, bottom: 100, left: 0, right: 200},
            scale: 1
        });
        await downloadBlocksAsImage(workspace, 'myProject', 'Sprite1');
        expect(downloadBlob).toHaveBeenCalledWith(
            'myProject_Sprite1.png',
            expect.any(Blob)
        );
    });

    test('canvas dimensions include padding', async () => {
        const bbox = {top: 0, bottom: 100, left: 0, right: 200};
        const workspace = makeMockWorkspace({boundingBox: bbox, scale: 1});

        let capturedCanvas;
        const realCreateElement = document.createElement.bind(document);
        jest.spyOn(document, 'createElement').mockImplementation(tag => {
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
        const bbox = {top: 0, bottom: 100, left: 0, right: 200};
        const scale = 2;
        const workspace = makeMockWorkspace({boundingBox: bbox, scale});

        let capturedCanvas;
        const realCreateElement = document.createElement.bind(document);
        jest.spyOn(document, 'createElement').mockImplementation(tag => {
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
