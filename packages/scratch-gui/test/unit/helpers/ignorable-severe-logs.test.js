import { isIgnorableSevereLog, unexpectedSevereLogs } from '../../helpers/ignorable-severe-logs';

const severe = (message) => ({ level: { name: 'SEVERE' }, message, timestamp: 0, type: '' });

// CI (Chrome stable) が実際に出したメッセージをそのまま貼っている。自前ホストした Monaco の
// editor worker を `file://` から読めないときの 2 件 (#1171)。
const MONACO_WORKER_LOGS = [
    'file:///home/runner/work/smalruby3-editor/smalruby3-editor/packages/scratch-gui/build/static/monaco/vs/editor.api-CalNCsUg.js 0:2337 Uncaught [object ErrorEvent]',
    "blob:null/99a1285a-897a-4d63-9599-b2f22f7ea68d 0 Uncaught NetworkError: Failed to execute 'importScripts' on 'WorkerGlobalScope': The script at 'file:///home/runner/work/smalruby3-editor/smalruby3-editor/packages/scratch-gui/build/static/monaco/vs/assets/editor.worker-Be8ye1pW.js' failed to load.",
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
            'file:///app/packages/scratch-gui/build/static/monaco/vs/loader.js - Failed to load resource: net::ERR_FILE_NOT_FOUND';
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
