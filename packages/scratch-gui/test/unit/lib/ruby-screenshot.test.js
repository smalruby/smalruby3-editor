import {
    buildFilename,
    cropRightWhitespace,
    downloadRubyAsImage
} from '../../../src/lib/ruby-screenshot';

jest.mock('../../../src/lib/download-blob', () => jest.fn());
import downloadBlob from '../../../src/lib/download-blob';

// Mock html-to-image
jest.mock('html-to-image', () => ({
    toBlob: jest.fn()
}));
import {toBlob} from 'html-to-image';

// Helper: create a mock Monaco editor instance
const makeMockEditor = ({lineCount = 5, contentHeight = 200} = {}) => {
    const domNode = document.createElement('div');
    const container = document.createElement('div');
    container.style.height = '300px';
    container.appendChild(domNode);

    return {
        getDomNode: jest.fn(() => domNode),
        getModel: jest.fn(() => ({
            getLineCount: () => lineCount
        })),
        getContentHeight: jest.fn(() => contentHeight),
        getScrollTop: jest.fn(() => 0),
        getScrollLeft: jest.fn(() => 0),
        setScrollTop: jest.fn(),
        setScrollLeft: jest.fn(),
        updateOptions: jest.fn(),
        layout: jest.fn(),
        _domNode: domNode,
        _container: container
    };
};

// ---- buildFilename ----

describe('buildFilename', () => {
    test('builds filename with _ruby suffix', () => {
        expect(buildFilename('MyProject', 'Cat')).toBe('MyProject_Cat_ruby.png');
    });

    test('handles Japanese characters', () => {
        expect(buildFilename('プロジェクト', 'ネコ')).toBe('プロジェクト_ネコ_ruby.png');
    });

    test('handles empty strings', () => {
        expect(buildFilename('', '')).toBe('__ruby.png');
    });
});

// ---- cropRightWhitespace ----

/**
 * Helper: build a fake ImageData-like pixel buffer.
 * Creates a width x height image where `contentCols` leftmost columns
 * contain non-white pixels and the rest are white (#ffffff).
 * @param {number} width - image width in pixels
 * @param {number} height - image height in pixels
 * @param {number} contentCols - number of leftmost columns with content
 * @returns {Uint8ClampedArray} RGBA pixel data
 */
const buildPixelData = (width, height, contentCols) => {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            if (x < contentCols) {
                // Dark pixel (content)
                data[idx] = 0;
                data[idx + 1] = 0;
                data[idx + 2] = 0;
                data[idx + 3] = 255;
            } else {
                // White pixel (background)
                data[idx] = 255;
                data[idx + 1] = 255;
                data[idx + 2] = 255;
                data[idx + 3] = 255;
            }
        }
    }
    return data;
};

/**
 * Set up Canvas/ImageBitmap mocks for cropRightWhitespace tests.
 * @param {number} width - image width
 * @param {number} height - image height
 * @param {Uint8ClampedArray} pixelData - RGBA pixel buffer
 * @returns {object} mock references for assertions
 */
const setupCanvasMocks = (width, height, pixelData) => {
    const mockCtx = {
        drawImage: jest.fn(),
        getImageData: jest.fn(() => ({data: pixelData}))
    };
    const croppedCtx = {
        drawImage: jest.fn()
    };
    let canvasCount = 0;
    const canvases = [];
    const realCreateElement = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation(tag => {
        if (tag === 'canvas') {
            const c = realCreateElement('canvas');
            canvases.push(c);
            canvasCount++;
            c.getContext = jest.fn(() => (canvasCount === 1 ? mockCtx : croppedCtx));
            c.toBlob = jest.fn(cb => cb(new Blob(['cropped'], {type: 'image/png'})));
            return c;
        }
        return realCreateElement(tag);
    });
    global.createImageBitmap = jest.fn(() =>
        Promise.resolve({width, height, close: jest.fn()})
    );
    return {mockCtx, croppedCtx, canvases};
};

