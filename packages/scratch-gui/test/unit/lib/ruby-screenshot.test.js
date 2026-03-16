import {
    buildFilename,
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

// ---- downloadRubyAsImage ----

describe('downloadRubyAsImage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
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

    test('calls editor.layout() to trigger re-render', async () => {
        const mockBlob = new Blob(['test'], {type: 'image/png'});
        toBlob.mockResolvedValue(mockBlob);

        const editor = makeMockEditor();

        await downloadRubyAsImage(editor, 'project', 'sprite');

        // layout should be called at least twice: once to expand, once to restore
        expect(editor.layout.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
});
