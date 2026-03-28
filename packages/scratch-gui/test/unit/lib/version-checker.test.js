// === Smalruby: This file is Smalruby-specific (version update notification) ===
import { createVersionChecker } from '../../../src/lib/version-checker';

describe('version-checker', () => {
    let originalFetch;

    beforeEach(() => {
        originalFetch = global.fetch;
        jest.useFakeTimers();
    });

    afterEach(() => {
        global.fetch = originalFetch;
        jest.useRealTimers();
    });

    test('should call onUpdateAvailable when remote commitId differs', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ commitId: 'remote-abc123' }),
        });
        const onUpdateAvailable = jest.fn();
        const checker = createVersionChecker({
            currentCommitId: 'local-def456',
            onUpdateAvailable,
        });

        await checker.check();

        expect(global.fetch).toHaveBeenCalledWith('./version.json', expect.objectContaining({ cache: 'no-store' }));
        expect(onUpdateAvailable).toHaveBeenCalled();
    });

    test('should not call onUpdateAvailable when commitId matches', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ commitId: 'same-id' }),
        });
        const onUpdateAvailable = jest.fn();
        const checker = createVersionChecker({
            currentCommitId: 'same-id',
            onUpdateAvailable,
        });

        await checker.check();

        expect(onUpdateAvailable).not.toHaveBeenCalled();
    });

    test('should not call onUpdateAvailable when fetch fails', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
        const onUpdateAvailable = jest.fn();
        const checker = createVersionChecker({
            currentCommitId: 'local-id',
            onUpdateAvailable,
        });

        await checker.check();

        expect(onUpdateAvailable).not.toHaveBeenCalled();
    });

    test('should not call onUpdateAvailable when response is not ok', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 404,
        });
        const onUpdateAvailable = jest.fn();
        const checker = createVersionChecker({
            currentCommitId: 'local-id',
            onUpdateAvailable,
        });

        await checker.check();

        expect(onUpdateAvailable).not.toHaveBeenCalled();
    });

    test('should not call onUpdateAvailable when currentCommitId is empty', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ commitId: 'remote-id' }),
        });
        const onUpdateAvailable = jest.fn();
        const checker = createVersionChecker({
            currentCommitId: '',
            onUpdateAvailable,
        });

        await checker.check();

        expect(onUpdateAvailable).not.toHaveBeenCalled();
    });

    test('start should schedule initial check after delay and periodic checks', () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ commitId: 'remote-id' }),
        });
        const onUpdateAvailable = jest.fn();
        const checker = createVersionChecker({
            currentCommitId: 'local-id',
            onUpdateAvailable,
            initialDelayMs: 5000,
            intervalMs: 3600000,
        });

        checker.start();

        // Before initial delay, no fetch
        expect(global.fetch).not.toHaveBeenCalled();

        // After initial delay
        jest.advanceTimersByTime(5000);
        expect(global.fetch).toHaveBeenCalledTimes(1);

        checker.stop();
    });

    test('stop should clear timers', () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ commitId: 'same-id' }),
        });
        const checker = createVersionChecker({
            currentCommitId: 'same-id',
            onUpdateAvailable: jest.fn(),
        });

        checker.start();
        checker.stop();

        jest.advanceTimersByTime(10000);
        expect(global.fetch).not.toHaveBeenCalled();
    });
});
