/**
 * tools/mcp/playwright-mcp.mjs の純粋ロジックのユニットテスト。
 *
 * `node --test tools/mcp/playwright-mcp.test.mjs` で実行する（外部依存なし）。
 */

import { test } from 'node:test';
import assert from 'node:assert';

import { buildMcpArgs, resolveChromiumExecutable } from './playwright-mcp.mjs';

test('buildMcpArgs: chromiumPath があれば --executable-path を付ける', () => {
    const args = buildMcpArgs({ chromiumPath: '/browsers/chrome' });
    assert.deepStrictEqual(args, [
        '-y',
        '@playwright/mcp@latest',
        '--headless',
        '--executable-path',
        '/browsers/chrome',
    ]);
});

test('buildMcpArgs: chromiumPath が無ければ --executable-path を付けない（既定 download 挙動へフォールバック）', () => {
    const args = buildMcpArgs({ chromiumPath: null });
    assert.deepStrictEqual(args, ['-y', '@playwright/mcp@latest', '--headless']);
});

test('buildMcpArgs: 呼び出し側の追加引数を末尾に透過する', () => {
    const args = buildMcpArgs({
        chromiumPath: '/browsers/chrome',
        extraArgs: ['--viewport-size', '1280x720'],
    });
    assert.deepStrictEqual(args, [
        '-y',
        '@playwright/mcp@latest',
        '--headless',
        '--executable-path',
        '/browsers/chrome',
        '--viewport-size',
        '1280x720',
    ]);
});

test('buildMcpArgs: mcpSpec を上書きできる（ピン止め用）', () => {
    const args = buildMcpArgs({ chromiumPath: null, mcpSpec: '@playwright/mcp@0.0.78' });
    assert.deepStrictEqual(args, ['-y', '@playwright/mcp@0.0.78', '--headless']);
});

test('resolveChromiumExecutable: playwright が解決でき executablePath があればそれを返す', () => {
    const loadPlaywright = () => ({ chromium: { executablePath: () => '/browsers/chrome-1217' } });
    assert.strictEqual(resolveChromiumExecutable(loadPlaywright), '/browsers/chrome-1217');
});

test('resolveChromiumExecutable: playwright 解決が throw したら null（フォールバック）', () => {
    const loadPlaywright = () => {
        throw new Error('Cannot find module playwright');
    };
    assert.strictEqual(resolveChromiumExecutable(loadPlaywright), null);
});

test('resolveChromiumExecutable: executablePath が空文字なら null', () => {
    const loadPlaywright = () => ({ chromium: { executablePath: () => '' } });
    assert.strictEqual(resolveChromiumExecutable(loadPlaywright), null);
});

test('resolveChromiumExecutable: executablePath 自体が throw しても null', () => {
    const loadPlaywright = () => ({
        chromium: {
            executablePath: () => {
                throw new Error('no browser');
            },
        },
    });
    assert.strictEqual(resolveChromiumExecutable(loadPlaywright), null);
});
