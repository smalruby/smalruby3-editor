// === Smalruby: This file is Smalruby-specific (version update notification) ===
import { createVersionChecker } from '../../src/lib/version-checker';

// Integration tests for version update notification feature
// These test the full lifecycle of the version checker

describe('version update notification integration', () => {
    let originalFetch;

    beforeEach(() => {
        originalFetch = global.fetch;
        jest.useFakeTimers();
    });

    afterEach(() => {
        global.fetch = originalFetch;
        jest.useRealTimers();
    });

    test('full lifecycle: start → detect update → dismiss → re-detect after interval', async () => {
        let fetchCallCount = 0;
        global.fetch = jest.fn().mockImplementation(() => {
            fetchCallCount++;
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ commitId: 'new-version' }),
            });
        });

        const onUpdateAvailable = jest.fn();
        const checker = createVersionChecker({
            currentCommitId: 'old-version',
            onUpdateAvailable,
            initialDelayMs: 5000,
            intervalMs: 3600000,
        });

        checker.start();

        // No fetch before initial delay
        expect(fetchCallCount).toBe(0);

        // After initial delay, first check fires
        jest.advanceTimersByTime(5000);
        // Flush multiple microtask cycles for fetch → response.json() → callback
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        expect(fetchCallCount).toBe(1);
        expect(onUpdateAvailable).toHaveBeenCalledTimes(1);

        // After 1 hour interval, second check fires
        jest.advanceTimersByTime(3600000);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        expect(fetchCallCount).toBe(2);
        expect(onUpdateAvailable).toHaveBeenCalledTimes(2);

        checker.stop();

        // No more fetches after stop
        jest.advanceTimersByTime(3600000);
        await Promise.resolve();
        expect(fetchCallCount).toBe(2);
    });

    test('no notification when server returns same version', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ commitId: 'current-version' }),
        });

        const onUpdateAvailable = jest.fn();
        const checker = createVersionChecker({
            currentCommitId: 'current-version',
            onUpdateAvailable,
            initialDelayMs: 1000,
            intervalMs: 60000,
        });

        checker.start();

        jest.advanceTimersByTime(1000);
        await Promise.resolve();

        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(onUpdateAvailable).not.toHaveBeenCalled();

        // Check again after interval
        jest.advanceTimersByTime(60000);
        await Promise.resolve();

        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(onUpdateAvailable).not.toHaveBeenCalled();

        checker.stop();
    });

    test('graceful degradation when version.json is unavailable', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('404 Not Found'));

        const onUpdateAvailable = jest.fn();
        const checker = createVersionChecker({
            currentCommitId: 'local-version',
            onUpdateAvailable,
            initialDelayMs: 1000,
            intervalMs: 60000,
        });

        checker.start();

        jest.advanceTimersByTime(1000);
        await Promise.resolve();

        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(onUpdateAvailable).not.toHaveBeenCalled();

        checker.stop();
    });

    test('manual check via check() method', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ commitId: 'new-version' }),
        });

        const onUpdateAvailable = jest.fn();
        const checker = createVersionChecker({
            currentCommitId: 'old-version',
            onUpdateAvailable,
        });

        // Can call check() directly without start()
        await checker.check();

        expect(global.fetch).toHaveBeenCalledWith('./version.json', { cache: 'no-store' });
        expect(onUpdateAvailable).toHaveBeenCalledTimes(1);
    });

    test('skips check when COMMIT_SHA is empty (local development)', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ commitId: 'any-version' }),
        });

        const onUpdateAvailable = jest.fn();
        const checker = createVersionChecker({
            currentCommitId: '',
            onUpdateAvailable,
            initialDelayMs: 1000,
            intervalMs: 60000,
        });

        checker.start();
        jest.advanceTimersByTime(1000);
        await Promise.resolve();

        // Should not even fetch when currentCommitId is empty
        expect(global.fetch).not.toHaveBeenCalled();
        expect(onUpdateAvailable).not.toHaveBeenCalled();

        checker.stop();
    });
});
