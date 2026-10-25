/* eslint-env jest */
/**
 * 着席判定 (issue #1197) — ハートビート間隔に連動した 1 か所のしきい値で判定する。
 */
import { HEARTBEAT_INTERVAL_MS, SEATED_THRESHOLD_MS, isMemberSeated } from '../../../src/lib/classroom-presence.js';

const NOW = Date.parse('2026-10-25T10:00:00.000Z');
const ago = (ms) => new Date(NOW - ms).toISOString();

describe('classroom presence (issue #1197)', () => {
    test('既定のハートビート間隔は 2 分、しきい値は間隔の 2 倍以上・1 時間未満', () => {
        expect(HEARTBEAT_INTERVAL_MS).toBe(2 * 60 * 1000);
        expect(SEATED_THRESHOLD_MS).toBeGreaterThanOrEqual(HEARTBEAT_INTERVAL_MS * 2);
        expect(SEATED_THRESHOLD_MS).toBeLessThan(60 * 60 * 1000);
    });

    test('直近のハートビートがあれば着席中', () => {
        expect(isMemberSeated({ lastActiveAt: ago(HEARTBEAT_INTERVAL_MS) }, NOW)).toBe(true);
    });

    test('ハートビートを 2 回取りこぼしても着席中のまま（1 回の遅延で点滅しない）', () => {
        expect(isMemberSeated({ lastActiveAt: ago(HEARTBEAT_INTERVAL_MS * 2) }, NOW)).toBe(true);
    });

    test('しきい値を過ぎたら離席', () => {
        expect(isMemberSeated({ lastActiveAt: ago(SEATED_THRESHOLD_MS + 1) }, NOW)).toBe(false);
        // 旧仕様 (1 時間) では着席扱いだった 30 分前も離席になる
        expect(isMemberSeated({ lastActiveAt: ago(30 * 60 * 1000) }, NOW)).toBe(false);
    });

    test('lastActiveAt が無い / メンバーが無いときは離席', () => {
        expect(isMemberSeated({}, NOW)).toBe(false);
        expect(isMemberSeated(null, NOW)).toBe(false);
        expect(isMemberSeated({ lastActiveAt: 'not-a-date' }, NOW)).toBe(false);
    });

    test('now を省略したら現在時刻で判定する', () => {
        expect(isMemberSeated({ lastActiveAt: new Date().toISOString() })).toBe(true);
    });
});
