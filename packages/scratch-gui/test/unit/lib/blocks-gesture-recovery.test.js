import { installGestureRecovery } from '../../../src/lib/blocks-gesture-recovery';

describe('installGestureRecovery', () => {
    let mockWorkspace;
    let mockGesture;
    let mockScratchBlocks;
    let listeners;

    beforeEach(() => {
        mockGesture = {
            isDragging: jest.fn(() => true),
        };

        mockWorkspace = {
            currentGesture_: null,
            cancelCurrentGesture: jest.fn(),
        };

        mockScratchBlocks = {
            getMainWorkspace: jest.fn(() => mockWorkspace),
        };

        listeners = {};
        jest.spyOn(document, 'addEventListener').mockImplementation((event, handler, options) => {
            listeners[`doc:${event}:${typeof options === 'object' ? 'capture' : 'bubble'}`] = handler;
            listeners[`doc:${event}`] = handler;
        });
        jest.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
            listeners[`win:${event}`] = handler;
        });

        installGestureRecovery(mockScratchBlocks);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('visibilitychange handler', () => {
        test('should cancel active gesture when page becomes hidden', () => {
            mockWorkspace.currentGesture_ = mockGesture;
            Object.defineProperty(document, 'visibilityState', {
                value: 'hidden',
                writable: true,
                configurable: true,
            });

            listeners['doc:visibilitychange']();

            expect(mockWorkspace.cancelCurrentGesture).toHaveBeenCalledTimes(1);
        });

        test('should not cancel when page becomes visible', () => {
            mockWorkspace.currentGesture_ = mockGesture;
            Object.defineProperty(document, 'visibilityState', {
                value: 'visible',
                writable: true,
                configurable: true,
            });

            listeners['doc:visibilitychange']();

            expect(mockWorkspace.cancelCurrentGesture).not.toHaveBeenCalled();
        });

        test('should not error when no workspace', () => {
            mockScratchBlocks.getMainWorkspace.mockReturnValue(null);

            Object.defineProperty(document, 'visibilityState', {
                value: 'hidden',
                writable: true,
                configurable: true,
            });

            expect(() => listeners['doc:visibilitychange']()).not.toThrow();
        });

        test('should not error when no active gesture', () => {
            mockWorkspace.currentGesture_ = null;
            Object.defineProperty(document, 'visibilityState', {
                value: 'hidden',
                writable: true,
                configurable: true,
            });

            expect(() => listeners['doc:visibilitychange']()).not.toThrow();
        });
    });

    describe('blur handler', () => {
        test('should cancel active gesture when window loses focus', () => {
            mockWorkspace.currentGesture_ = mockGesture;

            listeners['win:blur']();

            expect(mockWorkspace.cancelCurrentGesture).toHaveBeenCalledTimes(1);
        });

        test('should still call public cancel API even when no gesture (no-op safety)', () => {
            mockWorkspace.currentGesture_ = null;

            listeners['win:blur']();

            // The public cancelCurrentGesture is safe to call when no gesture
            // is active, so we always invoke it (Blockly handles the no-op).
            expect(mockWorkspace.cancelCurrentGesture).toHaveBeenCalledTimes(1);
        });

        test('should not error when no active gesture', () => {
            mockWorkspace.currentGesture_ = null;

            expect(() => listeners['win:blur']()).not.toThrow();
        });
    });

    describe('pointerdown recovery handler', () => {
        test('should cancel stale dragging gesture on new pointerdown', () => {
            mockWorkspace.currentGesture_ = mockGesture;
            mockGesture.isDragging.mockReturnValue(true);

            listeners['doc:pointerdown']({});

            expect(mockWorkspace.cancelCurrentGesture).toHaveBeenCalledTimes(1);
        });

        test('should not cancel gesture that is not dragging', () => {
            mockWorkspace.currentGesture_ = mockGesture;
            mockGesture.isDragging.mockReturnValue(false);

            listeners['doc:pointerdown']({});

            expect(mockWorkspace.cancelCurrentGesture).not.toHaveBeenCalled();
        });

        test('should not error when no active gesture', () => {
            mockWorkspace.currentGesture_ = null;

            expect(() => listeners['doc:pointerdown']({})).not.toThrow();
        });

        test('should not error when no workspace', () => {
            mockScratchBlocks.getMainWorkspace.mockReturnValue(null);

            expect(() => listeners['doc:pointerdown']({})).not.toThrow();
        });

        test('should be registered in capture phase', () => {
            // Verify capture phase was used
            expect(document.addEventListener).toHaveBeenCalledWith('pointerdown', expect.any(Function), true);
        });
    });

    describe('event listener registration', () => {
        test('should register visibilitychange on document', () => {
            expect(document.addEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
        });

        test('should register blur on window', () => {
            expect(window.addEventListener).toHaveBeenCalledWith('blur', expect.any(Function));
        });

        test('should register pointerdown on document in capture phase', () => {
            expect(document.addEventListener).toHaveBeenCalledWith('pointerdown', expect.any(Function), true);
        });
    });
});
