/* eslint-env jest */
import { loadHistory, addToHistory } from '../../../src/lib/join-code-history.js';

const STORAGE_KEY = 'smalruby:joinCodeHistory';

describe('join-code-history', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    describe('loadHistory', () => {
        test('returns empty array when no history', () => {
            expect(loadHistory()).toEqual([]);
        });

        test('returns stored entries', () => {
            const entries = [
                {
                    joinCode: 'abc234',
                    className: 'Class1',
                    assignmentName: 'Task1',
                    expiresAt: new Date(Date.now() + 86400000).toISOString(),
                    joinedAt: new Date().toISOString(),
                },
            ];
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
            expect(loadHistory()).toEqual(entries);
        });

        test('prunes expired entries', () => {
            const entries = [
                {
                    joinCode: 'abc234',
                    className: 'Active',
                    assignmentName: '',
                    expiresAt: new Date(Date.now() + 86400000).toISOString(),
                    joinedAt: new Date().toISOString(),
                },
                {
                    joinCode: 'xyz789',
                    className: 'Expired',
                    assignmentName: '',
                    expiresAt: new Date(Date.now() - 1000).toISOString(),
                    joinedAt: new Date(Date.now() - 86400000).toISOString(),
                },
            ];
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
            const result = loadHistory();
            expect(result).toHaveLength(1);
            expect(result[0].joinCode).toBe('abc234');
            // localStorage should also be updated
            const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
            expect(stored).toHaveLength(1);
        });

        test('keeps entries without expiresAt', () => {
            const entries = [
                {
                    joinCode: 'abc234',
                    className: 'NoExpiry',
                    assignmentName: '',
                    expiresAt: null,
                    joinedAt: new Date().toISOString(),
                },
            ];
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
            expect(loadHistory()).toHaveLength(1);
        });

        test('handles invalid JSON gracefully', () => {
            window.localStorage.setItem(STORAGE_KEY, 'not json');
            expect(loadHistory()).toEqual([]);
        });
    });

    describe('addToHistory', () => {
        test('adds entry to empty history', () => {
            addToHistory({
                joinCode: 'abc234',
                className: 'Class1',
                assignmentName: 'Task1',
                expiresAt: new Date(Date.now() + 86400000).toISOString(),
            });
            const result = loadHistory();
            expect(result).toHaveLength(1);
            expect(result[0].joinCode).toBe('abc234');
            expect(result[0].className).toBe('Class1');
            expect(result[0].assignmentName).toBe('Task1');
            expect(result[0].joinedAt).toBeTruthy();
        });

        test('moves existing entry to top on re-join', () => {
            addToHistory({ joinCode: 'aaa111', className: 'First' });
            addToHistory({ joinCode: 'bbb222', className: 'Second' });
            addToHistory({ joinCode: 'aaa111', className: 'First Updated' });
            const result = loadHistory();
            expect(result).toHaveLength(2);
            expect(result[0].joinCode).toBe('aaa111');
            expect(result[0].className).toBe('First Updated');
            expect(result[1].joinCode).toBe('bbb222');
        });

        test('limits to 10 entries', () => {
            for (let i = 0; i < 15; i++) {
                addToHistory({
                    joinCode: `code${String(i).padStart(2, '0')}`,
                    className: `Class${i}`,
                    expiresAt: new Date(Date.now() + 86400000).toISOString(),
                });
            }
            const result = loadHistory();
            expect(result).toHaveLength(10);
            // Most recent should be first
            expect(result[0].joinCode).toBe('code14');
        });

        test('ignores entries without joinCode', () => {
            addToHistory({ className: 'NoCode' });
            expect(loadHistory()).toEqual([]);
        });
    });
});
