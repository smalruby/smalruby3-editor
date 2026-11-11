import {
    filterBrowserLogs,
    isIgnorableSevereLog,
    levelName,
    unexpectedSevereLogs,
} from '../../helpers/ignorable-severe-logs';

const severe = (message) => ({ level: { name: 'SEVERE' }, message, timestamp: 0, type: '' });

// CI (Chrome stable) が実際に出したメッセージを貼っている（パスだけ版付きの配信パス
// `static/monaco/<版>/vs` に合わせた・#1318）。自前ホストした Monaco の
// editor worker を `file://` から読めないときの 2 件 (#1171)。
const MONACO_WORKER_LOGS = [
    'file:///home/runner/work/smalruby3-editor/smalruby3-editor/packages/scratch-gui/build/static/monaco/0.57.0/vs/editor.api-CalNCsUg.js 0:2337 Uncaught [object ErrorEvent]',
    "blob:null/99a1285a-897a-4d63-9599-b2f22f7ea68d 0 Uncaught NetworkError: Failed to execute 'importScripts' on 'WorkerGlobalScope': The script at 'file:///home/runner/work/smalruby3-editor/smalruby3-editor/packages/scratch-gui/build/static/monaco/0.57.0/vs/assets/editor.worker-Be8ye1pW.js' failed to load.",
];

describe('isIgnorableSevereLog', () => {
    test.each(MONACO_WORKER_LOGS)('ignores the monaco editor worker failure under file:// (%#)', (message) => {
        expect(isIgnorableSevereLog(message)).toBe(true);
    });

    test('ignores the upstream ConfirmationPrompt React key warning', () => {
        const message =
            'Warning: Each child in a list should have a unique "key" prop. Check the render method of `ConfirmationPrompt`.';
        expect(isIgnorableSevereLog(message)).toBe(true);
    });

    test('does not ignore a genuine monaco loader 404', () => {
        const message =
            'file:///app/packages/scratch-gui/build/static/monaco/0.57.0/vs/loader.js - Failed to load resource: net::ERR_FILE_NOT_FOUND';
        // loader.js の取得失敗は Monaco が全く読めない状態なので見逃してはいけない。
        expect(isIgnorableSevereLog(message)).toBe(false);
    });

    test('does not ignore a CDN fallback request', () => {
        const message = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs/loader.js 0 Uncaught Error';
        expect(isIgnorableSevereLog(message)).toBe(false);
    });

    test('does not ignore unrelated application errors', () => {
        expect(isIgnorableSevereLog('Uncaught TypeError: Cannot read properties of undefined')).toBe(false);
    });
});

describe('unexpectedSevereLogs', () => {
    test('keeps only non-ignorable SEVERE entries', () => {
        const logs = [
            { level: { name: 'WARNING' }, message: 'Uncaught TypeError: warning level is dropped' },
            severe(MONACO_WORKER_LOGS[0]),
            severe(MONACO_WORKER_LOGS[1]),
            severe('Uncaught TypeError: real failure'),
        ];
        expect(unexpectedSevereLogs(logs)).toEqual([severe('Uncaught TypeError: real failure')]);
    });

    test('returns an empty array when everything is ignorable', () => {
        expect(unexpectedSevereLogs(MONACO_WORKER_LOGS.map(severe))).toEqual([]);
    });
});

describe('isIgnorableSevereLog (environment noise)', () => {
    test('ignores the Google Drive API init failure seen without Google credentials', () => {
        const message =
            'file:///app/packages/scratch-gui/build/gui.js 2:1234 "Failed to initialize Google Drive API:" Object';
        expect(isIgnorableSevereLog(message)).toBe(true);
    });

    test('ignores cleardot.gif blocked by the devpod firewall', () => {
        const message =
            'https://www.google.com/images/cleardot.gif - Failed to load resource: net::ERR_CONNECTION_REFUSED';
        expect(isIgnorableSevereLog(message)).toBe(true);
    });

    test('ignores the Google api.js script blocked by the devpod firewall', () => {
        const messages = [
            'https://apis.google.com/js/api.js - Failed to load resource: net::ERR_CONNECTION_REFUSED',
            'file:///app/packages/scratch-gui/build/gui.js 113040:16 "Failed to load Google scripts:" Error: ' +
                'Failed to load script: https://apis.google.com/js/api.js',
        ];
        messages.forEach((message) => expect(isIgnorableSevereLog(message)).toBe(true));
    });

    test('does not ignore other google.com resource failures', () => {
        const message = 'https://www.google.com/other.js - Failed to load resource: net::ERR_CONNECTION_REFUSED';
        expect(isIgnorableSevereLog(message)).toBe(false);
    });
});

describe('levelName', () => {
    test.each([
        ['SEVERE', 'SEVERE'],
        [{ name: 'SEVERE', value: 1000 }, 'SEVERE'],
        [undefined, ''],
    ])('normalizes %p to %p', (level, expected) => {
        expect(levelName(level)).toBe(expected);
    });
});

describe('filterBrowserLogs', () => {
    const entry = (name, message) => ({ level: { name, value: 0 }, message, timestamp: 0, type: '' });
    const realError = entry('SEVERE', 'Uncaught TypeError: real failure');

    test('returns SEVERE entries by default (level is an object, not a string)', () => {
        const logs = [entry('INFO', 'info'), entry('WARNING', 'warn'), realError];
        expect(filterBrowserLogs(logs)).toEqual([realError]);
    });

    test('accepts a string level too', () => {
        const stringLevel = { level: 'SEVERE', message: 'Uncaught Error: boom' };
        expect(filterBrowserLogs([stringLevel])).toEqual([stringLevel]);
    });

    test('drops known harmless SEVERE entries', () => {
        const logs = [
            entry('SEVERE', 'gui.js 2:1 "Failed to initialize Google Drive API:" Object'),
            entry('SEVERE', 'https://www.google.com/images/cleardot.gif - Failed to load resource: net::ERR_CONNECTION_REFUSED'),
            entry('SEVERE', MONACO_WORKER_LOGS[1]),
            realError,
        ];
        expect(filterBrowserLogs(logs)).toEqual([realError]);
    });

    test('drops entries matching the default whitelist', () => {
        const logs = [entry('SEVERE', 'Uncaught (in promise) The play() request was interrupted by a call to pause()')];
        expect(filterBrowserLogs(logs)).toEqual([]);
    });

    test('a custom whitelist replaces the default one but keeps the known harmless list', () => {
        const play = entry('SEVERE', 'The play() request was interrupted by a call to pause()');
        const logs = [play, entry('SEVERE', 'expected noise'), entry('SEVERE', MONACO_WORKER_LOGS[1]), realError];
        expect(filterBrowserLogs(logs, { whitelist: ['expected noise'] })).toEqual([play, realError]);
    });

    test('includeAllLevels returns every level (raw, for debugging)', () => {
        const drive = entry('SEVERE', '"Failed to initialize Google Drive API:"');
        const logs = [entry('INFO', 'info'), drive, realError];
        expect(filterBrowserLogs(logs, { includeAllLevels: true })).toEqual(logs);
    });
});