describe('cropRightWhitespace', () => {
    afterEach(() => {
        document.createElement.mockRestore?.();
        delete global.createImageBitmap;
    });

    test('crops right whitespace to content width + padding', async () => {
        const width = 200;
        const height = 100;
        const contentCols = 120;
        const padding = 32;
        const pixelData = buildPixelData(width, height, contentCols);
        const {croppedCtx, canvases} = setupCanvasMocks(width, height, pixelData);

        const inputBlob = new Blob(['original'], {type: 'image/png'});
        const result = await cropRightWhitespace(inputBlob, padding);

        // Should return a new (cropped) blob, not the original
        expect(result).not.toBe(inputBlob);

        // Cropped canvas width = contentCols + padding
        const croppedCanvas = canvases[1];
        expect(croppedCanvas.width).toBe(contentCols + padding);
        expect(croppedCanvas.height).toBe(height);

        // drawImage should copy the cropped region
        expect(croppedCtx.drawImage).toHaveBeenCalledTimes(1);
    });

    test('returns original blob when image has little whitespace', async () => {
        const width = 200;
        const height = 100;
        const contentCols = 190; // almost full width
        const padding = 32;
        const pixelData = buildPixelData(width, height, contentCols);
        setupCanvasMocks(width, height, pixelData);

        const inputBlob = new Blob(['original'], {type: 'image/png'});
        const result = await cropRightWhitespace(inputBlob, padding);

        // Content + padding >= width, so no cropping needed
        expect(result).toBe(inputBlob);
    });

    test('handles anti-aliased pixels (near-white but not pure white)', async () => {
        const width = 100;
        const height = 10;
        const padding = 16;
        // Build all-white image, then add a near-white pixel at column 60
        const data = buildPixelData(width, height, 50);
        // Add anti-aliased pixel at (60, 4): RGB = (240, 245, 248)
        // Values must be below WHITE_THRESHOLD (250) to be detected as content.
        // Row must be a multiple of 4 to be hit by the sampling stride.
        const aaIdx = (4 * width + 60) * 4;
        data[aaIdx] = 240;
        data[aaIdx + 1] = 245;
        data[aaIdx + 2] = 248;
        data[aaIdx + 3] = 255;

        const {canvases} = setupCanvasMocks(width, height, data);

        const inputBlob = new Blob(['img'], {type: 'image/png'});
        const result = await cropRightWhitespace(inputBlob, padding);

        expect(result).not.toBe(inputBlob);
        // rightmost content is at column 60, so crop width = 61 + padding
        expect(canvases[1].width).toBe(61 + padding);
    });

    test('returns original blob when entire image is content', async () => {
        const width = 100;
        const height = 50;
        const pixelData = buildPixelData(width, height, width); // all content
        setupCanvasMocks(width, height, pixelData);

        const inputBlob = new Blob(['img'], {type: 'image/png'});
        const result = await cropRightWhitespace(inputBlob, 16);

        expect(result).toBe(inputBlob);
    });

    test('uses default padding of 32 when not specified', async () => {
        const width = 200;
        const height = 50;
        const contentCols = 100;
        const pixelData = buildPixelData(width, height, contentCols);
        const {canvases} = setupCanvasMocks(width, height, pixelData);

        const inputBlob = new Blob(['img'], {type: 'image/png'});
        await cropRightWhitespace(inputBlob);

        expect(canvases[1].width).toBe(contentCols + 32);
    });
});

// ---- downloadRubyAsImage ----

