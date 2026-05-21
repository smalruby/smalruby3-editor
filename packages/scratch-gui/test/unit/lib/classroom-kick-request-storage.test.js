import {
    KICK_REQUEST_STORAGE_KEY,
    KICK_REQUEST_FRESH_WINDOW_MS,
    loadPendingKickRequest,
    savePendingKickRequest,
    clearPendingKickRequest,
} from '../../../src/lib/classroom-kick-request-storage.js';

describe('classroom-kick-request-storage', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    test('returns null when nothing is stored', () => {
        expect(loadPendingKickRequest()).toBeNull();
    });

    test('saves and loads a request with a default timestamp', () => {
        savePendingKickRequest({
            requestId: 'req-1',
            joinCode: 'abcdef',
            seatNumber: 5,
            reason: '私の席です',
        });
        const loaded = loadPendingKickRequest();
        expect(loaded).toMatchObject({
            requestId: 'req-1',
            joinCode: 'abcdef',
            seatNumber: 5,
            reason: '私の席です',
        });
        expect(typeof loaded.createdAt).toBe('string');
    });

    test('drops a stale record older than the fresh window', () => {
        const stale = {
            requestId: 'req-old',
            joinCode: 'abcdef',
            seatNumber: 3,
            reason: null,
            createdAt: new Date(Date.now() - KICK_REQUEST_FRESH_WINDOW_MS - 1000).toISOString(),
        };
        window.localStorage.setItem(KICK_REQUEST_STORAGE_KEY, JSON.stringify(stale));
        expect(loadPendingKickRequest()).toBeNull();
        // Stale record should also be cleared so it does not resurface.
        expect(window.localStorage.getItem(KICK_REQUEST_STORAGE_KEY)).toBeNull();
    });

    test('keeps a record that is within the fresh window', () => {
        const fresh = {
            requestId: 'req-fresh',
            joinCode: 'abcdef',
            seatNumber: 7,
            reason: null,
            createdAt: new Date(Date.now() - 60_000).toISOString(),
        };
        window.localStorage.setItem(KICK_REQUEST_STORAGE_KEY, JSON.stringify(fresh));
        expect(loadPendingKickRequest()).toEqual(fresh);
    });

    test('ignores malformed JSON without throwing', () => {
        window.localStorage.setItem(KICK_REQUEST_STORAGE_KEY, '{ broken json');
        expect(loadPendingKickRequest()).toBeNull();
        expect(window.localStorage.getItem(KICK_REQUEST_STORAGE_KEY)).toBeNull();
    });

    test('ignores records missing required fields', () => {
        window.localStorage.setItem(
            KICK_REQUEST_STORAGE_KEY,
            JSON.stringify({ requestId: 'no-seat', joinCode: 'abcdef', createdAt: new Date().toISOString() }),
        );
        expect(loadPendingKickRequest()).toBeNull();
    });

    test('clearPendingKickRequest removes the record', () => {
        savePendingKickRequest({
            requestId: 'req-1',
            joinCode: 'abcdef',
            seatNumber: 2,
        });
        expect(window.localStorage.getItem(KICK_REQUEST_STORAGE_KEY)).not.toBeNull();
        clearPendingKickRequest();
        expect(window.localStorage.getItem(KICK_REQUEST_STORAGE_KEY)).toBeNull();
    });

    test('savePendingKickRequest is a no-op for invalid input', () => {
        savePendingKickRequest(null);
        savePendingKickRequest({ requestId: 'missing-rest' });
        expect(window.localStorage.getItem(KICK_REQUEST_STORAGE_KEY)).toBeNull();
    });
});
