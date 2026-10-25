/* eslint-env jest */
/**
 * 着席判定 (issue #1197) — 先生の画面はすべてこの 1 か所のしきい値で判定する。
 */
import { SEATED_THRESHOLD_MS, isMemberSeated } from '../../../src/lib/classroom-presence.js';

const NOW = Date.parse('2026-10-25T10:00:00.000Z');
const ago = (ms) => new Date(NOW - ms).toISOString();

describe('classroom presence (issue #1197)', () => {
    test('しきい値は 1 時間（定期通信をしないので従来どおり）', () => {
        expect(SEATED_THRESHOLD_MS).toBe(60 * 60 * 1000);
    });

    test('しきい値以内なら着席中', () => {
        expect(isMemberSeated({ lastActiveAt: ago(30 * 60 * 1000) }, NOW)).toBe(true);
    });

    test('しきい値を過ぎたら離席', () => {
        expect(isMemberSeated({ lastActiveAt: ago(SEATED_THRESHOLD_MS) }, NOW)).toBe(false);
        expect(isMemberSeated({ lastActiveAt: ago(2 * 60 * 60 * 1000) }, NOW)).toBe(false);
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