describe('downloadRubyAsImage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Mock createImageBitmap for cropRightWhitespace called inside downloadRubyAsImage.
        // Return a tiny all-white image so cropping is skipped (returns original blob).
        global.createImageBitmap = jest.fn(() =>
            Promise.resolve({width: 10, height: 10, close: jest.fn()})
        );
        const mockCtx = {
            drawImage: jest.fn(),
            getImageData: jest.fn(() => {
                // All-white pixels → no crop
                const data = new Uint8ClampedArray(10 * 10 * 4);
                data.fill(255);
                return {data};
            })
        };
        const realCreateElement = document.createElement.bind(document);
        jest.spyOn(document, 'createElement').mockImplementation(tag => {
            const el = realCreateElement(tag);
            if (tag === 'canvas') {
                el.getContext = jest.fn(() => mockCtx);
            }
            return el;
        });
    });

    afterEach(() => {
        document.createElement.mockRestore?.();
        delete global.createImageBitmap;
    });

    test('does nothing when editor is null', async () => {
        await downloadRubyAsImage(null, 'project', 'sprite');
        expect(toBlob).not.toHaveBeenCalled();
    });

    test('does nothing when editor DOM node is null', async () => {
        const editor = makeMockEditor();
        editor.getDomNode.mockReturnValue(null);
        await downloadRubyAsImage(editor, 'project', 'sprite');
        expect(toBlob).not.toHaveBeenCalled();
    });

    test('does nothing when model is null', async () => {
        const editor = makeMockEditor();
        editor.getModel.mockReturnValue(null);
        await downloadRubyAsImage(editor, 'project', 'sprite');
        expect(toBlob).not.toHaveBeenCalled();
    });

    test('does nothing when model has zero lines', async () => {
        const editor = makeMockEditor({lineCount: 0});
        await downloadRubyAsImage(editor, 'project', 'sprite');
        expect(toBlob).not.toHaveBeenCalled();
    });

    test('calls toBlob with editor DOM node and correct options', async () => {
        const mockBlob = new Blob(['test'], {type: 'image/png'});
        toBlob.mockResolvedValue(mockBlob);

        const editor = makeMockEditor({contentHeight: 500});

        await downloadRubyAsImage(editor, 'MyProject', 'Cat');

        expect(toBlob).toHaveBeenCalledTimes(1);
        const [domNode, options] = toBlob.mock.calls[0];
        expect(domNode).toBe(editor.getDomNode());
        expect(options.backgroundColor).toBe('#ffffff');
        expect(options.pixelRatio).toBe(2);
        expect(options.skipFonts).toBe(true);
    });

    test('downloads blob with correct filename', async () => {
        const mockBlob = new Blob(['test'], {type: 'image/png'});
        toBlob.mockResolvedValue(mockBlob);

        const editor = makeMockEditor();

        await downloadRubyAsImage(editor, 'MyProject', 'Cat');

        expect(downloadBlob).toHaveBeenCalledWith('MyProject_Cat_ruby.png', mockBlob);
    });

    test('does not download when toBlob returns null', async () => {
        toBlob.mockResolvedValue(null);

        const editor = makeMockEditor();

        await downloadRubyAsImage(editor, 'MyProject', 'Cat');

        expect(downloadBlob).not.toHaveBeenCalled();
    });

    test('temporarily expands editor to full content height', async () => {
        const mockBlob = new Blob(['test'], {type: 'image/png'});
        toBlob.mockImplementation(() => {
            // Check that container was expanded when toBlob is called
            expect(editor._container.style.height).toBe('500px');
            expect(editor._container.style.overflow).toBe('hidden');
            return Promise.resolve(mockBlob);
        });

        const editor = makeMockEditor({contentHeight: 500});
        editor._container.style.height = '300px';

        await downloadRubyAsImage(editor, 'project', 'sprite');

        // After capture, container should be restored
        expect(editor._container.style.height).toBe('300px');
    });

    test('restores scroll position after capture', async () => {
        const mockBlob = new Blob(['test'], {type: 'image/png'});
        toBlob.mockResolvedValue(mockBlob);

        const editor = makeMockEditor();
        editor.getScrollTop.mockReturnValue(42);
        editor.getScrollLeft.mockReturnValue(10);

        await downloadRubyAsImage(editor, 'project', 'sprite');

        expect(editor.setScrollTop).toHaveBeenCalledWith(42);
        expect(editor.setScrollLeft).toHaveBeenCalledWith(10);
    });

    test('restores state even when toBlob throws', async () => {
        toBlob.mockRejectedValue(new Error('capture failed'));

        const editor = makeMockEditor();
        editor._container.style.height = '300px';

        await expect(
            downloadRubyAsImage(editor, 'project', 'sprite')
        ).rejects.toThrow('capture failed');

        // State should still be restored
        expect(editor._container.style.height).toBe('300px');
        expect(editor.layout).toHaveBeenCalled();
    });

    test('disables full-width visual elements before capture and restores them after', async () => {
        const mockBlob = new Blob(['test'], {type: 'image/png'});
        toBlob.mockResolvedValue(mockBlob);

        const editor = makeMockEditor();

        await downloadRubyAsImage(editor, 'project', 'sprite');

        // First call disables visual elements for clean capture
        expect(editor.updateOptions).toHaveBeenCalledWith({
            scrollBeyondLastLine: false,
            renderLineHighlight: 'none',
            scrollbar: {vertical: 'hidden', horizontal: 'hidden'},
            hideCursorInOverviewRuler: true
        });
        // Second call (in finally) re-enables them
        expect(editor.updateOptions).toHaveBeenCalledWith({
            scrollBeyondLastLine: true,
            renderLineHighlight: 'line',
            scrollbar: {vertical: 'auto', horizontal: 'auto'},
            hideCursorInOverviewRuler: false
        });
    });

    test('calls editor.layout() to trigger re-render', async () => {
        const mockBlob = new Blob(['test'], {type: 'image/png'});
        toBlob.mockResolvedValue(mockBlob);

        const editor = makeMockEditor();

        await downloadRubyAsImage(editor, 'project', 'sprite');

        // layout should be called at least twice: once to expand, once to restore
        expect(editor.layout.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
});
