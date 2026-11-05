import {
  buildAiUsage,
  jstDate,
  seatFromMemberId,
  seatStatusKey,
  todayCountsBySeat,
  toJstIso,
  usagePk,
} from '../ai-usage-lib';

describe('ai-usage-lib (issue #1311)', () => {
  test('memberId から出席番号の数字を取り出す', () => {
    expect(seatFromMemberId('seat-03')).toBe('3');
    expect(seatFromMemberId('seat-12')).toBe('12');
    expect(seatFromMemberId('teacher')).toBeNull();
    expect(seatFromMemberId(undefined)).toBeNull();
  });

  test('キーは relay と同じ形', () => {
    expect(seatStatusKey('c1', '3')).toEqual({ sourceIp: 'seat#c1:3#current', windowStart: 0 });
    expect(usagePk('c1')).toBe('classroom#c1');
    expect(jstDate(Date.UTC(2026, 10, 1, 15, 30))).toBe('2026-11-02');
    expect(toJstIso(Date.UTC(2026, 10, 1, 1, 15) / 1000)).toBe('2026-11-01T10:15:00+09:00');
  });

  test('今日の回数を席・purpose ごとにまとめる', () => {
    const map = todayCountsBySeat([
      { pk: 'classroom#c1', sk: '2026-11-01#seat#3#genai-takeover', requests: 15, succeeded: 14, failed: 1 },
      { pk: 'classroom#c1', sk: '2026-11-01#seat#3#chat', requests: 3, succeeded: 3 },
      { pk: 'classroom#c1', sk: '2026-11-01#seat#-#chat', requests: 9 },
      { pk: 'classroom#c1', sk: '2026-11-01#seat#4#unknown', requests: 1 },
    ]);
    expect(map.get('3')).toEqual({
      takeover: { requests: 15, rateLimited: 0, succeeded: 14, failed: 1 },
      chat: { requests: 3, rateLimited: 0, succeeded: 3, failed: 0 },
    });
    expect(map.has('4')).toBe(false);
  });

  test('今の窓の行があれば used / limit / resetAt を返す', () => {
    const now = 1_000_000;
    const usage = buildAiUsage({ count: 40, limit: 40, windowMinutes: 35, resetAt: now + 60 }, undefined, now);
    expect(usage.takeover).toEqual({
      used: 40, limit: 40, windowMinutes: 35, resetAt: toJstIso(now + 60), limited: true,
    });
    expect(usage.today.takeover.requests).toBe(0);
  });

  test('行が無い・窓が終わった行は used 0 / resetAt null', () => {
    const now = 1_000_000;
    const none = buildAiUsage(undefined, undefined, now);
    expect(none.takeover).toEqual({ used: 0, limit: 40, windowMinutes: 35, resetAt: null, limited: false });
    const expired = buildAiUsage({ count: 12, limit: 30, windowMinutes: 35, resetAt: now - 1 }, undefined, now);
    expect(expired.takeover).toEqual({ used: 0, limit: 30, windowMinutes: 35, resetAt: null, limited: false });
  });
});
